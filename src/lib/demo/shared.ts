// โครงสร้างคำสั่งคิวรี + QueryBuilder ที่ปลอดภัยทั้งฝั่ง server และ browser
// (ไม่แตะ Node API ใดๆ — ฝั่ง server รันจริงในเครื่อง, ฝั่ง browser ส่งไปรันที่ /api/demo/query)

export type Filter =
  | { kind: "eq"; key: string; value: unknown }
  | { kind: "gte"; key: string; value: unknown }
  | { kind: "lte"; key: string; value: unknown }
  | { kind: "in"; key: string; value: unknown[] }
  | { kind: "ilike"; key: string; value: string }
  | { kind: "or"; raw: string };

export type QueryOp = "select" | "insert" | "update" | "delete";

export type QueryState = {
  table: string;
  op: QueryOp;
  selectStr: string;
  wantCount: boolean;
  filters: Filter[];
  orders: { col: string; ascending: boolean }[];
  rangeFrom: number | null;
  rangeTo: number | null;
  limitN: number | null;
  singleFlag: boolean;
  payload: unknown;
};

export type QueryResult<T = unknown> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
};

export type Executor = (state: QueryState) => Promise<QueryResult>;

function initialState(table: string): QueryState {
  return {
    table,
    op: "select",
    selectStr: "*",
    wantCount: false,
    filters: [],
    orders: [],
    rangeFrom: null,
    rangeTo: null,
    limitN: null,
    singleFlag: false,
    payload: null,
  };
}

/** Query builder ที่ทำงานเหมือน supabase-js postgrest builder เท่าที่แอปนี้ใช้จริง */
export class QueryBuilder<T = unknown> implements PromiseLike<QueryResult<T>> {
  private state: QueryState;
  private executor: Executor;

  constructor(table: string, executor: Executor) {
    this.state = initialState(table);
    this.executor = executor;
  }

  select(sel = "*", opts?: { count?: "exact" }) {
    this.state.selectStr = sel;
    if (opts?.count === "exact") this.state.wantCount = true;
    return this;
  }
  eq(key: string, value: unknown) {
    this.state.filters.push({ kind: "eq", key, value });
    return this;
  }
  gte(key: string, value: unknown) {
    this.state.filters.push({ kind: "gte", key, value });
    return this;
  }
  lte(key: string, value: unknown) {
    this.state.filters.push({ kind: "lte", key, value });
    return this;
  }
  in(key: string, value: unknown[]) {
    this.state.filters.push({ kind: "in", key, value });
    return this;
  }
  ilike(key: string, value: string) {
    this.state.filters.push({ kind: "ilike", key, value });
    return this;
  }
  or(raw: string) {
    this.state.filters.push({ kind: "or", raw });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.state.orders.push({ col, ascending: opts?.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.state.rangeFrom = from;
    this.state.rangeTo = to;
    return this;
  }
  limit(n: number) {
    this.state.limitN = n;
    return this;
  }
  single() {
    this.state.singleFlag = true;
    return this;
  }
  insert(payload: unknown) {
    this.state.op = "insert";
    this.state.payload = payload;
    return this;
  }
  update(payload: unknown) {
    this.state.op = "update";
    this.state.payload = payload;
    return this;
  }
  delete() {
    this.state.op = "delete";
    return this;
  }

  then<R1 = QueryResult<T>, R2 = never>(
    onFulfilled?: ((value: QueryResult<T>) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.executor(this.state).then(
      onFulfilled as (value: QueryResult) => R1 | PromiseLike<R1>,
      onRejected
    );
  }
}

export type DemoUser = { id: string; email: string };
export type RpcExecutor = (name: string, args: unknown) => Promise<QueryResult>;

/** ออบเจ็กต์ที่มีหน้าตาเหมือน supabase-js client เท่าที่แอปนี้เรียกใช้จริง */
export function createDemoSupabase(
  queryExecutor: Executor,
  rpcExecutor: RpcExecutor,
  user: DemoUser
) {
  return {
    from<T = unknown>(table: string) {
      return new QueryBuilder<T>(table, queryExecutor);
    },
    rpc(name: string, args?: unknown) {
      return rpcExecutor(name, args ?? {});
    },
    auth: {
      async getUser() {
        return { data: { user }, error: null };
      },
      async signInWithPassword() {
        return { data: { user, session: {} }, error: null };
      },
      async signOut() {
        return { error: null };
      },
    },
  };
}
