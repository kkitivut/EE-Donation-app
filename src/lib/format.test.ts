import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";

describe("formatMoney", () => {
  it("format จำนวนเงินปกติพร้อมทศนิยม 2 ตำแหน่ง", () => {
    expect(formatMoney(1234567.89)).toBe("1,234,567.89");
    expect(formatMoney(0)).toBe("0.00");
  });

  it("คืน '-' เมื่อ null/undefined", () => {
    expect(formatMoney(null)).toBe("-");
    expect(formatMoney(undefined)).toBe("-");
  });

  it("คืน '-' เมื่อ NaN (ไม่โชว์ข้อความ 'NaN' ให้ผู้ใช้เห็น)", () => {
    expect(formatMoney(NaN)).toBe("-");
  });
});
