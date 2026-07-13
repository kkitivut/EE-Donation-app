/**
 * กติกาการตัดเงินจากใบเสร็จหลายใบต่อรายจ่ายหนึ่งรายการ (allocation) — ต้องตรงกับ
 * RPC `save_expense` ใน supabase/schema.sql และ demo engine (src/lib/demo/engine.ts)
 */

/** จำนวนที่แนะนำให้ตัดจากใบเสร็จที่เพิ่งเลือก: ส่วนที่ยังขาดจากยอดจ่ายรวม หรือเท่าที่ใบนี้มี */
export function suggestAllocationAmount(
  totalAmount: number,
  alreadyAllocated: number,
  balance: number
): number {
  const remaining = Math.max(0, totalAmount - alreadyAllocated);
  return Math.min(remaining || balance, balance);
}

/** ผลรวมการตัดเงินต้องเท่ากับยอดจ่ายรวม (เทียบเป็นสตางค์ กันปัญหาทศนิยม) */
export function allocationSumMatches(
  allocatedSum: number,
  totalAmount: number
): boolean {
  return Math.round(allocatedSum * 100) === Math.round(totalAmount * 100);
}

/** หาใบเสร็จที่ถูกตัดเงินเกินยอดที่ตัดได้ (allowance 0.005 กันปัญหาทศนิยม) — undefined ถ้าไม่มี */
export function findOverAllocated<T extends { amount: number; available: number }>(
  allocations: T[]
): T | undefined {
  return allocations.find((a) => a.amount > a.available + 0.005);
}
