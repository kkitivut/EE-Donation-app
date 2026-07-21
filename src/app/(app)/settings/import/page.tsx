"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { toUserMessage } from "@/lib/error-message";
import {
  parseWorkbook,
  type ParseResult,
} from "@/lib/import-excel";

type ImportLog = { type: "ok" | "skip" | "error"; message: string };

/** จำกัดขนาดไฟล์นำเข้า กันไฟล์ใหญ่ผิดปกติ (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export default function ImportPage() {
  const supabase = createClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState("");
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [done, setDone] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileError(null);
    setLogs([]);
    setDone(false);
    setParsed(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileError(
        `ไฟล์ใหญ่เกิน ${MAX_FILE_SIZE / 1024 / 1024} MB — กรุณาแบ่งไฟล์ให้เล็กลง`
      );
      return;
    }

    try {
      const buf = await file.arrayBuffer();
      setParsed(parseWorkbook(buf));
    } catch (err) {
      console.error("[import] parse failed", err);
      setFileError(
        "อ่านไฟล์ไม่สำเร็จ — ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ Excel (.xlsx) ที่ถูกต้อง"
      );
    }
  }

  function log(type: ImportLog["type"], message: string) {
    setLogs((l) => [...l, { type, message }]);
  }

  async function runImport() {
    if (!parsed) return;
    setImporting(true);
    setLogs([]);
    let ok = 0,
      skip = 0,
      fail = 0;

    try {
      if (parsed.fileType === "donations") {
        // 1) เตรียมรายการอ้างอิง — สร้างที่ยังไม่มี
        setProgress("กำลังเตรียมรายการอ้างอิง...");
        const purposeNames = new Set(
          parsed.donations.map((d) => d.purpose_name).filter(Boolean) as string[]
        );
        const fd13Codes = new Set(
          parsed.donations.map((d) => d.fd13_code).filter(Boolean) as string[]
        );
        const categoryNames = new Set(
          parsed.donations.map((d) => d.category_name).filter(Boolean) as string[]
        );

        const purposeMap = await ensureLookup("purposes", "name", purposeNames);
        const fd13Map = await ensureLookup("fd13_codes", "code", fd13Codes);
        const categoryMap = await ensureLookup("categories", "name", categoryNames);

        // 2) ตรวจใบเสร็จซ้ำ
        setProgress("กำลังตรวจสอบใบเสร็จซ้ำ...");
        const receiptNos = parsed.donations.map((d) => d.receipt_no);
        const existing = new Set<string>();
        for (let i = 0; i < receiptNos.length; i += 200) {
          const { data } = await supabase
            .from("donations")
            .select("receipt_no")
            .in("receipt_no", receiptNos.slice(i, i + 200));
          (data ?? []).forEach((d) => existing.add(d.receipt_no));
        }

        // ซ้ำในไฟล์เองก็ข้าม (เอาแถวแรก)
        const seen = new Set<string>();
        const toInsert = [];
        for (const d of parsed.donations) {
          if (existing.has(d.receipt_no)) {
            skip++;
            log("skip", `${d.receipt_no} มีในระบบแล้ว — ข้าม`);
            continue;
          }
          if (seen.has(d.receipt_no)) {
            skip++;
            log("skip", `${d.receipt_no} ซ้ำในไฟล์ (sheet ${d.sheet} แถว ${d.row}) — ข้าม`);
            continue;
          }
          seen.add(d.receipt_no);
          toInsert.push({
            receipt_no: d.receipt_no,
            donor_name: d.donor_name,
            amount: d.amount,
            receipt_date: d.receipt_date,
            donated_date: d.donated_date,
            purpose_id: d.purpose_name ? (purposeMap.get(d.purpose_name) ?? null) : null,
            fd13_id: d.fd13_code ? (fd13Map.get(d.fd13_code) ?? null) : null,
            channel: d.channel,
            account: d.account,
            category_id: d.category_name
              ? (categoryMap.get(d.category_name) ?? null)
              : null,
            drive_url: d.drive_url,
          });
        }

        // 3) บันทึกเป็นชุด
        for (let i = 0; i < toInsert.length; i += 500) {
          setProgress(
            `กำลังบันทึกใบเสร็จ ${Math.min(i + 500, toInsert.length)}/${toInsert.length}...`
          );
          const batch = toInsert.slice(i, i + 500);
          const { error } = await supabase.from("donations").insert(batch);
          if (error) {
            fail += batch.length;
            log("error", `บันทึกชุดที่ ${i / 500 + 1} ล้มเหลว: ${toUserMessage(error)}`);
          } else {
            ok += batch.length;
          }
        }
        log("ok", `นำเข้าใบเสร็จสำเร็จ ${ok} รายการ`);
      }

      if (parsed.fileType === "expenses") {
        // 1) หา donation จากเลขที่ใบเสร็จ
        setProgress("กำลังค้นหาใบเสร็จในระบบ...");
        const receiptNos = [...new Set(parsed.expenses.map((e) => e.receipt_no))];
        const donationMap = new Map<string, string>();
        for (let i = 0; i < receiptNos.length; i += 200) {
          const { data } = await supabase
            .from("donations")
            .select("id, receipt_no")
            .in("receipt_no", receiptNos.slice(i, i + 200));
          (data ?? []).forEach((d) => donationMap.set(d.receipt_no, d.id));
        }

        // 2) นำเข้าทีละกลุ่มผ่าน save_expense — 1 กลุ่ม = 1 รายจ่าย อาจตัดหลายใบเสร็จ
        //    (กลุ่มถูกรวมไว้แล้วใน groupExpenseSplits() ตอน parse ดู ADR-009)
        const groups = parsed.expenseGroups;
        for (let i = 0; i < groups.length; i++) {
          const g = groups[i];
          const receiptsLabel = g.allocations.map((a) => a.receipt_no).join(", ");
          setProgress(`กำลังนำเข้ารายจ่าย ${i + 1}/${groups.length}...`);

          // ต้องพบใบเสร็จครบทุกใบของกลุ่มนี้ — ถ้าขาดใบไหนให้ล้มทั้งกลุ่ม กันได้ข้อมูล
          // ผิดรูป (รายจ่ายเดียวที่ตัดไม่ครบทุกใบ) กลับมาอีก
          const missing = g.allocations
            .map((a) => a.receipt_no)
            .filter((r) => !donationMap.has(r));
          if (missing.length > 0) {
            fail++;
            log(
              "error",
              `"${g.description}" (${receiptsLabel}): ไม่พบใบเสร็จ ${missing.join(", ")} ในระบบ — นำเข้าไฟล์ข้อมูลบริจาคก่อน`
            );
            continue;
          }

          const firstDonationId = donationMap.get(g.allocations[0].receipt_no)!;

          // กันนำเข้าซ้ำ: รายการ+วันจ่าย+ยอดรวมเดียวกันที่ตัดใบแรกของกลุ่มนี้อยู่แล้ว
          const { data: dup } = await supabase
            .from("expenses")
            .select("id, expense_allocations!inner(donation_id)")
            .eq("description", g.description)
            .eq("paid_date", g.paid_date)
            .eq("total_amount", g.total_amount)
            .eq("expense_allocations.donation_id", firstDonationId)
            .limit(1);
          if (dup && dup.length > 0) {
            skip++;
            log("skip", `"${g.description}" (${receiptsLabel}) มีในระบบแล้ว — ข้าม`);
            continue;
          }

          const { error } = await supabase.rpc("save_expense", {
            p_expense_id: null,
            p_doc_no: g.doc_no,
            p_paid_date: g.paid_date,
            p_description: g.description,
            p_total_amount: g.total_amount,
            p_drive_url: null,
            p_note: null,
            p_allocations: g.allocations.map((a) => ({
              donation_id: donationMap.get(a.receipt_no)!,
              amount: a.amount,
            })),
          });
          if (error) {
            fail++;
            log(
              "error",
              `"${g.description}" (${receiptsLabel}): ${toUserMessage(error)}`
            );
          } else {
            ok++;
          }
        }
        log("ok", `นำเข้ารายจ่ายสำเร็จ ${ok} รายการ`);
      }
    } finally {
      setProgress(
        `เสร็จสิ้น — สำเร็จ ${ok} · ข้าม ${skip} · ล้มเหลว ${fail}`
      );
      setImporting(false);
      setDone(true);
    }
  }

  async function ensureLookup(
    table: "purposes" | "fd13_codes" | "categories",
    field: "name" | "code",
    values: Set<string>
  ): Promise<Map<string, string>> {
    const { data: existing } = await supabase.from(table).select("*");
    const map = new Map<string, string>(
      (existing ?? []).map((r) => [r[field] as string, r.id as string])
    );
    for (const v of values) {
      if (!map.has(v)) {
        const payload: Record<string, string> =
          field === "name" ? { name: v } : { code: v };
        const { data, error } = await supabase
          .from(table)
          .insert(payload)
          .select()
          .single();
        if (!error && data) {
          map.set(v, data.id);
          log("ok", `สร้างรายการอ้างอิงใหม่ใน${table === "purposes" ? "วัตถุประสงค์" : table === "fd13_codes" ? "รหัส FD13" : "หมวดหมู่"}: "${v}"`);
        }
      }
    }
    return map;
  }

  const donationTotal = parsed?.donations.reduce((s, d) => s + d.amount, 0) ?? 0;
  const expenseTotal = parsed?.expenses.reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <Link href="/settings" className="text-sm text-teal-700 hover:underline">
          ← กลับหน้าตั้งค่า
        </Link>
        <h1 className="mt-1 text-xl font-bold text-slate-800">
          นำเข้าข้อมูลจาก Excel
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          รองรับ 2 รูปแบบ: ไฟล์<strong>ข้อมูลบริจาค</strong> (sheet ชื่อปี พ.ศ. เช่น
          2568) และไฟล์<strong>รายจ่าย</strong> (1 sheet ต่อใบเสร็จ) —
          ให้นำเข้าไฟล์ข้อมูลบริจาคก่อนเสมอ
        </p>
      </div>

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center transition hover:border-teal-600 hover:bg-teal-50/30">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFile}
          className="hidden"
          disabled={importing}
        />
        <p className="text-3xl">📄</p>
        <p className="mt-2 text-sm font-medium text-slate-700">
          {fileName ?? "คลิกเพื่อเลือกไฟล์ .xlsx"}
        </p>
      </label>

      {fileError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {fileError}
        </p>
      )}

      {parsed && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            ผลการอ่านไฟล์
          </h2>

          {parsed.fileType === "unknown" && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              ไม่รู้จักรูปแบบไฟล์นี้ — ต้องมี sheet ชื่อปี พ.ศ. (ไฟล์ข้อมูลบริจาค)
              หรือหัวตารางแบบบัญชีรายจ่าย (เลขที่ส่งออก/รายการ/จำนวนยอด)
            </p>
          )}

          {parsed.fileType === "donations" && (
            <p className="text-sm text-slate-600">
              ไฟล์ข้อมูลบริจาค · พบ{" "}
              <strong>{parsed.donations.length.toLocaleString()}</strong> ใบเสร็จ
              · ยอดรวม <strong>{formatMoney(donationTotal)}</strong> บาท
            </p>
          )}

          {parsed.fileType === "expenses" && (
            <p className="text-sm text-slate-600">
              ไฟล์รายจ่าย · พบ{" "}
              <strong>{parsed.expenses.length.toLocaleString()}</strong> แถว
              จาก{" "}
              {[...new Set(parsed.expenses.map((e) => e.receipt_no))].length}{" "}
              ใบเสร็จ · รวมเป็น{" "}
              <strong>{parsed.expenseGroups.length.toLocaleString()}</strong>{" "}
              รายจ่าย · ยอดรวม <strong>{formatMoney(expenseTotal)}</strong> บาท
            </p>
          )}

          {parsed.issues.length > 0 && (
            <div className="mt-3 rounded-lg bg-amber-50 p-3">
              <p className="mb-1 text-xs font-semibold text-amber-800">
                แถวที่ข้าม ({parsed.issues.length})
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-amber-700">
                {parsed.issues.map((iss, i) => (
                  <li key={i}>
                    sheet {iss.sheet} แถว {iss.row}: {iss.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.notices.length > 0 && (
            <div className="mt-3 rounded-lg bg-sky-50 p-3">
              <p className="mb-1 text-xs font-semibold text-sky-800">
                รายการที่ควรตรวจสอบ ({parsed.notices.length})
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-sky-700">
                {parsed.notices.map((n, i) => (
                  <li key={i}>{n.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {parsed.fileType !== "unknown" && !done && (
            <button
              onClick={runImport}
              disabled={importing}
              className="mt-4 rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {importing ? "กำลังนำเข้า..." : "เริ่มนำเข้าข้อมูล"}
            </button>
          )}
        </div>
      )}

      {(progress || logs.length > 0) && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">{progress}</p>
          {logs.length > 0 && (
            <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto text-xs">
              {logs.map((l, i) => (
                <li
                  key={i}
                  className={
                    l.type === "error"
                      ? "text-red-600"
                      : l.type === "skip"
                        ? "text-amber-600"
                        : "text-emerald-700"
                  }
                >
                  {l.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
