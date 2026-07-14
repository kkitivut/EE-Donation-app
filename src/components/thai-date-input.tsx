"use client";

import { useEffect, useRef, useState } from "react";
import { THAI_MONTHS_SHORT } from "@/lib/format";
import {
  beYearRangeError,
  dayRangeError,
  filterDigits,
} from "@/lib/numeric-input";

function fromIso(iso: string): { day: string; month: string; beYear: string } {
  if (!iso) return { day: "", month: "", beYear: "" };
  const [y, m, d] = iso.split("-").map(Number);
  return { day: String(d), month: String(m), beYear: String(y + 543) };
}

const baseCls = "rounded-lg border px-2 py-2 text-sm";
const okCls = "border-slate-300";
const errCls = "border-red-400 bg-red-50";

/**
 * Input วันที่แบบไทย (วัน / เดือน / ปี พ.ศ.) — value เป็น ISO date (ค.ศ.) หรือ "" ถ้ายังไม่ครบ
 *
 * เก็บ draft ของแต่ละช่อง (วัน/เดือน/ปี) เป็น state ภายในแยกจาก `value` ที่ส่งออก —
 * ถ้าผูกกับ `value` ตรงๆ การพิมพ์ทีละช่องระหว่างที่อีก 2 ช่องยังไม่ครบจะโดน onChange("")
 * ล้างกลับเป็นว่างทันที (เพราะยังประกอบเป็น ISO ที่สมบูรณ์ไม่ได้) ทำให้พิมพ์อะไรไม่ติดเลย
 *
 * ช่องวัน/ปีใช้ type="text" + inputMode="numeric" แล้วกรองผ่าน filterDigits ตั้งแต่พิมพ์
 * (ไม่ใช้ type="number" ที่ยอมให้พิมพ์ e/+/- และหลักไม่จำกัด — ดู ADR-006)
 * ค่าที่นอกช่วง (วัน 0, ปีนอก 2500-2600) ขึ้นขอบแดง + setCustomValidity กัน submit
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
  const [{ day, month, beYear }, setDraft] = useState(() => fromIso(value));
  const dayRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // sync จากภายนอกเฉพาะตอนที่ parent ตั้งค่าเป็นวันที่ที่สมบูรณ์แล้ว (เช่น โหมดแก้ไขที่โหลด
  // ข้อมูลเดิมมา) — ไม่ sync ตอน value เป็น "" เพราะนั่นคือค่าที่ onChange("") ส่งกลับมาเอง
  // ระหว่างผู้ใช้พิมพ์ยังไม่ครบ ไม่ใช่การ reset จากภายนอก
  useEffect(() => {
    if (value) setDraft(fromIso(value));
  }, [value]);

  const dayError = dayRangeError(day);
  const yearError = beYearRangeError(beYear);

  // ผูกข้อความ error เข้ากับ native form validation — submit ไม่ผ่านจนกว่าจะแก้
  useEffect(() => {
    dayRef.current?.setCustomValidity(dayError ?? "");
    yearRef.current?.setCustomValidity(yearError ?? "");
  }, [dayError, yearError]);

  function commit(nextDay: string, nextMonth: string, nextBeYear: string) {
    setDraft({ day: nextDay, month: nextMonth, beYear: nextBeYear });
    // ประกอบ ISO เฉพาะเมื่อครบทุกช่องและอยู่ในช่วงที่ถูกต้อง
    if (dayRangeError(nextDay) || beYearRangeError(nextBeYear)) {
      onChange("");
      return;
    }
    const d = Number(nextDay);
    const m = Number(nextMonth);
    const y = Number(nextBeYear);
    if (d && m && y >= 2400) {
      const ce = y - 543;
      const maxDay = new Date(ce, m, 0).getDate();
      const dd = Math.min(d, maxDay);
      onChange(
        `${String(ce).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
      );
    } else {
      onChange("");
    }
  }

  return (
    <div className="flex gap-1.5">
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        placeholder="วัน"
        required={required}
        value={day}
        onChange={(e) =>
          commit(filterDigits(e.target.value, 2), month, beYear)
        }
        title={dayError ?? undefined}
        className={`w-16 ${baseCls} ${dayError ? errCls : okCls}`}
      />
      <select
        required={required}
        value={month}
        onChange={(e) => commit(day, e.target.value, beYear)}
        className={`flex-1 ${baseCls} ${okCls}`}
      >
        <option value="">เดือน</option>
        {THAI_MONTHS_SHORT.map((name, i) => (
          <option key={i} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        placeholder="พ.ศ."
        required={required}
        value={beYear}
        onChange={(e) =>
          commit(day, month, filterDigits(e.target.value, 4))
        }
        title={yearError ?? undefined}
        className={`w-20 ${baseCls} ${yearError ? errCls : okCls}`}
      />
    </div>
  );
}
