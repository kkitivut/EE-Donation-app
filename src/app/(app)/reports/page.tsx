import { getDashboardData } from "@/lib/dashboard-data";
import { THAI_MONTHS_SHORT, formatMoney } from "@/lib/format";
import PrintButton from "@/components/print-button";
import YearSelect from "@/components/year-select";
import ExportCsvButton from "@/components/export-csv-button";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.year);
  const yearLabel = data.year === "all" ? "ทั้งหมด" : data.year;

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">รายงานประจำปี</h1>
        <div className="flex items-center gap-2">
          <YearSelect years={data.years} value={data.year} basePath="/reports" />
          <ExportCsvButton
            year={data.year}
            monthly={data.monthly}
            byPurpose={data.byPurpose}
            byCategory={data.byCategory}
          />
          <PrintButton />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-sm print:p-0 print:shadow-none">
        <div className="mb-6 text-center">
          <h2 className="text-lg font-bold text-slate-800">
            สรุปรายรับ-รายจ่ายเงินบริจาค ประจำปี พ.ศ. {yearLabel}
          </h2>
          <p className="text-sm text-slate-500">
            ภาควิชาวิศวกรรมไฟฟ้า (นับตามปี พ.ศ. ของวันที่ในใบเสร็จ)
          </p>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">รายรับรวม</p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatMoney(data.yearReceived)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">รายจ่ายรวม</p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatMoney(data.yearSpent)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">รับ − จ่าย</p>
            <p className="mt-1 text-xl font-bold text-slate-800">
              {formatMoney(data.yearReceived - data.yearSpent)}
            </p>
          </div>
        </div>

        <ReportTable
          title="สรุปรายเดือน"
          head={["เดือน", "รายรับ (บาท)", "รายจ่าย (บาท)", "รับ − จ่าย (บาท)"]}
          rows={data.monthly.map((m) => [
            THAI_MONTHS_SHORT[m.month - 1],
            m.received,
            m.spent,
            m.received - m.spent,
          ])}
        />

        <ReportTable
          title="สรุปตามวัตถุประสงค์ในการบริจาค"
          head={["วัตถุประสงค์", "รายรับ (บาท)", "รายจ่าย (บาท)", "คงเหลือ (บาท)"]}
          rows={data.byPurpose.map((p) => [
            p.name,
            p.received,
            p.spent,
            p.received - p.spent,
          ])}
        />

        <ReportTable
          title="สรุปตามหมวดหมู่"
          head={["หมวดหมู่", "รายรับ (บาท)", "รายจ่าย (บาท)", "คงเหลือ (บาท)"]}
          rows={data.byCategory.map((c) => [
            c.name,
            c.received,
            c.spent,
            c.received - c.spent,
          ])}
        />
      </div>
    </div>
  );
}

function ReportTable({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: (string | number)[][];
}) {
  const totals = head.slice(1).map((_, col) =>
    rows.reduce((s, r) => s + (typeof r[col + 1] === "number" ? (r[col + 1] as number) : 0), 0)
  );

  return (
    <div className="mb-8">
      <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                className={`border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 ${
                  i === 0 ? "text-left" : "text-right"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={head.length}
                className="border border-slate-300 px-3 py-4 text-center text-slate-400"
              >
                ไม่มีข้อมูล
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`border border-slate-300 px-3 py-1.5 ${
                    j === 0 ? "" : "text-right tabular-nums"
                  }`}
                >
                  {typeof cell === "number" ? formatMoney(cell) : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {rows.length > 0 && (
          <tfoot>
            <tr className="font-semibold">
              <td className="border border-slate-300 bg-slate-50 px-3 py-2">
                รวม
              </td>
              {totals.map((t, i) => (
                <td
                  key={i}
                  className="border border-slate-300 bg-slate-50 px-3 py-2 text-right tabular-nums"
                >
                  {formatMoney(t)}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
