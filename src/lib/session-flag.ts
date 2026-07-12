/** key ของ sessionStorage marker ที่บอกว่า "แท็บนี้ผ่านการ login ในเซสชันปัจจุบันแล้ว"
 * ใช้ตรวจจับ browser-close logout ใน SessionGuard — ต้องตั้งค่าตอน login สำเร็จ
 * (ไม่งั้น mount แรกหลัง login จะเข้าใจผิดว่าเป็นแท็บ/browser ใหม่แล้ว sign out ทันที) */
export const SESSION_FLAG_KEY = "ee_session_active";

export function markSessionActive() {
  sessionStorage.setItem(SESSION_FLAG_KEY, "1");
}
