"use client";

import { THAI_MONTHS_SHORT } from "@/lib/format";
import { csvRow } from "@/lib/csv";

type MonthlyPoint = { month: number; received: number; spent: number };
type NamedTotal = { name: string; received: number; spent: number };

export default function ExportCsvButton({
  year,
  monthly,
  byPurpose,
  byCategory,
}: {
  year: number | "all";
  monthly: MonthlyPoint[];
  byPurpose: NamedTotal[];
  byCategory: NamedTotal[];
}) {
  function handleExport() {
    const lines: string[] = [];

    lines.push(csvRow([`สรุปรายรับ-รายจ่ายเงินบริจาค ประจำปี พ.ศ. ${year}`]));
    lines.push("");

    lines.push(csvRow(["สรุปรายเดือน"]));
    lines.push(csvRow(["เดือน", "รายรับ (บาท)", "รายจ่าย (บาท)", "รับ - จ่าย (บาท)"]));
    for (const m of monthly) {
      lines.push(
        csvRow([THAI_MONTHS_SHORT[m.month - 1], m.received, m.spent, m.received - m.spent])
      );
    }
    lines.push("");

    lines.push(csvRow(["สรุปตามวัตถุประสงค์ในการบริจาค"]));
    lines.push(csvRow(["วัตถุประสงค์", "รายรับ (บาท)", "รายจ่าย (บาท)", "คงเหลือ (บาท)"]));
    for (const p of byPurpose) {
      lines.push(csvRow([p.name, p.received, p.spent, p.received - p.spent]));
    }
    lines.push("");

    lines.push(csvRow(["สรุปตามหมวดหมู่"]));
    lines.push(csvRow(["หมวดหมู่", "รายรับ (บาท)", "รายจ่าย (บาท)", "คงเหลือ (บาท)"]));
    for (const c of byCategory) {
      lines.push(csvRow([c.name, c.received, c.spent, c.received - c.spent]));
    }

    // BOM นำหน้า เพื่อให้ Excel เปิดภาษาไทยถูกต้อง
    const csvContent = "﻿" + lines.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `รายงานเงินบริจาค-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="cursor-pointer rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
    >
      📊 Export CSV
    </button>
  );
}
