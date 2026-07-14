"use client";

import { useEffect, useRef } from "react";
import { filterMoney, moneyRangeError } from "@/lib/numeric-input";

/**
 * Input จำนวนเงิน (บาท) — กรองตั้งแต่พิมพ์ให้เหลือเลข + จุดเดียว + ทศนิยม 2 ตำแหน่ง
 * (ไม่ใช้ type="number" ที่ยอมให้พิมพ์ e/+/- ได้ — ดู ADR-006)
 * ค่า 0 ขึ้นขอบแดง + setCustomValidity กัน submit; inputMode="decimal" ให้มือถือ
 * ขึ้น numeric keypad เหมือน type="number" เดิม
 */
export default function MoneyInput({
  value,
  onChange,
  required,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const error = moneyRangeError(value);

  useEffect(() => {
    ref.current?.setCustomValidity(error ?? "");
  }, [error]);

  return (
    <input
      ref={ref}
      type="text"
      inputMode="decimal"
      required={required}
      value={value}
      onChange={(e) => onChange(filterMoney(e.target.value))}
      title={error ?? undefined}
      className={`${className ?? ""} ${error ? "!border-red-400 !bg-red-50" : ""}`}
    />
  );
}
