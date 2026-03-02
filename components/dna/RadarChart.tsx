"use client";

import {
  Radar,
  RadarChart as RechartsRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

export interface RadarScore {
  dimension: string;
  value: number;
  fullMark: number;
}

interface RadarChartProps {
  scores: {
    safety: number;
    efficiency: number;
    consistency: number;
    responsiveness: number;
    endurance: number;
  };
  color?: string;
  size?: number;
}

export function RadarChart({
  scores,
  color = "#1a1a1a",
  size = 200,
}: RadarChartProps) {
  const data: RadarScore[] = [
    { dimension: "Safety", value: scores.safety, fullMark: 100 },
    { dimension: "Efficiency", value: scores.efficiency, fullMark: 100 },
    { dimension: "Consistency", value: scores.consistency, fullMark: 100 },
    { dimension: "Responsive", value: scores.responsiveness, fullMark: 100 },
    { dimension: "Endurance", value: scores.endurance, fullMark: 100 },
  ];

  return (
    <ResponsiveContainer width={size} height={size}>
      <RechartsRadar cx="50%" cy="50%" outerRadius="70%" data={data}>
        <PolarGrid
          stroke="#e5e5e0"
          strokeOpacity={0.8}
        />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fill: "#a3a3a3", fontSize: 10, fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={false}
          axisLine={false}
        />
        <Radar
          name="DNA"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.25}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
        />
      </RechartsRadar>
    </ResponsiveContainer>
  );
}
