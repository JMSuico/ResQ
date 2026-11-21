// [Layer: Shared/Charts]
// Responsibility: SVG bar graph for incident severity classification with interactive tactical telemetry HUD.
// Provides smooth interactive hover states, displaying precise coordinate values and percentages upon mouse movement with zero jitter.
// Universal lambda expressions (=>).

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
const BAR_WIDTH = 42;
const MIN_SCALE_MAX = 5;
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

// Severity classification status helper
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
    l.includes('sos')
  ) {
    return {
      text: 'CRITICAL CODE RED',
      badgeClass: 'bg-rose-100 text-[#991B1B] border-rose-300 shadow-sm',
      dotClass: 'bg-[#991B1B] animate-pulse',
      textColor: 'text-[#991B1B]',
      glowColor: '#991B1B'
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
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 shadow-sm',
      dotClass: 'bg-amber-600',
      textColor: 'text-amber-800',
      glowColor: '#d97706'
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
  const max = Math.max(...safeData.map((d) => d.value), MIN_SCALE_MAX);
  const width = DEFAULT_WIDTH;
  const barWidth = BAR_WIDTH;
  const gap = (width - safeData.length * barWidth) / (safeData.length + 1);

  const hoveredBar = hoveredBarIndex !== null ? safeData[hoveredBarIndex] : null;
  const hoveredSeverity = hoveredBar ? computeSeverityBadge(hoveredBar.color, hoveredBar.label) : null;
  const hoveredBarCenter =
    hoveredBarIndex !== null ? gap + hoveredBarIndex * (barWidth + gap) + barWidth / 2 : 0;
  const hoveredBarHeight = hoveredBar ? Math.max((hoveredBar.value / max) * (height - 55), 4) : 0;
  const hoveredBarElevatedY = height - 25 - hoveredBarHeight - BAR_ELEVATION_OFFSET;

  // Tooltip positioning logic (bounded within container)
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
          {safeData.map((d, i) => {
            const barHeight = Math.max((d.value / max) * (height - 55), 4);
            const x = gap + i * (barWidth + gap);
            const y = height - 25 - barHeight;
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
                {/* Elevated Bar + Value Number Group */}
                <g
                  style={{
                    transform: isHovered ? `translateY(-${BAR_ELEVATION_OFFSET}px)` : 'translateY(0)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    filter: isHovered
                      ? `drop-shadow(0 6px 10px ${barColor}55)`
                      : 'none'
                  }}
                >
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
                  <text
                    x={x + barWidth / 2}
                    y={y - 6}
                    textAnchor="middle"
                    fill={isHovered ? '#670626' : '#3B1722'}
                    fontSize={isHovered ? '13' : '12'}
                    fontWeight="bold"
                    className="transition-all duration-150 select-none font-mono"
                  >
                    {d.value}
                  </text>
                </g>

                {/* Grounded Category Label */}
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

        {/* Floating Claymorphic Tooltip */}
        {hoveredBar && hoveredSeverity && (
          <div
            className="absolute pointer-events-none z-30 transition-all duration-150 ease-out"
            style={{
              top: `${(hoveredBarElevatedY / height) * 100}%`,
              ...tooltipLeftStyle
            }}
          >
            <div className="clay-surface bg-[#F7F1EA] border border-[#E9D9D0] rounded-xl p-3 shadow-xl min-w-[185px] text-xs font-mono flex flex-col gap-1.5 text-[#3B1722]">
              {/* Category Label (X-axis) */}
              <div className="flex items-center justify-between gap-3 border-b border-[#E9D9D0] pb-1">
                <span className="text-xs text-[#7A4E59] uppercase tracking-wider">Category</span>
                <span className="text-[#670626] font-bold">{hoveredBar.label}</span>
              </div>

              {/* Numerical Value & Percentage Share */}
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

              {/* Severity Status Badge */}
              <div
                className={`mt-0.5 inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors duration-150 ${hoveredSeverity.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${hoveredSeverity.dotClass}`} />
                <span>{hoveredSeverity.text}</span>
              </div>
            </div>

            {/* Caret arrow pointing to bar */}
            <div
              className={`w-2.5 h-2.5 bg-[#F7F1EA] border-[#E9D9D0] transform rotate-45 shadow-md ${
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

export default BarGraphChart;
