# ระบบบริหารจัดการเงินบริจาค — ภาควิชาวิศวกรรมไฟฟ้า

เว็บแอปจัดการเงินบริจาค: ทะเบียนใบเสร็จ, ตัดรายจ่าย (หลายใบเสร็จได้),
แดชบอร์ด, รายงานรายปี และนำเข้าข้อมูลจาก Excel

- Next.js 16 + TypeScript + Tailwind CSS (deploy บน Vercel)
- Supabase (PostgreSQL + Auth + RLS)
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

## โครงสร้างข้อมูล (ย่อ)

```
donations (ใบเสร็จ) ─┬─ purposes (วัตถุประสงค์)
                     ├─ fd13_codes (รหัสกองทุน)
                     └─ categories (หมวดหมู่)
expenses (รายจ่าย) ──< expense_allocations >── donations
ยอดคงเหลือ = view donation_balances (คำนวณสด ไม่เก็บซ้ำ)
```
