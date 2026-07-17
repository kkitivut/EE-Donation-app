import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";

describe("csvCell", () => {
  it("ข้อความปกติครอบด้วย double quote", () => {
    expect(csvCell("สมชาย")).toBe('"สมชาย"');
  });

  it("ตัวเลขเป็นทศนิยม 2 ตำแหน่ง ไม่ครอบ quote", () => {
    expect(csvCell(1234.5)).toBe("1234.50");
  });

  it("escape double quote ซ้อน", () => {
    expect(csvCell('a"b')).toBe('"a""b"');
  });

  it("กัน formula injection: เติม ' นำหน้า cell ที่ขึ้นต้นด้วย = + - @", () => {
    expect(csvCell("=1+1")).toBe(`"'=1+1"`);
    expect(csvCell("+SUM(A1)")).toBe(`"'+SUM(A1)"`);
    expect(csvCell("-2")).toBe(`"'-2"`);
    expect(csvCell("@cmd")).toBe(`"'@cmd"`);
  });

  it("ไม่แตะข้อความที่ไม่ได้ขึ้นต้นด้วยอักขระอันตราย", () => {
    expect(csvCell("ท13/69")).toBe('"ท13/69"');
  });
});

describe("csvRow", () => {
  it("รวม cell ด้วย comma", () => {
    expect(csvRow(["a", 1, "=b"])).toBe(`"a",1.00,"'=b"`);
  });
});
