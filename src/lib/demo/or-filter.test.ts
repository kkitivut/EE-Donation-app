import { describe, expect, it } from "vitest";
import { splitOrTopLevel, unquoteValue } from "@/lib/demo/or-filter";
import { orIlikeFilter } from "@/lib/search";

describe("splitOrTopLevel", () => {
  it("แยกด้วย comma ปกติเมื่อไม่มี quote", () => {
    expect(splitOrTopLevel("a.ilike.x,b.ilike.y")).toEqual(["a.ilike.x", "b.ilike.y"]);
  });

  it("ไม่แยก comma ที่อยู่ใน quote", () => {
    expect(splitOrTopLevel('a.ilike."%x, y%",b.ilike.z')).toEqual([
      'a.ilike."%x, y%"',
      "b.ilike.z",
    ]);
  });

  it("ข้าม comma ที่ escape อยู่หลัง backslash ใน quote โดยไม่แยกผิดจุด", () => {
    expect(splitOrTopLevel('a.ilike."%x\\"y%",b.ilike.z')).toEqual([
      'a.ilike."%x\\"y%"',
      "b.ilike.z",
    ]);
  });
});

describe("unquoteValue", () => {
  it("ถอด quote และคง . / ไว้เหมือนเดิม", () => {
    expect(unquoteValue('"%บส.31/2200%"')).toBe("%บส.31/2200%");
  });

  it("unescape \\\" และ \\\\ ", () => {
    expect(unquoteValue('"%a\\"b%"')).toBe('%a"b%');
    expect(unquoteValue('"%a\\\\b%"')).toBe("%a\\b%");
  });

  it("ค่าที่ไม่ได้ quote คืนค่าเดิม", () => {
    expect(unquoteValue("plain")).toBe("plain");
  });
});

describe("integration: orIlikeFilter → splitOrTopLevel/unquoteValue round-trip", () => {
  it("filter ที่ประกอบจาก search.ts ถูก parse กลับมาได้ค่าเดิมเป๊ะ (เคสจุดในเลขที่ใบเสร็จ)", () => {
    const raw = orIlikeFilter(["donor_name", "receipt_no"], "บส.31/2200");
    const parts = splitOrTopLevel(raw);
    expect(parts).toHaveLength(2);
    const value = unquoteValue(parts[0].split(".").slice(2).join("."));
    expect(value).toBe("%บส.31/2200%");
  });

  it("ชื่อที่มี comma และวงเล็บ round-trip ถูกต้อง (ไม่ถูกตัดกลางคำ)", () => {
    const raw = orIlikeFilter(["donor_name"], "บริษัท เอบีซี จำกัด (มหาชน), สาขา 1");
    const parts = splitOrTopLevel(raw);
    expect(parts).toHaveLength(1); // comma ในค่าต้องไม่ถูกนับเป็นตัวคั่นเงื่อนไข
    const value = unquoteValue(parts[0].split(".").slice(2).join("."));
    expect(value).toBe("%บริษัท เอบีซี จำกัด (มหาชน), สาขา 1%");
  });
});
