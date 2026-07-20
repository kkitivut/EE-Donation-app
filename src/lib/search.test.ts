import { describe, expect, it } from "vitest";
import { orIlikeFilter } from "@/lib/search";

describe("orIlikeFilter", () => {
  it("คงจุดไว้ในเลขที่ใบเสร็จจริง (ไม่ตัดทิ้งเหมือนของเดิม)", () => {
    expect(orIlikeFilter(["receipt_no"], "บส.31/2200")).toBe(
      `receipt_no.ilike."%บส.31/2200%"`
    );
  });

  it("คงจุดในเลขที่ส่งออก", () => {
    expect(orIlikeFilter(["doc_no"], "ท.13/69")).toBe(`doc_no.ilike."%ท.13/69%"`);
  });

  it("ประกอบหลายคอลัมน์คั่นด้วย comma", () => {
    expect(orIlikeFilter(["donor_name", "receipt_no"], "บส.16")).toBe(
      `donor_name.ilike."%บส.16%",receipt_no.ilike."%บส.16%"`
    );
  });

  it("คงข้อความไทยปกติไว้เหมือนเดิม", () => {
    expect(orIlikeFilter(["donor_name"], "สมชาย ใจดี")).toBe(
      `donor_name.ilike."%สมชาย ใจดี%"`
    );
  });

  it("escape เครื่องหมาย \" และ \\ ในค่าค้นหา (กันหลุด quote)", () => {
    expect(orIlikeFilter(["donor_name"], 'a"b')).toBe(
      `donor_name.ilike."%a\\"b%"`
    );
    expect(orIlikeFilter(["donor_name"], "a\\b")).toBe(
      `donor_name.ilike."%a\\\\b%"`
    );
  });

  it("ชื่อบริษัทที่มี comma และวงเล็บค้นเจอได้ (เดิมค้นไม่เจอเพราะถูกตัดทิ้ง)", () => {
    expect(orIlikeFilter(["donor_name"], "บริษัท เอบีซี จำกัด (มหาชน), สาขา 1")).toBe(
      `donor_name.ilike."%บริษัท เอบีซี จำกัด (มหาชน), สาขา 1%"`
    );
  });

  it("trim ช่องว่างหัวท้าย", () => {
    expect(orIlikeFilter(["donor_name"], "  abc  ")).toBe(`donor_name.ilike."%abc%"`);
  });

  it("คืน filter ว่างเมื่อ input ว่าง (เรียกด้วยค่าว่างไม่ควรเกิดขึ้นจริง แต่ไม่ throw)", () => {
    expect(orIlikeFilter(["donor_name"], "")).toBe(`donor_name.ilike."%%"`);
  });
});
