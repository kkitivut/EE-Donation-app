# ADR-005: Idle Auto-Logout และ Logout เมื่อปิด Browser

สถานะ: ยอมรับแล้ว (13 ก.ค. 2569)

## บริบท

ข้อมูลเงินบริจาค/รายจ่ายเป็นข้อมูลอ่อนไหว ผู้ใช้ต้องการให้ระบบ:
1. Logout อัตโนมัติเมื่อไม่มีการใช้งานเกิน 5 นาที (กันกรณีลืม log out แล้วเดินจากไป)
2. Logout อัตโนมัติเมื่อปิด browser (กันกรณีใช้เครื่องสาธารณะ/เครื่องส่วนกลาง)

## ทางเลือกที่พิจารณาสำหรับข้อ 2 (logout เมื่อปิด browser)

วิธีมาตรฐานคือทำให้ session cookie ของ Supabase เป็น "session cookie" (ไม่มี
`Max-Age`/`Expires` — บราวเซอร์ลบให้เองตอนปิดโปรแกรม) ผ่าน `cookieOptions.maxAge`
ตอนสร้าง Supabase client

**ตรวจสอบแล้วว่าใช้ไม่ได้กับเวอร์ชันที่ติดตั้งอยู่**: อ่านซอร์สจริงของ `@supabase/ssr`
(`node_modules/@supabase/ssr/dist/main/cookies.js` บรรทัด ~202-206 และ ~390-393) พบว่า
ตอนเขียนคุกกี้ (`setItem`) โค้ดของ library เขียนไว้แบบนี้:

```js
const setCookieOptions = {
  ...DEFAULT_COOKIE_OPTIONS,
  ...options?.cookieOptions,           // ค่าที่แอปกำหนดเอง
  maxAge: DEFAULT_COOKIE_OPTIONS.maxAge,  // แต่บรรทัดนี้ทับกลับเป็น 400 วันเสมอ
};
```

ไม่ว่าแอปจะส่ง `cookieOptions.maxAge` (รวมถึง `undefined` ซึ่งเป็นวิธี "ทำให้เป็น session
cookie" ตามมาตรฐาน) เข้าไปอย่างไร คุกกี้ที่เขียนจริงจะเป็น persistent cookie อายุ 400 วัน
เสมอ — วิธีมาตรฐานจึงใช้ไม่ได้กับแพ็กเกจเวอร์ชันนี้ ถ้าอัปเดต `@supabase/ssr` ในอนาคต
ควรเช็คซ้ำว่าพฤติกรรมนี้เปลี่ยนหรือยัง ก่อนลองวิธี cookie มาตรฐานอีกครั้ง

## การตัดสินใจ

แก้ปัญหาที่ระดับแอปแทนการแก้ที่ cookie ของ Supabase: ใช้ `sessionStorage` marker
(`ee_session_active`, ดู `src/lib/session-flag.ts`) เป็นตัวบอกว่า "แท็บนี้อยู่ในเซสชันที่
login ผ่านมาแล้ว":

- ตั้งค่า marker ทันทีหลัง `signInWithPassword` สำเร็จ (`src/app/login/page.tsx`)
- ทุกครั้งที่ `SessionGuard` (`src/components/session-guard.tsx`, mount ใน
  `(app)/layout.tsx`) mount ขึ้นมา จะเช็ค marker — ถ้าไม่มี = ถือว่าเป็นแท็บ/browser ใหม่
  → บังคับ signOut ทันที

Idle timeout implement แยกในตัวเดียวกัน (`SessionGuard`) ด้วย `setTimeout` คู่ (เตือนที่
4:30, logout ที่ 5:00) คำนวณจาก deadline timestamp แบบ absolute ไม่ใช่ตัวนับถอยหลัง
เพื่อกัน drift ตอนแท็บถูก browser throttle (background tab)

signOut logic ที่ใช้ร่วมกันระหว่าง `Nav.tsx` และ `SessionGuard` ถูกดึงออกมาเป็น
`signOutAndRedirect()` ที่ `src/lib/supabase/sign-out.ts`

## ผลที่ตามมา (ข้อจำกัดที่ยอมรับแล้ว)

- **sessionStorage เป็นแบบต่อแท็บ (per-tab)** ไม่ใช่ต่อ browser process — เปิดแท็บใหม่
  (ไม่ใช่ปิด-เปิด browser จริง) ก็จะโดน logout เหมือนกัน เพราะแยกแยะสองกรณีนี้ไม่ได้ด้วย
  sessionStorage API และเปิดหลายแท็บพร้อมกันจะไม่แชร์ session กัน ต้อง login แยกแท็บ —
  ผู้ใช้รับทราบและยอมรับข้อจำกัดนี้แล้ว
- **บั๊กที่เจอระหว่างพัฒนา (แก้แล้ว)**: ตอนแรก marker ถูกตั้งค่าเฉพาะใน `SessionGuard`
  เอง ทำให้ mount แรกหลัง login สำเร็จ (ซึ่งยังไม่เคยมี marker เพราะหน้า `/login` ไม่ได้
  mount `SessionGuard`) เข้าใจผิดว่าเป็นแท็บใหม่แล้ว signOut ทันที กลายเป็น login ไม่ติด
  ทุกครั้ง — แก้โดยย้ายจุดตั้งค่า marker ไปที่หน้า login ตอน sign-in สำเร็จแทน
- Idle-timeout และ browser-close logout ทั้งคู่ถูกข้ามเมื่อ `DEMO_MODE` เปิดอยู่ (กัน
  ชนกับ `proxy.ts` ที่ redirect ออกจาก `/login` เสมอในโหมดสาธิต)
