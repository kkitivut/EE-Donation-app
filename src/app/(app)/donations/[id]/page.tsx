import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatThaiDate } from "@/lib/format";
import { isSafeHttpUrl } from "@/lib/safe-url";
import type { DonationWithRefs, Expense } from "@/lib/types";
import DonationFormButton from "@/components/donation-form";
import PrintButton from "@/components/print-button";

type AllocationRow = {
  id: string;
  amount: number;
  expenses: Expense;
};

export default async function DonationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: donation } = await supabase
    .from("donations")
    .select("*, purposes(name), fd13_codes(code), categories(name)")
    .eq("id", id)
    .single();

  if (!donation) notFound();
  const d = donation as unknown as DonationWithRefs;

  const [{ data: allocations }, { data: purposes }, { data: categories }, { data: fd13Codes }] =
    await Promise.all([
      supabase
        .from("expense_allocations")
        .select("id, amount, expenses(*)")
        .eq("donation_id", id),
      supabase.from("purposes").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("fd13_codes").select("*").order("code"),
    ]);

  const allocs = ((allocations ?? []) as unknown as AllocationRow[]).sort((a, b) =>
    a.expenses.paid_date.localeCompare(b.expenses.paid_date)
  );

  const totalSpent = allocs.reduce((s, a) => s + Number(a.amount), 0);
  const balance = Number(d.amount) - totalSpent;

  let running = Number(d.amount);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/donations" className="text-sm text-teal-700 hover:underline">
          ← กลับรายการบริจาค
        </Link>
        <div className="flex gap-2">
          <DonationFormButton
            purposes={purposes ?? []}
            categories={categories ?? []}
            fd13Codes={fd13Codes ?? []}
            donation={d}
          />
          <PrintButton />
        </div>
      </div>

      {/* หัวใบเสร็จ */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{d.donor_name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              ใบเสร็จเลขที่ <span className="font-semibold text-slate-700">{d.receipt_no}</span>
              {" · "}วันที่ {formatThaiDate(d.receipt_date)}
            </p>
          </div>
          <div className="rounded-xl bg-teal-50 px-5 py-3 text-right">
            <p className="text-xs text-teal-700">ยอดคงเหลือ</p>
            <p className="text-2xl font-bold tabular-nums text-teal-800">
              {formatMoney(balance)}
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">วัตถุประสงค์</dt>
            <dd>{d.purposes?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">รหัส FD13</dt>
            <dd>{d.fd13_codes?.code ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">หมวดหมู่</dt>
            <dd>{d.categories?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">ช่องทาง / บัญชี</dt>
            <dd>
              {d.channel ?? "-"}
              {d.account ? ` / ${d.account}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">วันที่บริจาค</dt>
            <dd>{formatThaiDate(d.donated_date)}</dd>
          </div>
          {d.drive_url && (
            <div className="no-print">
              <dt className="text-xs text-slate-400">เอกสารแนบ</dt>
              <dd>
                {isSafeHttpUrl(d.drive_url) ? (
                  <a
                    href={d.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 hover:underline"
                  >
                    เปิดใน Google Drive ↗
                  </a>
                ) : (
                  <span className="break-all text-slate-500">{d.drive_url}</span>
                )}
              </dd>
            </div>
          )}
          {d.note && (
            <div className="col-span-2">
              <dt className="text-xs text-slate-400">หมายเหตุ</dt>
              <dd>{d.note}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* บัญชีแยกประเภท */}
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">ลำดับ</th>
              <th className="px-4 py-3 font-medium">วันที่</th>
              <th className="px-4 py-3 font-medium">เลขที่ใบเสร็จ/เลขที่ส่งออก</th>
              <th className="px-4 py-3 font-medium">รายการ</th>
              <th className="px-4 py-3 text-right font-medium">รับ (บาท)</th>
              <th className="px-4 py-3 text-right font-medium">จ่าย (บาท)</th>
              <th className="px-4 py-3 text-right font-medium">คงเหลือ (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 bg-emerald-50/50">
              <td className="px-4 py-3">1</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatThaiDate(d.receipt_date)}
              </td>
              <td className="px-4 py-3">{d.receipt_no}</td>
              <td className="px-4 py-3 font-medium text-emerald-700">
                รายรับเงินบริจาคสนับสนุนสถานศึกษา
              </td>
              <td className="px-4 py-3 text-right font-medium tabular-nums text-emerald-700">
                {formatMoney(d.amount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">-</td>
              <td className="px-4 py-3 text-right font-medium tabular-nums">
                {formatMoney(d.amount)}
              </td>
            </tr>
            {allocs.map((a, i) => {
              running -= Number(a.amount);
              return (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">{i + 2}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatThaiDate(a.expenses.paid_date)}
                  </td>
                  <td className="px-4 py-3">{a.expenses.doc_no ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/expenses?q=${encodeURIComponent(a.expenses.doc_no ?? a.expenses.description)}`}
                      className="text-red-600 hover:underline"
                    >
                      {a.expenses.description}
                    </Link>
                    {Number(a.amount) !== Number(a.expenses.total_amount) && (
                      <span className="ml-1 text-xs text-slate-400">
                        (ส่วนของใบนี้ จากยอดจ่ายรวม {formatMoney(a.expenses.total_amount)})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">-</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600">
                    {formatMoney(a.amount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(running)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td colSpan={4} className="px-4 py-3 text-right">
                รวม
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                {formatMoney(d.amount)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-red-600">
                {formatMoney(totalSpent)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatMoney(balance)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
