# ADR-007: Security Review รอบ 2 — drive_url XSS, CSP, xlsx, CSV injection

สถานะ: ยอมรับแล้ว (17 ก.ค. 2569)

## บริบท

Security review รอบ 1 (ADR-005 ช่วงเดียวกัน, commit `afdc8c1`) แก้ 5 จุด รอบนี้ตรวจซ้ำทั้ง 3 ด้าน
(auth/session/RLS, input/injection, secrets/config) เพื่อยืนยันว่ารอบ 1 ยังไม่ถูก regress และหา
ช่องโหว่ใหม่ที่อาจเกิดหลังงาน UI/กราฟและ ADR-006

**ยืนยันว่ายังปลอดภัย (ไม่ต้องแก้)**: auth gate `proxy.ts` ไม่มี bypass (matcher ครอบทุก route,
default-deny), ไม่มี service-role key ที่ไหนเลย (ใช้ anon key อย่างเดียวถูกต้องตาม RLS design),
signup เป็น admin-only ผ่าน Supabase dashboard (flat RLS `using(true)` จึงเป็น tradeoff ที่ยอมรับได้
สำหรับทีมเล็กที่เชื่อถือได้ ไม่ใช่ช่องโหว่), ไม่มี Server Actions, query ทุกจุด parameterized,
ไม่มี `dangerouslySetInnerHTML`, headers รอบ 1 ยังครบ, `.env.local` ไม่เคยถูก commit

## ปัญหาที่เจอและการตัดสินใจ

### 1. `drive_url` stored XSS (Medium-High) — แก้แล้ว

หน้ารายละเอียดใบเสร็จ (`donations/[id]/page.tsx`) render `href={d.drive_url}` ตรงๆ และ `drive_url`
เป็น free-text (`<input type="url">` ซึ่ง**ไม่กัน** scheme `javascript:`/`data:`) เพราะ RLS เปิดให้
ผู้ใช้ที่ login ทุกคนแก้ทุกแถวได้ ผู้ใช้คนหนึ่งใส่ `drive_url = javascript:...` ในใบเสร็จใดก็ได้
เมื่อเจ้าหน้าที่อีกคนเปิดหน้านั้นแล้วคลิก จะรันสคริปต์ในเซสชันของเขา (ขโมย session/เขียนข้อมูลแทน)
ตัว importer (`import-excel.ts`) ก็ push `drive_url` จาก cell Excel ตรงๆ ไม่ตรวจ

**แก้ 4 ชั้น (defense in depth)** เพราะ RLS ไม่ได้เป็น backstop ให้:
- util กลาง `src/lib/safe-url.ts` `isSafeHttpUrl()` — parse ด้วย `new URL()` คืน true เฉพาะ http/https
- จุด render: ถ้า `drive_url` ไม่ผ่านให้แสดงเป็น plain text ไม่ทำเป็นลิงก์
- จุดรับ input: validate ใน submit ของ `donation-form.tsx`/`expense-form.tsx` และกรองใน importer
- DB `check` constraint บน `donations.drive_url`/`expenses.drive_url` (`~* '^https?://'`) เป็น
  backstop สุดท้ายที่กันแม้การเรียก Supabase client ตรงๆ **ต้องรัน SQL migration เอง** (ดูท้ายไฟล์)

### 2. `xlsx` (SheetJS) ช่องโหว่ high — แก้แล้ว

`xlsx ^0.18.5` มี prototype pollution + ReDoS ไม่มี fix บน npm (SheetJS ย้ายไป self-host)
เปลี่ยนเป็น build ที่ patch แล้วจาก CDN ทางการ: `xlsx@0.20.3` จาก `https://cdn.sheetjs.com/...`
API เข้ากันได้ ไม่ต้องแก้โค้ด (`package.json` กลายเป็น URL dependency) — `npm audit` เหลือแค่ 2
moderate (postcss transitive ผ่าน next, ไม่มี fix ถ้าไม่ downgrade next, ความเสี่ยงจริงต่ำ)

### 3. CSV formula injection (Low) — แก้แล้ว

`export-csv-button.tsx` ไม่กัน cell ที่ขึ้นต้นด้วย `= + - @` (Excel/Sheets รันเป็นสูตร เช่น ชื่อ
ผู้บริจาคที่ขึ้นต้นด้วย `=`) แยก logic ออกเป็น `src/lib/csv.ts` (testable) และเติม `'` นำหน้า cell
ที่ขึ้นต้นด้วยอักขระอันตราย

### 4. `dashboard-data.ts` กลืน DB error เงียบ (Low) — แก้แล้ว

เดิม destructure เฉพาะ `data` ทิ้ง `error` ทุก query/RPC — ไม่ leak (ไม่ surface อะไร) แต่ถ้า DB ล้ม
จะโชว์ ฿0 เงียบๆ ไม่ log เลย ต่างจากที่อื่นในแอป เพิ่ม `console.error` ฝั่ง server (คงพฤติกรรม
return zeros/empty เดิม) — logging นี้เผยให้เห็นว่า demo engine ยังไม่มี `yearly_summary` (ดูข้อ
ค้างท้ายไฟล์)

### 5. เพิ่ม CSP + HSTS (Low-Med) — แก้แล้ว

รอบ 1 เลี่ยง CSP ไว้เพราะกลัว break Supabase/Tailwind ตอนนี้ recharts เป็น SVG ล้วน (ไม่ต้อง eval)
จึงใส่ได้ **ย้าย security headers ทั้งหมดจาก `vercel.json` ไป `next.config.ts` `headers()`** เพื่อให้
portable (ไม่ผูกกับ Vercel), ทดสอบ local ได้, และเป็น single source; `vercel.json` เหลือแค่ `regions`

CSP: `default-src 'self'`; `connect-src` เปิดให้ Supabase (REST + realtime wss); `script-src
'self' 'unsafe-inline'` (Next hydration ต้องการ inline; **production ไม่ต้อง `unsafe-eval`** แต่ dev
mode ต้องใช้ (React Fast Refresh) จึงเพิ่ม `unsafe-eval` เฉพาะเมื่อ `NODE_ENV !== production`);
`frame-ancestors 'none'`, `object-src 'none'`, `base-uri`/`form-action 'self'` + HSTS 2 ปี
ยืนยันด้วย `curl -I` ว่า header ออกครบ และเปิดแอปแล้วไม่มี CSP violation ใน console

## รายการ non-issue ที่ตรวจแล้วปลอดภัย (บันทึกไว้กันตรวจซ้ำ)

parameterized queries ทุกจุด, `sanitizeSearchTerm` (รอบ 1) ยังกันการแทรกเงื่อนไข `.or()` ได้,
error helper `toUserMessage` (รอบ 1) ยัง route ครบ, ไม่มี Server Actions, ไม่มี service-role key,
`.env.local` gitignored และไม่เคย commit

## การนำไปใช้ (ต้องทำเพิ่มโดยผู้ใช้)

**รัน SQL นี้ใน Supabase SQL Editor** เพื่อเพิ่ม check constraint กับตารางที่มีอยู่ (ข้อ 1 ชั้น DB):

```sql
alter table donations
  add constraint donations_drive_url_scheme
  check (drive_url is null or drive_url ~* '^https?://');
alter table expenses
  add constraint expenses_drive_url_scheme
  check (drive_url is null or drive_url ~* '^https?://');
```

(ถ้ามีข้อมูลเดิมที่ `drive_url` ไม่ใช่ http(s) อยู่แล้ว ต้องแก้/ล้างก่อน ไม่งั้น constraint จะ error)

## ข้อค้าง (นอกขอบเขต security รอบนี้)

`console.error` ที่เพิ่มในข้อ 4 เผยว่า **demo engine (`src/lib/demo/engine.ts`) drift จาก schema
จริง** — `executeRpc` ยังไม่มี `yearly_summary` (บรรทัด ~499) และ `doSelect` (บรรทัด ~214) crash เมื่อ
query ตาราง/วิวที่ engine ไม่รู้จัก (`donations_list_view`, join บน `expense_allocations`) ทำให้
โหมดสาธิตหน้าแดชบอร์ด/รายการบริจาคใช้ไม่ได้ — **ไม่กระทบ production** (Supabase จริงมี RPC/วิวครบ)
นี่คือ "Candidate 1 (demo engine drift)" ที่เลื่อนไว้ ควรยืนยัน priority กับผู้ใช้ก่อนแก้แยกต่างหาก
