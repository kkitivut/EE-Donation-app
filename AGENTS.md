<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## วินัยการใช้ context/token (โปรเจกต์เล็ก ~80 ไฟล์)

โปรเจกต์นี้เล็กพอที่จะรู้ขอบเขตล่วงหน้าได้แทบทุกงาน — เลือกเครื่องมือให้เหมาะกับขนาดงาน ไม่ใช่ลดคุณภาพการตรวจสอบ:

- **ค้นหา**: รู้ path/ขอบเขตอยู่แล้ว → ใช้ Grep/Read/Glob ตรง ไม่เรียก Explore/general-purpose agent (แต่ละครั้งมี overhead หลายหมื่น token) สงวน agent ไว้เฉพาะงานที่ขอบเขตไม่ชัดจริงๆ
- **Browser verification ตามความเสี่ยง**: แก้ label/ข้อความ/CSS ล้วนๆ → อ่านโค้ด + เช็ค build พอ ไม่ต้องเปิด browser เต็ม flow; แก้ logic/state/validation/auth/schema → ค่อยเปิด browser test เต็มรูปแบบเหมือนเดิม
- **เช็ค build/test แบบสั้น**: ดูแค่ผ่าน/ไม่ผ่าน (grep หา "error"/"Compiled successfully"/"FAIL") ไม่ dump log เต็ม เว้นแต่ล้มเหลวแล้วต้อง diagnose
- **รวมรอบ verification**: หลายการเปลี่ยนแปลงเล็กที่ไม่ขึ้นต่อกัน ทำให้เสร็จก่อนแล้ว verify รวมครั้งเดียว แทนที่จะ build+test+browser ทีละจุด
- **คำถามยืนยัน**: ถามเท่าที่จำเป็นจริง ไม่ตั้งหลายคำถามพร้อม option ยาวถ้าบริบทเดาได้แล้ว

งาน security-sensitive, logic ซับซ้อน, หรือ schema change ยังต้องตรวจสอบเต็มรูปแบบเหมือนเดิม (ยืนยันก่อน commit, ตรวจสอบจริงไม่เดา) — กฎข้างต้นใช้กับงานความเสี่ยงต่ำเท่านั้น
