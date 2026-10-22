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
    <div className="border border-ink bg-white px-3 py-2">
      <p className="text-[8px] font-bold tracking-[0.18em] text-[#8a8a8a] uppercase">
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
              <stop offset="0%" stopColor="#0a0a0a" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#0a0a0a" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#eeeeee" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: "#6b6b6b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#6b6b6b", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<ChartTooltip suffix="enquiries" />} cursor={{ stroke: "#bdbdbd" }} />
          <Area
            type="monotone"
            dataKey="enquiries"
            stroke="#0a0a0a"
            strokeWidth={2}
            fill="url(#enquiryFill)"
            activeDot={{ r: 4, fill: "#0a0a0a", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const DEFAULT_COLORS = ["#0a0a0a", "#404040", "#6b6b6b", "#a3a3a3", "#d4d4d4", "#ececec"];

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
                fill={filtered.length ? colors[index % colors.length] : "#f0f0f0"}
              />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-[34px] leading-[0.8] font-semibold tracking-[-0.025em] text-ink">{centerValue}</p>
        <p className="mt-1.5 text-[8px] font-bold tracking-[0.2em] text-[#8a8a8a] uppercase">{centerLabel}</p>
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
          <div className="h-1.5 overflow-hidden bg-[#f0f0f0]">
            <div
              className={cn("h-full", index === 0 ? "bg-ink" : index === 1 ? "bg-[#404040]" : "bg-[#a3a3a3]")}
              style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-[12px] text-muted">No enquiries yet.</p>}
    </div>
  );
}
