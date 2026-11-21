// [Layer: Shared/Charts]
// Responsibility: 7-day x 24-hour incident density heatmap matrix.
// Interactive matrix with synchronized axis highlights, cell halo scaling, and floating tactical HUD tooltips.

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

export const HeatmapChart: React.FC<{
  matrix?: number[][];
  title?: string;
}> = ({ matrix, title = 'Weekly Incident Density Heatmap' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<HoveredHeatmapCell | null>(null);

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hours = ['00', '04', '08', '12', '16', '20'];

  // 7 days x 6 time blocks all-zero baseline matrix
  const cleanZeroGrid = Array.from({ length: 7 }, () => Array(6).fill(0));

  const grid =
    matrix && matrix.length === 7 && matrix.every((row) => Array.isArray(row) && row.length === 6)
      ? matrix
      : cleanZeroGrid;

  const getCellBaseStyle = (val: number) => {
    if (val === 0) return 'bg-[#E9D9D0]/65 text-[#7A4E59] border border-[#D8C1B5]';
    if (val < 4) return 'bg-[#F3D8DE] text-[#670626] border border-[#E5B8C3]';
    if (val < 8) return 'bg-[#A83B4D] text-[#F7F1EA] border border-[#8E2B3C] font-semibold';
    if (val < 12) return 'bg-amber-600 text-white border border-amber-500 font-bold';
    return 'bg-[#670626] text-[#F7F1EA] font-bold border border-[#4A031A] animate-pulse';
  };

  const getRiskMeta = (val: number) => {
    if (val >= 12) {
      return {
        status: 'CRITICAL CONGESTION',
        color: 'text-[#670626]',
        badge: 'bg-rose-100 text-[#991B1B] border-rose-300',
        dot: 'bg-[#991B1B]',
        halo: 'ring-2 ring-[#670626] shadow-lg border-[#F7F1EA]'
      };
    }
    if (val >= 8) {
      return {
        status: 'HIGH DISPATCH VOLUME',
        color: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-900 border-amber-300',
        dot: 'bg-amber-600',
        halo: 'ring-2 ring-amber-500 shadow-lg border-[#F7F1EA]'
      };
    }
    if (val >= 4) {
      return {
        status: 'MODERATE CONCENTRATION',
        color: 'text-[#A83B4D]',
        badge: 'bg-[#F3E4E7] text-[#670626] border-[#A83B4D]/40',
        dot: 'bg-[#A83B4D]',
        halo: 'ring-2 ring-[#A83B4D] shadow-md border-[#F7F1EA]'
      };
    }
    if (val > 0) {
      return {
        status: 'NOMINAL CADENCE',
        color: 'text-emerald-700',
        badge: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        dot: 'bg-emerald-600',
        halo: 'ring-2 ring-emerald-500 shadow-md border-[#F7F1EA]'
      };
    }
    return {
      status: 'ALL CLEAR / ZERO CALLS',
      color: 'text-[#7A4E59]',
      badge: 'bg-[#E9D9D0] text-[#5C313E] border-[#D4B8AA]',
      dot: 'bg-[#7A4E59]',
      halo: 'ring-2 ring-[#A83B4D]/50 shadow-sm border-[#670626]'
    };
  };

  const getDispatchPosture = (val: number) => {
    if (val >= 12) return 'Priority apparatus pre-staging required';
    if (val >= 8) return 'Increase mobile patrol density';
    if (val >= 4) return 'Standard triage readiness';
    return 'Routine readiness posture';
  };

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
  const clampedX = hoveredCell ? Math.max(135, Math.min(hoveredCell.x, containerW - 135)) : 200;

  const nextHour = hoveredCell
    ? hoveredCell.hIdx < hours.length - 1
      ? hours[hoveredCell.hIdx + 1]
      : '24'
    : '04';

  const activeRisk = hoveredCell ? getRiskMeta(hoveredCell.value) : null;
  const activePosture = hoveredCell ? getDispatchPosture(hoveredCell.value) : null;

  return (
    <div
      ref={containerRef}
      className="clay-surface relative flex flex-col gap-2 p-4 bg-[#F7F1EA] border border-[#E9D9D0] rounded-2xl shadow-[0_14px_32px_-10px_rgba(103,6,38,0.14),inset_0_2px_4px_rgba(255,255,255,0.85)] select-none text-[#3B1722]"
      onMouseLeave={() => setHoveredCell(null)}
    >
      {/* Title & Telemetry Header */}
      <div className="flex items-center justify-between gap-2">
        {title && <h4 className="text-sm font-extrabold text-[#670626] uppercase tracking-wider">{title}</h4>}
        <span className="text-xs font-mono text-[#7A4E59] uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#670626] animate-pulse" />
          7D × 24H SECTOR GRID
        </span>
      </div>

      {/* Grid Container */}
      <div
        className="flex flex-col gap-1.5 mt-2 overflow-x-auto pb-1"
        onScroll={() => setHoveredCell(null)}
      >
        {/* X-Axis Hour Labels */}
        <div className="flex items-center gap-1.5 text-xs font-mono pl-9">
          {hours.map((h, hIdx) => {
            const isColHovered = hoveredCell?.hIdx === hIdx;
            return (
              <span
                key={h}
                className={`w-10 text-center transition-all duration-200 ${
                  isColHovered
                    ? 'text-[#670626] font-bold scale-110'
                    : 'text-[#7A4E59]'
                }`}
              >
                {h}:00
              </span>
            );
          })}
        </div>

        {/* Y-Axis Day Rows and Matrix Cells */}
        {days.map((day, dIdx) => {
          const isRowHovered = hoveredCell?.dIdx === dIdx;

          return (
            <div key={day} className="flex items-center gap-1.5">
              {/* Day Label (Y-axis) */}
              <span
                className={`w-7 text-xs font-mono transition-all duration-200 ${
                  isRowHovered
                    ? 'text-[#670626] font-bold scale-110'
                    : 'text-[#7A4E59]'
                }`}
              >
                {day}
              </span>

              {/* Row Cells */}
              {grid[dIdx].map((val, hIdx) => {
                const isCellHovered = hoveredCell?.dIdx === dIdx && hoveredCell?.hIdx === hIdx;
                const risk = getRiskMeta(val);

                return (
                  <div
                    key={hIdx}
                    onMouseEnter={(e) => handleCellMouseEnter(e, day, dIdx, hIdx, val)}
                    className={`relative w-10 h-7 rounded flex items-center justify-center text-xs font-mono transition-all duration-200 cursor-pointer ${
                      getCellBaseStyle(val)
                    } ${
                      isCellHovered
                        ? `scale-125 z-20 ${risk.halo}`
                        : 'scale-100 z-0 hover:brightness-95'
                    }`}
                  >
                    {val > 0 ? val : ''}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Floating Claymorphic Tooltip */}
      {hoveredCell && activeRisk && activePosture && (
        <div
          className="pointer-events-none absolute z-30 transition-all duration-150 ease-out"
          style={{
            left: `${clampedX}px`,
            top: hoveredCell.dIdx <= 1 ? `${hoveredCell.y + 36}px` : `${hoveredCell.y - 10}px`,
            transform: hoveredCell.dIdx <= 1 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <div className="clay-surface bg-[#F7F1EA] border border-[#E9D9D0] rounded-xl shadow-xl p-3 min-w-[270px] text-xs font-mono text-[#3B1722]">
            {/* Sector Window Header */}
            <div className="flex items-center justify-between border-b border-[#E9D9D0] pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-[#670626] text-sm">
                <span className={`w-2 h-2 rounded-full ${activeRisk.dot}`} />
                <span className="tracking-wide">
                  {hoveredCell.day} {hoveredCell.hour}:00 - {nextHour}:00
                </span>
              </div>
              <span className="text-xs text-[#7A4E59] font-semibold uppercase tracking-wider">
                SECTOR
              </span>
            </div>

            {/* Density Value */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[#7A4E59] text-xs">Density Value:</span>
              <span className="font-bold text-[#3B1722] text-xs">
                {hoveredCell.value} Recorded Incidents
              </span>
            </div>

            {/* Risk Rating Status */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-[#7A4E59] text-xs">Risk Rating:</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${activeRisk.badge}`}>
                {activeRisk.status}
              </span>
            </div>

            {/* Dispatch Posture Recommendation */}
            <div className="mt-2 pt-2 border-t border-[#E9D9D0] flex flex-col gap-0.5">
              <span className="text-xs text-[#7A4E59] uppercase tracking-wider font-semibold">
                Dispatch Posture:
              </span>
              <span className={`text-xs font-medium ${activeRisk.color}`}>
                "{activePosture}"
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Incident Density Scale Legend */}
      <div className="mt-2 pt-2 border-t border-[#E9D9D0] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#7A4E59]">
        <span className="font-semibold uppercase tracking-wider text-[#670626]">
          Incident Density Scale:
        </span>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#E9D9D0]/65 border border-[#D8C1B5]" />
            <span>0</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#F3D8DE] border border-[#E5B8C3]" />
            <span>1-3</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#A83B4D] border border-[#8E2B3C]" />
            <span>4-7</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-600 border border-amber-500" />
            <span>8-11</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-[#670626] border border-[#4A031A] animate-pulse" />
            <span>12+</span>
          </div>
        </div>
      </div>
    </div>
  );
};
