# ADR-004: ลดความหน่วงจริง — Region Pinning, Auth Check, Query Consolidation

สถานะ: ยอมรับแล้ว (13 ก.ค. 2569)

## บริบท

ผู้ใช้รายงานว่าเว็บ "ช้า" หลังจากรอบก่อนหน้าแก้แค่ความรู้สึกช้าด้วย skeleton/spinner
(`loading.tsx`, `useTransition`) แล้ว — spinner ขึ้นถูกต้องแต่เวลาที่แท้จริงยังไม่ลดลง
ต้องหาสาเหตุความหน่วงจริงแล้วแก้ที่ต้นตอ

## สาเหตุที่พบ (ยืนยันด้วยการอ่านโค้ด + เอกสาร Vercel/Supabase จริง ไม่ได้เดา)

1. **Region mismatch** — Supabase project อยู่ Singapore (`ap-southeast-1`) แต่ Vercel
   function รัน default ที่ US (`iad1`) ทุก query จึงมี round-trip ข้ามทวีปโดยไม่จำเป็น
2. **Auth overhead ต่อ request** — `src/proxy.ts` เรียก `supabase.auth.getUser()` ทุก
   request ซึ่งยิง network call ไปยัง Supabase Auth server ก่อนที่หน้าเว็บจะเริ่มโหลดข้อมูลด้วยซ้ำ
3. **Full-table scan ที่ไม่จำเป็น** — `src/lib/dashboard-data.ts` ดึงทั้งตาราง
   `donations`/`expense_allocations` (limit 20000 แถว) มารวมยอดรายปีฝั่ง JS ทุกครั้งที่
   โหลด dashboard ทั้งที่ Postgres รวมยอดให้ได้ในคำสั่งเดียว
4. **Sequential round-trip ที่เหลือ** — หน้ารายการบริจาคต้อง query `donations` ก่อน
   แล้วค่อย query `donation_balances` แยกอีกรอบด้วย id ที่ได้มา (2 round-trip แทนที่จะเป็น 1)

## การตัดสินใจ

1. เพิ่ม `vercel.json` กำหนด `"regions": ["sin1"]` — ยืนยันจาก Vercel docs ว่า Hobby plan
   รองรับ single region ได้ (ไม่ใช่ฟีเจอร์ Pro-only ตามที่กังวลไว้แต่แรก)
2. เปลี่ยน `proxy.ts` จาก `supabase.auth.getUser()` เป็น `supabase.auth.getClaims()` —
   อ่านซอร์ส `@supabase/auth-js` ยืนยันว่า `getClaims()` verify JWT ในเครื่องถ้า project
   ใช้ asymmetric signing key และ **fallback ไปเรียก `getUser()` แบบเดิมโดยอัตโนมัติถ้าไม่ใช่**
   จึงไม่มีความเสี่ยงด้าน security เพิ่มขึ้นเลย มีแต่เร็วขึ้นหรือเท่าเดิม
3. เพิ่ม RPC `yearly_summary()` ใน `supabase/schema.sql` ให้ Postgres รวมยอดรายปีเอง
   แทนการดึง raw rows ทั้งตารางมารวมฝั่ง JS
4. สร้าง view `donations_list_view` (join `donations` + `purposes` + `categories` +
   ยอดคงเหลือในตัว) แทนการ query `donations` แล้วตามด้วย `donation_balances` แยก —
   ไม่แก้ view `donation_balances` เดิมเพราะมีที่อื่นใช้อยู่ (`expense-form.tsx`,
   หน้ารายละเอียดใบเสร็จ)

## ผลที่ตามมา

- ยืนยัน region จริงด้วย response header `X-Vercel-Id: sin1::...` (ไม่ใช้แค่ dashboard UI
  เพราะ Vercel dashboard settings page แสดงค่า default ที่ไม่อัปเดตตาม `vercel.json`)
- ทุกครั้งที่แก้ query ที่พึ่ง schema ใหม่ (RPC/view) ต้อง**รัน SQL ใน Supabase SQL editor
  ก่อน push code** ไม่งั้นหน้าที่เกี่ยวข้องจะ error ทันทีหลัง deploy — เป็น pattern ที่ต้อง
  ทำซ้ำทุกครั้งที่มีการแก้ schema ในโปรเจกต์นี้ (ไม่มี migration tool อัตโนมัติ มีแค่
  `supabase/schema.sql` ไฟล์เดียว apply ด้วยมือ)
- เพิ่มตัวเลือก "ทั้งหมด" (รวมทุกปี) ในตัวกรองปีทุกหน้า (แดชบอร์ด, รายงาน, รายการบริจาค,
  รายจ่าย) ตั้งเป็นค่า default แทนปีล่าสุด — `getDashboardData()` ข้าม filter ช่วงปีในโหมดนี้
