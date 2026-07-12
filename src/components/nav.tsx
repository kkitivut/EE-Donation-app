"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEMO_MODE } from "@/lib/demo/config";

const MENU = [
  { href: "/", label: "แดชบอร์ด", icon: "📊" },
  { href: "/donations", label: "รายการบริจาค", icon: "🧾" },
  { href: "/expenses", label: "รายจ่าย", icon: "💸" },
  { href: "/reports", label: "รายงาน", icon: "📑" },
  { href: "/settings", label: "ตั้งค่า", icon: "⚙️" },
];

export default function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
            EE
          </span>
          <span className="hidden text-sm font-bold leading-tight text-slate-800 sm:block">
            ระบบเงินบริจาค
            <span className="block text-xs font-normal text-slate-500">
              ภาควิชาวิศวกรรมไฟฟ้า
            </span>
          </span>
        </Link>

        {DEMO_MODE && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            🧪 โหมดสาธิต — ข้อมูลตัวอย่าง
          </span>
        )}

        <nav className="ml-4 hidden flex-1 items-center gap-1 md:flex">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(m.href)
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span className="max-w-[180px] truncate text-xs text-slate-500">
            {email}
          </span>
          <button
            onClick={signOut}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            ออกจากระบบ
          </button>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="ml-auto rounded-lg border border-slate-300 p-2 md:hidden"
          aria-label="เมนู"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 md:hidden">
          {MENU.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                isActive(m.href)
                  ? "bg-teal-700 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {m.icon} {m.label}
            </Link>
          ))}
          <button
            onClick={signOut}
            className="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            ออกจากระบบ ({email})
          </button>
        </nav>
      )}
    </header>
  );
}
