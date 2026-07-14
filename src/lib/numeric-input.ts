/**
 * กติกาการกรอกตัวเลขในฟอร์ม — กรองตั้งแต่ keystroke แทนพึ่ง <input type="number">
 *
 * เหตุผล: HTML `<input type="number">` ไม่ block การพิมพ์จริง — ยอมให้พิมพ์ "e"
 * (scientific notation), เครื่องหมาย +/-, และจำนวนหลักไม่จำกัด attribute min/max
 * แค่ทำให้ CSS :invalid ทำงานตอน submit เท่านั้น จึงเปลี่ยนมาใช้ type="text" +
 * inputMode (มือถือได้ numeric keypad เหมือนเดิม) แล้วกรองด้วยฟังก์ชันชุดนี้
 * (ดู docs/adr/006-numeric-input-validation.md)
 */

/** กรองให้เหลือเฉพาะเลขโดด 0-9 และตัดความยาวตาม maxDigits (ช่องวัน=2, ปี พ.ศ.=4) */
export function filterDigits(raw: string, maxDigits: number): string {
  return raw.replace(/\D/g, "").slice(0, maxDigits);
}

/** จำนวนหลักหน้าจุดสูงสุดของช่องจำนวนเงิน (999,999,999 บาทพอสำหรับเงินบริจาคภาควิชา) */
const MONEY_MAX_INT_DIGITS = 9;
/** ทศนิยมสูงสุด 2 ตำแหน่ง (สตางค์) */
const MONEY_MAX_DECIMALS = 2;

/** กรองเป็นเลขทศนิยม: เลขโดด + จุดเดียว, หลักหน้าจุดไม่เกิน 9, หลังจุดไม่เกิน 2 — สำหรับช่องจำนวนเงิน */
export function filterMoney(raw: string): string {
  // ตัดทุกอย่างที่ไม่ใช่เลขหรือจุดก่อน (กัน e, +, -, เว้นวรรค, comma)
  const cleaned = raw.replace(/[^0-9.]/g, "");
  // เก็บเฉพาะจุดแรก จุดถัดไปตัดทิ้ง
  const firstDot = cleaned.indexOf(".");
  const intPart =
    firstDot === -1 ? cleaned : cleaned.slice(0, firstDot).replace(/\./g, "");
  const decPart =
    firstDot === -1 ? null : cleaned.slice(firstDot + 1).replace(/\./g, "");
  const int = intPart.slice(0, MONEY_MAX_INT_DIGITS);
  if (decPart === null) return int;
  return `${int}.${decPart.slice(0, MONEY_MAX_DECIMALS)}`;
}

/** ตรวจช่วงวันในเดือน — คืนข้อความ error หรือ null ถ้าผ่าน ("" = ยังไม่กรอก ไม่ถือว่าผิด) */
export function dayRangeError(day: string): string | null {
  if (day === "") return null;
  const d = Number(day);
  if (d < 1 || d > 31) return "วันต้องอยู่ระหว่าง 1-31";
  return null;
}

/** ช่วงปี พ.ศ. ที่ระบบยอมรับ — ครอบคลุมข้อมูลย้อนหลังและอนาคตอันใกล้ของภาควิชา */
export const BE_YEAR_MIN = 2500;
export const BE_YEAR_MAX = 2600;

/** ตรวจช่วงปี พ.ศ. — เช็คเฉพาะเมื่อกรอกครบ 4 หลัก (ระหว่างพิมพ์ยังไม่ตัดสิน) */
export function beYearRangeError(beYear: string): string | null {
  if (beYear.length < 4) return null;
  const y = Number(beYear);
  if (y < BE_YEAR_MIN || y > BE_YEAR_MAX)
    return `ปี พ.ศ. ต้องอยู่ระหว่าง ${BE_YEAR_MIN}-${BE_YEAR_MAX}`;
  return null;
}

/** ตรวจจำนวนเงิน — ต้องมากกว่า 0 ("" = ยังไม่กรอก ให้ required ของ form จัดการ) */
export function moneyRangeError(value: string): string | null {
  if (value === "") return null;
  const n = Number(value);
  if (!(n > 0)) return "จำนวนเงินต้องมากกว่า 0";
  return null;
}
