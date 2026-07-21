import * as XLSX from "xlsx";
import { isSafeHttpUrl } from "@/lib/safe-url";
import { formatThaiDate } from "@/lib/format";

export type ParsedDonation = {
  sheet: string;
  row: number;
  receipt_no: string;
  donor_name: string;
  amount: number;
  receipt_date: string; // ISO ค.ศ.
  donated_date: string | null;
  purpose_name: string | null;
  fd13_code: string | null;
  channel: string | null;
  account: string | null;
  category_name: string | null;
  drive_url: string | null;
};

export type ParsedExpense = {
  sheet: string; // = เลขที่ใบเสร็จ
  row: number;
  receipt_no: string;
  doc_no: string | null;
  paid_date: string;
  description: string;
  amount: number;
};

export type ParseIssue = { sheet: string; row: number; reason: string };

/**
 * รายจ่าย 1 รายการหลังรวมแถวที่เป็นการจ่ายครั้งเดียวกันแต่ตัดเงินจากหลายใบเสร็จ
 * (ไฟล์ Excel เป็น 1 sheet ต่อ 1 ใบเสร็จ การจ่ายที่ตัดหลายใบจึงกระจายเป็นคนละแถวคนละ sheet)
 */
export type ParsedExpenseGroup = {
  doc_no: string | null;
  paid_date: string;
  description: string;
  total_amount: number; // ผลรวมของทุก allocation
  allocations: { receipt_no: string; amount: number }[];
  sources: { sheet: string; row: number }[];
};

export type ParseResult = {
  fileType: "donations" | "expenses" | "unknown";
  donations: ParsedDonation[];
  expenses: ParsedExpense[];
  expenseGroups: ParsedExpenseGroup[];
  issues: ParseIssue[];
  /** ข้อสังเกตที่ไม่ถึงขั้นข้ามแถว — แจ้งให้ผู้ใช้ตรวจสอบเอง */
  notices: ParseIssue[];
};

/** แปลงค่าวันที่จาก Excel (serial number / Date / ข้อความ d/m/ปี พ.ศ. หรือ ค.ศ.) เป็น ISO */
export function toIsoDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !isNaN(value.getTime())) {
    let y = value.getFullYear();
    if (y > 2400) y -= 543;
    return `${String(y).padStart(4, "0")}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }

  if (typeof value === "number" && value > 20000 && value < 300000) {
    // Excel serial date (ฐาน ค.ศ. 1900)
    // หมายเหตุ: บางเครื่องที่ตั้งค่าเป็นปฏิทินไทย เวลาพิมพ์ปี พ.ศ. ลงในเซลล์วันที่
    // Excel จะตีความเป็นปี ค.ศ. ตรงตัว (เช่น พ.ศ. 2569 กลายเป็น ค.ศ. 2569)
    // ทำให้ serial number สูงผิดปกติ (~244,000 แทนที่จะเป็น ~46,000) จึงต้องขยายช่วงตรวจสอบ
    const d = XLSX.SSF.parse_date_code(value);
    if (!d) return null;
    let y = d.y;
    if (y > 2400) y -= 543;
    return `${String(y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  if (typeof value === "string") {
    const m = value.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (!m) return null;
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += 2500; // "69" → 2569
    if (year > 2400) year -= 543; // พ.ศ. → ค.ศ.
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[,\s฿]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/** drive_url จาก Excel: เก็บเฉพาะที่เป็น http(s) — กัน javascript:/data: (stored XSS) */
function safeDriveUrl(value: string | null): string | null {
  return isSafeHttpUrl(value) ? value : null;
}

/** จัดชื่อวัตถุประสงค์ให้เป็นมาตรฐานเดียวกัน (สะกดต่างกันในไฟล์เก่า) */
export function normalizePurpose(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (s.includes("พรก") || s.includes("พระราชกฤษฎีกา")) return "ข้อ พรก.";
  if (s.includes("ไม่ระบุ")) return "ข้อไม่ระบุวัตถุประสงค์";
  if (s.includes("อื่น")) return "ข้อ อื่นๆ";
  const m = s.match(/ข้อ\s*(\d+)/);
  if (m) return `ข้อ ${m[1]}`;
  return s;
}

/** อ่าน workbook แล้วแยกประเภทไฟล์ + ดึงข้อมูล */
export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const wb = XLSX.read(data, { cellDates: false });
  const issues: ParseIssue[] = [];
  const donations: ParsedDonation[] = [];
  const expenses: ParsedExpense[] = [];

  const yearSheets = wb.SheetNames.filter((n) => /^25\d{2}$/.test(n.trim()));

  if (yearSheets.length > 0) {
    // ===== ไฟล์ข้อมูลบริจาค: 1 sheet ต่อปี พ.ศ. หัวตารางแถว 2 =====
    for (const sheetName of yearSheets) {
      const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
        header: 1,
        raw: true,
      });
      // หาแถวหัวตาราง (มีคำว่า เลขที่ใบเสร็จ)
      const headerIdx = rows.findIndex((r) =>
        r?.some((c) => typeof c === "string" && c.includes("เลขที่ใบเสร็จ"))
      );
      if (headerIdx === -1) {
        issues.push({ sheet: sheetName, row: 0, reason: "ไม่พบหัวตาราง (เลขที่ใบเสร็จ)" });
        continue;
      }
      const header = rows[headerIdx].map((c) => String(c ?? "").trim());
      const col = (name: string) => header.findIndex((h) => h.includes(name));
      const cName = col("ชื่อ-นามสกุล");
      const cAmount = col("จำนวนเงิน");
      const cReceiptNo = col("เลขที่ใบเสร็จ");
      const cDriveUrl = col("เอกสารแนบ");
      const cReceiptDate = col("วันที่ในใบเสร็จ");
      const cPurpose = col("วัตถุประสงค์");
      const cFd13 = col("FD13");
      const cChannel = col("ช่องทาง");
      const cAccount = col("ข้อมูลบัญชี");
      const cDonatedDate = col("วันที่บริจาค");
      const cCategory = col("หมวดหมู่");

      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.every((c) => c == null || String(c).trim() === "")) continue;
        const rowNo = i + 1;
        const receipt_no = toText(r[cReceiptNo]);
        const donor_name = toText(r[cName]);
        const amount = toNumber(r[cAmount]);
        const receipt_date = toIsoDate(r[cReceiptDate]);

        if (!receipt_no && !donor_name && !amount) continue;
        if (!receipt_no) {
          issues.push({ sheet: sheetName, row: rowNo, reason: "ไม่มีเลขที่ใบเสร็จ" });
          continue;
        }
        if (!donor_name) {
          issues.push({ sheet: sheetName, row: rowNo, reason: `${receipt_no}: ไม่มีชื่อผู้บริจาค` });
          continue;
        }
        if (!amount || amount <= 0) {
          issues.push({ sheet: sheetName, row: rowNo, reason: `${receipt_no}: จำนวนเงินไม่ถูกต้อง` });
          continue;
        }
        if (!receipt_date) {
          issues.push({ sheet: sheetName, row: rowNo, reason: `${receipt_no}: วันที่ในใบเสร็จไม่ถูกต้อง` });
          continue;
        }

        donations.push({
          sheet: sheetName,
          row: rowNo,
          receipt_no,
          donor_name,
          amount,
          receipt_date,
          donated_date: toIsoDate(r[cDonatedDate]),
          purpose_name: normalizePurpose(toText(r[cPurpose])),
          fd13_code: toText(r[cFd13]),
          channel: toText(r[cChannel]),
          account: toText(r[cAccount]),
          category_name: toText(r[cCategory]),
          drive_url: safeDriveUrl(toText(r[cDriveUrl])),
        });
      }
    }
    return {
      fileType: "donations",
      donations,
      expenses,
      expenseGroups: [],
      issues,
      notices: [],
    };
  }

  // ===== ไฟล์รายจ่าย: 1 sheet ต่อใบเสร็จ =====
  let foundLedger = false;
  for (const sheetName of wb.SheetNames) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
    });
    const headerIdx = rows.findIndex(
      (r) =>
        r?.some((c) => typeof c === "string" && c.includes("เลขที่ส่งออก")) &&
        r?.some((c) => typeof c === "string" && c.includes("รายการ"))
    );
    if (headerIdx === -1) continue;
    foundLedger = true;

    const header = rows[headerIdx].map((c) => String(c ?? "").trim());
    const col = (name: string) => header.findIndex((h) => h.includes(name));
    const cBookNo = col("เล่มที่/เลขที่");
    const cDocNo = col("เลขที่ส่งออก");
    const cPaidDate = col("วันที่จ่ายเงิน");
    const cDesc = col("รายการ");
    const cAmount = col("จำนวนยอด");

    // เลขที่ใบเสร็จ: จากคอลัมน์ เล่มที่/เลขที่ ของแถวยอดเงินบริจาค หรือชื่อ sheet
    let receipt_no = sheetName.trim();
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const bookNo = toText(rows[i]?.[cBookNo]);
      if (bookNo) {
        receipt_no = bookNo;
        break;
      }
    }

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const rowNo = i + 1;
      const description = toText(r[cDesc]);
      const amount = toNumber(r[cAmount]);
      if (!description || description.includes("ยอดเงินบริจาค")) continue;
      if (description.includes("รวมราย")) continue;
      if (!amount || amount <= 0) {
        issues.push({
          sheet: sheetName,
          row: rowNo,
          reason: `"${description}": จำนวนยอดไม่ถูกต้อง`,
        });
        continue;
      }
      const paid_date = toIsoDate(r[cPaidDate]);
      if (!paid_date) {
        issues.push({
          sheet: sheetName,
          row: rowNo,
          reason: `"${description}": วันที่จ่ายเงินไม่ถูกต้อง`,
        });
        continue;
      }
      expenses.push({
        sheet: sheetName,
        row: rowNo,
        receipt_no,
        doc_no: toText(r[cDocNo]),
        paid_date,
        description,
        amount,
      });
    }
  }

  const { groups: expenseGroups, notices } = groupExpenseSplits(expenses);

  return {
    fileType: foundLedger ? "expenses" : "unknown",
    donations,
    expenses,
    expenseGroups,
    issues,
    notices,
  };
}

/**
 * รวมแถวรายจ่ายที่เป็น "การจ่ายครั้งเดียวกัน แต่ตัดเงินจากหลายใบเสร็จ" ให้กลับมาเป็น
 * 1 รายจ่าย × N allocations ตามโมเดล ADR-002 — แทนที่จะปล่อยให้กลายเป็น N รายจ่าย × 1 allocation
 * ตามโครงสร้างไฟล์ Excel เดิม (1 sheet ต่อใบเสร็จ) ดู ADR-009
 *
 * กติกา (เจตนาเข้มงวด — รวมเฉพาะเคสที่มั่นใจได้จริง):
 * - รวมเมื่อ doc_no (ไม่ว่าง) + description + paid_date ตรงกันทุกตัวอักษร ข้าม sheet ต่างกัน
 * - doc_no ว่าง → ไม่รวมเด็ดขาด (ไม่มีหลักฐานพอว่าเป็นรายจ่ายเดียวกัน) แต่ถ้า description+paid_date
 *   ซ้ำข้าม sheet ก็ยังแจ้งเตือนให้ผู้ใช้ตรวจเอง
 * - doc_no ตรงกันแต่ description ต่างกัน → ไม่รวม (นี่คือเคส "เอกสารรวมหลายรายการ" ที่ถูกต้องอยู่แล้ว
 *   เช่น ค่าจ้างเหมายานพาหนะ + ค่าส่งไปรษณีย์ ใน doc_no เดียวกัน) แค่แจ้งเตือนให้ตรวจสอบ
 * - แถวซ้ำ (key เดียวกัน + receipt_no เดียวกัน) ใน sheet เดิม → รวม amount เป็น allocation เดียว
 *   พร้อมเตือนว่าพบแถวซ้ำ
 */
export function groupExpenseSplits(expenses: ParsedExpense[]): {
  groups: ParsedExpenseGroup[];
  notices: ParseIssue[];
} {
  const notices: ParseIssue[] = [];
  const byMergeKey = new Map<string, ParsedExpense[]>();

  for (const e of expenses) {
    // doc_no ว่าง → คีย์ไม่ซ้ำใครเลย (ผูกกับ sheet+row) กันไม่ให้ถูกรวมข้าม sheet
    // ใช้ JSON.stringify ของ array แทนการต่อ string ด้วยช่องว่าง กันไม่ให้ doc_no/description
    // ที่มีช่องว่างอยู่ในตัวมันเองบังเอิญประกอบกันเป็น key เดียวกับแถวอื่นที่ไม่เกี่ยวข้องกัน
    const keyParts = e.doc_no
      ? ["doc", e.doc_no, e.description, e.paid_date]
      : ["nodoc", e.sheet, String(e.row)];
    const key = JSON.stringify(keyParts);
    const list = byMergeKey.get(key);
    if (list) list.push(e);
    else byMergeKey.set(key, [e]);
  }

  // เตือนกรณี doc_no ตรงกันแต่ description ต่างกันข้าม sheet (ไม่รวม แค่แจ้ง)
  const byDocNo = new Map<string, ParsedExpense[]>();
  for (const e of expenses) {
    if (!e.doc_no) continue;
    const list = byDocNo.get(e.doc_no);
    if (list) list.push(e);
    else byDocNo.set(e.doc_no, [e]);
  }
  for (const [docNo, list] of byDocNo) {
    const sheets = new Set(list.map((e) => e.sheet));
    const descriptions = new Set(list.map((e) => e.description));
    if (sheets.size > 1 && descriptions.size > 1) {
      notices.push({
        sheet: [...sheets].join(", "),
        row: 0,
        reason: `เลขที่ส่งออก "${docNo}" ปรากฏในหลายใบเสร็จ (${[...sheets].join(", ")}) ด้วยรายการที่ต่างกัน — ตรวจสอบว่าเป็นเอกสารรวมหลายรายการจริง หรือควรรวมเป็นรายการเดียวกัน`,
      });
    }
  }

  // เตือนกรณี doc_no ว่าง แต่ description+paid_date ซ้ำข้าม sheet
  const noDocKey = new Map<string, ParsedExpense[]>();
  for (const e of expenses) {
    if (e.doc_no) continue;
    const key = JSON.stringify([e.description, e.paid_date]);
    const list = noDocKey.get(key);
    if (list) list.push(e);
    else noDocKey.set(key, [e]);
  }
  for (const list of noDocKey.values()) {
    const sheets = new Set(list.map((e) => e.sheet));
    if (sheets.size > 1) {
      notices.push({
        sheet: [...sheets].join(", "),
        row: 0,
        reason: `"${list[0].description}" (${formatThaiDate(list[0].paid_date)}) ปรากฏในหลายใบเสร็จ (${[...sheets].join(", ")}) แต่ไม่มีเลขที่ส่งออกให้ยืนยัน — ไม่ได้ถูกรวมอัตโนมัติ ตรวจสอบว่าเป็นรายการเดียวกันหรือไม่`,
      });
    }
  }

  const groups: ParsedExpenseGroup[] = [];
  for (const list of byMergeKey.values()) {
    // แถวซ้ำ (receipt_no เดียวกัน) ใน group เดียวกัน → รวม amount เป็น allocation เดียว
    const byReceipt = new Map<string, { amount: number; rows: ParsedExpense[] }>();
    for (const e of list) {
      const existing = byReceipt.get(e.receipt_no);
      if (existing) {
        existing.amount += e.amount;
        existing.rows.push(e);
      } else {
        byReceipt.set(e.receipt_no, { amount: e.amount, rows: [e] });
      }
    }
    for (const [receiptNo, v] of byReceipt) {
      if (v.rows.length > 1) {
        notices.push({
          sheet: v.rows[0].sheet,
          row: v.rows[0].row,
          reason: `พบแถวซ้ำ ${v.rows.length} แถวสำหรับ "${list[0].description}" ในใบเสร็จ ${receiptNo} — รวมยอดเป็นรายการเดียวแล้ว`,
        });
      }
    }

    const first = list[0];
    const allocations = [...byReceipt.entries()].map(([receipt_no, v]) => ({
      receipt_no,
      amount: v.amount,
    }));
    if (allocations.length > 1) {
      notices.push({
        sheet: [...new Set(list.map((e) => e.sheet))].join(", "),
        row: 0,
        reason: `"${first.description}" (เลขที่ส่งออก ${first.doc_no ?? "-"}) ตัดเงินจาก ${allocations.length} ใบเสร็จ — รวมเป็นรายจ่ายเดียวแล้ว`,
      });
    }

    groups.push({
      doc_no: first.doc_no,
      paid_date: first.paid_date,
      description: first.description,
      total_amount: allocations.reduce((s, a) => s + a.amount, 0),
      allocations,
      sources: list.map((e) => ({ sheet: e.sheet, row: e.row })),
    });
  }

  return { groups, notices };
}
