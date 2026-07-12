import type { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** ออกจากระบบแล้วเด้งไปหน้า login — ใช้ร่วมกันทั้งปุ่ม logout เดิมและ session-guard */
export async function signOutAndRedirect(router: ReturnType<typeof useRouter>) {
  const supabase = createClient();
  await supabase.auth.signOut();
  router.push("/login");
  router.refresh();
}
