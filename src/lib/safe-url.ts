/**
 * ตรวจว่า URL ปลอดภัยที่จะนำไปใส่ใน href หรือไม่ — อนุญาตเฉพาะ scheme http/https
 *
 * `drive_url` เป็น free-text ที่ผู้ใช้กรอกเอง (และนำเข้าจาก Excel ได้) ถ้าปล่อยให้เป็น
 * `javascript:` หรือ `data:` แล้วนำไป render เป็น <a href> จะกลายเป็น stored XSS —
 * เมื่อเจ้าหน้าที่คนอื่นคลิกจะรันสคริปต์ในเซสชันของเขา RLS ของระบบเปิดให้ผู้ใช้ที่ login
 * ทุกคนแก้ทุกแถวได้ จึงต้องกันที่ชั้นแอปเอง (ดู ADR-007)
 */
export function isSafeHttpUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const scheme = new URL(url).protocol;
    return scheme === "http:" || scheme === "https:";
  } catch {
    // parse ไม่ได้ (relative/ว่าง/ผิดรูปแบบ) ถือว่าไม่ปลอดภัย
    return false;
  }
}
