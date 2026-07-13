import { describe, expect, it } from "vitest";
import {
  allocationSumMatches,
  findOverAllocated,
  suggestAllocationAmount,
} from "@/lib/allocation";

describe("suggestAllocationAmount", () => {
  it("แนะนำส่วนที่ยังขาดจากยอดจ่ายรวม เมื่อใบเสร็จมีพอ", () => {
    expect(suggestAllocationAmount(1000, 400, 2000)).toBe(600);
  });

  it("แนะนำเท่าที่ใบเสร็จมี เมื่อยอดที่ขาดมากกว่ายอดคงเหลือ", () => {
    expect(suggestAllocationAmount(1000, 0, 300)).toBe(300);
  });

  it("แนะนำเต็มยอดคงเหลือ เมื่อยังไม่กรอกยอดจ่ายรวม (totalAmount = 0)", () => {
    expect(suggestAllocationAmount(0, 0, 500)).toBe(500);
  });

  it("แนะนำเต็มยอดคงเหลือ เมื่อตัดครบยอดจ่ายรวมแล้ว (remaining = 0)", () => {
    expect(suggestAllocationAmount(1000, 1000, 500)).toBe(500);
  });
});

describe("allocationSumMatches", () => {
  it("ตรงกันเมื่อยอดเท่ากันพอดี", () => {
    expect(allocationSumMatches(1500, 1500)).toBe(true);
  });

  it("ไม่ตรงกันเมื่อยอดต่างกัน", () => {
    expect(allocationSumMatches(1499, 1500)).toBe(false);
  });

  it("ทนทานต่อปัญหาการปัดเศษทศนิยม (floating point)", () => {
    expect(allocationSumMatches(0.1 + 0.2, 0.3)).toBe(true);
  });
});

describe("findOverAllocated", () => {
  it("คืน undefined เมื่อไม่มีใบเสร็จไหนถูกตัดเกิน", () => {
    const allocations = [
      { amount: 100, available: 100 },
      { amount: 50, available: 200 },
    ];
    expect(findOverAllocated(allocations)).toBeUndefined();
  });

  it("หาใบเสร็จที่ถูกตัดเกินยอดที่ตัดได้", () => {
    const allocations = [
      { amount: 100, available: 100 },
      { amount: 250, available: 200 },
    ];
    expect(findOverAllocated(allocations)?.amount).toBe(250);
  });

  it("ยอมรับส่วนต่างเล็กน้อยจากปัญหาทศนิยม (allowance 0.005)", () => {
    const allocations = [{ amount: 100.004, available: 100 }];
    expect(findOverAllocated(allocations)).toBeUndefined();
  });
});
