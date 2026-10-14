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
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#235c46" name="Active leads" />
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
      <BarChart data={data}>
        <XAxis dataKey="name" />
        <YAxis
          tickFormatter={(v) =>
            new Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)
          }
        />
        <Tooltip
          formatter={(v) => new Intl.NumberFormat("id-ID").format(Number(v))}
        />
        <Bar dataKey="previous" name="Sebelumnya" fill="#a8b7a6" />
        <Bar dataKey="current" name="Terbaru" fill="#235c46" />
      </BarChart>
    </ResponsiveContainer>
  );
}
