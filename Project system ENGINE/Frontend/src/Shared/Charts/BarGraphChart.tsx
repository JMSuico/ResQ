// [Layer: Shared/Charts]
// Responsibility: SVG bar graph for incident severity classification with interactive tactical telemetry HUD.
// Provides smooth interactive hover states, displaying precise coordinate values and percentages upon mouse movement with zero jitter.
// Universal lambda expressions (=>). ZERO 'any', ZERO emojis.

import React, { FC, useState } from 'react';
import { BarChart2 } from 'lucide-react';

export interface BarGraphItem {
  label: string;
  value: number;
  color?: string;
}

export interface BarGraphChartProps {
  data: BarGraphItem[];
  title?: string;
  height?: number;
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 180;
const LEFT_PADDING = 36;
const RIGHT_PADDING = 16;
const TOP_PADDING = 24;
const BOTTOM_PADDING = 28;
const TOOLTIP_BOUND_MARGIN = 85;
const TOP_BOUND_MARGIN = 65;
const BAR_ELEVATION_OFFSET = 6;

interface SeverityBadge {
  text: string;
  badgeClass: string;
  dotClass: string;
  textColor: string;
  glowColor: string;
}

const computeSeverityBadge = (color?: string, label?: string): SeverityBadge => {
  const c = (color || '').toLowerCase();
  const l = (label || '').toLowerCase();

  // Red / Rose: CRITICAL CODE RED
  if (
    c.includes('ef4444') ||
    c.includes('f43f5e') ||
    c.includes('e11d48') ||
    c.includes('991b1b') ||
    c.includes('670626') ||
    c.includes('red') ||
    c.includes('rose') ||
    l.includes('crit') ||
    l.includes('alert') ||
    l.includes('emerg')
  ) {
    return {
      text: 'CRITICAL CODE RED',
      badgeClass: 'bg-rose-100 text-[#991B1B] border-rose-300 shadow-sm',
      dotClass: 'bg-[#991B1B] animate-pulse',
      textColor: 'text-[#991B1B]',
      glowColor: '#991B1B'
    };
  }

  // Orange: HIGH PRIORITY
  if (
    c.includes('ea580c') ||
    c.includes('orange') ||
    l.includes('high')
  ) {
    return {
      text: 'HIGH PRIORITY',
      badgeClass: 'bg-orange-100 text-orange-900 border-orange-300 shadow-sm',
      dotClass: 'bg-orange-600',
      textColor: 'text-orange-800',
      glowColor: '#ea580c'
    };
  }

  // Amber / Yellow: MEDIUM PRIORITY
  if (
    c.includes('f59e0b') ||
    c.includes('d97706') ||
    c.includes('amber') ||
    c.includes('eab308') ||
    l.includes('med') ||
    l.includes('medium') ||
    l.includes('moderate') ||
    l.includes('tier')
  ) {
    return {
      text: 'MEDIUM PRIORITY',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm',
      dotClass: 'bg-amber-600',
      textColor: 'text-amber-800',
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
      badgeClass: 'bg-sky-100 text-sky-900 border-sky-300 shadow-sm',
      dotClass: 'bg-sky-700',
      textColor: 'text-sky-800',
      glowColor: '#0284c7'
    };
  }

  // Green: LOW IMPACT
  return {
    text: 'LOW IMPACT',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm',
    dotClass: 'bg-emerald-600',
    textColor: 'text-emerald-800',
    glowColor: '#10b981'
  };
};

export const BarGraphChart: FC<BarGraphChartProps> = ({
  data,
  title = 'Severity Classification Breakdown',
  height = DEFAULT_HEIGHT
}) => {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const safeData = data && data.length > 0 ? data : [
    { label: 'Low', value: 0, color: '#10b981' },
    { label: 'Medium', value: 0, color: '#f59e0b' },
    { label: 'High', value: 0, color: '#ea580c' },
    { label: 'Critical', value: 0, color: '#ef4444' }
  ];

  const total = safeData.reduce((sum, d) => sum + d.value, 0) || 1;
  const rawPeak = Math.max(...safeData.map((d) => d.value), 0);
  const yAxisStep = rawPeak <= 4 ? 1 : rawPeak <= 8 ? 2 : Math.ceil((rawPeak * 1.2) / 4);
  const maxScale = yAxisStep * 4;
  const yTicks = [0, yAxisStep, yAxisStep * 2, yAxisStep * 3, maxScale];

  const width = DEFAULT_WIDTH;
  const plotWidth = width - LEFT_PADDING - RIGHT_PADDING;
  const plotHeight = height - TOP_PADDING - BOTTOM_PADDING;
  const baselineY = height - BOTTOM_PADDING;

  const slotWidth = plotWidth / Math.max(1, safeData.length);
  const barWidth = Math.min(48, Math.max(14, Math.floor(slotWidth * 0.56)));
  const gap = (plotWidth - safeData.length * barWidth) / (safeData.length + 1);

  const hoveredBar = hoveredBarIndex !== null ? safeData[hoveredBarIndex] : null;
  const hoveredSeverity = hoveredBar ? computeSeverityBadge(hoveredBar.color, hoveredBar.label) : null;
  const hoveredBarCenter =
    hoveredBarIndex !== null
      ? LEFT_PADDING + gap + hoveredBarIndex * (barWidth + gap) + barWidth / 2
      : 0;
  const hoveredBarHeight =
    hoveredBar && hoveredBar.value > 0 ? (hoveredBar.value / maxScale) * plotHeight : 0;
  const hoveredBarElevatedY = baselineY - hoveredBarHeight - BAR_ELEVATION_OFFSET;

  const isNearTop = hoveredBarElevatedY < TOP_BOUND_MARGIN;
  const isNearLeft = hoveredBarCenter < TOOLTIP_BOUND_MARGIN;
  const isNearRight = hoveredBarCenter > width - TOOLTIP_BOUND_MARGIN;

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
    <div className="clay-surface relative flex flex-col gap-2 p-4 bg-[#F7F1EA] border border-[#E9D9D0] rounded-2xl shadow-[0_14px_32px_-10px_rgba(103,6,38,0.14),inset_0_2px_4px_rgba(255,255,255,0.85)] select-none text-[#3B1722]">
      {/* Header with live category telemetry */}
      <div className="flex items-center justify-between min-h-[24px]">
        {title && (
          <div className="flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-[#670626]" />
            <h4 className="text-sm font-extrabold text-[#670626] uppercase tracking-wider">{title}</h4>
          </div>
        )}
        {hoveredBar && hoveredSeverity && (
          <div className="flex items-center gap-2 text-xs font-mono transition-opacity duration-150">
            <span className="text-[#7A4E59]">{hoveredBar.label}:</span>
            <span className={`font-bold ${hoveredSeverity.textColor}`}>
              {hoveredBar.value} ({((hoveredBar.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        )}
      </div>

      <div className="relative w-full">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Y-axis Horizontal Gridlines & Numeric Ticks */}
          {yTicks.map((tickVal) => {
            const tickY = baselineY - (tickVal / maxScale) * plotHeight;
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
                  x={LEFT_PADDING - 6}
                  y={tickY + 3}
                  textAnchor="end"
                  fill="#7A4E59"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {safeData.map((d, i) => {
            const barHeight = d.value > 0 ? (d.value / maxScale) * plotHeight : 0;
            const x = LEFT_PADDING + gap + i * (barWidth + gap);
            const y = baselineY - barHeight;
            const isHovered = hoveredBarIndex === i;
            const isDimmed = hoveredBarIndex !== null && !isHovered;
            const barColor = d.color || '#670626';

            return (
              <g
                key={i}
                className="cursor-pointer"
                style={{
                  opacity: isDimmed ? 0.45 : 1,
                  transition: 'opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={() => setHoveredBarIndex(i)}
                onMouseLeave={() => setHoveredBarIndex(null)}
              >
                <g
                  style={{
                    transform: isHovered ? `translateY(-${BAR_ELEVATION_OFFSET}px)` : 'translateY(0)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: isHovered ? `drop-shadow(0 6px 10px ${barColor}55)` : 'none'
                  }}
                >
                  {barHeight > 0 && (
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      fill={barColor}
                      stroke={isHovered ? '#670626' : barColor}
                      strokeWidth={isHovered ? 1.5 : 0}
                      strokeOpacity={isHovered ? 0.9 : 0}
                      className="transition-all duration-150"
                    />
                  )}
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill={isHovered ? '#670626' : '#3B1722'}
                    fontSize={isHovered ? '13' : '11.5'}
                    fontWeight="bold"
                    className="transition-all duration-150 select-none font-mono"
                  >
                    {d.value}
                  </text>
                </g>

                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fill={isHovered ? '#670626' : '#7A4E59'}
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  className="transition-all duration-150 select-none font-sans"
                >
                  {d.label}
                </text>

                <rect
                  x={x - gap / 2}
                  y={TOP_PADDING - 10}
                  width={barWidth + gap}
                  height={height - TOP_PADDING + 10}
                  fill="transparent"
                  className="pointer-events-auto"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating Claymorphic Tooltip */}
        {hoveredBar && hoveredSeverity && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-150 ease-out flex flex-col"
            style={{
              top: `${(hoveredBarElevatedY / height) * 100}%`,
              ...tooltipLeftStyle
            }}
          >
            {isNearTop && (
              <div className="w-2.5 h-2.5 bg-[#F7F1EA] border-l border-t border-[#E9D9D0] transform rotate-45 shadow-sm -mb-[5px] mx-auto z-10" />
            )}

            <div className="clay-surface bg-[#F7F1EA] border border-[#E9D9D0] rounded-xl p-3 shadow-xl min-w-[185px] text-xs font-mono flex flex-col gap-1.5 text-[#3B1722]">
              <div className="flex items-center justify-between gap-3 border-b border-[#E9D9D0] pb-1">
                <span className="text-xs text-[#7A4E59] uppercase tracking-wider">Category</span>
                <span className="text-[#670626] font-bold">{hoveredBar.label}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7A4E59]">Total Count:</span>
                <span className="text-[#3B1722] font-extrabold text-sm flex items-center gap-1">
                  <span className={hoveredSeverity.textColor}>{hoveredBar.value}</span>
                  <span className="text-xs text-[#7A4E59] font-normal">incidents</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[#7A4E59]">Share of Total:</span>
                <span className="text-[#3B1722] font-semibold text-xs">
                  {((hoveredBar.value / total) * 100).toFixed(1)}%
                </span>
              </div>

              <div
                className={`mt-0.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors duration-150 ${hoveredSeverity.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${hoveredSeverity.dotClass}`} />
                <span>{hoveredSeverity.text}</span>
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

export default BarGraphChart;
