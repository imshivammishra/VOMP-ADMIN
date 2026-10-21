"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date);
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-paper px-3 py-2 shadow-[0_20px_44px_-24px_rgba(23,19,14,0.35)]">
      <p className="text-[8.5px] font-semibold tracking-[0.16em] text-[#948771] uppercase">
        {label ? shortDate(label) : ""}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold text-ink">
        {payload[0]?.value ?? 0} {suffix}
      </p>
    </div>
  );
}

export function TrendChart({ data }: { data: { date: string; enquiries: number }[] }) {
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <defs>
            <linearGradient id="enquiryFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#17130e" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#17130e" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8dfd0" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: "#817665", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#817665", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip suffix="enquiries" />} cursor={{ stroke: "#b5a993", strokeDasharray: "3 4" }} />
          <Area
            type="monotone"
            dataKey="enquiries"
            stroke="#17130e"
            strokeWidth={2}
            fill="url(#enquiryFill)"
            activeDot={{ r: 4, fill: "#17130e", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const DEFAULT_COLORS = ["#17130e", "#4b4337", "#817665", "#b1a48f", "#d4c7b4", "#e8dfd0"];

export function StatusDonut({
  data,
  centerLabel,
  centerValue,
  colors = DEFAULT_COLORS,
}: {
  data: { name: string; value: number }[];
  centerLabel: string;
  centerValue: string | number;
  colors?: string[];
}) {
  const filtered = data.filter((item) => item.value > 0);
  return (
    <div className="relative h-[190px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={filtered.length ? filtered : [{ name: "No data", value: 1 }]}
            dataKey="value"
            nameKey="name"
            innerRadius={58}
            outerRadius={78}
            paddingAngle={filtered.length > 1 ? 3 : 0}
            strokeWidth={0}
          >
            {(filtered.length ? filtered : [{ name: "No data", value: 1 }]).map((entry, index) => (
              <Cell
                key={`${entry.name}-${index}`}
                fill={filtered.length ? colors[index % colors.length] : "#ece3d4"}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-[34px] leading-[0.8] font-semibold tracking-[-0.025em] text-ink">{centerValue}</p>
        <p className="mt-1.5 text-[8px] font-semibold tracking-[0.18em] text-[#948771] uppercase">{centerLabel}</p>
      </div>
    </div>
  );
}

export function SourceBars({ data }: { data: { source: string; count: number; label: string }[] }) {
  const max = Math.max(1, ...data.map((item) => item.count));
  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={item.source}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[11.5px] font-medium text-muted">{item.label}</span>
            <span className="text-[11px] font-semibold text-ink">{item.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-cream">
            <div
              className={cn("h-full rounded-full", index === 0 ? "bg-ink" : index === 1 ? "bg-[#5b5245]" : "bg-[#a49680]")}
              style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-[12px] text-muted">No enquiries yet.</p>}
    </div>
  );
}
