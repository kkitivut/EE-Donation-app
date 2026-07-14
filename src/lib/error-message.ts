/**
 * แปลง error จาก Supabase/PostgREST เป็นข้อความที่ปลอดภัยจะแสดงให้ผู้ใช้เห็น
 *
 * RPC ของแอปเอง (เช่น save_expense) ใช้ `raise exception` ซึ่ง PostgREST คืน code
 * `P0001` (raise_exception) พร้อมข้อความภาษาไทยที่ตั้งใจให้ผู้ใช้อ่าน — กรณีนี้แสดงต่อได้
 * ส่วน error อื่น (constraint violation, type error ฯลฯ) อาจมีชื่อ column/constraint ภายใน
 * หรือรายละเอียด schema หลุดออกมา จึงแทนด้วยข้อความ generic และเก็บ raw ไว้ใน console
 *
 * demo engine (src/lib/demo/engine.ts) จำลอง error validation ของตัวเองด้วย code
 * `P0001` เช่นกัน เพื่อให้ข้อความสาธิตยังแสดงตามเดิม
 */
export function toUserMessage(
  error: { message?: string; code?: string } | null | undefined,
  fallback = "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
): string {
  if (!error) return fallback;
  if (error.code === "P0001") return error.message ?? fallback;
  // เก็บรายละเอียดจริงไว้ debug แต่ไม่แสดงให้ผู้ใช้เห็น
  console.error("[db-error]", error);
  return fallback;
}
