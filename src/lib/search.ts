/**
 * ทำความสะอาดคำค้นหาจากผู้ใช้ก่อนนำไปต่อเป็น string ของ PostgREST `.or()` filter
 *
 * `.or()` ใช้ `,` แยกเงื่อนไข, `.` แยก column.operator.value, และ `()` สำหรับ nested logic
 * ถ้าปล่อยให้ผู้ใช้พิมพ์อักขระเหล่านี้ต่อเข้า filter string ตรงๆ จะทำให้ query parse ผิด
 * (error หรือเงื่อนไขเพี้ยนจากที่ตั้งใจ) — จึงตัดอักขระที่ทำลาย syntax ออกก่อน
 *
 * ครอบเฉพาะจุดที่ประกอบ `.or()` เป็น string เอง; การเรียก `.ilike(col, value)` แบบ
 * method call ส่งค่าเป็น parameter แยก ไม่ต้องผ่านฟังก์ชันนี้
 */
export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,().*]/g, "").trim();
}
