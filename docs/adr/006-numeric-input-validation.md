# ADR-006: กรอง Input ตัวเลขตั้งแต่ keystroke แทนการพึ่ง `<input type="number">`

สถานะ: ยอมรับแล้ว (15 ก.ค. 2569)

## บริบท

ผู้ใช้พบว่าช่อง "วัน" และ "พ.ศ." ใน `ThaiDateInput` พิมพ์ตัวอักษรได้ (`e`), ใส่เครื่องหมาย
ได้ (`+`/`-`), และใส่จำนวนหลักไม่จำกัดได้ (เช่น `255555555` ในช่องปี) ทั้งที่กำกับ
`min`/`max` ไว้แล้ว — ข้อมูลการเงินที่กรอกด้วยมือทุกวันมีโอกาสพลาดสูง ต้องกันที่ต้นทาง

**สาเหตุ**: HTML `<input type="number">` ไม่ block การพิมพ์จริง
- ยอมรับอักขระ `e`/`E` (scientific notation เช่น `1e10` = 10,000,000,000), `+`, `-`, `.`
- attribute `min`/`max` แค่ทำให้ CSS `:invalid` ทำงานและ browser เตือนตอน submit —
  ไม่จำกัดสิ่งที่พิมพ์ได้ระหว่างทาง
- `maxLength` ใช้ไม่ได้กับ `type="number"` (browser เมินตามสเปก HTML)

สำรวจทั้งโปรเจกต์แล้วพบจุดเสี่ยงลักษณะเดียวกัน 5 จุด: วัน/ปีใน `thai-date-input.tsx`,
จำนวนเงินใน `donation-form.tsx`, ยอดจ่ายรวมและยอดตัดเงินต่อใบใน `expense-form.tsx`
รวมถึงเส้นทางข้อมูลที่ NaN เล็ดลอดได้: `formatMoney(NaN)` แสดงข้อความ "NaN" ตรงๆ
และ `?year=` ใน URL ที่แก้เองได้ → `beYearRange(NaN)` → เงื่อนไข `"NaN-01-01"`
เข้า Supabase query เงียบๆ

## ทางเลือกที่พิจารณา

1. **คง `type="number"` + validate ตอน blur/submit** — พิมพ์ผิดได้แต่บันทึกไม่ผ่าน
   ข้อเสีย: ผู้ใช้เห็นค่าผิดค้างในช่องจนกว่าจะ submit และ `e`/`-` ยังพิมพ์ติด
2. **เปลี่ยนเป็น date picker ปฏิทิน** — กันพิมพ์ผิด 100% แต่ต้องสร้างปฏิทิน พ.ศ. เอง
   (native picker เป็น ค.ศ.) งานใหญ่เกินปัญหา
3. **`type="text"` + `inputMode` + กรองตั้งแต่ keystroke** ← เลือกทางนี้

## การตัดสินใจ

ใช้ `type="text"` + `inputMode="numeric"` (จำนวนเต็ม) / `inputMode="decimal"`
(จำนวนเงิน) แล้วกรองค่าในทุก `onChange` ผ่าน helper กลางใน `src/lib/numeric-input.ts`:

- `filterDigits(raw, maxDigits)` — เหลือเฉพาะ 0-9 ตัดหลักเกิน (วัน=2, ปี พ.ศ.=4)
- `filterMoney(raw)` — เลข + จุดเดียว, หน้าจุด ≤ 9 หลัก (999,999,999 บาท), หลังจุด ≤ 2
- `dayRangeError` / `beYearRangeError` / `moneyRangeError` — ตรวจช่วงค่า
  คืนข้อความไทยหรือ `null`

ค่าที่กรองไม่ได้ด้วยจำนวนหลัก (เช่น วัน `45`, ปี `2499`) แสดงขอบแดง + ผูกข้อความเข้า
`setCustomValidity()` ให้ native form validation block การ submit และชี้ช่องที่ผิดเอง

`inputMode` ทำให้มือถือยังขึ้น numeric keypad เหมือน `type="number"` เดิม —
ผู้ใช้ไม่เสียความสะดวก

**ขอบเขตค่าที่ตกลงกัน**:
- ปี พ.ศ.: 2500–2600 (ครอบคลุมข้อมูลย้อนหลังและอนาคตของภาควิชา) — ค่าคงที่
  `BE_YEAR_MIN`/`BE_YEAR_MAX` ใน `numeric-input.ts`
- จำนวนเงิน: > 0, ไม่เกิน 9 หลักหน้าจุด, ทศนิยม 2 ตำแหน่ง
- `?year=` จาก URL: `parseYearParam` ยอมรับเฉพาะจำนวนเต็ม 2400–2700
  นอกนั้นถือเป็น "ทั้งหมด" (ค่า default) — แก้ที่ต้นทางแทนการ guard ทุก caller

**Guard ปลายทางเสริม**: `formatMoney(NaN)` คืน `"-"` (เหมือน null) กันข้อความ
"NaN" โชว์ให้ผู้ใช้เห็นไม่ว่าข้อมูลจะเพี้ยนมาจากทางไหน

## แนวปฏิบัติสำหรับ input ตัวเลขใหม่ในอนาคต

- **ห้ามใช้ `<input type="number">`** — ใช้ component/helper ที่มีอยู่แทน:
  - จำนวนเงิน → `<MoneyInput>` (`src/components/money-input.tsx`)
  - วันที่ไทย → `<ThaiDateInput>` (`src/components/thai-date-input.tsx`)
  - ตัวเลขรูปแบบอื่น → ประกอบเองจาก helper ใน `src/lib/numeric-input.ts`
    (type="text" + inputMode + filter ใน onChange + setCustomValidity)
- ทุก helper ใหม่ต้องมี unit test ใน `*.test.ts` คู่กัน (vitest มีแล้วตั้งแต่ Candidate 4)

## ผลที่ตามมา

- ตัวอักษร/เครื่องหมาย/หลักเกินพิมพ์ไม่ติดตั้งแต่แรก — ผู้ใช้เห็นผลทันทีไม่ต้องรอ submit
- ค่าที่ไหลเข้า state เป็น numeric string ที่สะอาดเสมอ (`Number(...)` เดิมใช้ต่อได้ ไม่มี
  `"1e5"` แปลงเป็น 100000 โดยผู้ใช้ไม่รู้ตัว)
- เสีย spinner ขึ้น/ลงของ `type="number"` ไป — ยอมรับได้เพราะกรอกเลขตรงๆ เร็วกว่า
- ต้อง maintain กติกากรองเอง — มี unit test 6 ไฟล์คุมอยู่ (`numeric-input.test.ts`,
  `format.test.ts`, `year-range.test.ts` ฯลฯ)
