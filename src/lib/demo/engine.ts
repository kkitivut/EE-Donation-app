import "server-only";
import { SEED, type SeedDb } from "./seed";
import type { Filter, QueryResult, QueryState } from "./shared";
import { beYear } from "@/lib/format";
import { splitOrTopLevel, unquoteValue } from "./or-filter";

type Row = Record<string, unknown>;
type TableName = keyof SeedDb;

const UNIQUE_FIELD: Partial<Record<TableName, string>> = {
  donations: "receipt_no",
  purposes: "name",
  fd13_codes: "code",
  categories: "name",
};

type ForwardFk = { from: TableName; fkCol: string; to: TableName; as: string };
type ReverseFk = { from: TableName; to: TableName; childFkCol: string; as: string };

const FORWARD: ForwardFk[] = [
  { from: "donations", fkCol: "purpose_id", to: "purposes", as: "purposes" },
  { from: "donations", fkCol: "fd13_id", to: "fd13_codes", as: "fd13_codes" },
  { from: "donations", fkCol: "category_id", to: "categories", as: "categories" },
  { from: "expense_allocations", fkCol: "expense_id", to: "expenses", as: "expenses" },
  { from: "expense_allocations", fkCol: "donation_id", to: "donations", as: "donations" },
];

const REVERSE: ReverseFk[] = [
  { from: "expenses", to: "expense_allocations", childFkCol: "expense_id", as: "expense_allocations" },
];

// ===== ที่เก็บข้อมูล (คงอยู่ตลอดอายุ dev server process) =====

const g = globalThis as unknown as { __ddeeDemoDb?: SeedDb };

function freshSeed(): SeedDb {
  return JSON.parse(JSON.stringify(SEED)) as SeedDb;
}

function getDb(): SeedDb {
  if (!g.__ddeeDemoDb) g.__ddeeDemoDb = freshSeed();
  return g.__ddeeDemoDb;
}

function getTable(name: TableName): Row[] {
  return getDb()[name] as Row[];
}

export function resetDemoDb() {
  g.__ddeeDemoDb = freshSeed();
}

// ===== select-string parser =====

type SelectNode = {
  star: boolean;
  cols: string[];
  embeds: { as: string; node: SelectNode }[];
};

function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function parseSelect(sel: string): SelectNode {
  const node: SelectNode = { star: false, cols: [], embeds: [] };
  for (let tok of splitTopLevel(sel)) {
    tok = tok.trim();
    if (!tok) continue;
    if (tok === "*") {
      node.star = true;
      continue;
    }
    const m = tok.match(/^([a-zA-Z0-9_]+)(?:!inner)?\(([\s\S]*)\)$/);
    if (m) {
      node.embeds.push({ as: m[1], node: parseSelect(m[2]) });
    } else {
      node.cols.push(tok);
    }
  }
  return node;
}

function project(table: TableName, row: Row, node: SelectNode): Row {
  const out: Row = {};
  if (node.star) Object.assign(out, row);
  for (const c of node.cols) out[c] = row[c];
  for (const e of node.embeds) {
    const fwd = FORWARD.find((f) => f.from === table && f.as === e.as);
    if (fwd) {
      const relId = row[fwd.fkCol];
      const rel = relId ? getTable(fwd.to).find((r) => r.id === relId) : null;
      out[e.as] = rel ? project(fwd.to, rel, e.node) : null;
      continue;
    }
    const rev = REVERSE.find((f) => f.from === table && f.as === e.as);
    if (rev) {
      const children = getTable(rev.to).filter((r) => r[rev.childFkCol] === row.id);
      out[e.as] = children.map((c) => project(rev.to, c, e.node));
    }
  }
  return out;
}

// ===== filter evaluation =====

function matchIlike(val: unknown, pattern: string): boolean {
  if (val == null) return false;
  const needle = pattern.replace(/^%/, "").replace(/%$/, "").toLowerCase();
  return String(val).toLowerCase().includes(needle);
}

function resolveDotted(
  table: TableName,
  row: Row,
  key: string
): { ok: boolean; val: unknown } {
  const [relAs, col] = key.split(".");
  const fwd = FORWARD.find((f) => f.from === table && f.as === relAs);
  if (fwd) {
    const relId = row[fwd.fkCol];
    const rel = relId ? getTable(fwd.to).find((r) => r.id === relId) : null;
    return rel ? { ok: true, val: rel[col] } : { ok: false, val: undefined };
  }
  return { ok: false, val: undefined };
}

function passFilter(table: TableName, row: Row, f: Filter): boolean {
  switch (f.kind) {
    case "eq": {
      if (f.key.includes(".")) {
        const [relAs, col] = f.key.split(".");
        const rev = REVERSE.find((r) => r.from === table && r.as === relAs);
        if (rev) {
          const children = getTable(rev.to).filter((r) => r[rev.childFkCol] === row.id);
          return children.some((c) => c[col] === f.value);
        }
        const { ok, val } = resolveDotted(table, row, f.key);
        return ok && val === f.value;
      }
      return row[f.key] === f.value;
    }
    case "gte": {
      if (f.key.includes(".")) {
        const { ok, val } = resolveDotted(table, row, f.key);
        return ok && (val as string) >= (f.value as string);
      }
      return (row[f.key] as string) >= (f.value as string);
    }
    case "lte": {
      if (f.key.includes(".")) {
        const { ok, val } = resolveDotted(table, row, f.key);
        return ok && (val as string) <= (f.value as string);
      }
      return (row[f.key] as string) <= (f.value as string);
    }
    case "in":
      return f.value.includes(row[f.key]);
    case "ilike":
      return matchIlike(row[f.key], f.value);
    case "or": {
      const parts = splitOrTopLevel(f.raw);
      return parts.some((part) => {
        const segs = part.split(".");
        const col = segs[0];
        const op = segs[1];
        const value = unquoteValue(segs.slice(2).join("."));
        if (op === "ilike") return matchIlike(row[col], value);
        if (op === "eq") return String(row[col]) === value;
        return false;
      });
    }
    default:
      return true;
  }
}

// ===== view: donation_balances (คำนวณสดจาก donations + expense_allocations) =====

function computeDonationBalances(): Row[] {
  const allocations = getTable("expense_allocations");
  return getTable("donations").map((d) => {
    const allocated = allocations
      .filter((a) => a.donation_id === d.id)
      .reduce((s, a) => s + Number(a.amount), 0);
    const amount = Number(d.amount);
    return {
      donation_id: d.id,
      amount,
      allocated,
      balance: Math.round((amount - allocated) * 100) / 100,
    };
  });
}

// ===== view: donations_list_view (คำนวณสดจาก donations + purposes + categories + expense_allocations) =====

function computeDonationsListView(): Row[] {
  const allocations = getTable("expense_allocations");
  const purposes = getTable("purposes");
  const categories = getTable("categories");
  return getTable("donations").map((d) => {
    const allocated = allocations
      .filter((a) => a.donation_id === d.id)
      .reduce((s, a) => s + Number(a.amount), 0);
    const purpose = purposes.find((p) => p.id === d.purpose_id);
    const category = categories.find((c) => c.id === d.category_id);
    return {
      id: d.id,
      receipt_no: d.receipt_no,
      donor_name: d.donor_name,
      amount: d.amount,
      receipt_date: d.receipt_date,
      purpose_id: d.purpose_id,
      category_id: d.category_id,
      purpose_name: purpose?.name ?? null,
      category_name: category?.name ?? null,
      balance: Math.round((Number(d.amount) - allocated) * 100) / 100,
    };
  });
}

// ===== select / insert / update / delete =====

function doSelect(state: QueryState): QueryResult {
  const isBalanceView = state.table === "donation_balances";
  const isDonationsListView = state.table === "donations_list_view";
  const table = state.table as TableName;
  const baseRows = isBalanceView
    ? computeDonationBalances()
    : isDonationsListView
      ? computeDonationsListView()
      : getTable(table);
  let rows = baseRows.filter((r) => state.filters.every((f) => passFilter(table, r, f)));
  const count = rows.length;

  if (state.orders.length) {
    for (const o of [...state.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const av = a[o.col] as string | number;
        const bv = b[o.col] as string | number;
        if (av === bv) return 0;
        const cmp = av < bv ? -1 : 1;
        return o.ascending ? cmp : -cmp;
      });
    }
  }

  if (state.rangeFrom != null && state.rangeTo != null) {
    rows = rows.slice(state.rangeFrom, state.rangeTo + 1);
  } else if (state.limitN != null) {
    rows = rows.slice(0, state.limitN);
  }

  const node = parseSelect(state.selectStr);
  const projected = rows.map((r) => project(table, r, node));

  if (state.singleFlag) {
    if (projected.length === 0) {
      return { data: null, error: { message: "ไม่พบข้อมูล", code: "PGRST116" } };
    }
    return { data: projected[0], error: null };
  }
  const result: QueryResult = { data: projected, error: null };
  if (state.wantCount) result.count = count;
  return result;
}

function makeDefaults(table: TableName, now: string): Row {
  const base: Row = { id: `gen-${Math.random().toString(36).slice(2, 11)}-${Date.now()}` };
  if (table === "purposes" || table === "fd13_codes" || table === "categories") {
    base.active = true;
    base.created_at = now;
  } else if (table === "donations" || table === "expenses") {
    base.created_at = now;
    base.updated_at = now;
  } else if (table === "expense_allocations") {
    base.created_at = now;
  }
  return base;
}

function doInsert(state: QueryState): QueryResult {
  const table = state.table as TableName;
  const target = getTable(table);
  const items = (Array.isArray(state.payload) ? state.payload : [state.payload]) as Row[];
  const uniqueField = UNIQUE_FIELD[table];

  if (uniqueField) {
    for (const item of items) {
      const val = item[uniqueField];
      const dupInTable = target.some((r) => r[uniqueField] === val);
      const dupInBatch = items.filter((i) => i[uniqueField] === val).length > 1;
      if (dupInTable || dupInBatch) {
        return {
          data: null,
          error: { message: `ค่า "${val}" มีอยู่แล้ว`, code: "23505" },
        };
      }
    }
  }

  const now = new Date().toISOString();
  const created = items.map((item) => ({ ...makeDefaults(table, now), ...item }));
  target.push(...created);

  if (state.singleFlag) return { data: created[0], error: null };
  return { data: created, error: null };
}

function doUpdate(state: QueryState): QueryResult {
  const table = state.table as TableName;
  const target = getTable(table);
  const matched = target.filter((r) => state.filters.every((f) => passFilter(table, r, f)));
  const payload = state.payload as Row;

  if (matched.length === 0) {
    return { data: state.singleFlag ? null : [], error: null };
  }

  const uniqueField = UNIQUE_FIELD[table];
  if (uniqueField && payload[uniqueField] != null) {
    const val = payload[uniqueField];
    const clash = target.some((r) => r[uniqueField] === val && !matched.includes(r));
    if (clash) {
      return { data: null, error: { message: `ค่า "${val}" มีอยู่แล้ว`, code: "23505" } };
    }
  }

  if (table === "donations" && payload.amount != null) {
    for (const row of matched) {
      const allocated = getTable("expense_allocations")
        .filter((a) => a.donation_id === row.id)
        .reduce((s, a) => s + Number(a.amount), 0);
      if (Number(payload.amount) < allocated) {
        return {
          data: null,
          error: {
            message: `ยอดใบเสร็จต่ำกว่ายอดที่ตัดจ่ายไปแล้ว (${allocated.toLocaleString()})`,
            code: "23514",
          },
        };
      }
    }
  }

  const now = new Date().toISOString();
  for (const row of matched) {
    Object.assign(row, payload, { updated_at: now });
  }

  if (state.singleFlag) return { data: matched[0], error: null };
  return { data: matched, error: null };
}

function doDelete(state: QueryState): QueryResult {
  const table = state.table as TableName;
  const target = getTable(table);
  const matched = target.filter((r) => state.filters.every((f) => passFilter(table, r, f)));

  if (table === "purposes" || table === "fd13_codes" || table === "categories") {
    const fkCol =
      table === "purposes" ? "purpose_id" : table === "fd13_codes" ? "fd13_id" : "category_id";
    for (const row of matched) {
      if (getTable("donations").some((d) => d[fkCol] === row.id)) {
        return {
          data: null,
          error: { message: "มีข้อมูลใช้รายการนี้อยู่", code: "23503" },
        };
      }
    }
  }

  if (table === "donations") {
    for (const row of matched) {
      if (getTable("expense_allocations").some((a) => a.donation_id === row.id)) {
        return {
          data: null,
          error: { message: "มีรายจ่ายตัดเงินจากใบเสร็จนี้อยู่", code: "23503" },
        };
      }
    }
  }

  for (const row of matched) {
    const idx = target.indexOf(row);
    if (idx >= 0) target.splice(idx, 1);
    if (table === "expenses") {
      const allocs = getTable("expense_allocations");
      for (let i = allocs.length - 1; i >= 0; i--) {
        if (allocs[i].expense_id === row.id) allocs.splice(i, 1);
      }
    }
  }

  return { data: null, error: null };
}

export function executeQuery(state: QueryState): QueryResult {
  if (state.op === "insert") return doInsert(state);
  if (state.op === "update") return doUpdate(state);
  if (state.op === "delete") return doDelete(state);
  return doSelect(state);
}

// ===== RPC =====

type SaveExpenseArgs = {
  p_expense_id: string | null;
  p_doc_no: string | null;
  p_paid_date: string;
  p_description: string;
  p_total_amount: number;
  p_drive_url: string | null;
  p_note: string | null;
  p_allocations: { donation_id: string; amount: number }[];
};

function rpcSaveExpense(args: SaveExpenseArgs): QueryResult {
  const sum = args.p_allocations.reduce((s, a) => s + Number(a.amount), 0);
  if (Math.round(sum * 100) !== Math.round(Number(args.p_total_amount) * 100)) {
    return {
      data: null,
      error: {
        message: `ผลรวมการตัดเงิน (${sum.toLocaleString()}) ไม่เท่ากับยอดจ่าย (${args.p_total_amount.toLocaleString()})`,
        code: "P0001", // mirror save_expense RPC จริงที่ใช้ raise exception
      },
    };
  }

  const expenses = getTable("expenses");
  const allocations = getTable("expense_allocations");
  const donations = getTable("donations");
  const now = new Date().toISOString();

  let expenseId: string;
  if (!args.p_expense_id) {
    expenseId = `gen-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`;
    expenses.push({
      id: expenseId,
      doc_no: args.p_doc_no,
      paid_date: args.p_paid_date,
      description: args.p_description,
      total_amount: args.p_total_amount,
      drive_url: args.p_drive_url,
      note: args.p_note,
      created_at: now,
      updated_at: now,
    });
  } else {
    expenseId = args.p_expense_id;
    const exp = expenses.find((e) => e.id === expenseId);
    if (!exp)
      return { data: null, error: { message: "ไม่พบรายจ่ายนี้", code: "P0001" } };
    Object.assign(exp, {
      doc_no: args.p_doc_no,
      paid_date: args.p_paid_date,
      description: args.p_description,
      total_amount: args.p_total_amount,
      drive_url: args.p_drive_url,
      note: args.p_note,
      updated_at: now,
    });
    for (let i = allocations.length - 1; i >= 0; i--) {
      if (allocations[i].expense_id === expenseId) allocations.splice(i, 1);
    }
  }

  for (const a of args.p_allocations) {
    const donation = donations.find((d) => d.id === a.donation_id);
    if (!donation)
      return {
        data: null,
        error: { message: "ไม่พบใบเสร็จที่เลือก", code: "P0001" },
      };
    const already = allocations
      .filter((x) => x.donation_id === a.donation_id)
      .reduce((s, x) => s + Number(x.amount), 0);
    if (already + Number(a.amount) > Number(donation.amount) + 0.005) {
      return {
        data: null,
        error: {
          message: `ยอดตัดเงินรวมเกินยอดใบเสร็จ ${donation.receipt_no}`,
          code: "P0001",
        },
      };
    }
  }

  for (const a of args.p_allocations) {
    allocations.push({
      id: `gen-${Math.random().toString(36).slice(2, 11)}-${Date.now()}`,
      expense_id: expenseId,
      donation_id: a.donation_id,
      amount: a.amount,
      created_at: now,
    });
  }

  return { data: expenseId, error: null };
}

function rpcOverallSummary(): QueryResult {
  const donations = getTable("donations");
  const allocations = getTable("expense_allocations");
  return {
    data: {
      total_donated: donations.reduce((s, d) => s + Number(d.amount), 0),
      total_allocated: allocations.reduce((s, a) => s + Number(a.amount), 0),
      donation_count: donations.length,
    },
    error: null,
  };
}

function rpcYearlySummary(): QueryResult {
  const donations = getTable("donations");
  const allocations = getTable("expense_allocations");
  const expenses = getTable("expenses");

  const receivedByYear = new Map<number, number>();
  for (const d of donations) {
    const y = beYear(d.receipt_date as string);
    if (y == null) continue;
    receivedByYear.set(y, (receivedByYear.get(y) ?? 0) + Number(d.amount));
  }

  const spentByYear = new Map<number, number>();
  for (const a of allocations) {
    const expense = expenses.find((e) => e.id === a.expense_id);
    const y = expense ? beYear(expense.paid_date as string) : null;
    if (y == null) continue;
    spentByYear.set(y, (spentByYear.get(y) ?? 0) + Number(a.amount));
  }

  const years = new Set([...receivedByYear.keys(), ...spentByYear.keys()]);
  const data = [...years]
    .sort((a, b) => a - b)
    .map((year) => ({
      year,
      received: receivedByYear.get(year) ?? 0,
      spent: spentByYear.get(year) ?? 0,
    }));

  return { data, error: null };
}

export function executeRpc(name: string, args: unknown): QueryResult {
  if (name === "save_expense") return rpcSaveExpense(args as SaveExpenseArgs);
  if (name === "overall_summary") return rpcOverallSummary();
  if (name === "yearly_summary") return rpcYearlySummary();
  return { data: null, error: { message: `ไม่รู้จัก RPC: ${name}` } };
}
