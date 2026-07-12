"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type SelectField = {
  type: "select";
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};
type TextField = {
  type: "text";
  name: string;
  label: string;
  value: string;
  placeholder?: string;
};

export type FilterField = SelectField | TextField;

/** แถบตัวกรอง — เปลี่ยนค่าแล้วอัปเดตผลทันที (select ทันที, ช่องค้นหา debounce 400ms) */
export default function FilterBar({
  basePath,
  fields,
}: {
  basePath: string;
  fields: FilterField[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [textValues, setTextValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.filter((f): f is TextField => f.type === "text").map((f) => [f.name, f.value])
    )
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applyParams(overrides: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    sp.delete("page"); // เปลี่ยนตัวกรอง กลับไปหน้า 1
    startTransition(() =>
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false })
    );
  }

  function handleClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setTextValues(
      Object.fromEntries(
        fields.filter((f): f is TextField => f.type === "text").map((f) => [f.name, ""])
      )
    );
    startTransition(() => router.replace(basePath, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-4 shadow-sm">
      {fields.map((f) =>
        f.type === "select" ? (
          <div key={f.name}>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {f.label}
            </label>
            <select
              value={f.value}
              onChange={(e) => applyParams({ [f.name]: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div key={f.name} className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {f.label}
            </label>
            <input
              value={textValues[f.name] ?? f.value}
              onChange={(e) => {
                const val = e.target.value;
                setTextValues((v) => ({ ...v, [f.name]: val }));
                if (debounceRef.current) clearTimeout(debounceRef.current);
                debounceRef.current = setTimeout(() => applyParams({ [f.name]: val }), 400);
              }}
              placeholder={f.placeholder}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )
      )}
      <button
        type="button"
        onClick={handleClear}
        className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
      >
        ล้าง
      </button>
      {isPending && (
        <span
          aria-label="กำลังโหลด"
          className="mb-1 block h-5 w-5 animate-spin self-center rounded-full border-2 border-slate-300 border-t-teal-700"
        />
      )}
    </div>
  );
}
