"use client";

import { THAI_MONTHS_SHORT } from "@/lib/format";

/**
 * Input วันที่แบบไทย (วัน / เดือน / ปี พ.ศ.) — value เป็น ISO date (ค.ศ.) หรือ "" ถ้ายังไม่ครบ
 */
export default function ThaiDateInput({
  value,
  onChange,
  required,
}: {
  value: string; // ISO "2026-02-10" หรือ ""
  onChange: (iso: string) => void;
  required?: boolean;
}) {
  const [y, m, d] = value ? value.split("-").map(Number) : [0, 0, 0];

  function update(day: number, month: number, beYear: number) {
    if (day && month && beYear >= 2400) {
      const ce = beYear - 543;
      const maxDay = new Date(ce, month, 0).getDate();
      const dd = Math.min(day, maxDay);
      onChange(
        `${String(ce).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
      );
    } else {
      onChange("");
    }
  }

  return (
    <div className="flex gap-1.5">
      <input
        type="number"
        min={1}
        max={31}
        placeholder="วัน"
        required={required}
        value={d || ""}
        onChange={(e) => update(Number(e.target.value), m, y ? y + 543 : 0)}
        className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm"
      />
      <select
        required={required}
        value={m || ""}
        onChange={(e) => update(d, Number(e.target.value), y ? y + 543 : 0)}
        className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="">เดือน</option>
        {THAI_MONTHS_SHORT.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={2500}
        max={2600}
        placeholder="พ.ศ."
        required={required}
        value={y ? y + 543 : ""}
        onChange={(e) => update(d, m, Number(e.target.value))}
        className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-sm"
      />
    </div>
  );
}
