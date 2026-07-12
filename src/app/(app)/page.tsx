import Link from "next/link";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatMoney } from "@/lib/format";
import { MonthlyChart, PurposeDonut, YearlyChart } from "@/components/charts";
import YearSelect from "@/components/year-select";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.year);
  const yearLabel = data.year === "all" ? "ทั้งหมด" : data.year;

  const yoy =
    data.prevYearReceived > 0
      ? ((data.yearReceived - data.prevYearReceived) / data.prevYearReceived) * 100
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">
          แดชบอร์ด ปี {yearLabel}
        </h1>
        <YearSelect years={data.years} value={data.year} basePath="/" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">รายรับ ปี {yearLabel}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {formatMoney(data.yearReceived)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {data.yearCount.toLocaleString()} ใบเสร็จ
            {yoy != null && (
              <span className={yoy >= 0 ? "ml-2 text-emerald-700" : "ml-2 text-red-600"}>
                {yoy >= 0 ? "▲" : "▼"} {Math.abs(yoy).toFixed(1)}% จากปี {(data.year as number) - 1}
              </span>
            )}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">รายจ่าย ปี {yearLabel}</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">
            {formatMoney(data.yearSpent)}
          </p>
          <p className="mt-1 text-xs text-slate-400">ตามวันที่จ่ายเงิน</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-xs text-slate-500">ยอดคงเหลือ ปี {yearLabel}</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              data.yearReceived - data.yearSpent >= 0
                ? "text-emerald-700"
                : "text-red-600"
            }`}
          >
            {formatMoney(data.yearReceived - data.yearSpent)}
          </p>
          <p className="mt-1 text-xs text-slate-400">เฉพาะปีที่เลือก</p>
        </div>
        <div className="rounded-2xl bg-teal-700 p-5 text-white shadow-sm">
          <p className="text-xs text-teal-100">ยอดคงเหลือสะสมทั้งหมด</p>
          <p className="mt-1 text-2xl font-bold">
            {formatMoney(data.totalBalance)}
          </p>
          <p className="mt-1 text-xs text-teal-100">ทุกใบเสร็จ ทุกปี</p>
        </div>
      </div>

      {/* กราฟ */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            รายรับ-รายจ่าย รายเดือน ปี {yearLabel}
          </h2>
          <MonthlyChart data={data.monthly} />
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            รายรับตามวัตถุประสงค์ ปี {yearLabel}
          </h2>
          <PurposeDonut data={data.byPurpose} />
        </div>
      </div>

      {/* สรุปตามวัตถุประสงค์ + หมวดหมู่ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SummaryTable
          title={`สรุปตามวัตถุประสงค์ ปี ${yearLabel}`}
          rows={data.byPurpose}
        />
        <SummaryTable
          title={`สรุปตามหมวดหมู่ ปี ${yearLabel}`}
          rows={data.byCategory}
        />
      </div>

      {/* กราฟภาพรวมรายปี (ล่างสุด) */}
      {data.yearly.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            ภาพรวมรายรับ–รายจ่าย–คงเหลือ รายปี (คงเหลือสุทธิ = รับ − จ่าย ของแต่ละปี)
          </h2>
          <YearlyChart data={data.yearly} />
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        ดูรายงานแบบละเอียดและพิมพ์ได้ที่หน้า{" "}
        <Link href={`/reports?year=${data.year}`} className="text-teal-700 hover:underline">
          รายงาน
        </Link>
      </p>
    </div>
  );
}

function SummaryTable({
  title,
  rows,
}: {
  title: string;
  rows: { name: string; received: number; spent: number }[];
}) {
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-2 font-medium">รายการ</th>
            <th className="py-2 text-right font-medium">รายรับ</th>
            <th className="py-2 text-right font-medium">รายจ่าย</th>
            <th className="py-2 text-right font-medium">คงเหลือ</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-slate-400">
                ไม่มีข้อมูล
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-slate-100 last:border-0">
              <td className="py-2">{r.name}</td>
              <td className="py-2 text-right tabular-nums">
                {formatMoney(r.received)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatMoney(r.spent)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatMoney(r.received - r.spent)}
              </td>
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold">
              <td className="py-2">รวม</td>
              <td className="py-2 text-right tabular-nums">
                {formatMoney(totalReceived)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatMoney(totalSpent)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {formatMoney(totalReceived - totalSpent)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
