// [Layer: Components]
// Responsibility: Reusable responsive SVG bounding-box overlay and telemetry chip for Roboflow Serverless Workflow detections.
// Invariant: Strict TypeScript with ZERO 'any', ZERO emojis, lucide-react icons only, and 100% Universal Arrow Lambda syntax (=>).

import React from 'react';
import { Cpu, Database, Zap } from 'lucide-react';

export interface RoboflowPredictionBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly className: string;
  readonly confidence: number;
  readonly imageWidth?: number;
  readonly imageHeight?: number;
}

export interface RoboflowDetectionOverlayProps {
  readonly predictions: readonly RoboflowPredictionBox[];
  readonly fallbackWidth?: number;
  readonly fallbackHeight?: number;
  readonly cacheHit?: boolean;
  readonly datasetLabel?: string;
  readonly claudeCacheActive?: boolean;
  readonly accentHex?: string;
}

export const RoboflowDetectionOverlay: React.FC<RoboflowDetectionOverlayProps> = ({
  predictions,
  fallbackWidth = 640,
  fallbackHeight = 480,
  cacheHit = false,
  datasetLabel,
  claudeCacheActive = false,
  accentHex = '#10b981'
}) => {
  if (!predictions || predictions.length === 0) return null;

  const sized = predictions.find(
    (p: RoboflowPredictionBox): boolean =>
      typeof p.imageWidth === 'number' && p.imageWidth > 0 && typeof p.imageHeight === 'number' && p.imageHeight > 0
  );
  const viewW = sized?.imageWidth ?? (fallbackWidth > 0 ? fallbackWidth : 640);
  const viewH = sized?.imageHeight ?? (fallbackHeight > 0 ? fallbackHeight : 480);
  const unit = Math.max(0.75, viewW / 640);
  const cleanDataset = datasetLabel?.trim();
  const hasTelemetry = Boolean(cleanDataset || cacheHit || claudeCacheActive);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="none" className="pointer-events-none h-full w-full">
        {predictions.map((pred: RoboflowPredictionBox, idx: number) => {
          const boxX = Math.max(1, Math.min(viewW - 6, pred.x - pred.width / 2));
          const boxY = Math.max(1, Math.min(viewH - 6, pred.y - pred.height / 2));
          const boxW = Math.max(4, Math.min(viewW - boxX - 1, pred.width));
          const boxH = Math.max(4, Math.min(viewH - boxY - 1, pred.height));
          const labelText = `${pred.className} ${(Math.max(0, Math.min(1, pred.confidence)) * 100).toFixed(0)}%`;
          const pillH = Math.round(20 * unit);
          const fontSize = Math.round(11 * unit);
          const pillW = Math.min(
            viewW - boxX - 2,
            Math.max(Math.round(56 * unit), Math.round(labelText.length * 6.8 * unit + 14 * unit))
          );
          const pillY = boxY >= pillH + 4 ? boxY - pillH - 2 : boxY + 2;

          return (
            <g key={`${pred.className}-${idx}`}>
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                rx={Math.round(8 * unit)}
                ry={Math.round(8 * unit)}
                fill={`${accentHex}18`}
                stroke={accentHex}
                strokeWidth={Math.max(2, 2.5 * unit)}
              />
              <rect x={boxX} y={pillY} width={pillW} height={pillH} rx={Math.round(5 * unit)} ry={Math.round(5 * unit)} fill={accentHex} />
              <text
                x={boxX + Math.round(7 * unit)}
                y={pillY + Math.round(14 * unit)}
                fill="#04110b"
                fontSize={fontSize}
                fontWeight="700"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {labelText}
              </text>
            </g>
          );
        })}
      </svg>

      {hasTelemetry && (
        <div className="absolute top-2 right-2 flex flex-wrap items-center justify-end gap-1 max-w-[92%]">
          {cleanDataset && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/50 bg-slate-950/85 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-emerald-200 backdrop-blur-sm">
              <Database className="w-2.5 h-2.5 text-emerald-400" />
              <span>{cleanDataset}</span>
            </span>
          )}
          {cacheHit && (
            <span className="inline-flex items-center gap-1 rounded border border-amber-400/50 bg-slate-950/85 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-amber-200 backdrop-blur-sm">
              <Zap className="w-2.5 h-2.5 text-amber-400" />
              <span>15m Cache</span>
            </span>
          )}
          {claudeCacheActive && (
            <span className="inline-flex items-center gap-1 rounded border border-cyan-400/50 bg-slate-950/85 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold text-cyan-200 backdrop-blur-sm">
              <Cpu className="w-2.5 h-2.5 text-cyan-400" />
              <span>Claude Cached</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default RoboflowDetectionOverlay;
