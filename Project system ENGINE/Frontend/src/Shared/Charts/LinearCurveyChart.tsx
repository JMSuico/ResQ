// [Layer: Shared/Charts]
// Responsibility: SVG smooth curvey line chart for incident volume and triage response telemetry.
// DO NOT import heavy charting libraries when self-contained SVG vectors provide deterministic rendering.

import React, { useState } from 'react';

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
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  if (!data || data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 10);
  const width = 500;
  const padding = 32;

  // Compute SVG curve points
  const points = data.map((d, i) => {
    const x = data.length > 1 ? padding + (i / (data.length - 1)) * (width - padding * 2) : width / 2;
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

  // Pointer position tracking across the SVG canvas
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    setMousePos({ x, y });

    // Find nearest data point along the X-axis
    let nearestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - x);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = idx;
      }
    });

    setActivePointIndex(nearestIdx);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!e.touches[0]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.touches[0].clientX - rect.left) / rect.width) * width;
    const y = ((e.touches[0].clientY - rect.top) / rect.height) * height;
    setMousePos({ x, y });

    let nearestIdx = 0;
    let minDiff = Infinity;
    points.forEach((p, idx) => {
      const diff = Math.abs(p.x - x);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = idx;
      }
    });

    setActivePointIndex(nearestIdx);
  };

  const handleMouseLeave = () => {
    setActivePointIndex(null);
    setMousePos(null);
  };

  // Tactical Surge Status computation
  const getSurgeStatus = (value: number, max: number) => {
    if (value === 0) {
      return {
        text: 'ZERO INCIDENTS',
        badgeClass: 'bg-slate-800/90 text-slate-300 border-slate-700/80',
        dotClass: 'bg-slate-400',
        textColor: 'text-slate-400'
      };
    }
    if (value >= max * 0.75) {
      return {
        text: 'CRITICAL SURGE',
        badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.3)]',
        dotClass: 'bg-rose-500 animate-ping',
        textColor: 'text-rose-400'
      };
    }
    if (value >= max * 0.45) {
      return {
        text: 'ELEVATED ACTIVITY',
        badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
        dotClass: 'bg-amber-400',
        textColor: 'text-amber-400'
      };
    }
    return {
      text: 'NOMINAL CADENCE',
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.25)]',
      dotClass: 'bg-emerald-400',
      textColor: 'text-emerald-400'
    };
  };

  const activePoint = activePointIndex !== null ? points[activePointIndex] : null;
  const activeData = activePointIndex !== null ? data[activePointIndex] : null;
  const activeSurge = activeData ? getSurgeStatus(activeData.value, maxValue) : null;

  // Tooltip positioning logic (bounded within container)
  const isNearTop = activePoint ? activePoint.y < 65 : false;
  const isNearLeft = activePoint ? activePoint.x < 85 : false;
  const isNearRight = activePoint ? activePoint.x > width - 85 : false;

  let tooltipLeftStyle: React.CSSProperties = {};
  if (activePoint) {
    if (isNearLeft) {
      tooltipLeftStyle = { left: '8px', transform: isNearTop ? 'translateY(14px)' : 'translateY(-100%) translateY(-14px)' };
    } else if (isNearRight) {
      tooltipLeftStyle = { right: '8px', left: 'auto', transform: isNearTop ? 'translateY(14px)' : 'translateY(-100%) translateY(-14px)' };
    } else {
      tooltipLeftStyle = {
        left: `${(activePoint.x / width) * 100}%`,
        transform: isNearTop ? 'translate(-50%, 14px)' : 'translate(-50%, -100%) translateY(-14px)'
      };
    }
  }

  return (
    <div className="relative flex flex-col gap-2 p-4 bg-slate-900 border border-slate-800 rounded-xl select-none">
      {/* Header with live coordinate telemetry */}
      <div className="flex items-center justify-between min-h-[22px]">
        {title && <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>}
        {activeData && activeSurge && (
          <div className="flex items-center gap-2 text-[11px] font-mono transition-opacity duration-200">
            <span className="text-slate-400">{activeData.label}:</span>
            <span className={`font-bold ${activeSurge.textColor}`}>{activeData.value} Incidents</span>
          </div>
        )}
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible cursor-crosshair touch-none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseLeave}
        >
          {/* Gradient Def */}
          <defs>
            <linearGradient id="linearCurveGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
            <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#ff5c74" floodOpacity="0.8" />
            </filter>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill="url(#linearCurveGradient)" className="transition-all duration-300" />

          {/* Curve Stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Vertical Laser Guideline */}
          {activePoint && (
            <g className="transition-all duration-200 ease-out pointer-events-none">
              <line
                x1={activePoint.x}
                y1={padding - 12}
                x2={activePoint.x}
                y2={height - padding}
                stroke="#ff5c74"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                opacity="0.8"
                filter="url(#laserGlow)"
                className="transition-all duration-150"
              />
            </g>
          )}

          {/* Data Circles & Axis Labels */}
          {points.map((p, i) => {
            const isActive = activePointIndex === i;

            return (
              <g key={i} className="pointer-events-none">
                {/* Outer animated pulse beacon ring for active point */}
                {isActive && (
                  <>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="14"
                      fill="none"
                      stroke="#ff5c74"
                      strokeWidth="2"
                      className="animate-ping opacity-75"
                      style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="14"
                      fill="#ff5c74"
                      opacity="0.25"
                      className="transition-opacity duration-200"
                    />
                  </>
                )}

                {/* Point Circle (Enlarges from r=4 to r=7 when active) */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 7 : 4}
                  fill={isActive ? '#ff5c74' : '#0f172a'}
                  stroke={isActive ? '#ffffff' : color}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-all duration-200 ease-out"
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 8px #ff5c74)' : 'none'
                  }}
                />

                {/* X-axis Timestamp / Label */}
                <text
                  x={p.x}
                  y={height - 10}
                  textAnchor="middle"
                  fill={isActive ? '#f1f5f9' : '#64748b'}
                  fontSize="10"
                  fontFamily="monospace"
                  fontWeight={isActive ? 'bold' : 'normal'}
                  className="transition-colors duration-200"
                >
                  {data[i].label}
                </text>
              </g>
            );
          })}

          {/* Transparent Overlay Rect for continuous pointer detection */}
          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill="transparent"
            className="pointer-events-auto"
          />
        </svg>

        {/* Floating Tactical HUD Tooltip */}
        {activePoint && activeData && activeSurge && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-200 ease-out"
            style={{
              top: `${(activePoint.y / height) * 100}%`,
              ...tooltipLeftStyle
            }}
          >
            <div className="bg-slate-950/95 border border-slate-700/90 rounded-xl p-2.5 shadow-2xl backdrop-blur-md min-w-[170px] text-xs font-mono flex flex-col gap-1.5 transition-all duration-200 ease-out ring-1 ring-white/10">
              {/* X-axis coordinate / label */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-1">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Temporal Coord</span>
                <span className="text-white font-bold">{activeData.label}</span>
              </div>

              {/* Y-axis coordinate / value */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Telemetry:</span>
                <span className="text-white font-extrabold text-sm flex items-center gap-1">
                  <span className={activeSurge.textColor}>{activeData.value}</span>
                  <span className="text-[10px] text-slate-400 font-normal">incidents</span>
                </span>
              </div>

              {/* Velocity / Surge Status Badge */}
              <div
                className={`mt-0.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors duration-200 ${activeSurge.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeSurge.dotClass}`} />
                <span>{activeSurge.text}</span>
              </div>
            </div>

            {/* Caret arrow indicator pointing to active point */}
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
