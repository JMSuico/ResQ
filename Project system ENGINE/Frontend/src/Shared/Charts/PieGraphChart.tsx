// [Layer: Shared/Charts]
// Responsibility: Interactive SVG Donut chart representing multi-agency workload distribution (RHU, FIRE, PNP).
// Pure React + SVG architecture with radial slice expansion, dynamic center hole, and tactical HUD tooltips.

import React, { useState, useRef } from 'react';

export interface PieChartItem {
  label: string;
  value: number;
  color: string;
}

export const PieGraphChart: React.FC<{
  data: PieChartItem[];
  title?: string;
}> = ({ data, title = 'Agency Workload Distribution' }) => {
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let accumulatedAngle = 0;

  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;

    const r = 60;
    const cx = 100;
    const cy = 100;

    // Prevent arc collapse when a single slice occupies 360 degrees
    const safeAngle = Math.min(angle, 359.999);

    const x1 = cx + r * Math.cos((Math.PI * startAngle) / 180);
    const y1 = cy + r * Math.sin((Math.PI * startAngle) / 180);
    const x2 = cx + r * Math.cos((Math.PI * (startAngle + safeAngle)) / 180);
    const y2 = cy + r * Math.sin((Math.PI * (startAngle + safeAngle)) / 180);

    const largeArc = safeAngle > 180 ? 1 : 0;
    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const midAngle = startAngle + angle / 2;
    const rad = (midAngle * Math.PI) / 180;
    const dx = Math.cos(rad) * 8;
    const dy = Math.sin(rad) * 8;

    const percentage = ((d.value / total) * 100).toFixed(1);

    return {
      pathD,
      color: d.color,
      label: d.label,
      value: d.value,
      percentage,
      startAngle,
      angle,
      midAngle,
      dx,
      dy
    };
  });

  const getTacticalStatus = (value: number, totalVal: number) => {
    const share = totalVal > 0 ? value / totalVal : 0;
    if (share >= 0.40) {
      return {
        label: 'PRIMARY DISPATCH LOAD',
        color: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      };
    }
    if (share >= 0.25) {
      return {
        label: 'ACTIVE RESPONSE VOLUME',
        color: 'text-sky-400',
        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40'
      };
    }
    if (share >= 0.15) {
      return {
        label: 'TACTICAL SUPPORT SQUAD',
        color: 'text-indigo-400',
        badge: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
      };
    }
    return {
      label: 'STANDBY READY',
      color: 'text-emerald-400',
      badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const activeSlice = hoveredSliceIndex !== null ? slices[hoveredSliceIndex] : null;
  const activeStatus = activeSlice ? getTacticalStatus(activeSlice.value, total) : null;

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl select-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredSliceIndex(null);
        setMousePos(null);
      }}
    >
      {/* Title & Status Indicator */}
      <div className="flex items-center justify-between">
        {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          RADAR ACTIVE
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 mt-1">
        {/* SVG Donut Chart */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox="0 0 200 200"
            className="w-40 h-40 overflow-visible drop-shadow-md"
          >
            {/* Pie Slices */}
            {slices.map((s, i) => {
              const isHovered = hoveredSliceIndex === i;
              const isDimmed = hoveredSliceIndex !== null && !isHovered;

              return (
                <path
                  key={i}
                  d={s.pathD}
                  fill={s.color}
                  stroke={isHovered ? '#ffffff' : '#0f172a'}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  style={{
                    transform: isHovered ? `translate(${s.dx}px, ${s.dy}px)` : 'translate(0px, 0px)',
                    transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease-out, filter 300ms ease-out',
                    opacity: isDimmed ? 0.35 : 1,
                    filter: isHovered ? 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' : 'none',
                    transformOrigin: '100px 100px'
                  }}
                  className="transition-all duration-300 ease-out cursor-pointer"
                  onMouseEnter={() => setHoveredSliceIndex(i)}
                  onMouseLeave={() => setHoveredSliceIndex(null)}
                />
              );
            })}

            {/* Donut Center Hole */}
            <circle
              cx="100"
              cy="100"
              r="35"
              fill="#090d16"
              stroke="#1e293b"
              strokeWidth="2"
              className="pointer-events-none drop-shadow-inner"
            />

            {/* Dynamic Center Donut Content */}
            {hoveredSliceIndex === null ? (
              <g className="pointer-events-none select-none transition-all duration-300">
                <text
                  x="100"
                  y="97"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="16"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {total}
                </text>
                <text
                  x="100"
                  y="112"
                  textAnchor="middle"
                  fill="#64748b"
                  fontSize="8"
                  fontWeight="bold"
                  letterSpacing="0.1em"
                >
                  TOTAL
                </text>
              </g>
            ) : (
              <g className="pointer-events-none select-none transition-all duration-300">
                <text
                  x="100"
                  y="88"
                  textAnchor="middle"
                  fill={slices[hoveredSliceIndex].color}
                  fontSize="8"
                  fontWeight="bold"
                  letterSpacing="0.04em"
                >
                  {slices[hoveredSliceIndex].label.length > 10
                    ? slices[hoveredSliceIndex].label.slice(0, 9) + '…'
                    : slices[hoveredSliceIndex].label}
                </text>
                <text
                  x="100"
                  y="103"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontSize="13"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  {slices[hoveredSliceIndex].percentage}%
                </text>
                <text
                  x="100"
                  y="116"
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {slices[hoveredSliceIndex].value} CALLS
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Interactive Legend List */}
        <div className="flex flex-col gap-1.5 w-full sm:w-auto min-w-[170px] text-xs">
          {slices.map((d, i) => {
            const isHovered = hoveredSliceIndex === i;
            const isDimmed = hoveredSliceIndex !== null && !isHovered;

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredSliceIndex(i)}
                onMouseLeave={() => setHoveredSliceIndex(null)}
                className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-200 ${
                  isHovered
                    ? 'bg-slate-800/90 border-slate-600 shadow-md ring-1 ring-sky-500/50 translate-x-1'
                    : isDimmed
                    ? 'opacity-35 border-transparent'
                    : 'border-transparent hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-200"
                    style={{
                      backgroundColor: d.color,
                      transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: isHovered ? `0 0 8px ${d.color}` : 'none'
                    }}
                  />
                  <span className={`truncate text-xs ${isHovered ? 'text-white font-bold' : 'text-slate-300 font-medium'}`}>
                    {d.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
                  <span className="text-slate-400 text-[10px]">
                    {d.percentage}%
                  </span>
                  <span className={`font-bold ${isHovered ? 'text-white' : 'text-slate-200'}`}>
                    {d.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Tactical HUD Tooltip */}
      {hoveredSliceIndex !== null && activeSlice && activeStatus && (
        <div
          className="pointer-events-none absolute z-30 transition-all duration-150 ease-out"
          style={{
            left: mousePos
              ? `${Math.max(100, Math.min(mousePos.x, (containerRef.current?.clientWidth || 300) - 100))}px`
              : '50%',
            top: mousePos ? `${Math.max(mousePos.y - 12, 45)}px` : '40%',
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-lg shadow-2xl p-2.5 min-w-[190px] flex flex-col gap-1 text-[11px] font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-100">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeSlice.color }} />
                <span>{activeSlice.label}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">{activeSlice.percentage}%</span>
            </div>
            <div className="flex justify-between text-slate-300 pt-0.5">
              <span className="text-slate-500">Active Load:</span>
              <span className="font-bold text-white">{activeSlice.value} Dispatches</span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-500">Fleet Share:</span>
              <span className="text-sky-400 font-semibold">{activeSlice.percentage}% Workload</span>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-[9px] text-slate-400 uppercase tracking-wider">Tactical Status:</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${activeStatus.badge}`}>
                {activeStatus.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Status Telemetry Pill */}
      {activeSlice && activeStatus ? (
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs transition-all duration-200">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0 animate-ping" style={{ backgroundColor: activeSlice.color }} />
            <span className="font-semibold text-slate-200 truncate">{activeSlice.label} Focus</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${activeStatus.badge}`}>
              {activeStatus.label}
            </span>
            <span className="font-mono text-slate-300 text-xs font-semibold">
              {activeSlice.value} Dispatches ({activeSlice.percentage}%)
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <span>HOVER SLICE OR LEGEND FOR FLEET TELEMETRY</span>
          <span className="text-slate-400 font-semibold">{data.length} AGENCIES LOGGED</span>
        </div>
      )}
    </div>
  );
};
