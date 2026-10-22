// [Layer: Shared/Charts]
// Responsibility: SVG bar graph for incident severity classification with interactive tactical telemetry HUD.
// DO NOT hardcode fixed pixel widths preventing responsive container adaptation.

import React, { useState } from 'react';

export const BarGraphChart: React.FC<{
  data: { label: string; value: number; color?: string }[];
  title?: string;
  height?: number;
}> = ({ data, title = 'Severity Classification Breakdown', height = 180 }) => {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const max = Math.max(...data.map((d) => d.value), 5);
  const width = 400;
  const barWidth = 42;
  const gap = (width - data.length * barWidth) / (data.length + 1);

  // Severity classification status helper
  const getSeverityBadge = (color?: string, label?: string) => {
    const c = (color || '').toLowerCase();
    const l = (label || '').toLowerCase();

    // Red / Rose: CRITICAL CODE RED
    if (
      c.includes('ef4444') ||
      c.includes('f43f5e') ||
      c.includes('e11d48') ||
      c.includes('red') ||
      c.includes('rose') ||
      l.includes('crit') ||
      l.includes('sos')
    ) {
      return {
        text: 'CRITICAL CODE RED',
        badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)]',
        dotClass: 'bg-rose-500 animate-pulse',
        textColor: 'text-rose-400',
        glowColor: '#ef4444'
      };
    }

    // Orange / Amber: HIGH PRIORITY
    if (
      c.includes('ea580c') ||
      c.includes('f59e0b') ||
      c.includes('d97706') ||
      c.includes('orange') ||
      c.includes('amber') ||
      l.includes('high') ||
      l.includes('med') ||
      l.includes('medium') ||
      l.includes('tier')
    ) {
      return {
        text: 'HIGH PRIORITY',
        badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
        dotClass: 'bg-amber-400',
        textColor: 'text-amber-400',
        glowColor: '#f59e0b'
      };
    }

    // Blue / Sky: STANDARD CADENCE
    if (
      c.includes('38bdf8') ||
      c.includes('0284c7') ||
      c.includes('3b82f6') ||
      c.includes('blue') ||
      c.includes('sky') ||
      l.includes('standard') ||
      l.includes('cadence') ||
      l.includes('police') ||
      l.includes('rhu')
    ) {
      return {
        text: 'STANDARD CADENCE',
        badgeClass: 'bg-sky-950/90 text-sky-300 border-sky-500/50 shadow-[0_0_8px_rgba(56,189,248,0.25)]',
        dotClass: 'bg-sky-400',
        textColor: 'text-sky-400',
        glowColor: '#38bdf8'
      };
    }

    // Slate / Green: LOW IMPACT
    return {
      text: 'LOW IMPACT',
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]',
      dotClass: 'bg-emerald-400',
      textColor: 'text-emerald-400',
      glowColor: '#10b981'
    };
  };

  const hoveredBar = hoveredBarIndex !== null ? data[hoveredBarIndex] : null;
  const hoveredSeverity = hoveredBar ? getSeverityBadge(hoveredBar.color, hoveredBar.label) : null;
  const hoveredBarCenter =
    hoveredBarIndex !== null ? gap + hoveredBarIndex * (barWidth + gap) + barWidth / 2 : 0;
  const hoveredBarHeight = hoveredBar ? Math.max((hoveredBar.value / max) * (height - 55), 4) : 0;
  const hoveredBarElevatedY = height - 25 - hoveredBarHeight - 6;

  // Tooltip positioning logic (bounded within container)
  const isNearTop = hoveredBarElevatedY < 65;
  const isNearLeft = hoveredBarCenter < 85;
  const isNearRight = hoveredBarCenter > width - 85;

  let tooltipLeftStyle: React.CSSProperties = {};
  if (hoveredBar) {
    if (isNearLeft) {
      tooltipLeftStyle = {
        left: '8px',
        transform: isNearTop ? 'translateY(12px)' : 'translateY(-100%) translateY(-12px)'
      };
    } else if (isNearRight) {
      tooltipLeftStyle = {
        right: '8px',
        left: 'auto',
        transform: isNearTop ? 'translateY(12px)' : 'translateY(-100%) translateY(-12px)'
      };
    } else {
      tooltipLeftStyle = {
        left: `${(hoveredBarCenter / width) * 100}%`,
        transform: isNearTop ? 'translate(-50%, 12px)' : 'translate(-50%, -100%) translateY(-12px)'
      };
    }
  }

  return (
    <div className="relative flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl select-none">
      {/* Header with live category telemetry */}
      <div className="flex items-center justify-between min-h-[22px]">
        {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
        {hoveredBar && hoveredSeverity && (
          <div className="flex items-center gap-2 text-[11px] font-mono transition-opacity duration-200">
            <span className="text-slate-400">{hoveredBar.label}:</span>
            <span className={`font-bold ${hoveredSeverity.textColor}`}>
              {hoveredBar.value} ({((hoveredBar.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {data.map((d, i) => {
            const barHeight = Math.max((d.value / max) * (height - 55), 4);
            const x = gap + i * (barWidth + gap);
            const y = height - 25 - barHeight;
            const isHovered = hoveredBarIndex === i;
            const isDimmed = hoveredBarIndex !== null && !isHovered;
            const barColor = d.color || '#38bdf8';

            return (
              <g
                key={i}
                className="cursor-pointer"
                style={{
                  opacity: isDimmed ? 0.4 : 1,
                  transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={() => setHoveredBarIndex(i)}
                onMouseLeave={() => setHoveredBarIndex(null)}
              >
                {/* Elevated Bar + Value Number Group */}
                <g
                  style={{
                    transform: isHovered ? 'translateY(-6px)' : 'translateY(0)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: isHovered
                      ? `drop-shadow(0 0 10px ${barColor}) drop-shadow(0 0 3px ${barColor})`
                      : 'none'
                  }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="5"
                    fill={barColor}
                    stroke={isHovered ? '#ffffff' : barColor}
                    strokeWidth={isHovered ? 1.5 : 0}
                    strokeOpacity={isHovered ? 0.95 : 0}
                    className="transition-all duration-200"
                  />
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill={isHovered ? '#ffffff' : '#f8fafc'}
                    fontSize={isHovered ? '12' : '11'}
                    fontWeight="bold"
                    className="transition-all duration-200 select-none font-mono"
                  >
                    {d.value}
                  </text>
                </g>

                {/* Grounded Category Label */}
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isHovered ? '#f1f5f9' : '#94a3b8'}
                  fontSize="10"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  className="transition-all duration-200 select-none font-sans"
                >
                  {d.label}
                </text>

                {/* Transparent column hit box for effortless hover activation */}
                <rect
                  x={x - 6}
                  y={10}
                  width={barWidth + 12}
                  height={height - 20}
                  fill="transparent"
                  className="pointer-events-auto"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Tactical HUD Tooltip */}
        {hoveredBar && hoveredSeverity && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-200 ease-out"
            style={{
              top: `${(hoveredBarElevatedY / height) * 100}%`,
              ...tooltipLeftStyle
            }}
          >
            <div className="bg-slate-950/95 border border-slate-700/90 rounded-xl p-2.5 shadow-2xl backdrop-blur-md min-w-[175px] text-xs font-mono flex flex-col gap-1.5 transition-all duration-200 ease-out ring-1 ring-white/10">
              {/* Category Label (X-axis) */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Category</span>
                <span className="text-white font-bold">{hoveredBar.label}</span>
              </div>

              {/* Numerical Value & Percentage Share */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Total Count:</span>
                <span className="text-white font-extrabold text-sm flex items-center gap-1">
                  <span className={hoveredSeverity.textColor}>{hoveredBar.value}</span>
                  <span className="text-[10px] text-slate-400 font-normal">incidents</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Share of Total:</span>
                <span className="text-slate-200 font-semibold text-xs">
                  {((hoveredBar.value / total) * 100).toFixed(1)}%
                </span>
              </div>

              {/* Severity Status Badge */}
              <div
                className={`mt-0.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors duration-200 ${hoveredSeverity.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${hoveredSeverity.dotClass}`} />
                <span>{hoveredSeverity.text}</span>
              </div>
            </div>

            {/* Caret arrow pointing to bar */}
            <div
              className={`w-2.5 h-2.5 bg-slate-950 border-slate-700/90 transform rotate-45 shadow-md ${
                isNearTop
                  ? 'border-l border-t -mt-[5px] mx-auto'
                  : 'border-r border-b -mt-[5px] mx-auto'
              }`}
            />
          </div>
        )}
      </div>
    </div>
  );
};
