import type { NextConfig } from "next";

const SUPABASE_HOST = "https://srrrmgelenumimloyfyh.supabase.co";
const SUPABASE_WS = "wss://srrrmgelenumimloyfyh.supabase.co";

// CSP: recharts เป็น SVG ล้วน (ไม่ต้อง eval), Next production ใช้ inline script/style
// จึงต้อง 'unsafe-inline'; production ไม่ต้อง 'unsafe-eval' แต่ dev (React Fast Refresh/HMR)
// ต้องใช้ eval จึงเพิ่มเฉพาะตอน dev; connect ไป Supabase (REST + realtime)
const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = isDev
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const csp = [
  "default-src 'self'",
  `connect-src 'self' ${SUPABASE_HOST} ${SUPABASE_WS}`,
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
