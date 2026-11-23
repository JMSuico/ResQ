// [Layer: Shared/Charts]
// Responsibility: 7-day x 24-hour incident density heatmap matrix with max-normalized intensity ramp.
// Interactive matrix with synchronized axis highlights, responsive grid sizing, and clamped HUD tooltips.
// Universal lambda expressions (=>). ZERO 'any', ZERO emojis.

import React, { useState, useRef } from 'react';

export interface HoveredHeatmapCell {
  day: string;
  hour: string;
  value: number;
  dIdx: number;
  hIdx: number;
  x: number;
  y: number;
}

export interface HeatmapChartProps {
  matrix?: number[][];
  title?: string;
  subtitle?: string;
  rows?: string[];
  cols?: string[];
  unitLabel?: string;
}

const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_HOURS = ['00', '04', '08', '12', '16', '20'];

interface IntensityTier {
  cellClass: string;
  status: string;
  color: string;
  badge: string;
  dot: string;
  halo: string;
  posture: string;
}

const resolveIntensityTier = (val: number, maxVal: number): IntensityTier => {
  if (val <= 0) {
    return {
      cellClass: 'bg-[#EFE5DC]/80 text-[#7A4E59] border border-[#D8C1B5]',
      status: 'ALL CLEAR / ZERO CALLS',
      color: 'text-[#7A4E59]',
      badge: 'bg-[#E9D9D0] text-[#5C313E] border-[#D4B8AA]',
      dot: 'bg-[#7A4E59]',
      halo: 'ring-2 ring-[#A83B4D]/50 shadow-sm border-[#670626]',
      posture: 'Routine readiness posture'
    };
  }

  const ratio = maxVal > 0 ? val / maxVal : 0;

  if (ratio <= 0.2) {
    return {
      cellClass: 'bg-emerald-100 text-emerald-900 border border-emerald-300 font-semibold',
      status: 'LOW EMERALD MIST',
      color: 'text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      dot: 'bg-emerald-600',
      halo: 'ring-2 ring-emerald-500 shadow-md border-[#F7F1EA]',
      posture: 'Routine readiness posture'
    };
  }

  if (ratio <= 0.4) {
    return {
      cellClass: 'bg-amber-200 text-amber-950 border border-amber-400 font-semibold',
      status: 'MODERATE AMBER',
      color: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-900 border-amber-300',
      dot: 'bg-amber-600',
      halo: 'ring-2 ring-amber-500 shadow-md border-[#F7F1EA]',
      posture: 'Standard triage readiness'
    };
  }

  if (ratio <= 0.65) {
    return {
      cellClass: 'bg-orange-500 text-white border border-orange-600 font-bold',
      status: 'ELEVATED BURNT ORANGE',
      color: 'text-orange-800',
      badge: 'bg-orange-100 text-orange-900 border-orange-300',
      dot: 'bg-orange-600',
      halo: 'ring-2 ring-orange-500 shadow-lg border-[#F7F1EA]',
      posture: 'Increase mobile patrol density'
    };
  }

  if (ratio <= 0.85) {
    return {
      cellClass: 'bg-rose-600 text-white border border-rose-700 font-bold',
      status: 'HIGH ROSE CRIMSON',
      color: 'text-rose-800',
      badge: 'bg-rose-100 text-[#991B1B] border-rose-300',
      dot: 'bg-rose-600',
      halo: 'ring-2 ring-rose-500 shadow-lg border-[#F7F1EA]',
      posture: 'Priority apparatus pre-staging advised'
    };
  }

  return {
    cellClass: 'bg-[#670626] text-[#F7F1EA] font-bold border border-[#4A031A]',
    status: 'PEAK INTENSITY MAROON',
    color: 'text-[#670626]',
    badge: 'bg-rose-100 text-[#991B1B] border-rose-300',
    dot: 'bg-[#670626] animate-pulse',
    halo: 'ring-2 ring-[#670626] shadow-lg border-[#F7F1EA]',
    posture: 'Priority apparatus pre-staging required'
  };
};

export const HeatmapChart: React.FC<HeatmapChartProps> = ({
  matrix,
  title = 'Weekly Incident Density Heatmap',
  subtitle,
  rows,
  cols,
  unitLabel = 'TIME BLOCK'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredHeatmapCell | null>(null);

  const days = rows && rows.length > 0 ? rows : DEFAULT_DAYS;
  const hours = cols && cols.length > 0 ? cols : DEFAULT_HOURS;

  const cleanZeroGrid = Array.from({ length: days.length }, () => Array<number>(hours.length).fill(0));

  const grid =
    matrix &&
    matrix.length === days.length &&
    matrix.every((row) => Array.isArray(row) && row.length === hours.length)
      ? matrix
      : cleanZeroGrid;

  const rawMax = Math.max(0, ...grid.flat());
  const normalizationMax = Math.max(1, rawMax);

  const handleCellMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    day: string,
    dIdx: number,
    hIdx: number,
    val: number
  ) => {
    if (containerRef.current) {
      const parentRect = containerRef.current.getBoundingClientRect();
      const cellRect = e.currentTarget.getBoundingClientRect();
      const x = cellRect.left - parentRect.left + cellRect.width / 2;
      const y = cellRect.top - parentRect.top;

      setHoveredCell({
        day,
        hour: hours[hIdx],
        value: val,
        dIdx,
        hIdx,
        x,
        y
      });
    }
  };

  const containerW = containerRef.current?.clientWidth || 400;
  const halfTooltipW = Math.min(135, Math.max(105, Math.floor(containerW * 0.42)));
  const clampedX = hoveredCell
    ? Math.max(halfTooltipW, Math.min(hoveredCell.x, Math.max(halfTooltipW, containerW - halfTooltipW)))
    : containerW / 2;

  const nextHour = hoveredCell
    ? hoveredCell.hIdx < hours.length - 1
      ? hours[hoveredCell.hIdx + 1]
      : '24'
    : '04';

  const activeTier = hoveredCell ? resolveIntensityTier(hoveredCell.value, normalizationMax) : null;

  return (
    <div
      ref={containerRef}
      className="clay-surface relative flex flex-col gap-2 p-4 bg-[#F7F1EA] border border-[#E9D9D0] rounded-2xl shadow-[0_14px_32px_-10px_rgba(103,6,38,0.14),inset_0_2px_4px_rgba(255,255,255,0.85)] select-none text-[#3B1722]"
      onMouseLeave={() => setHoveredCell(null)}
    >
      {/* Title & Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title && (
          <h4 className="text-sm font-extrabold text-[#670626] uppercase tracking-wider">{title}</h4>
        )}
        <span className="text-xs font-mono text-[#7A4E59] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#670626] animate-pulse" />
          <span>{subtitle || `${days.length}D × 24H DENSITY GRID`}</span>
        </span>
      </div>

      {/* Synchronized Responsive Grid Container */}
      <div className="flex flex-col gap-1.5 mt-2 pb-1">
        {/* X-Axis Hour Labels */}
        <div className="grid grid-cols-[44px_1fr] items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase text-[#7A4E59] text-right pr-1">
            DAY
          </span>
          <div
            className="grid gap-1.5 text-xs font-mono"
            style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
          >
            {hours.map((h, hIdx) => {
              const isColHovered = hoveredCell?.hIdx === hIdx;
              return (
                <span
                  key={h}
                  className={`text-center transition-all duration-200 ${
                    isColHovered ? 'text-[#670626] font-bold scale-105' : 'text-[#7A4E59]'
                  }`}
                >
                  {h}:00
                </span>
              );
            })}
          </div>
        </div>

        {/* Y-Axis Day Rows and Matrix Cells */}
        {days.map((day, dIdx) => {
          const isRowHovered = hoveredCell?.dIdx === dIdx;

          return (
            <div key={day} className="grid grid-cols-[44px_1fr] items-center gap-2">
              <span
                className={`text-xs font-mono text-right pr-1 transition-all duration-200 ${
                  isRowHovered ? 'text-[#670626] font-bold scale-105' : 'text-[#7A4E59]'
                }`}
              >
                {day}
              </span>

              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }}
              >
                {grid[dIdx].map((val, hIdx) => {
                  const isCellHovered = hoveredCell?.dIdx === dIdx && hoveredCell?.hIdx === hIdx;
                  const tier = resolveIntensityTier(val, normalizationMax);

                  return (
                    <div
                      key={hIdx}
                      onMouseEnter={(e) => handleCellMouseEnter(e, day, dIdx, hIdx, val)}
                      className={`relative w-full h-8 rounded-md flex items-center justify-center text-xs font-mono transition-all duration-200 cursor-pointer ${
                        tier.cellClass
                      } ${
                        isCellHovered
                          ? `scale-105 z-20 ${tier.halo}`
                          : 'scale-100 z-0 hover:brightness-95'
                      }`}
                    >
                      {val > 0 ? val : ''}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Claymorphic Tooltip */}
      {hoveredCell && activeTier && (
        <div
          className="pointer-events-none absolute z-30 transition-all duration-150 ease-out max-w-[calc(100%-16px)]"
          style={{
            left: `${clampedX}px`,
            top: hoveredCell.dIdx <= 1 ? `${hoveredCell.y + 38}px` : `${hoveredCell.y - 10}px`,
            transform: hoveredCell.dIdx <= 1 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <div className="clay-surface bg-[#F7F1EA] border border-[#E9D9D0] rounded-xl shadow-xl p-3 min-w-[220px] sm:min-w-[260px] text-xs font-mono text-[#3B1722]">
            <div className="flex items-center justify-between gap-2 border-b border-[#E9D9D0] pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-[#670626] text-sm">
                <span className={`w-2 h-2 rounded-full ${activeTier.dot}`} />
                <span className="tracking-wide">
                  {hoveredCell.day} {hoveredCell.hour}:00 - {nextHour}:00
                </span>
              </div>
              <span className="text-[11px] text-[#7A4E59] font-semibold uppercase tracking-wider">
                {unitLabel}
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5 gap-2">
              <span className="text-[#7A4E59] text-xs">Density Value:</span>
              <span className="font-bold text-[#3B1722] text-xs">
                {hoveredCell.value} Recorded Incidents
              </span>
            </div>

            <div className="flex items-center justify-between py-0.5 gap-2">
              <span className="text-[#7A4E59] text-xs">Intensity Tier:</span>
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${activeTier.badge}`}>
                {activeTier.status}
              </span>
            </div>

            <div className="mt-2 pt-2 border-t border-[#E9D9D0] flex flex-col gap-0.5">
              <span className="text-[11px] text-[#7A4E59] uppercase tracking-wider font-semibold">
                Dispatch Posture:
              </span>
              <span className={`text-xs font-medium ${activeTier.color}`}>
                &ldquo;{activeTier.posture}&rdquo;
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Continuous Color Intensity Scale Legend Bar */}
      <div className="mt-2 pt-2.5 border-t border-[#E9D9D0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-[#7A4E59]">
        <span className="font-semibold uppercase tracking-wider text-[#670626]">
          Color Intensity Scale:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-[#EFE5DC]/80 border border-[#D8C1B5]" />
            <span>0</span>
          </span>
          <div
            className="h-3 w-36 sm:w-44 rounded-full border border-[#D4B8AA]"
            style={{
              background:
                'linear-gradient(90deg, #D1FAE5 0%, #FDE68A 25%, #F97316 55%, #E11D48 80%, #670626 100%)'
            }}
            title="Zero -> Emerald Mist -> Amber -> Burnt Orange -> Rose Crimson -> Deep Maroon (#670626)"
          />
          <span className="text-[#670626] font-bold">
            Peak ({rawMax})
          </span>
        </div>
      </div>
    </div>
  );
};

export default HeatmapChart;
