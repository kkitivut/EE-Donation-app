"use client";

import { useRouter } from "next/navigation";

/**
 * ตัวเลือกปี พ.ศ. — เปลี่ยนแล้วนำทางทันทีโดยไม่ต้องกดปุ่ม
 */
export default function YearSelect({
  years,
  value,
  basePath,
}: {
  years: number[];
  value: number;
  basePath: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-500">ปี พ.ศ.</label>
      <select
        value={String(value)}
        onChange={(e) => router.push(`${basePath}?year=${e.target.value}`)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
