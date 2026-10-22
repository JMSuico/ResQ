// [Layer: Shared/Charts]
// Responsibility: SVG smooth curvey line chart for incident volume and triage response telemetry.
// DO NOT import heavy charting libraries when self-contained SVG vectors provide deterministic rendering.

import React from 'react';

export interface DataPoint {
  label: string;
  value: number;
}

export const LinearCurveyChart: React.FC<{
  data: DataPoint[];
  title?: string;
  color?: string;
  height?: number;
}> = ({ data, title = '24-Hour Incident Volume', color = '#0284c7', height = 180 }) => {
  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 10);
  const width = 500;
  const padding = 30;

  // Compute SVG curve points
  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.value / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {/* Gradient Def */}
        <defs>
          <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill Area */}
        <path d={areaD} fill="url(#curveGradient)" />

        {/* Line Stroke */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />

        {/* Data Circles & Labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="#0f172a" stroke={color} strokeWidth="2" />
            <text x={p.x} y={height - 10} textAnchor="middle" fill="#64748b" fontSize="10" fontFamily="monospace">
              {data[i].label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
