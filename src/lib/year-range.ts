import type { SupabaseClient } from "@supabase/supabase-js";
import { beYear, beYearRange, currentBeYear } from "@/lib/format";

/** ค่าที่ผู้ใช้เลือกในตัวกรองปี พ.ศ. — "all" คือตัวเลือก "ทั้งหมด" */
export type YearFilter = { kind: "all" } | { kind: "year"; year: number };

/** แปลงค่าดิบจาก searchParams (`?year=...`) เป็น YearFilter — ไม่มีค่า/"all" = ทั้งหมด (ค่า default) */
export function parseYearParam(raw: string | undefined): YearFilter {
  if (!raw || raw === "all") return { kind: "all" };
  return { kind: "year", year: Number(raw) };
}

/** ช่วงวันที่ ISO ที่ต้อง filter — null หมายถึงไม่ต้อง filter (โหมด "ทั้งหมด") */
export function yearFilterRange(
  filter: YearFilter
): { from: string; to: string } | null {
  if (filter.kind === "all") return null;
  return beYearRange(filter.year);
}

/** รายการปี พ.ศ. เรียงมากไปน้อย สำหรับ dropdown */
export function yearListDescending(latestYear: number, firstYear: number): number[] {
  const years: number[] = [];
  for (let y = latestYear; y >= firstYear; y--) years.push(y);
  return years;
}

async function getYearBounds(
  supabase: SupabaseClient,
  table: string,
  dateColumn: string
): Promise<{ latestYear: number; firstYear: number }> {
  const [{ data: lastRow }, { data: firstRow }] = await Promise.all([
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: false }).limit(1),
    supabase.from(table).select(dateColumn).order(dateColumn, { ascending: true }).limit(1),
  ]);
  const last = (lastRow?.[0] ?? null) as Record<string, string> | null;
  const first = (firstRow?.[0] ?? null) as Record<string, string> | null;
  const latestYear = last ? (beYear(last[dateColumn]) ?? currentBeYear()) : currentBeYear();
  const firstYear = first ? (beYear(first[dateColumn]) ?? currentBeYear()) : currentBeYear();
  return { latestYear, firstYear };
}

/** ปีแรก/ปีล่าสุดที่มีข้อมูลบริจาค (ตาม receipt_date) */
export function getDonationYearBounds(supabase: SupabaseClient) {
  return getYearBounds(supabase, "donations", "receipt_date");
}

/** ปีแรก/ปีล่าสุดที่มีข้อมูลรายจ่าย (ตาม paid_date) */
export function getExpenseYearBounds(supabase: SupabaseClient) {
  return getYearBounds(supabase, "expenses", "paid_date");
}
