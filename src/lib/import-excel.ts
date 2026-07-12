import * as XLSX from "xlsx";

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

export type ParseResult = {
  fileType: "donations" | "expenses" | "unknown";
  donations: ParsedDonation[];
  expenses: ParsedExpense[];
  issues: ParseIssue[];
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
          drive_url: toText(r[cDriveUrl]),
        });
      }
    }
    return { fileType: "donations", donations, expenses, issues };
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

  return {
    fileType: foundLedger ? "expenses" : "unknown",
    donations,
    expenses,
    issues,
  };
}
