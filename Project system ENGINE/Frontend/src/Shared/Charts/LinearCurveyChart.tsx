// [Layer: Shared/Charts]
// Responsibility: SVG smooth curvey line chart for incident volume and triage response telemetry.
// Self-contained SVG vectors provide deterministic rendering with zero-jitter interactive telemetry.
// Universal lambda expressions (=>).

import React, { FC, useState, useCallback } from 'react';
import { TrendingUp } from 'lucide-react';

export interface DataPoint {
  label: string;
  value: number;
}

export interface LinearCurveyChartProps {
  data: DataPoint[];
  title?: string;
  color?: string;
  height?: number;
}

const DEFAULT_WIDTH = 540;
const DEFAULT_HEIGHT = 200;
const LEFT_PADDING = 40;
const RIGHT_PADDING = 20;
const TOP_PADDING = 22;
const BOTTOM_PADDING = 30;
const SURGE_CRITICAL_RATIO = 0.75;
const SURGE_ELEVATED_RATIO = 0.45;
const TOOLTIP_BOUND_MARGIN = 90;
const TOP_BOUND_MARGIN = 65;

interface SurgeStatus {
  text: string;
  badgeClass: string;
  dotClass: string;
  textColor: string;
}

const computeSurgeStatus = (value: number, max: number): SurgeStatus => {
  if (value === 0) {
    return {
      text: 'Zero',
      badgeClass: 'bg-slate-800/70 text-slate-300 border-white/10',
      dotClass: 'bg-slate-400',
      textColor: 'text-slate-400'
    };
  }
  if (value >= max * SURGE_CRITICAL_RATIO) {
    return {
      text: 'Critical',
      badgeClass: 'bg-rose-950/75 text-rose-300 border-rose-500/45 shadow-[0_0_8px_rgba(244,63,94,0.3)]',
      dotClass: 'bg-rose-500 animate-ping',
      textColor: 'text-rose-400'
    };
  }
  if (value >= max * SURGE_ELEVATED_RATIO) {
    return {
      text: 'Elevated',
      badgeClass: 'bg-amber-950/75 text-amber-300 border-amber-500/45 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
      dotClass: 'bg-amber-400',
      textColor: 'text-amber-400'
    };
  }
  return {
    text: 'Nominal',
    badgeClass: 'bg-emerald-950/75 text-emerald-300 border-emerald-500/45 shadow-[0_0_8px_rgba(16,185,129,0.25)]',
    dotClass: 'bg-emerald-400',
    textColor: 'text-emerald-400'
  };
};

export const LinearCurveyChart: FC<LinearCurveyChartProps> = ({
  data,
  title = 'Incident Volume',
  color = '#0284c7',
  height = DEFAULT_HEIGHT
}) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  const safeData = data && data.length > 0 ? data : [
    { label: '00:00', value: 0 },
    { label: '04:00', value: 0 },
    { label: '08:00', value: 0 },
    { label: '12:00', value: 0 },
    { label: '16:00', value: 0 },
    { label: '20:00', value: 0 }
  ];

  const totalVolume = safeData.reduce((acc, d) => acc + d.value, 0);
  const rawPeak = Math.max(...safeData.map((d) => d.value), 0);
  const yAxisStep = rawPeak <= 4 ? 1 : rawPeak <= 8 ? 2 : Math.ceil((rawPeak * 1.2) / 4);
  const maxValue = yAxisStep * 4;
  const yTicks = [0, yAxisStep, yAxisStep * 2, yAxisStep * 3, maxValue];

  const width = DEFAULT_WIDTH;
  const plotWidth = width - LEFT_PADDING - RIGHT_PADDING;
  const plotHeight = height - TOP_PADDING - BOTTOM_PADDING;
  const baselineY = height - BOTTOM_PADDING;

  // Compute SVG curve points bounded cleanly inside padded Y/X plot area
  const points = safeData.map((d, i) => {
    const x = safeData.length > 1 ? LEFT_PADDING + (i / (safeData.length - 1)) * plotWidth : LEFT_PADDING + plotWidth / 2;
    const y = baselineY - (d.value / maxValue) * plotHeight;
    return { x, y };
  });

  const pathD = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cpX = (prev.x + p.x) / 2;
    return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  // Zero-jitter point calculation: only update index if nearest point changed
  const updateNearestPoint = useCallback(
    (clientX: number, targetRect: DOMRect) => {
      const x = ((clientX - targetRect.left) / targetRect.width) * width;

      let nearestIdx = 0;
      let minDiff = Infinity;
      points.forEach((p, idx) => {
        const diff = Math.abs(p.x - x);
        if (diff < minDiff) {
          minDiff = diff;
          nearestIdx = idx;
        }
      });

      setActivePointIndex((prev) => (prev === nearestIdx ? prev : nearestIdx));
    },
    [points, width]
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    updateNearestPoint(e.clientX, rect);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!e.touches[0]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    updateNearestPoint(e.touches[0].clientX, rect);
  };

  const handleMouseLeave = () => {
    setActivePointIndex(null);
  };

  const activePoint = activePointIndex !== null ? points[activePointIndex] : null;
  const activeData = activePointIndex !== null ? safeData[activePointIndex] : null;
  const activeSurge = activeData ? computeSurgeStatus(activeData.value, maxValue) : null;
  const percentageOfTotal =
    activeData && totalVolume > 0 ? ((activeData.value / totalVolume) * 100).toFixed(1) : '0.0';

  // Tooltip positioning logic (bounded within container)
  const isNearTop = activePoint ? activePoint.y < TOP_BOUND_MARGIN : false;
  const isNearLeft = activePoint ? activePoint.x < TOOLTIP_BOUND_MARGIN : false;
  const isNearRight = activePoint ? activePoint.x > width - TOOLTIP_BOUND_MARGIN : false;

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
    <div
      className="relative flex flex-col gap-2 p-4 bg-slate-900/55 backdrop-blur-xl border border-white/10 rounded-xl shadow-[0_12px_32px_-8px_rgba(2,6,23,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] select-none"
      data-x-labels={safeData.map((d) => d.label).join('|')}
      data-y-ticks={yTicks.join(',')}
      data-y-max={String(maxValue)}
    >
      {/* Header with live coordinate telemetry */}
      <div className="flex items-center justify-between min-h-[22px]">
        {title && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">{title}</h4>
          </div>
        )}
        {activeData && activeSurge && (
          <div className="flex items-center gap-2 text-[11px] font-mono transition-opacity duration-200">
            <span className="text-slate-400">{activeData.label}:</span>
            <span className={`font-bold ${activeSurge.textColor}`}>
              {activeData.value} ({percentageOfTotal}%)
            </span>
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

          {/* Dynamic Y-axis Horizontal Gridlines & Numeric Ticks */}
          {yTicks.map((tickVal) => {
            const tickY = baselineY - (tickVal / maxValue) * plotHeight;
            return (
              <g key={`y-${tickVal}`} className="pointer-events-none">
                <line
                  x1={LEFT_PADDING}
                  y1={tickY}
                  x2={width - RIGHT_PADDING}
                  y2={tickY}
                  stroke="rgba(148, 163, 184, 0.16)"
                  strokeDasharray={tickVal === 0 ? undefined : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={LEFT_PADDING - 8}
                  y={tickY + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

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
            <g className="transition-all duration-150 ease-out pointer-events-none">
              <line
                x1={activePoint.x}
                y1={TOP_PADDING}
                x2={activePoint.x}
                y2={baselineY}
                stroke="#ff5c74"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                opacity="0.8"
                filter="url(#laserGlow)"
              />
            </g>
          )}

          {/* Data Circles & Axis Labels */}
          {points.map((p, i) => {
            const isActive = activePointIndex === i;

            return (
              <g key={i} className="pointer-events-none">
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

                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 7 : 4}
                  fill={isActive ? '#ff5c74' : '#0f172a'}
                  stroke={isActive ? '#ffffff' : color}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-all duration-150 ease-out"
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 8px #ff5c74)' : 'none'
                  }}
                />

                {/* X-axis Dynamic Bucket Label */}
                <text
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isActive ? '#f1f5f9' : '#94a3b8'}
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight={isActive ? 'bold' : 'normal'}
                  className="transition-colors duration-150"
                >
                  {safeData[i]?.label || ''}
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

        {/* Floating Glass HUD Tooltip */}
        {activePoint && activeData && activeSurge && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-150 ease-out"
            style={{
              top: `${(activePoint.y / height) * 100}%`,
              ...tooltipLeftStyle
            }}
          >
            <div className="bg-slate-950/85 border border-white/15 rounded-xl p-2.5 shadow-2xl backdrop-blur-xl min-w-[165px] text-xs font-mono flex flex-col gap-1.5 ring-1 ring-white/10">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1">
                <span className="text-[10px] text-slate-400 uppercase">Window</span>
                <span className="text-white font-bold">{activeData.label}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Count:</span>
                <span className="text-white font-extrabold text-sm flex items-center gap-1">
                  <span className={activeSurge.textColor}>{activeData.value}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Share:</span>
                <span className="text-slate-200 font-semibold text-xs">{percentageOfTotal}%</span>
              </div>

              <div
                className={`mt-0.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors duration-150 ${activeSurge.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeSurge.dotClass}`} />
                <span>{activeSurge.text}</span>
              </div>
            </div>

            <div
              className={`w-2.5 h-2.5 bg-slate-950/90 border-white/15 transform rotate-45 shadow-md ${
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

export default LinearCurveyChart;
