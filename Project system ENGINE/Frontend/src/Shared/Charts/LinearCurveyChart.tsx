// [Layer: Shared/Charts]
// Responsibility: SVG smooth curvey line chart for incident volume and triage response telemetry.
// Self-contained SVG vectors provide deterministic rendering with zero-jitter interactive telemetry.
// Universal lambda expressions (=>). ZERO 'any', ZERO emojis.

import React, { FC, useState, useCallback, useId } from 'react';
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
const RIGHT_PADDING = 38;
const TOP_PADDING = 22;
const BOTTOM_PADDING = 30;
const SURGE_CRITICAL_RATIO = 0.75;
const SURGE_ELEVATED_RATIO = 0.45;
const TOOLTIP_BOUND_MARGIN = 95;
const TOP_BOUND_MARGIN = 65;

interface SurgeStatus {
  text: string;
  badgeClass: string;
  dotClass: string;
  textColor: string;
}

const computeSurgeStatus = (value: number, rawPeak: number): SurgeStatus => {
  if (value === 0 || rawPeak <= 0) {
    return {
      text: 'Zero',
      badgeClass: 'bg-[#E9D9D0] text-[#5C313E] border-[#D4B8AA]',
      dotClass: 'bg-[#7A4E59]',
      textColor: 'text-[#7A4E59]'
    };
  }
  if (value >= rawPeak * SURGE_CRITICAL_RATIO) {
    return {
      text: 'Critical',
      badgeClass: 'bg-rose-100 text-[#991B1B] border-rose-300 shadow-sm',
      dotClass: 'bg-[#991B1B] animate-ping',
      textColor: 'text-[#991B1B]'
    };
  }
  if (value >= rawPeak * SURGE_ELEVATED_RATIO) {
    return {
      text: 'Elevated',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm',
      dotClass: 'bg-amber-600',
      textColor: 'text-amber-800'
    };
  }
  return {
    text: 'Nominal',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm',
    dotClass: 'bg-emerald-600',
    textColor: 'text-emerald-800'
  };
};

export const LinearCurveyChart: FC<LinearCurveyChartProps> = ({
  data,
  title = 'Incident Volume',
  color = '#670626',
  height = DEFAULT_HEIGHT
}) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `linearCurveGradient-${uid}`;
  const filterId = `laserGlow-${uid}`;

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

  const points = safeData.map((d, i) => {
    const x =
      safeData.length > 1
        ? LEFT_PADDING + (i / (safeData.length - 1)) * plotWidth
        : LEFT_PADDING + plotWidth / 2;
    const y = baselineY - (d.value / maxValue) * plotHeight;
    return { x, y };
  });

  const isSinglePoint = points.length === 1;
  const singleSpanHalf = 22;

  const pathD = isSinglePoint
    ? `M ${points[0].x - singleSpanHalf} ${points[0].y} L ${points[0].x + singleSpanHalf} ${points[0].y}`
    : points.reduce((acc, p, i, arr) => {
        if (i === 0) return `M ${p.x} ${p.y}`;
        const prev = arr[i - 1];
        const cpX = (prev.x + p.x) / 2;
        return `${acc} C ${cpX} ${prev.y}, ${cpX} ${p.y}, ${p.x} ${p.y}`;
      }, '');

  const areaD = isSinglePoint
    ? `M ${points[0].x - singleSpanHalf} ${points[0].y} L ${points[0].x + singleSpanHalf} ${points[0].y} L ${
        points[0].x + singleSpanHalf
      } ${baselineY} L ${points[0].x - singleSpanHalf} ${baselineY} Z`
    : `${pathD} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

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
  const activeSurge = activeData ? computeSurgeStatus(activeData.value, rawPeak) : null;
  const percentageOfTotal =
    activeData && totalVolume > 0 ? ((activeData.value / totalVolume) * 100).toFixed(1) : '0.0';

  const isNearTop = activePoint ? activePoint.y < TOP_BOUND_MARGIN : false;
  const isNearLeft = activePoint ? activePoint.x < TOOLTIP_BOUND_MARGIN : false;
  const isNearRight = activePoint ? activePoint.x > width - TOOLTIP_BOUND_MARGIN : false;

  let tooltipLeftStyle: React.CSSProperties = {};
  if (activePoint) {
    if (isNearLeft) {
      tooltipLeftStyle = {
        left: '8px',
        transform: isNearTop ? 'translateY(14px)' : 'translateY(-100%) translateY(-14px)'
      };
    } else if (isNearRight) {
      tooltipLeftStyle = {
        right: '8px',
        left: 'auto',
        transform: isNearTop ? 'translateY(14px)' : 'translateY(-100%) translateY(-14px)'
      };
    } else {
      tooltipLeftStyle = {
        left: `${(activePoint.x / width) * 100}%`,
        transform: isNearTop ? 'translate(-50%, 14px)' : 'translate(-50%, -100%) translateY(-14px)'
      };
    }
  }

  return (
    <div
      className="clay-surface relative flex flex-col gap-2 p-4 bg-[#F7F1EA] border border-[#E9D9D0] rounded-2xl shadow-[0_14px_32px_-10px_rgba(103,6,38,0.14),inset_0_2px_4px_rgba(255,255,255,0.85)] select-none text-[#3B1722]"
      data-x-labels={safeData.map((d) => d.label).join('|')}
      data-y-ticks={yTicks.join(',')}
      data-y-max={String(maxValue)}
    >
      {/* Header with live coordinate telemetry */}
      <div className="flex items-center justify-between min-h-[24px]">
        {title && (
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-[#670626]" />
            <h4 className="text-sm font-extrabold text-[#670626] uppercase tracking-wider">{title}</h4>
          </div>
        )}
        {activeData && activeSurge && (
          <div className="flex items-center gap-2 text-xs font-mono transition-opacity duration-200">
            <span className="text-[#7A4E59]">{activeData.label}:</span>
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
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
            <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#A83B4D" floodOpacity="0.55" />
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
                  stroke="rgba(103, 6, 38, 0.14)"
                  strokeDasharray={tickVal === 0 ? undefined : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={LEFT_PADDING - 8}
                  y={tickY + 3}
                  textAnchor="end"
                  fill="#7A4E59"
                  fontSize="11"
                  fontFamily="monospace"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} className="transition-all duration-300" />

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
                stroke="#A83B4D"
                strokeDasharray="3 3"
                strokeWidth="1.5"
                opacity="0.85"
                filter={`url(#${filterId})`}
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
                      stroke="#A83B4D"
                      strokeWidth="2"
                      className="animate-ping opacity-75"
                      style={{ transformOrigin: `${p.x}px ${p.y}px` }}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="14"
                      fill="#A83B4D"
                      opacity="0.2"
                      className="transition-opacity duration-200"
                    />
                  </>
                )}

                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isActive ? 7 : 4}
                  fill={isActive ? '#670626' : '#F7F1EA'}
                  stroke={isActive ? '#F7F1EA' : color}
                  strokeWidth={isActive ? 2.5 : 2}
                  className="transition-all duration-150 ease-out"
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 6px #A83B4D)' : 'none'
                  }}
                />

                <text
                  x={p.x}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isActive ? '#670626' : '#7A4E59'}
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight={isActive ? 'bold' : 'normal'}
                  className="transition-colors duration-150"
                >
                  {safeData[i]?.label || ''}
                </text>
              </g>
            );
          })}

          <rect
            x="0"
            y="0"
            width={width}
            height={height}
            fill="transparent"
            className="pointer-events-auto"
          />
        </svg>

        {/* Floating Claymorphic Tooltip */}
        {activePoint && activeData && activeSurge && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-150 ease-out flex flex-col"
            style={{
              top: `${(activePoint.y / height) * 100}%`,
              ...tooltipLeftStyle
            }}
          >
            {isNearTop && (
              <div className="w-2.5 h-2.5 bg-[#F7F1EA] border-l border-t border-[#E9D9D0] transform rotate-45 shadow-sm -mb-[5px] mx-auto z-10" />
            )}

            <div className="clay-surface bg-[#F7F1EA] border border-[#E9D9D0] rounded-xl p-3 shadow-xl min-w-[175px] text-xs font-mono flex flex-col gap-1.5 text-[#3B1722]">
              <div className="flex items-center justify-between gap-3 border-b border-[#E9D9D0] pb-1">
                <span className="text-xs text-[#7A4E59] uppercase">Window</span>
                <span className="text-[#670626] font-bold">{activeData.label}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7A4E59]">Count:</span>
                <span className="text-[#3B1722] font-extrabold text-sm flex items-center gap-1">
                  <span className={activeSurge.textColor}>{activeData.value}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7A4E59]">Share:</span>
                <span className="text-[#3B1722] font-semibold text-xs">{percentageOfTotal}%</span>
              </div>

              <div
                className={`mt-0.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors duration-150 ${activeSurge.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${activeSurge.dotClass}`} />
                <span>{activeSurge.text}</span>
              </div>
            </div>

            {!isNearTop && (
              <div className="w-2.5 h-2.5 bg-[#F7F1EA] border-r border-b border-[#E9D9D0] transform rotate-45 shadow-md -mt-[5px] mx-auto" />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LinearCurveyChart;
