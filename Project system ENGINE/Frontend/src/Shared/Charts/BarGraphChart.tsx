// [Layer: Shared/Charts]
// Responsibility: SVG bar graph for incident severity classification.
// DO NOT hardcode fixed pixel widths preventing responsive container adaptation.

import React from 'react';

export const BarGraphChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  title?: string;
  height?: number;
}> = ({ data, title = 'Severity Classification Breakdown', height = 180 }) => {
  const max = Math.max(...data.map((d) => d.value), 5);
  const width = 400;
  const barWidth = 40;
  const gap = (width - data.length * barWidth) / (data.length + 1);

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 50);
          const x = gap + i * (barWidth + gap);
          const y = height - 25 - barHeight;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={d.color || '#38bdf8'}
                className="transition-all duration-300 hover:opacity-80"
              />
              <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="bold">
                {d.value}
              </text>
              <text x={x + barWidth / 2} y={height - 8} textAnchor="middle" fill="#94a3b8" fontSize="10">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
