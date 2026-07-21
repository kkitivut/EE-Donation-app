import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  groupExpenseSplits,
  normalizePurpose,
  parseWorkbook,
  toIsoDate,
  toNumber,
  type ParsedExpense,
} from "@/lib/import-excel";

function expense(overrides: Partial<ParsedExpense>): ParsedExpense {
  return {
    sheet: "RC001",
    row: 5,
    receipt_no: "RC001",
    doc_no: "ท.13/69",
    paid_date: "2026-01-15",
    description: "ทุนการศึกษา",
    amount: 1000,
    ...overrides,
  };
}

describe("groupExpenseSplits", () => {
  it("รวมแถวจากคนละ sheet ที่ doc_no + description + paid_date ตรงกันเป็นรายจ่ายเดียว หลาย allocation", () => {
    const rows = [
      expense({ sheet: "RC001", row: 5, receipt_no: "RC001", amount: 600 }),
      expense({ sheet: "RC002", row: 8, receipt_no: "RC002", amount: 400 }),
    ];
    const { groups, notices } = groupExpenseSplits(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].total_amount).toBe(1000);
    expect(groups[0].allocations).toEqual([
      { receipt_no: "RC001", amount: 600 },
      { receipt_no: "RC002", amount: 400 },
    ]);
    expect(notices.some((n) => n.reason.includes("ตัดเงินจาก 2 ใบเสร็จ"))).toBe(true);
  });

  it("ไม่รวมเมื่อ doc_no ตรงกันแต่ description ต่างกัน (เอกสารรวมหลายรายการที่ถูกต้อง) — แค่แจ้งเตือน", () => {
    const rows = [
      expense({
        sheet: "RC001",
        receipt_no: "RC001",
        description: "ค่าจ้างเหมายานพาหนะ",
        amount: 500,
      }),
      expense({
        sheet: "RC002",
        receipt_no: "RC002",
        description: "ค่าส่งไปรษณีย์",
        amount: 100,
      }),
    ];
    const { groups, notices } = groupExpenseSplits(rows);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.total_amount).sort()).toEqual([100, 500]);
    expect(
      notices.some((n) => n.reason.includes("ปรากฏในหลายใบเสร็จ") && n.reason.includes("เอกสารรวมหลายรายการ"))
    ).toBe(true);
  });

  it("ไม่รวมเด็ดขาดเมื่อ doc_no ว่าง แม้ description+paid_date จะตรงกันข้าม sheet — แต่แจ้งเตือน", () => {
    const rows = [
      expense({ sheet: "RC001", receipt_no: "RC001", doc_no: null, amount: 200 }),
      expense({ sheet: "RC002", receipt_no: "RC002", doc_no: null, amount: 300 }),
    ];
    const { groups, notices } = groupExpenseSplits(rows);

    expect(groups).toHaveLength(2);
    expect(notices.some((n) => n.reason.includes("ไม่มีเลขที่ส่งออกให้ยืนยัน"))).toBe(true);
  });

  it("รวม amount ของแถวซ้ำ (receipt_no เดียวกัน) ใน key เดียวกันเป็น allocation เดียว พร้อมเตือน", () => {
    const rows = [
      expense({ sheet: "RC001", row: 5, receipt_no: "RC001", amount: 300 }),
      expense({ sheet: "RC001", row: 6, receipt_no: "RC001", amount: 200 }),
    ];
    const { groups, notices } = groupExpenseSplits(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].allocations).toEqual([{ receipt_no: "RC001", amount: 500 }]);
    expect(notices.some((n) => n.reason.includes("พบแถวซ้ำ"))).toBe(true);
  });

  it("แถวเดี่ยวปกติ (ไม่มีอะไรให้รวม) ผ่านไปเป็น 1 กลุ่มโดยไม่มี notice", () => {
    const rows = [expense({})];
    const { groups, notices } = groupExpenseSplits(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].allocations).toEqual([{ receipt_no: "RC001", amount: 1000 }]);
    expect(notices).toHaveLength(0);
  });
});

describe("toIsoDate", () => {
  it("แปลง string วันที่ พ.ศ. เป็น ISO ค.ศ.", () => {
    expect(toIsoDate("15/1/2569")).toBe("2026-01-15");
  });

  it("แปลงปี 2 หลักเป็น พ.ศ. เต็มก่อนแปลงเป็น ค.ศ.", () => {
    expect(toIsoDate("15/1/69")).toBe("2026-01-15");
  });

  it("แปลง Excel serial date (ฐาน ค.ศ. 1900) ปกติ", () => {
    // 46037 = 2026-01-15 ในปฏิทิน Excel มาตรฐาน
    expect(toIsoDate(46037)).toBe("2026-01-15");
  });

  it("แปลง Excel serial date ที่พิมพ์ปี พ.ศ. ลงเซลล์วันที่ (serial สูงผิดปกติ)", () => {
    // 244364 = serial ของ 2569-01-15 ตามปฏิทิน Excel ตรงตัว (ผู้ใช้พิมพ์ พ.ศ. ลงไป
    // Excel ตีความเป็น ค.ศ. 2569) — toIsoDate ต้องลบ 543 กลับให้ถูก
    expect(toIsoDate(244364)).toBe("2026-01-15");
  });

  it("คืน null เมื่อ format ไม่ตรง", () => {
    expect(toIsoDate("ไม่ใช่วันที่")).toBeNull();
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate("")).toBeNull();
  });
});

describe("toNumber", () => {
  it("แปลง string ที่มี comma คั่นหลักพันได้", () => {
    expect(toNumber("1,234.50")).toBe(1234.5);
  });

  it("แปลง string ที่มีสัญลักษณ์ ฿ ได้", () => {
    expect(toNumber("฿1,000")).toBe(1000);
  });

  it("รับ number ตรงๆ ได้เลย", () => {
    expect(toNumber(500)).toBe(500);
  });

  it("คืน null เมื่อแปลงไม่ได้", () => {
    expect(toNumber("abc")).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe("normalizePurpose", () => {
  it("จัดชื่อวัตถุประสงค์ที่สะกดต่างกันให้เป็นมาตรฐานเดียวกัน", () => {
    expect(normalizePurpose("ข้อ 1")).toBe("ข้อ 1");
    expect(normalizePurpose("ข้อ 2 ")).toBe("ข้อ 2");
    expect(normalizePurpose("พรก.")).toBe("ข้อ พรก.");
    expect(normalizePurpose("พระราชกฤษฎีกา")).toBe("ข้อ พรก.");
    expect(normalizePurpose("ไม่ระบุวัตถุประสงค์")).toBe("ข้อไม่ระบุวัตถุประสงค์");
    expect(normalizePurpose("อื่นๆ")).toBe("ข้อ อื่นๆ");
  });

  it("คืน null เมื่อไม่มีค่า", () => {
    expect(normalizePurpose(null)).toBeNull();
  });
});

describe("parseWorkbook (end-to-end: ไฟล์รายจ่าย 2 sheet ตัดจากเอกสารเดียวกัน)", () => {
  function ledgerSheet(receiptNo: string, amount: number) {
    return XLSX.utils.aoa_to_sheet([
      ["เล่มที่/เลขที่", "เลขที่ส่งออก", "วันที่จ่ายเงิน", "รายการ", "จำนวนยอด"],
      [receiptNo, "ท.13/69", "15/1/69", "ทุนการศึกษา เดือนมกราคม", amount],
    ]);
  }

  it("แตกเป็น 2 แถวดิบ แต่ประกอบกลับเป็น 1 รายจ่าย 2 allocation ผ่าน expenseGroups", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ledgerSheet("RC001", 600), "RC001");
    XLSX.utils.book_append_sheet(wb, ledgerSheet("RC002", 400), "RC002");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = parseWorkbook(buf);

    expect(result.fileType).toBe("expenses");
    expect(result.expenses).toHaveLength(2);
    expect(result.expenseGroups).toHaveLength(1);
    expect(result.expenseGroups[0].total_amount).toBe(1000);
    expect(result.expenseGroups[0].allocations).toEqual([
      { receipt_no: "RC001", amount: 600 },
      { receipt_no: "RC002", amount: 400 },
    ]);
    expect(result.notices.some((n) => n.reason.includes("ตัดเงินจาก 2 ใบเสร็จ"))).toBe(
      true
    );
  });
});
