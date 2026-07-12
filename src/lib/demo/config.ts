const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const configured = !!url && !url.includes("YOUR-PROJECT");

/**
 * โหมดสาธิต: ใช้ข้อมูลจำลองในหน่วยความจำแทน Supabase จริง
 * เปิดอัตโนมัติเมื่อยังไม่ได้ตั้งค่า Supabase (.env.local ยังเป็นค่า placeholder)
 * ปิดอัตโนมัติทันทีที่ใส่ค่า Supabase จริงแล้ว — ไม่ต้องแก้ไขไฟล์นี้
 */
export const DEMO_MODE =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" || !configured;

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@ee.kmutt.ac.th",
};
