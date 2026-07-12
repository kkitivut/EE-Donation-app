import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO_MODE, DEMO_USER } from "@/lib/demo/config";

export async function createClient(): Promise<SupabaseClient> {
  if (DEMO_MODE) {
    const { createDemoSupabase } = await import("@/lib/demo/shared");
    const { executeQuery, executeRpc } = await import("@/lib/demo/engine");
    return createDemoSupabase(
      async (state) => executeQuery(state),
      async (name, args) => executeRpc(name, args),
      DEMO_USER
    ) as unknown as SupabaseClient;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // เรียกจาก Server Component — middleware จะจัดการ refresh session ให้
          }
        },
      },
    }
  );
}
