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
    if (val === 0) return 'bg-slate-800/40 text-slate-500 border border-slate-800/60';
    if (val < 4) return 'bg-sky-950/70 text-sky-300 border border-sky-900/50';
    if (val < 8) return 'bg-sky-700/80 text-white border border-sky-600/50 font-semibold';
    if (val < 12) return 'bg-amber-600/90 text-white border border-amber-500/60 font-bold';
    return 'bg-rose-600 text-white font-bold border border-rose-400/80 animate-pulse';
  };

  const getRiskMeta = (val: number) => {
    if (val >= 12) {
      return {
        status: 'CRITICAL CONGESTION',
        color: 'text-rose-400',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
        dot: 'bg-rose-500',
        halo: 'ring-2 ring-rose-400 shadow-[0_0_18px_rgba(244,63,94,0.9)] border-white'
      };
    }
    if (val >= 8) {
      return {
        status: 'HIGH DISPATCH VOLUME',
        color: 'text-amber-400',
        badge: 'bg-amber-500/20 text-amber-300 border-amber-500/50',
        dot: 'bg-amber-500',
        halo: 'ring-2 ring-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.9)] border-white'
      };
    }
    if (val >= 4) {
      return {
        status: 'MODERATE CONCENTRATION',
        color: 'text-sky-400',
        badge: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
        dot: 'bg-sky-400',
        halo: 'ring-2 ring-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.85)] border-white'
      };
    }
    if (val > 0) {
      return {
        status: 'NOMINAL CADENCE',
        color: 'text-emerald-400',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
        dot: 'bg-emerald-400',
        halo: 'ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.75)] border-white'
      };
    }
    return {
      status: 'ALL CLEAR / ZERO CALLS',
      color: 'text-slate-400',
      badge: 'bg-slate-700/20 text-slate-300 border-slate-600/40',
      dot: 'bg-slate-500',
      halo: 'ring-2 ring-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.5)] border-slate-300'
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
      className="relative flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl select-none"
      onMouseLeave={() => setHoveredCell(null)}
    >
      {/* Title & Telemetry Header */}
      <div className="flex items-center justify-between">
        {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
          7D × 24H SECTOR GRID
        </span>
      </div>

      {/* Grid Container */}
      <div
        className="flex flex-col gap-1.5 mt-2 overflow-x-auto pb-1"
        onScroll={() => setHoveredCell(null)}
      >
        {/* X-Axis Hour Labels */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono pl-8">
          {hours.map((h, hIdx) => {
            const isColHovered = hoveredCell?.hIdx === hIdx;
            return (
              <span
                key={h}
                className={`w-10 text-center transition-all duration-200 ${
                  isColHovered
                    ? 'text-sky-300 font-bold scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                    : 'text-slate-500'
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
                className={`w-6 text-[10px] font-mono transition-all duration-200 ${
                  isRowHovered
                    ? 'text-sky-300 font-bold scale-110 drop-shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                    : 'text-slate-400'
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
                    className={`relative w-10 h-7 rounded flex items-center justify-center text-[10px] font-mono transition-all duration-200 cursor-pointer ${
                      getCellBaseStyle(val)
                    } ${
                      isCellHovered
                        ? `scale-125 z-20 ${risk.halo}`
                        : 'scale-100 z-0 hover:brightness-110'
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

      {/* Floating Tactical HUD Tooltip */}
      {hoveredCell && activeRisk && activePosture && (
        <div
          className="pointer-events-none absolute z-30 transition-all duration-150 ease-out"
          style={{
            left: `${clampedX}px`,
            top: hoveredCell.dIdx <= 1 ? `${hoveredCell.y + 36}px` : `${hoveredCell.y - 10}px`,
            transform: hoveredCell.dIdx <= 1 ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-slate-950/95 backdrop-blur-md border border-slate-700/90 rounded-xl shadow-2xl p-3 min-w-[260px] text-xs font-mono">
            {/* Sector Window Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5 font-bold text-slate-100">
                <span className={`w-2 h-2 rounded-full ${activeRisk.dot}`} />
                <span className="tracking-wide">
                  {hoveredCell.day} {hoveredCell.hour}:00 - {nextHour}:00
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                SECTOR
              </span>
            </div>

            {/* Density Value */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 text-[11px]">Density Value:</span>
              <span className="font-bold text-white text-xs">
                {hoveredCell.value} Recorded Incidents
              </span>
            </div>

            {/* Risk Rating Status */}
            <div className="flex items-center justify-between py-0.5">
              <span className="text-slate-400 text-[11px]">Risk Rating:</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${activeRisk.badge}`}>
                {activeRisk.status}
              </span>
            </div>

            {/* Dispatch Posture Recommendation */}
            <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                Dispatch Posture:
              </span>
              <span className={`text-[11px] font-medium ${activeRisk.color}`}>
                "{activePosture}"
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Incident Density Scale Legend */}
      <div className="mt-2 pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-slate-400">
        <span className="font-semibold uppercase tracking-wider text-slate-500">
          Incident Density Scale:
        </span>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-slate-800/40 border border-slate-700/60" />
            <span>0</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-sky-950/70 border border-sky-900/50 text-sky-400 text-center" />
            <span>1-3</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-sky-700/80 border border-sky-600/50" />
            <span>4-7</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-amber-600/90 border border-amber-500/60" />
            <span>8-11</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-rose-600 border border-rose-400/80 animate-pulse" />
            <span>12+</span>
          </div>
        </div>
      </div>
    </div>
  );
};
