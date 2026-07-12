import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { beYearRange, currentBeYear, formatMoney, formatThaiDate } from "@/lib/format";
import type { DonationBalance, DonationWithRefs } from "@/lib/types";
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
  const [
    { data: purposes },
    { data: categories },
    { data: fd13Codes },
    { data: yearRows },
    { data: yearRowsFirst },
  ] = await Promise.all([
    supabase.from("purposes").select("*").order("sort_order"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("fd13_codes").select("*").order("code"),
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

  const latestYear = yearRows?.[0]
    ? Number(yearRows[0].receipt_date.slice(0, 4)) + 543
    : currentBeYear();
  const firstYear = yearRowsFirst?.[0]
    ? Number(yearRowsFirst[0].receipt_date.slice(0, 4)) + 543
    : currentBeYear();
  const years: number[] = [];
  for (let y = latestYear; y >= firstYear; y--) years.push(y);

  const selectedYear = params.year ? Number(params.year) : latestYear;
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("donations")
    .select("*, purposes(name), fd13_codes(code), categories(name)", {
      count: "exact",
    });

  if (selectedYear) {
    const { from, to } = beYearRange(selectedYear);
    query = query.gte("receipt_date", from).lte("receipt_date", to);
  }
  if (params.purpose) query = query.eq("purpose_id", params.purpose);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.q) {
    query = query.or(
      `donor_name.ilike.%${params.q}%,receipt_no.ilike.%${params.q}%`
    );
  }

  const {
    data: donations,
    count,
    error,
  } = await query
    .order("receipt_date", { ascending: false })
    .order("receipt_no", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const rows = (donations ?? []) as unknown as DonationWithRefs[];

  let balances = new Map<string, DonationBalance>();
  if (rows.length > 0) {
    const { data: balanceRows } = await supabase
      .from("donation_balances")
      .select("*")
      .in(
        "donation_id",
        rows.map((d) => d.id)
      );
    balances = new Map(
      (balanceRows ?? []).map((b: DonationBalance) => [b.donation_id, b])
    );
  }

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
            options: years.map((y) => ({ value: String(y), label: String(y) })),
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
          เกิดข้อผิดพลาด: {error.message}
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
              const bal = balances.get(d.id);
              const balance = bal ? bal.balance : d.amount;
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
                  <td className="px-4 py-3">{d.purposes?.name ?? "-"}</td>
                  <td className="px-4 py-3">{d.categories?.name ?? "-"}</td>
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
