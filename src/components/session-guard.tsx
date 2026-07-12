"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAndRedirect } from "@/lib/supabase/sign-out";
import { DEMO_MODE } from "@/lib/demo/config";
import { SESSION_FLAG_KEY, markSessionActive } from "@/lib/session-flag";

const IDLE_LIMIT_MS = 5 * 60 * 1000;
const WARNING_LEAD_MS = 30 * 1000;
const RESET_THROTTLE_MS = 1000;
const ACTIVITY_EVENTS = ["mousemove", "click", "scroll", "keydown"] as const;

/**
 * รวม 2 กลไกความปลอดภัย session ไว้ในที่เดียว:
 * 1. logout อัตโนมัติเมื่อไม่มีการตอบสนอง (idle) เกิน 5 นาที — เตือนก่อน 30 วินาทีสุดท้าย
 * 2. logout อัตโนมัติเมื่อปิด browser — ใช้ sessionStorage marker แทน session cookie ของ Supabase
 *    เพราะ @supabase/ssr เวอร์ชันที่ใช้อยู่บังคับ cookie maxAge เป็น 400 วันเสมอ ไม่รับค่าที่แอปกำหนดเอง
 *    (ดูรายละเอียดใน node_modules/@supabase/ssr/dist/main/cookies.js)
 *    ผลข้างเคียงที่ยอมรับแล้ว: logout ทุกครั้งที่ปิด "แท็บ" ไม่ใช่แค่ปิดทั้งโปรแกรม และหลายแท็บไม่แชร์ session กัน
 */
export default function SessionGuard() {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadlineRef = useRef(0);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResetRef = useRef(0);
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  const resetTimer = useCallback(() => {
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
    deadlineRef.current = Date.now() + IDLE_LIMIT_MS;
    setShowWarning(false);
    warningTimeoutRef.current = setTimeout(
      () => setShowWarning(true),
      IDLE_LIMIT_MS - WARNING_LEAD_MS
    );
    logoutTimeoutRef.current = setTimeout(() => {
      signOutAndRedirect(router);
    }, IDLE_LIMIT_MS);
  }, [router]);

  // ตรวจว่าเป็นแท็บ/browser ใหม่หรือไม่ (browser-close logout)
  useEffect(() => {
    if (DEMO_MODE) return;
    if (!sessionStorage.getItem(SESSION_FLAG_KEY)) {
      signOutAndRedirect(router);
      return;
    }
    markSessionActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // idle timer + activity listeners
  useEffect(() => {
    if (DEMO_MODE) return;

    resetTimer();

    function handleActivity() {
      const now = Date.now();
      if (now - lastResetRef.current < RESET_THROTTLE_MS) return;
      lastResetRef.current = now;
      resetTimer();
    }

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true })
    );

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity));
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (logoutTimeoutRef.current) clearTimeout(logoutTimeoutRef.current);
      if (displayIntervalRef.current) clearInterval(displayIntervalRef.current);
    };
  }, [resetTimer]);

  // นับถอยหลังแสดงผลตอน modal เตือนขึ้น (คำนวณจาก deadline ใหม่ทุกครั้ง กัน drift)
  useEffect(() => {
    if (!showWarning) {
      if (displayIntervalRef.current) clearInterval(displayIntervalRef.current);
      return;
    }
    stayButtonRef.current?.focus();
    function tick() {
      setSecondsLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
    }
    tick();
    displayIntervalRef.current = setInterval(tick, 250);
    return () => {
      if (displayIntervalRef.current) clearInterval(displayIntervalRef.current);
    };
  }, [showWarning]);

  if (DEMO_MODE || !showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-warning-title"
        aria-describedby="idle-warning-desc"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="idle-warning-title" className="text-lg font-bold text-slate-800">
          ไม่มีการใช้งาน
        </h2>
        <p id="idle-warning-desc" className="mt-2 text-sm text-slate-600" aria-live="polite">
          จะออกจากระบบใน {secondsLeft} วินาที เนื่องจากไม่มีการตอบสนอง
        </p>
        <button
          ref={stayButtonRef}
          type="button"
          onClick={resetTimer}
          className="mt-4 w-full rounded-lg bg-teal-700 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          อยู่ต่อ
        </button>
      </div>
    </div>
  );
}
