import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { beYearRange, currentBeYear, formatMoney, formatThaiDate } from "@/lib/format";
import type { Expense } from "@/lib/types";
import ExpenseFormButton from "@/components/expense-form";
import FilterBar from "@/components/filter-bar";

const PAGE_SIZE = 50;

type ExpenseRow = Expense & {
  expense_allocations: {
    id: string;
    amount: number;
    donation_id: string;
    donations: { id: string; receipt_no: string; donor_name: string };
  }[];
};

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: lastRow }, { data: firstRow }] = await Promise.all([
    supabase
      .from("expenses")
      .select("paid_date")
      .order("paid_date", { ascending: false })
      .limit(1),
    supabase
      .from("expenses")
      .select("paid_date")
      .order("paid_date", { ascending: true })
      .limit(1),
  ]);

  const latestYear = lastRow?.[0]
    ? Number(lastRow[0].paid_date.slice(0, 4)) + 543
    : currentBeYear();
  const firstYear = firstRow?.[0]
    ? Number(firstRow[0].paid_date.slice(0, 4)) + 543
    : currentBeYear();
  const years: number[] = [];
  for (let y = latestYear; y >= firstYear; y--) years.push(y);

  const selectedYear = params.year ? Number(params.year) : latestYear;
  const page = Math.max(1, Number(params.page) || 1);

  let query = supabase
    .from("expenses")
    .select(
      "*, expense_allocations(id, amount, donation_id, donations(id, receipt_no, donor_name))",
      { count: "exact" }
    );

  if (selectedYear) {
    const { from, to } = beYearRange(selectedYear);
    query = query.gte("paid_date", from).lte("paid_date", to);
  }
  if (params.q) {
    query = query.or(
      `description.ilike.%${params.q}%,doc_no.ilike.%${params.q}%`
    );
  }

  const { data: expenses, count, error } = await query
    .order("paid_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const rows = (expenses ?? []) as unknown as ExpenseRow[];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (params.year) sp.set("year", params.year);
    if (params.q) sp.set("q", params.q);
    sp.set("page", String(p));
    return `/expenses?${sp.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">รายจ่าย</h1>
        <ExpenseFormButton />
      </div>

      <FilterBar
        basePath="/expenses"
        fields={[
          {
            type: "select",
            name: "year",
            label: "ปี พ.ศ. (ตามวันที่จ่าย)",
            value: String(selectedYear),
            options: years.map((y) => ({ value: String(y), label: String(y) })),
          },
          {
            type: "text",
            name: "q",
            label: "ค้นหา (รายการ / เลขที่ส่งออก)",
            value: params.q ?? "",
            placeholder: "เช่น ทุนการศึกษา, ท.13/69",
          },
        ]}
      />

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          เกิดข้อผิดพลาด: {error.message}
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">วันที่จ่าย</th>
              <th className="px-4 py-3 font-medium">เลขที่ส่งออก</th>
              <th className="px-4 py-3 font-medium">รายการ</th>
              <th className="px-4 py-3 text-right font-medium">ยอดจ่าย</th>
              <th className="px-4 py-3 font-medium">ตัดจากใบเสร็จ</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
            {rows.map((e) => (
              <tr
                key={e.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  {formatThaiDate(e.paid_date)}
                </td>
                <td className="px-4 py-3">{e.doc_no ?? "-"}</td>
                <td className="max-w-[300px] px-4 py-3">{e.description}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-red-600">
                  {formatMoney(e.total_amount)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {e.expense_allocations.map((a) => (
                      <Link
                        key={a.id}
                        href={`/donations/${a.donations.id}`}
                        title={`${a.donations.donor_name} — ${formatMoney(a.amount)} บาท`}
                        className="rounded-full bg-teal-50 px-2 py-0.5 text-xs text-teal-800 hover:bg-teal-100"
                      >
                        {a.donations.receipt_no}
                        {e.expense_allocations.length > 1 &&
                          ` (${formatMoney(a.amount)})`}
                      </Link>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <ExpenseFormButton expense={e} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
