import { createClient } from "@/lib/supabase/server";
import { beYearRange, currentBeYear, monthOf } from "@/lib/format";

export type MonthlyPoint = {
  month: number;
  received: number;
  spent: number;
};

export type YearlyPoint = {
  year: number;
  received: number;
  spent: number;
};

export type NamedTotal = { name: string; received: number; spent: number };

export type DashboardData = {
  years: number[];
  year: number;
  yearReceived: number;
  yearSpent: number;
  yearCount: number;
  prevYearReceived: number;
  totalBalance: number;
  monthly: MonthlyPoint[];
  yearly: YearlyPoint[];
  byPurpose: NamedTotal[];
  byCategory: NamedTotal[];
};

type DonationRow = {
  amount: number;
  receipt_date: string;
  purposes: { name: string } | null;
  categories: { name: string } | null;
};

type AllocationRow = {
  amount: number;
  expenses: { paid_date: string };
  donations: {
    purposes: { name: string } | null;
    categories: { name: string } | null;
  };
};

const MAX_ROWS = 20000;

export async function getDashboardData(
  yearParam?: string
): Promise<DashboardData> {
  const supabase = await createClient();

  // ปีที่มีข้อมูล
  const [{ data: lastRow }, { data: firstRow }] = await Promise.all([
    supabase
      .from("donations")
      .select("receipt_date")
      .order("receipt_date", { ascending: false })
      .limit(1),
    supabase
      .from("donations")
      .select("receipt_date")
      .order("receipt_date", { ascending: true })
      .limit(1),
  ]);

  const latestYear = lastRow?.[0]
    ? Number(lastRow[0].receipt_date.slice(0, 4)) + 543
    : currentBeYear();
  const firstYear = firstRow?.[0]
    ? Number(firstRow[0].receipt_date.slice(0, 4)) + 543
    : currentBeYear();
  const years: number[] = [];
  for (let y = latestYear; y >= firstYear; y--) years.push(y);

  const year = yearParam ? Number(yearParam) : latestYear;
  const { from, to } = beYearRange(year);
  const prev = beYearRange(year - 1);

  const [
    { data: donations },
    { data: allocations },
    { data: prevDonations },
    { data: overall },
    { data: yearlyRows },
  ] = await Promise.all([
    supabase
      .from("donations")
      .select("amount, receipt_date, purposes(name), categories(name)")
      .gte("receipt_date", from)
      .lte("receipt_date", to)
      .limit(MAX_ROWS),
    supabase
      .from("expense_allocations")
      .select("amount, expenses!inner(paid_date), donations(purposes(name), categories(name))")
      .gte("expenses.paid_date", from)
      .lte("expenses.paid_date", to)
      .limit(MAX_ROWS),
    supabase
      .from("donations")
      .select("amount")
      .gte("receipt_date", prev.from)
      .lte("receipt_date", prev.to)
      .limit(MAX_ROWS),
    supabase.rpc("overall_summary"),
    // สรุปรายปีรวม (สำหรับกราฟเปรียบเทียบรายปี) — รวมยอดฝั่ง Postgres แทนการดึงทั้งตารางมารวมใน JS
    supabase.rpc("yearly_summary"),
  ]);

  const dRows = (donations ?? []) as unknown as DonationRow[];
  const aRows = (allocations ?? []) as unknown as AllocationRow[];

  const monthly: MonthlyPoint[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    received: 0,
    spent: 0,
  }));

  const purposeMap = new Map<string, NamedTotal>();
  const categoryMap = new Map<string, NamedTotal>();

  function bump(
    map: Map<string, NamedTotal>,
    name: string,
    field: "received" | "spent",
    amount: number
  ) {
    const item = map.get(name) ?? { name, received: 0, spent: 0 };
    item[field] += amount;
    map.set(name, item);
  }

  let yearReceived = 0;
  for (const d of dRows) {
    const amt = Number(d.amount);
    yearReceived += amt;
    monthly[monthOf(d.receipt_date) - 1].received += amt;
    bump(purposeMap, d.purposes?.name ?? "ไม่ระบุ", "received", amt);
    bump(categoryMap, d.categories?.name ?? "ไม่ระบุ", "received", amt);
  }

  let yearSpent = 0;
  for (const a of aRows) {
    const amt = Number(a.amount);
    yearSpent += amt;
    monthly[monthOf(a.expenses.paid_date) - 1].spent += amt;
    bump(purposeMap, a.donations?.purposes?.name ?? "ไม่ระบุ", "spent", amt);
    bump(categoryMap, a.donations?.categories?.name ?? "ไม่ระบุ", "spent", amt);
  }

  const prevYearReceived = (prevDonations ?? []).reduce(
    (s, d) => s + Number(d.amount),
    0
  );

  // สรุปรายปีทุกปี — คำนวณฝั่ง Postgres ผ่าน RPC yearly_summary() แล้ว (ดู supabase/schema.sql)
  const yearly: YearlyPoint[] = (
    (yearlyRows ?? []) as unknown as {
      year: number;
      received: number;
      spent: number;
    }[]
  )
    .map((r) => ({
      year: r.year,
      received: Number(r.received),
      spent: Number(r.spent),
    }))
    .sort((a, b) => a.year - b.year);

  const summary = (overall ?? {}) as {
    total_donated?: number;
    total_allocated?: number;
  };
  const totalBalance =
    Number(summary.total_donated ?? 0) - Number(summary.total_allocated ?? 0);

  const sortByReceived = (a: NamedTotal, b: NamedTotal) =>
    b.received - a.received;

  return {
    years,
    year,
    yearReceived,
    yearSpent,
    yearCount: dRows.length,
    prevYearReceived,
    totalBalance,
    monthly,
    yearly,
    byPurpose: [...purposeMap.values()].sort(sortByReceived),
    byCategory: [...categoryMap.values()].sort(sortByReceived),
  };
}
