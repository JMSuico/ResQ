// [Layer: Shared/Charts]
// Responsibility: SVG donut chart representing multi-agency workload distribution (RHU, FIRE, PNP).
// DO NOT compute angle offsets with cumulative degree rounding errors.

import React from 'react';

export const PieGraphChart: React.FC<{
  data: { label: string; value: number; color: string }[];
  title?: string;
}> = ({ data, title = 'Agency Workload Distribution' }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let accumulatedAngle = 0;

  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;

    const r = 60;
    const cx = 100;
    const cy = 100;

    const x1 = cx + r * Math.cos((Math.PI * startAngle) / 180);
    const y1 = cy + r * Math.sin((Math.PI * startAngle) / 180);
    const x2 = cx + r * Math.cos((Math.PI * (startAngle + angle)) / 180);
    const y2 = cy + r * Math.sin((Math.PI * (startAngle + angle)) / 180);

    const largeArc = angle > 180 ? 1 : 0;
    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { pathD, color: d.color, label: d.label, value: d.value };
  });

  return (
    <div className="flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl">
      {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
      <div className="flex items-center justify-around">
        <svg viewBox="0 0 200 200" className="w-36 h-36">
          {slices.map((s, i) => (
            <path key={i} d={s.pathD} fill={s.color} className="transition-all hover:opacity-80 cursor-pointer" />
          ))}
          <circle cx="100" cy="100" r="35" fill="#0f172a" />
          <text x="100" y="105" textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="bold">
            {total}
          </text>
        </svg>

        <div className="flex flex-col gap-1.5 text-xs">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-slate-300 font-medium">{d.label}:</span>
              <span className="text-slate-100 font-bold">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
