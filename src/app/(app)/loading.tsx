/**
 * Skeleton กลางระหว่างโหลดหน้าใน (app) — Next.js แสดงทันทีเมื่อเปลี่ยนหน้า
 * (Nav ด้านบนคงอยู่ใน layout, เฉพาะเนื้อหาหลักโชว์ skeleton)
 */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      {/* แถบหัวข้อ */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-48 rounded-lg bg-slate-200" />
        <div className="h-10 w-40 rounded-lg bg-slate-200" />
      </div>

      {/* การ์ด KPI / ตัวกรอง */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-28 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* บล็อกตาราง/กราฟ */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-full rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
