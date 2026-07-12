# ระบบบริหารจัดการเงินบริจาค — ภาควิชาวิศวกรรมไฟฟ้า

เว็บแอปจัดการเงินบริจาค: ทะเบียนใบเสร็จ, ตัดรายจ่าย (หลายใบเสร็จได้),
แดชบอร์ด, รายงานรายปี (ดูรายปีหรือ "ทั้งหมด" รวมทุกปี) และนำเข้าข้อมูลจาก Excel

- Next.js 16 + TypeScript + Tailwind CSS (deploy บน Vercel, pin region ให้ตรงกับ
  Supabase ผ่าน `vercel.json`)
- Supabase (PostgreSQL + Auth + RLS)
- Auto-logout เมื่อไม่มีการใช้งานเกิน 5 นาที และ logout อัตโนมัติเมื่อปิด browser
- เอกสารการออกแบบ: [docs/adr/](docs/adr/) · [docs/glossary.md](docs/glossary.md)

## ติดตั้งครั้งแรก

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com) (ฟรี)
2. เปิด **SQL Editor** → วางเนื้อหา [supabase/schema.sql](supabase/schema.sql) ทั้งไฟล์ → Run
3. เปิด **Authentication → Users → Add user** สร้างบัญชีเจ้าหน้าที่ (email + password,
   เลือก Auto confirm)
4. เปิด **Project Settings → API** คัดลอกค่าใส่ `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

5. รันในเครื่อง:

   ```
   npm install
   npm run dev
   ```

6. เข้า http://localhost:3000 → login → ตั้งค่า → นำเข้าข้อมูลจาก Excel
   (**นำเข้าไฟล์ข้อมูลบริจาคก่อน แล้วจึงไฟล์รายจ่าย**)

## Deploy ขึ้น Vercel

1. push โค้ดขึ้น GitHub
2. [vercel.com](https://vercel.com) → Import repository
3. ใส่ Environment Variables 2 ตัวเดียวกับ `.env.local` → Deploy
4. เช็คว่า `vercel.json` (มีอยู่แล้วในโปรเจกต์) กำหนด `regions` ให้ตรงกับ region ของ
   Supabase project — ไม่งั้นทุก query จะมี latency ข้ามทวีปโดยไม่จำเป็น (ดู
   [docs/adr/004-performance-region-and-query-optimization.md](docs/adr/004-performance-region-and-query-optimization.md))

**สำคัญ**: ทุกครั้งที่ `supabase/schema.sql` มีการเพิ่ม view/RPC ใหม่ (เช่นตอนอัปเดตโค้ด
จาก git) ต้องคัดลอกส่วนที่เพิ่มไปรันใน Supabase SQL Editor เองก่อน ไม่งั้นหน้าที่เกี่ยวข้อง
จะ error หลัง deploy — โปรเจกต์นี้ไม่มี migration tool อัตโนมัติ

## โครงสร้างข้อมูล (ย่อ)

```
donations (ใบเสร็จ) ─┬─ purposes (วัตถุประสงค์)
                     ├─ fd13_codes (รหัสกองทุน)
                     └─ categories (หมวดหมู่)
expenses (รายจ่าย) ──< expense_allocations >── donations

ยอดคงเหลือ:
  - view donation_balances       — ใช้ในหน้ารายละเอียดใบเสร็จ, ฟอร์มตัดรายจ่าย
  - view donations_list_view     — ใช้ในหน้ารายการบริจาค (join lookup + balance ในตัว)
สรุปยอด:
  - RPC overall_summary()        — ยอดสะสมทั้งหมด (dashboard)
  - RPC yearly_summary()         — สรุปรายรับ-รายจ่ายแยกตามปี (กราฟเปรียบเทียบรายปี)
ทั้งหมดคำนวณสดจากฐานข้อมูล ไม่มีการเก็บค่าซ้ำ
```
