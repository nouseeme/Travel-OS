"use client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export function SalesStageChart({
  data,
}: {
  data: { name: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} barCategoryGap="28%">
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#626b74", fontSize: 12 }}
          dy={8}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#626b74", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "#f3f5f7" }}
          contentStyle={{
            borderColor: "#e5e8ec",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Bar
          dataKey="count"
          fill="var(--chart-accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={64}
          name="Active leads"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function ComparisonChart({
  data,
}: {
  data: { name: string; previous: number; current: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barCategoryGap="28%">
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#626b74", fontSize: 12 }}
          dy={8}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#626b74", fontSize: 12 }}
          tickFormatter={(v) =>
            new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)
          }
        />
        <Tooltip
          cursor={{ fill: "#f3f5f7" }}
          contentStyle={{
            borderColor: "#e5e8ec",
            borderRadius: 8,
            fontSize: 13,
          }}
          formatter={(v) => new Intl.NumberFormat("id-ID").format(Number(v))}
        />
        <Bar
          dataKey="previous"
          name="Sebelumnya"
          fill="var(--chart-comparison)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
        <Bar
          dataKey="current"
          name="Terbaru"
          fill="var(--chart-accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
