import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatThaiDate } from "@/lib/format";
import {
  getDonationYearBounds,
  parseYearParam,
  yearFilterRange,
  yearListDescending,
} from "@/lib/year-range";
import { orIlikeFilter } from "@/lib/search";
import { toUserMessage } from "@/lib/error-message";
import type { DonationListRow } from "@/lib/types";
import DonationFormButton from "@/components/donation-form";
import FilterBar from "@/components/filter-bar";

const PAGE_SIZE = 50;

export default async function DonationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    purpose?: string;
    category?: string;
    q?: string;
    page?: string;
    balance?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  // ดึงทุก query ที่ไม่พึ่งกันพร้อมกัน (ลด latency)
  const [{ data: purposes }, { data: categories }, { data: fd13Codes }, yearBounds] =
    await Promise.all([
      supabase.from("purposes").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("fd13_codes").select("*").order("code"),
      getDonationYearBounds(supabase),
    ]);

  const { latestYear, firstYear } = yearBounds;
  const years = yearListDescending(latestYear, firstYear);
  const yearFilter = parseYearParam(params.year);
  const selectedYear: number | "all" =
    yearFilter.kind === "all" ? "all" : yearFilter.year;
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("donations_list_view")
    .select("*", { count: "exact" });

  const range = yearFilterRange(yearFilter);
  if (range) {
    query = query.gte("receipt_date", range.from).lte("receipt_date", range.to);
  }
  if (params.purpose) query = query.eq("purpose_id", params.purpose);
  if (params.category) query = query.eq("category_id", params.category);
  const q = params.q?.trim() ?? "";
  if (q) {
    query = query.or(orIlikeFilter(["donor_name", "receipt_no"], q));
  }

  const {
    data: donations,
    count,
    error,
  } = await query
    .order("receipt_date", { ascending: false })
    .order("receipt_no", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const rows = (donations ?? []) as unknown as DonationListRow[];

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (params.year) sp.set("year", params.year);
    if (params.purpose) sp.set("purpose", params.purpose);
    if (params.category) sp.set("category", params.category);
    if (params.q) sp.set("q", params.q);
    sp.set("page", String(p));
    return `/donations?${sp.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">รายการบริจาค</h1>
        <DonationFormButton
          purposes={purposes ?? []}
          categories={categories ?? []}
          fd13Codes={fd13Codes ?? []}
        />
      </div>

      {/* ตัวกรอง */}
      <FilterBar
        basePath="/donations"
        fields={[
          {
            type: "select",
            name: "year",
            label: "ปี พ.ศ.",
            value: String(selectedYear),
            options: [
              { value: "all", label: "ทั้งหมด" },
              ...years.map((y) => ({ value: String(y), label: String(y) })),
            ],
          },
          {
            type: "select",
            name: "purpose",
            label: "วัตถุประสงค์",
            value: params.purpose ?? "",
            options: [
              { value: "", label: "ทั้งหมด" },
              ...(purposes ?? []).map((p) => ({ value: p.id, label: p.name })),
            ],
          },
          {
            type: "select",
            name: "category",
            label: "หมวดหมู่",
            value: params.category ?? "",
            options: [
              { value: "", label: "ทั้งหมด" },
              ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
            ],
          },
          {
            type: "text",
            name: "q",
            label: "ค้นหา (ชื่อผู้บริจาค / เลขที่ใบเสร็จ)",
            value: params.q ?? "",
            placeholder: "เช่น RC1055845",
          },
        ]}
      />

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {toUserMessage(error, "โหลดข้อมูลไม่สำเร็จ")}
        </p>
      )}

      {/* ตาราง */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">เลขที่ใบเสร็จ</th>
              <th className="px-4 py-3 font-medium">วันที่ในใบเสร็จ</th>
              <th className="px-4 py-3 font-medium">ผู้บริจาค</th>
              <th className="px-4 py-3 text-right font-medium">จำนวนเงิน</th>
              <th className="px-4 py-3 text-right font-medium">คงเหลือ</th>
              <th className="px-4 py-3 font-medium">วัตถุประสงค์</th>
              <th className="px-4 py-3 font-medium">หมวดหมู่</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
            {rows.map((d) => {
              const balance = d.balance;
              return (
                <tr
                  key={d.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-teal-700">
                    <Link href={`/donations/${d.id}`} className="hover:underline">
                      {d.receipt_no}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatThaiDate(d.receipt_date)}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3">
                    {d.donor_name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(d.amount)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      balance === 0 ? "text-slate-400" : "font-semibold text-emerald-700"
                    }`}
                  >
                    {formatMoney(balance)}
                  </td>
                  <td className="px-4 py-3">{d.purpose_name ?? "-"}</td>
                  <td className="px-4 py-3">{d.category_name ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/donations/${d.id}`}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                    >
                      ดูรายละเอียด
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          ทั้งหมด {count ?? 0} รายการ · หน้า {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              ← ก่อนหน้า
            </Link>
          )}
          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
            >
              ถัดไป →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
