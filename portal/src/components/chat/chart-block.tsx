"use client";

import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

interface ChartReferenceLine {
  y?: number;
  x?: string;
  label?: string;
  color?: string;
  strokeDasharray?: string;
}

export interface ChartSpec {
  type: "line" | "bar" | "area";
  title?: string;
  xKey: string;
  xLabel?: string;
  yLabel?: string;
  series: ChartSeries[];
  data: Record<string, unknown>[];
  referenceLines?: ChartReferenceLine[];
}

const DEFAULT_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

export function ChartBlock({ spec }: { spec: ChartSpec }) {
  const { type, title, xKey, xLabel, yLabel, series, data, referenceLines } = spec;

  if (!data?.length || !series?.length) {
    return (
      <div className="text-sm text-muted-foreground italic p-4">
        No chart data available.
      </div>
    );
  }

  const coloredSeries = series.map((s, i) => ({
    ...s,
    color: s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const sharedProps = {
    data,
    margin: { top: 5, right: 20, left: 10, bottom: 5 },
  };

  const renderAxes = () => (
    <>
      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
      <XAxis
        dataKey={xKey}
        tick={{ fontSize: 11 }}
        label={xLabel ? { value: xLabel, position: "insideBottom", offset: -5, fontSize: 12 } : undefined}
      />
      <YAxis
        tick={{ fontSize: 11 }}
        label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 12 } : undefined}
      />
      <Tooltip
        contentStyle={{
          backgroundColor: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: "0.5rem",
          fontSize: "0.75rem",
        }}
      />
      <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
    </>
  );

  const renderReferenceLines = () =>
    referenceLines?.map((rl, i) => (
      <ReferenceLine
        key={i}
        y={rl.y}
        x={rl.x}
        label={{ value: rl.label || "", position: "right", fontSize: 11 }}
        stroke={rl.color || "#ef4444"}
        strokeDasharray={rl.strokeDasharray || "5 5"}
      />
    ));

  const renderChart = () => {
    switch (type) {
      case "bar":
        return (
          <BarChart {...sharedProps}>
            {renderAxes()}
            {renderReferenceLines()}
            {coloredSeries.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label || s.key} fill={s.color} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        );
      case "area":
        return (
          <AreaChart {...sharedProps}>
            {renderAxes()}
            {renderReferenceLines()}
            {coloredSeries.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label || s.key}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.15}
              />
            ))}
          </AreaChart>
        );
      default:
        return (
          <LineChart {...sharedProps}>
            {renderAxes()}
            {renderReferenceLines()}
            {coloredSeries.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label || s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        );
    }
  };

  return (
    <div className="my-3 p-3 bg-background rounded-lg border" role="img" aria-label={generateChartAltText(spec)}>
      {title && (
        <h4 className="text-sm font-medium mb-2 text-center">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height={280}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}

/** Generate a text description of the chart for screen readers. */
function generateChartAltText(spec: ChartSpec): string {
  const { type, title, series, data, referenceLines } = spec;
  const chartType = type === "area" ? "area chart" : type === "bar" ? "bar chart" : "line chart";
  const dataPoints = data?.length ?? 0;
  const seriesNames = series?.map((s) => s.label || s.key).join(", ") ?? "";
  const refLines = referenceLines
    ?.filter((r) => r.label)
    .map((r) => `${r.label}${r.y !== undefined ? ` at ${r.y}` : ""}`)
    .join(", ");

  let alt = title ? `${title}. ` : "";
  alt += `${chartType} with ${dataPoints} data point${dataPoints !== 1 ? "s" : ""}`;
  if (seriesNames) alt += ` showing ${seriesNames}`;
  alt += ".";
  if (refLines) alt += ` Reference lines: ${refLines}.`;

  // Include first and last data points for trend context
  if (data?.length >= 2 && series?.length > 0) {
    const firstKey = series[0].key;
    const first = data[0];
    const last = data[data.length - 1];
    const xKey = spec.xKey;
    if (first[xKey] && last[xKey] && first[firstKey] !== undefined && last[firstKey] !== undefined) {
      alt += ` Range: ${first[xKey]} (${first[firstKey]}) to ${last[xKey]} (${last[firstKey]}).`;
    }
  }

  return alt;
}
