"use client";

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money } from "@/lib/format";

export interface Slice {
  name: string;
  value: number;
  color: string;
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  color: "var(--text)",
  fontSize: 13,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
};

export function CategoryDonut({ data, total }: { data: Slice[]; total: number }) {
  return (
    <div className="relative h-56 w-full" role="img" aria-label="Spending by category">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none" isAnimationActive={false}>
            {data.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs text-muted">Spent</span>
        <span className="text-xl font-semibold">{money(total)}</span>
      </div>
    </div>
  );
}

export function MonthlyBars({ data }: { data: { label: string; spent: number; current: boolean }[] }) {
  return (
    <div className="h-56 w-full" role="img" aria-label="Spending by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
          <YAxis hide />
          <Tooltip cursor={{ fill: "var(--border)", opacity: 0.4 }} contentStyle={tooltipStyle} formatter={(v) => money(Number(v))} />
          <Bar dataKey="spent" name="Spent" radius={[8, 8, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.label} fill="var(--accent)" fillOpacity={d.current ? 1 : 0.4} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
