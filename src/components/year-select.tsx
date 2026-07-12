"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * ตัวเลือกปี พ.ศ. — เปลี่ยนแล้วนำทางทันทีโดยไม่ต้องกดปุ่ม
 * ใช้ useTransition เพื่อแสดงสัญญาณโหลดระหว่างรอ server ตอบ (กันอาการ "เงียบแล้วเด้ง")
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
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-slate-500">ปี พ.ศ.</label>
      <div className="relative">
        <select
          value={String(value)}
          aria-busy={isPending}
          onChange={(e) => {
            const year = e.target.value;
            startTransition(() => router.push(`${basePath}?year=${year}`));
          }}
          className="rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm focus:border-teal-600 focus:outline-none"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {isPending && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
          </span>
        )}
      </div>
    </div>
  );
}
