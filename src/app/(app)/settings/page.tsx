import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LookupManager from "@/components/lookup-manager";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [{ data: purposes }, { data: fd13Codes }, { data: categories }] =
    await Promise.all([
      supabase.from("purposes").select("*").order("sort_order"),
      supabase.from("fd13_codes").select("*").order("code"),
      supabase.from("categories").select("*").order("name"),
    ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">ตั้งค่า</h1>
        <Link
          href="/settings/import"
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
        >
          📥 นำเข้าข้อมูลจาก Excel
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <LookupManager
          table="purposes"
          title="วัตถุประสงค์ในการบริจาค"
          nameField="name"
          items={(purposes ?? []).map((p) => ({
            id: p.id,
            name: p.name,
            active: p.active,
          }))}
        />
        <LookupManager
          table="fd13_codes"
          title="รหัส FD13"
          nameField="code"
          items={(fd13Codes ?? []).map((c) => ({
            id: c.id,
            name: c.code,
            active: c.active,
          }))}
        />
        <LookupManager
          table="categories"
          title="หมวดหมู่"
          nameField="name"
          items={(categories ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            active: c.active,
          }))}
        />
      </div>

      <p className="text-xs text-slate-400">
        รายการที่เคยถูกใช้งานแล้วลบไม่ได้ แต่ปิดการใช้งานได้ —
        รายการที่ปิดจะไม่ขึ้นในฟอร์มเพิ่มข้อมูลใหม่ แต่ข้อมูลเก่ายังแสดงผลตามเดิม
      </p>
    </div>
  );
}
