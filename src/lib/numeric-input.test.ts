import { describe, expect, it } from "vitest";
import {
  beYearRangeError,
  dayRangeError,
  filterDigits,
  filterMoney,
  moneyRangeError,
} from "@/lib/numeric-input";

describe("filterDigits", () => {
  it("คงตัวเลขปกติไว้", () => {
    expect(filterDigits("15", 2)).toBe("15");
    expect(filterDigits("2569", 4)).toBe("2569");
  });

  it("ตัดตัวอักษรและเครื่องหมายออกทั้งหมด (e, -, +, จุด, ไทย)", () => {
    expect(filterDigits("1e5", 4)).toBe("15");
    expect(filterDigits("-5", 2)).toBe("5");
    expect(filterDigits("+31", 2)).toBe("31");
    expect(filterDigits("2.5", 4)).toBe("25");
    expect(filterDigits("abc", 2)).toBe("");
    expect(filterDigits("สอง5", 2)).toBe("5");
  });

  it("ตัดหลักที่เกิน maxDigits", () => {
    expect(filterDigits("255555555", 4)).toBe("2555");
    expect(filterDigits("315", 2)).toBe("31");
  });

  it("string ว่างคืนว่าง", () => {
    expect(filterDigits("", 4)).toBe("");
  });
});

describe("filterMoney", () => {
  it("คงจำนวนเงินปกติไว้", () => {
    expect(filterMoney("1500")).toBe("1500");
    expect(filterMoney("1500.50")).toBe("1500.50");
    expect(filterMoney("0.01")).toBe("0.01");
  });

  it("ตัด e/+/-/comma/เว้นวรรค (กัน scientific notation)", () => {
    expect(filterMoney("1e5")).toBe("15");
    expect(filterMoney("-100")).toBe("100");
    expect(filterMoney("+100")).toBe("100");
    expect(filterMoney("1,500")).toBe("1500");
    expect(filterMoney("1 500")).toBe("1500");
  });

  it("เก็บเฉพาะจุดทศนิยมแรก", () => {
    expect(filterMoney("1.2.3")).toBe("1.23");
    expect(filterMoney("..5")).toBe(".5");
  });

  it("จำกัดทศนิยม 2 ตำแหน่ง", () => {
    expect(filterMoney("10.999")).toBe("10.99");
  });

  it("จำกัดหลักหน้าจุดไม่เกิน 9", () => {
    expect(filterMoney("12345678901")).toBe("123456789");
    expect(filterMoney("12345678901.55")).toBe("123456789.55");
  });

  it("ยอมให้พิมพ์จุดค้างไว้ระหว่างทาง (ยังไม่จบ)", () => {
    expect(filterMoney("15.")).toBe("15.");
  });
});

describe("dayRangeError", () => {
  it("ผ่านเมื่อ 1-31 หรือยังไม่กรอก", () => {
    expect(dayRangeError("1")).toBeNull();
    expect(dayRangeError("31")).toBeNull();
    expect(dayRangeError("")).toBeNull();
  });

  it("error เมื่อ 0 หรือเกิน 31", () => {
    expect(dayRangeError("0")).toContain("1-31");
    expect(dayRangeError("45")).toContain("1-31");
  });
});

describe("beYearRangeError", () => {
  it("ผ่านเมื่ออยู่ในช่วง 2500-2600", () => {
    expect(beYearRangeError("2569")).toBeNull();
    expect(beYearRangeError("2500")).toBeNull();
    expect(beYearRangeError("2600")).toBeNull();
  });

  it("ไม่ตัดสินระหว่างพิมพ์ยังไม่ครบ 4 หลัก", () => {
    expect(beYearRangeError("")).toBeNull();
    expect(beYearRangeError("2")).toBeNull();
    expect(beYearRangeError("256")).toBeNull();
  });

  it("error เมื่อครบ 4 หลักแต่นอกช่วง", () => {
    expect(beYearRangeError("2499")).toContain("2500-2600");
    expect(beYearRangeError("2700")).toContain("2500-2600");
    expect(beYearRangeError("9999")).toContain("2500-2600");
  });
});

describe("moneyRangeError", () => {
  it("ผ่านเมื่อมากกว่า 0 หรือยังไม่กรอก", () => {
    expect(moneyRangeError("0.01")).toBeNull();
    expect(moneyRangeError("1500")).toBeNull();
    expect(moneyRangeError("")).toBeNull();
  });

  it("error เมื่อ 0 หรือ parse ไม่ได้", () => {
    expect(moneyRangeError("0")).toContain("มากกว่า 0");
    expect(moneyRangeError("0.00")).toContain("มากกว่า 0");
    expect(moneyRangeError(".")).toContain("มากกว่า 0");
  });
});
