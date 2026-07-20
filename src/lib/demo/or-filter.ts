/**
 * ตัวช่วย parse `.or()` filter string ของ demo engine — แยกไฟล์จาก engine.ts (ซึ่ง import
 * "server-only") เพื่อให้ทดสอบด้วย vitest ตรงๆ ได้โดยไม่ต้อง stub "server-only"
 */

/**
 * แยกเงื่อนไขของ `.or()` ด้วย `,` เฉพาะระดับบนสุด — ข้ามส่วนที่อยู่ใน `"..."` เพื่อไม่ให้
 * comma ที่อยู่ในค่า (เช่นชื่อบริษัท "จำกัด (มหาชน), สาขา...") ถูกตัดกลางคำ
 * ต้องเข้าคู่กับ src/lib/search.ts ที่ประกอบ .or() ด้วยการ quote ค่า (ดู ADR-008)
 */
export function splitOrTopLevel(raw: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && inQuotes) {
      cur += ch + (raw[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      cur += ch;
      continue;
    }
    if (ch === "," && !inQuotes) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

/** ถอด `"` ที่ครอบค่า และ unescape `\"` `\\` — คู่กับการ quote ใน src/lib/search.ts */
export function unquoteValue(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  return value;
}
