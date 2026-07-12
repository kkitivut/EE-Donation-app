import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDemoSupabase, type QueryResult, type QueryState } from "@/lib/demo/shared";
import { DEMO_MODE, DEMO_USER } from "@/lib/demo/config";

async function demoQuery(state: QueryState): Promise<QueryResult> {
  const res = await fetch("/api/demo/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
  return res.json();
}

async function demoRpc(name: string, args: unknown): Promise<QueryResult> {
  const res = await fetch("/api/demo/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "rpc", name, args }),
  });
  return res.json();
}

export function createClient(): SupabaseClient {
  if (DEMO_MODE) {
    return createDemoSupabase(
      demoQuery,
      demoRpc,
      DEMO_USER
    ) as unknown as SupabaseClient;
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
