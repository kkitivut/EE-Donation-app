import { describe, expect, it } from "vitest";
import { sanitizeSearchTerm } from "@/lib/search";

describe("sanitizeSearchTerm", () => {
  it("คงข้อความไทยปกติไว้เหมือนเดิม", () => {
    expect(sanitizeSearchTerm("สมชาย ใจดี")).toBe("สมชาย ใจดี");
  });

  it("คงเลขที่ใบเสร็จปกติไว้ (ตัดเฉพาะจุด)", () => {
    // '.' เป็น separator ของ PostgREST filter จึงถูกตัดออก
    expect(sanitizeSearchTerm("ท13/69")).toBe("ท13/69");
  });

  it("ตัดอักขระที่ทำลาย syntax ของ .or() ออก (, ( ) . *)", () => {
    expect(sanitizeSearchTerm("foo,bar")).toBe("foobar");
    expect(sanitizeSearchTerm("a(b)c")).toBe("abc");
    expect(sanitizeSearchTerm("x.y")).toBe("xy");
    expect(sanitizeSearchTerm("a*b")).toBe("ab");
  });

  it("ตัด attempt injection เงื่อนไข or เพิ่ม", () => {
    // พยายามแทรก ',amount.gt.0' เพื่อเพิ่มเงื่อนไข — อักขระโครงสร้างถูกถอดหมด
    expect(sanitizeSearchTerm("x,amount.gt.0")).toBe("xamountgt0");
  });

  it("trim ช่องว่างหัวท้าย", () => {
    expect(sanitizeSearchTerm("  abc  ")).toBe("abc");
  });

  it("คืน string ว่างเมื่อ input ว่าง", () => {
    expect(sanitizeSearchTerm("")).toBe("");
    expect(sanitizeSearchTerm("   ")).toBe("");
  });
});
