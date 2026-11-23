// [Layer: Shared/Charts]
// Responsibility: Interactive SVG Donut chart representing multi-agency workload distribution (RHU, FIRE, PNP).
// Pure React + SVG architecture with radial slice expansion, dynamic center hole, and tactical HUD tooltips.
// Universal lambda expressions (=>). ZERO 'any', ZERO emojis.

import React, { FC, useState, useRef, useCallback } from 'react';
import { PieChart } from 'lucide-react';

export interface PieChartItem {
  label: string;
  value: number;
  color: string;
}

export interface PieGraphChartProps {
  data: PieChartItem[];
  title?: string;
}

const DONUT_RADIUS = 60;
const CENTER_X = 100;
const CENTER_Y = 100;
const INNER_HOLE_RADIUS = 35;
const SLICE_EXPANSION_OFFSET = 8;
const FULL_CIRCLE_DEGREES = 360;
const START_ANGLE_OFFSET_DEG = -90; // Start at 12 o'clock

interface TacticalStatus {
  label: string;
  color: string;
  badge: string;
}

const computeTacticalStatus = (value: number, totalVal: number): TacticalStatus => {
  const share = totalVal > 0 ? value / totalVal : 0;
  if (share >= 0.40) {
    return {
      label: 'PRIMARY DISPATCH LOAD',
      color: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-900 border-amber-300'
    };
  }
  if (share >= 0.25) {
    return {
      label: 'ACTIVE RESPONSE VOLUME',
      color: 'text-[#670626]',
      badge: 'bg-[#F3E4E7] text-[#670626] border-[#A83B4D]/40'
    };
  }
  if (share >= 0.15) {
    return {
      label: 'TACTICAL SUPPORT SQUAD',
      color: 'text-sky-800',
      badge: 'bg-sky-100 text-sky-900 border-sky-300'
    };
  }
  return {
    label: 'STANDBY READY',
    color: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-900 border-emerald-300'
  };
};

export const PieGraphChart: FC<PieGraphChartProps> = ({
  data,
  title = 'Agency Workload Distribution'
}) => {
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const safeData = data && data.length > 0 ? data : [
    { label: 'RHU Medical', value: 0, color: '#0284c7' },
    { label: 'BFP Fire Rescue', value: 0, color: '#ea580c' },
    { label: 'PNP Police Force', value: 0, color: '#3b82f6' }
  ];

  const realTotal = safeData.reduce((sum, d) => sum + d.value, 0);
  const total = realTotal || 1;
  const activeAgenciesCount = safeData.filter((d) => d.value > 0).length;
  let accumulatedAngle = START_ANGLE_OFFSET_DEG;

  const slices = safeData.map((d) => {
    const angle = realTotal > 0 ? (d.value / total) * FULL_CIRCLE_DEGREES : 0;
    const startAngle = accumulatedAngle;
    accumulatedAngle += angle;

    const isFullCircle = realTotal > 0 && d.value === realTotal;
    const r = DONUT_RADIUS;
    const cx = CENTER_X;
    const cy = CENTER_Y;

    const x1 = cx + r * Math.cos((Math.PI * startAngle) / 180);
    const y1 = cy + r * Math.sin((Math.PI * startAngle) / 180);
    const x2 = cx + r * Math.cos((Math.PI * (startAngle + angle)) / 180);
    const y2 = cy + r * Math.sin((Math.PI * (startAngle + angle)) / 180);

    const largeArc = angle > 180 ? 1 : 0;
    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    const midAngle = startAngle + angle / 2;
    const rad = (midAngle * Math.PI) / 180;
    const dx = isFullCircle ? 0 : Math.cos(rad) * SLICE_EXPANSION_OFFSET;
    const dy = isFullCircle ? 0 : Math.sin(rad) * SLICE_EXPANSION_OFFSET;

    const percentage = realTotal > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';

    return {
      pathD,
      color: d.color,
      label: d.label,
      value: d.value,
      percentage,
      startAngle,
      angle,
      midAngle,
      isFullCircle,
      dx,
      dy
    };
  });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const nextX = e.clientX - rect.left;
      const nextY = e.clientY - rect.top;
      setMousePos((prev) => {
        if (prev && Math.abs(prev.x - nextX) < 2 && Math.abs(prev.y - nextY) < 2) {
          return prev;
        }
        return { x: nextX, y: nextY };
      });
    }
  }, []);

  const activeSlice = hoveredSliceIndex !== null ? slices[hoveredSliceIndex] : null;
  const activeStatus = activeSlice ? computeTacticalStatus(activeSlice.value, total) : null;
  const isTooltipNearTop = mousePos ? mousePos.y < 145 : false;

  return (
    <div
      ref={containerRef}
      className="clay-surface relative flex flex-col gap-2 p-4 bg-[#F7F1EA] border border-[#E9D9D0] rounded-2xl shadow-[0_14px_32px_-10px_rgba(103,6,38,0.14),inset_0_2px_4px_rgba(255,255,255,0.85)] select-none text-[#3B1722]"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredSliceIndex(null);
        setMousePos(null);
      }}
    >
      {/* Title & Status Indicator */}
      <div className="flex items-center justify-between gap-2">
        {title && (
          <div className="flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-[#670626]" />
            <h4 className="text-sm font-extrabold text-[#670626] uppercase tracking-wider">{title}</h4>
          </div>
        )}
        <span className="text-xs font-mono text-[#7A4E59] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
          RADAR ACTIVE
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-around gap-4 mt-1">
        {/* SVG Donut Chart */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox={`0 0 ${CENTER_X * 2} ${CENTER_Y * 2}`}
            className="w-40 h-40 overflow-visible drop-shadow-sm"
          >
            {/* Empty state donut ring when zero calls */}
            {realTotal === 0 && (
              <circle
                cx={CENTER_X}
                cy={CENTER_Y}
                r={(DONUT_RADIUS + INNER_HOLE_RADIUS) / 2}
                fill="none"
                stroke="#E9D9D0"
                strokeWidth={DONUT_RADIUS - INNER_HOLE_RADIUS}
                className="opacity-90"
              />
            )}

            {/* Pie Slices */}
            {realTotal > 0 &&
              slices.map((s, i) => {
                if (s.value <= 0) return null;
                const isHovered = hoveredSliceIndex === i;
                const isDimmed = hoveredSliceIndex !== null && !isHovered;

                if (s.isFullCircle) {
                  return (
                    <circle
                      key={i}
                      cx={CENTER_X}
                      cy={CENTER_Y}
                      r={(DONUT_RADIUS + INNER_HOLE_RADIUS) / 2}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={DONUT_RADIUS - INNER_HOLE_RADIUS}
                      style={{
                        transform: isHovered ? 'scale(1.04)' : 'scale(1)',
                        transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out, filter 200ms ease-out',
                        opacity: isDimmed ? 0.35 : 1,
                        filter: isHovered ? 'drop-shadow(0 4px 10px rgba(103,6,38,0.25))' : 'none',
                        transformOrigin: `${CENTER_X}px ${CENTER_Y}px`
                      }}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredSliceIndex(i)}
                      onMouseLeave={() => setHoveredSliceIndex(null)}
                    />
                  );
                }

                return (
                  <path
                    key={i}
                    d={s.pathD}
                    fill={s.color}
                    stroke="#F7F1EA"
                    strokeWidth={isHovered ? 2 : 1}
                    style={{
                      transform: isHovered ? `translate(${s.dx}px, ${s.dy}px)` : 'translate(0px, 0px)',
                      transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out, filter 200ms ease-out',
                      opacity: isDimmed ? 0.35 : 1,
                      filter: isHovered ? 'drop-shadow(0 4px 10px rgba(103,6,38,0.25))' : 'none',
                      transformOrigin: `${CENTER_X}px ${CENTER_Y}px`
                    }}
                    className="transition-all duration-200 ease-out cursor-pointer"
                    onMouseEnter={() => setHoveredSliceIndex(i)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                  />
                );
              })}

            {/* Donut Center Hole */}
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={INNER_HOLE_RADIUS}
              fill="#F7F1EA"
              stroke="#E9D9D0"
              strokeWidth="2"
              className="pointer-events-none"
            />

            {/* Dynamic Center Donut Content (Full Label, No Truncation) */}
            {hoveredSliceIndex === null ? (
              <g className="pointer-events-none select-none transition-all duration-200">
                <text
                  x={CENTER_X}
                  y={CENTER_Y - 2}
                  textAnchor="middle"
                  fill="#670626"
                  fontSize="16"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {realTotal}
                </text>
                <text
                  x={CENTER_X}
                  y={CENTER_Y + 13}
                  textAnchor="middle"
                  fill="#7A4E59"
                  fontSize="10"
                  fontWeight="bold"
                  letterSpacing="0.08em"
                >
                  TOTAL
                </text>
              </g>
            ) : (
              <g className="pointer-events-none select-none transition-all duration-200">
                <text
                  x={CENTER_X}
                  y={CENTER_Y - 12}
                  textAnchor="middle"
                  fill={slices[hoveredSliceIndex].color}
                  fontSize={slices[hoveredSliceIndex].label.length > 14 ? '7.2' : '8.5'}
                  fontWeight="bold"
                  letterSpacing="0.02em"
                >
                  {slices[hoveredSliceIndex].label}
                </text>
                <text
                  x={CENTER_X}
                  y={CENTER_Y + 4}
                  textAnchor="middle"
                  fill="#670626"
                  fontSize="14"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  {slices[hoveredSliceIndex].percentage}%
                </text>
                <text
                  x={CENTER_X}
                  y={CENTER_Y + 17}
                  textAnchor="middle"
                  fill="#7A4E59"
                  fontSize="9"
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
                className={`flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all duration-150 ${
                  isHovered
                    ? 'bg-[#E9D9D0] border-[#A83B4D]/50 shadow-sm translate-x-1'
                    : isDimmed
                    ? 'opacity-35 border-transparent'
                    : 'border-transparent hover:bg-[#E9D9D0]/55'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform duration-150"
                    style={{
                      backgroundColor: d.color,
                      transform: isHovered ? 'scale(1.25)' : 'scale(1)',
                      boxShadow: isHovered ? `0 0 8px ${d.color}` : 'none'
                    }}
                  />
                  <span className={`truncate text-sm ${isHovered ? 'text-[#670626] font-bold' : 'text-[#3B1722] font-medium'}`}>
                    {d.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
                  <span className="text-[#7A4E59] text-xs">{d.percentage}%</span>
                  <span className={`font-bold text-sm ${isHovered ? 'text-[#670626]' : 'text-[#3B1722]'}`}>
                    {d.value}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Claymorphic Tooltip (Flip below cursor if near top to prevent clipping) */}
      {hoveredSliceIndex !== null && activeSlice && activeStatus && (
        <div
          className="pointer-events-none absolute z-30 transition-all duration-100 ease-out"
          style={{
            left: mousePos
              ? `${Math.max(105, Math.min(mousePos.x, (containerRef.current?.clientWidth || 300) - 105))}px`
              : '50%',
            top: mousePos
              ? isTooltipNearTop
                ? `${mousePos.y + 14}px`
                : `${mousePos.y - 12}px`
              : '40%',
            transform: isTooltipNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <div className="clay-surface bg-[#F7F1EA] border border-[#E9D9D0] rounded-xl shadow-xl p-3 min-w-[205px] flex flex-col gap-1 text-xs font-mono text-[#3B1722]">
            <div className="flex items-center justify-between border-b border-[#E9D9D0] pb-1">
              <div className="flex items-center gap-1.5 font-bold text-[#670626]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeSlice.color }} />
                <span>{activeSlice.label}</span>
              </div>
              <span className="text-xs text-[#7A4E59] font-semibold">{activeSlice.percentage}%</span>
            </div>
            <div className="flex justify-between text-[#5C313E] pt-0.5">
              <span className="text-[#7A4E59]">Active Load:</span>
              <span className="font-bold text-[#3B1722]">{activeSlice.value} Dispatches</span>
            </div>
            <div className="flex justify-between text-[#5C313E]">
              <span className="text-[#7A4E59]">Fleet Share:</span>
              <span className="text-[#670626] font-semibold">{activeSlice.percentage}% Workload</span>
            </div>
            <div className="mt-1 pt-1 border-t border-[#E9D9D0] flex items-center justify-between gap-2">
              <span className="text-xs text-[#7A4E59] uppercase tracking-wider">Status:</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${activeStatus.badge}`}>
                {activeStatus.label}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Status Telemetry Pill */}
      {activeSlice && activeStatus ? (
        <div className="mt-2 pt-2 border-t border-[#E9D9D0] flex items-center justify-between text-xs transition-all duration-150">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0 animate-ping" style={{ backgroundColor: activeSlice.color }} />
            <span className="font-semibold text-[#670626] truncate">{activeSlice.label} Focus</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${activeStatus.badge}`}>
              {activeStatus.label}
            </span>
            <span className="font-mono text-[#3B1722] text-xs font-semibold">
              {activeSlice.value} Dispatches ({activeSlice.percentage}%)
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-[#E9D9D0] flex items-center justify-between text-xs font-mono text-[#7A4E59]">
          <span>HOVER SLICE OR LEGEND FOR FLEET TELEMETRY</span>
          <span className="text-[#670626] font-bold">
            {activeAgenciesCount} ACTIVE / {safeData.length} AGENCIES
          </span>
        </div>
      )}
    </div>
  );
};

export default PieGraphChart;
