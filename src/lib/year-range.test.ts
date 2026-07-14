import { describe, expect, it } from "vitest";
import { parseYearParam, yearFilterRange, yearListDescending } from "@/lib/year-range";

describe("parseYearParam", () => {
  it("ไม่มีค่า หรือ 'all' = ทั้งหมด", () => {
    expect(parseYearParam(undefined)).toEqual({ kind: "all" });
    expect(parseYearParam("")).toEqual({ kind: "all" });
    expect(parseYearParam("all")).toEqual({ kind: "all" });
  });

  it("ปี พ.ศ. ปกติ = ปีนั้น", () => {
    expect(parseYearParam("2569")).toEqual({ kind: "year", year: 2569 });
  });

  it("ค่าที่ parse ไม่ได้ (แก้ URL เอง) = ทั้งหมด ไม่ใช่ NaN", () => {
    expect(parseYearParam("abc")).toEqual({ kind: "all" });
    expect(parseYearParam("25x9")).toEqual({ kind: "all" });
  });

  it("ปีนอกช่วงสมเหตุสมผล (2400-2700) = ทั้งหมด", () => {
    expect(parseYearParam("99999")).toEqual({ kind: "all" });
    expect(parseYearParam("1")).toEqual({ kind: "all" });
    expect(parseYearParam("-2569")).toEqual({ kind: "all" });
  });

  it("ทศนิยม = ทั้งหมด (ปีต้องเป็นจำนวนเต็ม)", () => {
    expect(parseYearParam("2569.5")).toEqual({ kind: "all" });
  });
});

describe("yearFilterRange", () => {
  it("โหมดทั้งหมดคืน null (ไม่ filter)", () => {
    expect(yearFilterRange({ kind: "all" })).toBeNull();
  });

  it("ปีเฉพาะคืนช่วง ISO ค.ศ. ของปีนั้น", () => {
    expect(yearFilterRange({ kind: "year", year: 2569 })).toEqual({
      from: "2026-01-01",
      to: "2026-12-31",
    });
  });
});

describe("yearListDescending", () => {
  it("เรียงมากไปน้อยครอบคลุมทั้งช่วง", () => {
    expect(yearListDescending(2569, 2567)).toEqual([2569, 2568, 2567]);
  });

  it("ปีเดียวคืนลิสต์ตัวเดียว", () => {
    expect(yearListDescending(2569, 2569)).toEqual([2569]);
  });
});
