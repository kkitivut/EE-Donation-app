const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configured = !!url && !url.includes("YOUR-PROJECT");
const explicitDemo = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const isProd = process.env.NODE_ENV === "production";

// กันพลาดตอน deploy: ถ้าเป็น production แต่ยังไม่ได้ตั้ง Supabase URL จริง และไม่ได้
// สั่งเปิดโหมดสาธิตอย่างชัดเจน ให้ล้มทันทีแบบเห็นชัด — ดีกว่าปล่อยให้ auto-demo ปิด
// การยืนยันตัวตนทั้งระบบเงียบๆ (proxy.ts ข้าม auth เมื่อ DEMO_MODE เปิด)
if (isProd && !configured && !explicitDemo) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL ยังไม่ถูกตั้งค่าใน production — " +
      "ตั้งค่า env ให้ครบ หรือกำหนด NEXT_PUBLIC_DEMO_MODE=true อย่างชัดเจนถ้าต้องการโหมดสาธิตจริงๆ"
  );
}

/**
 * โหมดสาธิต: ใช้ข้อมูลจำลองในหน่วยความจำแทน Supabase จริง
 * - เปิดชัดเจนด้วย NEXT_PUBLIC_DEMO_MODE=true ได้ทุก environment
 * - เปิดอัตโนมัติเมื่อยังไม่ได้ตั้งค่า Supabase เฉพาะตอน dev/build ที่ไม่ใช่ production
 *   (ใน production การ config ไม่ครบจะ throw ข้างบนแทน ไม่ fallback เป็น demo เงียบๆ)
 */
export const DEMO_MODE = explicitDemo || (!configured && !isProd);

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@ee.kmutt.ac.th",
};
