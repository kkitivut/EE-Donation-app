"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { THAI_MONTHS_SHORT, formatMoney } from "@/lib/format";
import type { MonthlyPoint, NamedTotal, YearlyPoint } from "@/lib/dashboard-data";

// palette ผ่าน scripts/validate_palette.js (dataviz) — light mode
const RECEIVED = "#2a78d6";
const SPENT = "#e34948";
const NET = "#008300"; // เขียวเข้ม (money green) — คงเหลือสุทธิ
const CUMULATIVE = "#1baf7a"; // aqua — คงเหลือสุทธิสะสม, ตรวจ CVD ผ่านแล้วต่างจาก NET ชัดเจน
const CATEGORICAL = [
  "#2a78d6", // blue
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];
const INK_MUTED = "#898781";
const INK_LABEL = "#57554d";
const GRID = "#e1e0d9";

const compact = new Intl.NumberFormat("th-TH", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function BahtTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-semibold text-slate-700">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-1.5 text-slate-600">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: p.color }}
          />
          {p.name}: <span className="tabular-nums">{formatMoney(p.value)} บาท</span>
        </p>
      ))}
    </div>
  );
}

export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  const chartData = data.map((m) => ({
    name: THAI_MONTHS_SHORT[m.month - 1],
    รายรับ: m.received,
    รายจ่าย: m.spent,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: INK_MUTED }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickFormatter={(v: number) => compact.format(v)}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<BahtTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="รายรับ" fill={RECEIVED} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="รายจ่าย" fill={SPENT} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function YearlyChart({ data }: { data: YearlyPoint[] }) {
  let running = 0;
  const chartData = data.map((y) => {
    running += y.received - y.spent;
    return {
      name: `${y.year}`,
      รายรับ: y.received,
      รายจ่าย: y.spent,
      คงเหลือสุทธิ: Math.round((y.received - y.spent) * 100) / 100,
      คงเหลือสุทธิสะสม: Math.round(running * 100) / 100,
    };
  });

  const labelStyle = { fontSize: 11, fill: INK_LABEL, fontWeight: 600 } as const;
  const barLabelFormatter = (v: unknown) => (typeof v === "number" && v ? compact.format(v) : "");
  const netLabelFormatter = (v: unknown) => (typeof v === "number" ? compact.format(v) : "");
  // เส้นสะสม: label เฉพาะจุดสุดท้าย กันป้ายทับกันเต็มกราฟ (อีก 2 เส้นมี label ทุกจุดอยู่แล้ว)
  const lastIndex = chartData.length - 1;
  // recharts ไม่ export type ของ props ที่ LabelList content รับให้ import ตรงๆ ได้ง่าย
  // (ไม่มี index signature ให้ widen เป็น Record ได้) จึงรับเป็น any แล้วตรวจชนิดเองด้านใน
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cumEndLabel = (props: any) => {
    const { x, y, value, index } = props;
    if (
      index !== lastIndex ||
      typeof x !== "number" && typeof x !== "string" ||
      typeof y !== "number" && typeof y !== "string" ||
      typeof value !== "number"
    )
      return null;
    return (
      <text x={Number(x)} y={Number(y) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill={CUMULATIVE}>
        {compact.format(value)}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="cumAreaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CUMULATIVE} stopOpacity={0.22} />
            <stop offset="100%" stopColor={CUMULATIVE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: INK_MUTED }}
          axisLine={{ stroke: GRID }}
          tickLine={false}
          padding={{ left: 24, right: 24 }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: INK_MUTED }}
          tickFormatter={(v: number) => compact.format(v)}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip content={<BahtTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
        {/* เส้นสะสม (พื้นที่ไล่เฉด) วางก่อน — ให้อยู่หลังแท่ง/เส้นอื่น ไม่บังข้อมูลหลัก */}
        <Area
          type="monotone"
          dataKey="คงเหลือสุทธิสะสม"
          stroke={CUMULATIVE}
          strokeWidth={2}
          fill="url(#cumAreaGradient)"
          dot={{ r: 3.5, strokeWidth: 0, fill: CUMULATIVE }}
          activeDot={{ r: 6 }}
        >
          <LabelList dataKey="คงเหลือสุทธิสะสม" content={cumEndLabel} />
        </Area>
        <Bar dataKey="รายรับ" fill={RECEIVED} radius={[4, 4, 0, 0]} maxBarSize={22}>
          <LabelList dataKey="รายรับ" position="top" style={labelStyle} formatter={barLabelFormatter} />
        </Bar>
        <Bar dataKey="รายจ่าย" fill={SPENT} radius={[4, 4, 0, 0]} maxBarSize={22}>
          <LabelList dataKey="รายจ่าย" position="top" style={labelStyle} formatter={barLabelFormatter} />
        </Bar>
        <Line
          type="linear"
          dataKey="คงเหลือสุทธิ"
          stroke={NET}
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={{ r: 4, strokeWidth: 0, fill: NET }}
          activeDot={{ r: 6 }}
        >
          <LabelList
            dataKey="คงเหลือสุทธิ"
            position="bottom"
            offset={10}
            style={labelStyle}
            formatter={netLabelFormatter}
          />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function PurposeDonut({ data }: { data: NamedTotal[] }) {
  // เกิน 6 หมวด: 5 อันดับแรก + รวมที่เหลือเป็น "อื่น ๆ"
  const items =
    data.length > 6
      ? [
          ...data.slice(0, 5),
          {
            name: "อื่น ๆ",
            received: data.slice(5).reduce((s, d) => s + d.received, 0),
            spent: 0,
          },
        ]
      : data;

  const chartData = items
    .filter((d) => d.received > 0)
    .map((d) => ({ name: d.name, value: d.received }));

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return (
      <p className="flex h-[280px] items-center justify-center text-sm text-slate-400">
        ไม่มีข้อมูลรายรับในปีนี้
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-[200px] w-[200px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
              ))}
            </Pie>
            <Tooltip content={<BahtTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* legend + ตัวเลข (relief สำหรับสีที่ contrast ต่ำ) */}
      <ul className="w-full max-w-sm space-y-1.5 text-sm">
        {chartData.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: CATEGORICAL[i % CATEGORICAL.length] }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">
              {d.name}
            </span>
            <span className="tabular-nums text-slate-700">
              {formatMoney(d.value)}
            </span>
            <span className="w-12 text-right text-xs tabular-nums text-slate-400">
              {((d.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
