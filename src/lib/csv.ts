/**
 * แปลงค่าเป็น CSV cell แบบปลอดภัย
 *
 * - ตัวเลข: ทศนิยม 2 ตำแหน่ง
 * - ข้อความ: ครอบ `"` และ escape `"` ซ้อน
 * - กัน CSV formula injection: cell ที่ขึ้นต้นด้วย = + - @ tab CR อาจถูก Excel/Sheets
 *   รันเป็นสูตร (เช่น ชื่อผู้บริจาคที่ขึ้นต้นด้วย =) จึงเติม ' นำหน้าให้เป็นข้อความล้วน
 */
export function csvCell(v: string | number): string {
  if (typeof v === "number") return v.toFixed(2);
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(",");
}
