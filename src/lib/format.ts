const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "2569-02-10" → "10 ก.พ. 2569" */
export function formatThaiDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "-";
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${y + 543}`;
}

/** "2569-02-10" → "10 กุมภาพันธ์ 2569" */
export function formatThaiDateLong(isoDate: string | null | undefined): string {
  if (!isoDate) return "-";
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "-";
  return `${d} ${THAI_MONTHS[m - 1]} ${y + 543}`;
}

/** ปี พ.ศ. ของวันที่ ISO เช่น "2026-02-10" → 2569 */
export function beYear(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const y = Number(isoDate.slice(0, 4));
  return y ? y + 543 : null;
}

/** เดือน (1-12) ของวันที่ ISO */
export function monthOf(isoDate: string): number {
  return Number(isoDate.slice(5, 7));
}

/** จำนวนเงิน → "1,234,567.89" */
export function formatMoney(n: number | null | undefined): string {
  if (n == null) return "-";
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** ช่วงวันที่ ISO ของปี พ.ศ. หนึ่งปี (ม.ค.–ธ.ค.) */
export function beYearRange(be: number): { from: string; to: string } {
  const ce = be - 543;
  return { from: `${ce}-01-01`, to: `${ce}-12-31` };
}

/** วันนี้เป็นปี พ.ศ. อะไร */
export function currentBeYear(): number {
  return new Date().getFullYear() + 543;
}
