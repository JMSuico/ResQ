// [Layer: Vision / idScanner / face]
// Responsibility: Pure Geometric HUD Overlay & Telemetry Visualizer matching Pictures 1 through 7.
// Renders Bounding Box, Blue Dashed Center Lines with arrows, Key Points (eyes, nose, chin),
// Inverted Facial Triangle, Jawline Contour, Profile Angle Sector (~90°), Radial Yaw Gauge,
// Red Dual Eyelid Calipers (||), 5-Point Validation Checklist, and Detection Status Banners.
// Strict TypeScript, zero 'any', 100% universal lambda expressions (=>), zero emojis.

import React from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import type { GeometricFaceResult, GeometricPoint } from './geometricFacePatternEngine';

export interface GeometricFacePatternHUDProps {
  readonly result: GeometricFaceResult;
  readonly width?: number;
  readonly height?: number;
}

export const GeometricFacePatternHUD: React.FC<GeometricFacePatternHUDProps> = ({
  result,
  width = 480,
  height = 360
}) => {
  const {
    poseType,
    boundingBox: bb,
    centerLines: cl,
    keyPoints: kp,
    triangle: tri,
    jawContour: jaw,
    profileAngle,
    calipers,
    validationChecks: vc,
    geometricData: gd
  } = result;

  // Generate SVG path string from jawline contour points
  const jawPathD = jaw.length > 0
    ? jaw.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '')
    : '';

  // Triangle path for frontal view symmetry
  const trianglePoints = `${tri.leftEye.x},${tri.leftEye.y} ${tri.rightEye.x},${tri.rightEye.y} ${tri.chinPoint.x},${tri.chinPoint.y}`;

  // Radial yaw gauge dial angle (-90 to +90 mapped to needle rotation)
  const needleAngle = profileAngle ? profileAngle.yawGaugeAngle : gd.yaw;
  const needleRotation = Math.max(-90, Math.min(90, needleAngle));

  // Pose header title matching blueprints
  const getPoseHeaderTitle = (): string => {
    switch (poseType) {
      case 'FRONT':
        return 'Face Forward (Frontal View)';
      case 'LEFT':
        return 'Face Left (Left Profile View)';
      case 'RIGHT':
        return 'Face Right (Right Profile View)';
      case 'BLINK':
        return 'Blink (Eye Closure View)';
      default:
        return 'Facial Recognition Using Geometric Patterns';
    }
  };

  // Status banner text
  const getStatusBannerText = (): string => {
    switch (poseType) {
      case 'FRONT':
        return 'Face Forward Detected (Valid for Recognition)';
      case 'LEFT':
        return 'Face Left Detected (Valid for Recognition)';
      case 'RIGHT':
        return 'Face Right Detected (Valid for Recognition)';
      case 'BLINK':
        return 'Blink Detected (Eye Closure)';
      default:
        return 'Geometric Pattern Validation Complete';
    }
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-hidden select-none">
      {/* Top Pose Title Badge */}
      <div className="absolute top-2.5 left-3 z-20 flex items-center gap-1.5 bg-blue-950/85 border border-sky-400/80 px-3 py-1 rounded-md shadow-lg shadow-sky-950/50 backdrop-blur-sm">
        <span className="font-mono text-[11px] font-bold text-sky-200 tracking-wider uppercase">
          {getPoseHeaderTitle()}
        </span>
      </div>

      {/* SVG Canvas for Geometric Blueprint Reticles */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Arrowhead marker for blue center lines */}
          <marker
            id="geo-arrow-blue"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
          </marker>

          {/* Green arrow marker for profile angle indicators */}
          <marker
            id="geo-arrow-green"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#22c55e" />
          </marker>
        </defs>

        {/* 1. White Face Bounding Box */}
        <rect
          x={bb.x}
          y={bb.y}
          width={bb.width}
          height={bb.height}
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.2"
          className="transition-all duration-200"
        />

        {/* Bounding box corner ticks */}
        <path
          d={`M ${bb.x - 4} ${bb.y + 12} L ${bb.x - 4} ${bb.y - 4} L ${bb.x + 12} ${bb.y - 4}`}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
        <path
          d={`M ${bb.x + bb.width + 4} ${bb.y + 12} L ${bb.x + bb.width + 4} ${bb.y - 4} L ${bb.x + bb.width - 12} ${bb.y - 4}`}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
        <path
          d={`M ${bb.x - 4} ${bb.y + bb.height - 12} L ${bb.x - 4} ${bb.y + bb.height + 4} L ${bb.x + 12} ${bb.y + bb.height + 4}`}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />
        <path
          d={`M ${bb.x + bb.width + 4} ${bb.y + bb.height - 12} L ${bb.x + bb.width + 4} ${bb.y + bb.height + 4} L ${bb.x + bb.width - 12} ${bb.y + bb.height + 4}`}
          fill="none"
          stroke="#38bdf8"
          strokeWidth="1.5"
        />

        {/* 2. Blue Dashed Center Lines (Vertical Midline with Arrow Markers) */}
        <line
          x1={cl.vertical.x}
          y1={cl.vertical.y1}
          x2={cl.vertical.x}
          y2={cl.vertical.y2}
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeDasharray="6,4"
          markerStart="url(#geo-arrow-blue)"
          markerEnd="url(#geo-arrow-blue)"
        />

        {/* 3. Blue Dashed Eye Line (Horizontal Line with Arrow Markers) */}
        <line
          x1={cl.horizontal.x1}
          y1={cl.horizontal.y}
          x2={cl.horizontal.x2}
          y2={cl.horizontal.y}
          stroke="#38bdf8"
          strokeWidth="1.8"
          strokeDasharray="6,4"
          markerStart="url(#geo-arrow-blue)"
          markerEnd="url(#geo-arrow-blue)"
        />

        {/* Labels for Center Lines in Frontal View */}
        {poseType === 'FRONT' && (
          <>
            <g className="font-mono text-[9px] font-bold">
              <rect
                x={cl.vertical.x - 42}
                y={cl.vertical.y1 - 18}
                width="84"
                height="15"
                rx="3"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#0284c7"
                strokeWidth="1"
              />
              <text x={cl.vertical.x} y={cl.vertical.y1 - 7} fill="#7dd3fc" textAnchor="middle">
                Center Line (Vertical)
              </text>
            </g>

            <g className="font-mono text-[9px] font-bold">
              <rect
                x={cl.horizontal.x1 - 85}
                y={cl.horizontal.y - 7}
                width="80"
                height="15"
                rx="3"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#0284c7"
                strokeWidth="1"
              />
              <text x={cl.horizontal.x1 - 45} y={cl.horizontal.y + 4} fill="#7dd3fc" textAnchor="middle">
                Eye Line (Horizontal)
              </text>
            </g>
          </>
        )}

        {/* 4. Inverted Green Facial Triangle (Eye-Eye-Chin) for Frontal View */}
        {poseType === 'FRONT' && (
          <polygon
            points={trianglePoints}
            fill="rgba(34, 197, 94, 0.08)"
            stroke="#22c55e"
            strokeWidth="1.8"
            className="transition-all duration-150"
          />
        )}

        {/* 5. Green Jawline Contour (Boundary) */}
        {jawPathD && (
          <path
            d={jawPathD}
            fill="none"
            stroke="#84cc16"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="transition-all duration-150"
          />
        )}

        {/* 6. Key Points: Concentric Reticles on Eyes, Red Dot on Nose, Chin Point */}
        {poseType === 'FRONT' && (
          <>
            {/* Left Eye concentric reticle */}
            <g>
              <circle cx={kp.leftEye.x} cy={kp.leftEye.y} r="8" fill="none" stroke="#22c55e" strokeWidth="1.8" />
              <circle cx={kp.leftEye.x} cy={kp.leftEye.y} r="3" fill="#22c55e" />
              <line x1={kp.leftEye.x - 10} y1={kp.leftEye.y} x2={kp.leftEye.x + 10} y2={kp.leftEye.y} stroke="#22c55e" strokeWidth="1" />
              <line x1={kp.leftEye.x} y1={kp.leftEye.y - 10} x2={kp.leftEye.x} y2={kp.leftEye.y + 10} stroke="#22c55e" strokeWidth="1" />
            </g>

            {/* Right Eye concentric reticle */}
            <g>
              <circle cx={kp.rightEye.x} cy={kp.rightEye.y} r="8" fill="none" stroke="#22c55e" strokeWidth="1.8" />
              <circle cx={kp.rightEye.x} cy={kp.rightEye.y} r="3" fill="#22c55e" />
              <line x1={kp.rightEye.x - 10} y1={kp.rightEye.y} x2={kp.rightEye.x + 10} y2={kp.rightEye.y} stroke="#22c55e" strokeWidth="1" />
              <line x1={kp.rightEye.x} y1={kp.rightEye.y - 10} x2={kp.rightEye.x} y2={kp.rightEye.y + 10} stroke="#22c55e" strokeWidth="1" />
            </g>

            {/* Nose Center Red Point */}
            <g>
              <circle cx={kp.noseCenter.x} cy={kp.noseCenter.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
            </g>

            {/* Chin Green Point */}
            <g>
              <circle cx={kp.chinPoint.x} cy={kp.chinPoint.y} r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          </>
        )}

        {/* Visible Eye & Nose Point for Profile Views */}
        {(poseType === 'LEFT' || poseType === 'RIGHT') && kp.visibleEye && (
          <g>
            <circle cx={kp.visibleEye.x} cy={kp.visibleEye.y} r="8" fill="none" stroke="#22c55e" strokeWidth="1.8" />
            <circle cx={kp.visibleEye.x} cy={kp.visibleEye.y} r="3" fill="#22c55e" />
            <line x1={kp.visibleEye.x - 10} y1={kp.visibleEye.y} x2={kp.visibleEye.x + 10} y2={kp.visibleEye.y} stroke="#22c55e" strokeWidth="1" />
            <line x1={kp.visibleEye.x} y1={kp.visibleEye.y - 10} x2={kp.visibleEye.x} y2={kp.visibleEye.y + 10} stroke="#22c55e" strokeWidth="1" />

            {kp.nosePoint && (
              <circle cx={kp.nosePoint.x} cy={kp.nosePoint.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.2" />
            )}
          </g>
        )}

        {/* 7. Profile Angle Indicator: ~90° Green Sector Arc & Arrows */}
        {(poseType === 'LEFT' || poseType === 'RIGHT') && profileAngle && (
          <g className="transition-all duration-200">
            {profileAngle.direction === 'LEFT' ? (
              // Left Angle Indicator Arc (drawn from chin base to the left)
              <>
                <path
                  d={`M ${profileAngle.origin.x} ${profileAngle.origin.y} L ${profileAngle.origin.x - profileAngle.radius} ${profileAngle.origin.y} A ${profileAngle.radius} ${profileAngle.radius} 0 0 1 ${profileAngle.origin.x} ${profileAngle.origin.y - profileAngle.radius} Z`}
                  fill="rgba(34, 197, 94, 0.25)"
                  stroke="#22c55e"
                  strokeWidth="2"
                />
                {/* Double horizontal arrows representing rotation */}
                <line
                  x1={profileAngle.origin.x - profileAngle.radius - 8}
                  y1={profileAngle.origin.y + 6}
                  x2={profileAngle.origin.x + 8}
                  y2={profileAngle.origin.y + 6}
                  stroke="#22c55e"
                  strokeWidth="2"
                  markerStart="url(#geo-arrow-green)"
                  markerEnd="url(#geo-arrow-green)"
                />
                {/* Text: ≈ 90° */}
                <text
                  x={profileAngle.origin.x - profileAngle.radius * 0.55}
                  y={profileAngle.origin.y - 8}
                  fill="#86efac"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  ≈ 90°
                </text>
              </>
            ) : (
              // Right Angle Indicator Arc (drawn from chin base to the right)
              <>
                <path
                  d={`M ${profileAngle.origin.x} ${profileAngle.origin.y} L ${profileAngle.origin.x + profileAngle.radius} ${profileAngle.origin.y} A ${profileAngle.radius} ${profileAngle.radius} 0 0 0 ${profileAngle.origin.x} ${profileAngle.origin.y - profileAngle.radius} Z`}
                  fill="rgba(34, 197, 94, 0.25)"
                  stroke="#22c55e"
                  strokeWidth="2"
                />
                <line
                  x1={profileAngle.origin.x - 8}
                  y1={profileAngle.origin.y + 6}
                  x2={profileAngle.origin.x + profileAngle.radius + 8}
                  y2={profileAngle.origin.y + 6}
                  stroke="#22c55e"
                  strokeWidth="2"
                  markerStart="url(#geo-arrow-green)"
                  markerEnd="url(#geo-arrow-green)"
                />
                <text
                  x={profileAngle.origin.x + profileAngle.radius * 0.55}
                  y={profileAngle.origin.y - 8}
                  fill="#86efac"
                  fontSize="13"
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  ≈ 90°
                </text>
              </>
            )}
          </g>
        )}

        {/* 8. Red Dual Vertical Eyelid Calipers (||) during Blink Pose */}
        {poseType === 'BLINK' && calipers && (
          <g className="transition-all duration-150">
            {/* Left Eye Calipers */}
            <line
              x1={calipers.left.x - 5}
              y1={calipers.left.yTop}
              x2={calipers.left.x - 5}
              y2={calipers.left.yBottom}
              stroke="#ef4444"
              strokeWidth="2.5"
            />
            <line
              x1={calipers.left.x + 5}
              y1={calipers.left.yTop}
              x2={calipers.left.x + 5}
              y2={calipers.left.yBottom}
              stroke="#ef4444"
              strokeWidth="2.5"
            />
            <line
              x1={calipers.left.x - 9}
              y1={(calipers.left.yTop + calipers.left.yBottom) * 0.5}
              x2={calipers.left.x + 9}
              y2={(calipers.left.yTop + calipers.left.yBottom) * 0.5}
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="2,2"
            />

            {/* Right Eye Calipers */}
            <line
              x1={calipers.right.x - 5}
              y1={calipers.right.yTop}
              x2={calipers.right.x - 5}
              y2={calipers.right.yBottom}
              stroke="#ef4444"
              strokeWidth="2.5"
            />
            <line
              x1={calipers.right.x + 5}
              y1={calipers.right.yTop}
              x2={calipers.right.x + 5}
              y2={calipers.right.yBottom}
              stroke="#ef4444"
              strokeWidth="2.5"
            />
            <line
              x1={calipers.right.x - 9}
              y1={(calipers.right.yTop + calipers.right.yBottom) * 0.5}
              x2={calipers.right.x + 9}
              y2={(calipers.right.yTop + calipers.right.yBottom) * 0.5}
              stroke="#ef4444"
              strokeWidth="1.2"
              strokeDasharray="2,2"
            />

            {/* Label: Eye Closure Area (Blink) */}
            <g className="font-mono text-[9px] font-bold">
              <rect
                x={cl.vertical.x - 65}
                y={calipers.left.yBottom + 8}
                width="130"
                height="15"
                rx="3"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#ef4444"
                strokeWidth="1"
              />
              <text x={cl.vertical.x} y={calipers.left.yBottom + 19} fill="#fca5a5" textAnchor="middle">
                Eye Closure Area (Blink)
              </text>
            </g>
          </g>
        )}
      </svg>

      {/* ======================================================== */}
      {/* Floating HUD Cards (Top Right & Bottom Right)            */}
      {/* ======================================================== */}

      {/* Floating Top-Right: Validation Checks Card */}
      <div className="absolute top-2.5 right-3 z-20 w-44 bg-slate-950/90 border border-sky-500/50 rounded-lg p-2 shadow-xl backdrop-blur-md font-mono text-[9px]">
        <div className="border-b border-sky-500/30 pb-1 mb-1.5 flex items-center justify-between">
          <span className="font-bold text-sky-300 tracking-wider uppercase">Validation Checks</span>
          <span className="text-[7.5px] px-1 py-0.2 rounded bg-sky-950 text-sky-400 border border-sky-800">
            {vc.allPassed ? 'ALL GREEN' : 'INSPECT'}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${vc.check1.passed ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span className="truncate">{vc.check1.label}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200">
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${vc.check2.passed ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span className="truncate">{vc.check2.label}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200">
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${vc.check3.passed ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span className="truncate">{vc.check3.label}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-200">
            <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${vc.check4.passed ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
            <span className="truncate">{vc.check4.label}</span>
          </div>

          {vc.check5 && (
            <div className="flex items-center gap-1.5 text-slate-200">
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${vc.check5.passed ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'}`}>
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
              <span className="truncate">{vc.check5.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bottom-Right: Key Geometric Data Card OR Angle Information Dial */}
      <div className="absolute bottom-11 right-3 z-20 w-44 bg-slate-950/90 border border-sky-500/50 rounded-lg p-2 shadow-xl backdrop-blur-md font-mono text-[9px]">
        {poseType === 'LEFT' || poseType === 'RIGHT' ? (
          // Angle Information Card with Semi-Circular Radial Yaw Gauge Dial
          <div>
            <div className="border-b border-sky-500/30 pb-1 mb-1.5">
              <span className="font-bold text-sky-300 tracking-wider uppercase">Angle Information</span>
            </div>
            <div className="flex justify-between items-center text-slate-300 mb-1">
              <span>Yaw (Left/Right):</span>
              <span className="text-emerald-400 font-bold">
                {poseType === 'LEFT' ? '≈ 90° (Left)' : '≈ 90° (Right)'}
              </span>
            </div>

            {/* SVG Semi-Circular Radial Yaw Gauge Dial */}
            <div className="w-full flex flex-col items-center mt-1">
              <svg viewBox="0 0 100 55" className="w-28 h-14">
                {/* Background arc */}
                <path
                  d="M 10 50 A 40 40 0 0 1 90 50"
                  fill="none"
                  stroke="#334155"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Active sector arc */}
                <path
                  d={
                    poseType === 'LEFT'
                      ? 'M 10 50 A 40 40 0 0 1 50 10'
                      : 'M 50 10 A 40 40 0 0 1 90 50'
                  }
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Center pivot point */}
                <circle cx="50" cy="50" r="3" fill="#ffffff" />
                {/* Needle line */}
                <line
                  x1="50"
                  y1="50"
                  x2={50 + 32 * Math.sin((needleRotation * Math.PI) / 180)}
                  y2={50 - 32 * Math.cos((needleRotation * Math.PI) / 180)}
                  stroke="#0f172a"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <line
                  x1="50"
                  y1="50"
                  x2={50 + 32 * Math.sin((needleRotation * Math.PI) / 180)}
                  y2={50 - 32 * Math.cos((needleRotation * Math.PI) / 180)}
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <div className="w-full flex justify-between text-[7.5px] text-slate-400 px-1 font-mono">
                <span>-90° (Left)</span>
                <span>0° (Front)</span>
                <span>+90° (Right)</span>
              </div>
            </div>
          </div>
        ) : (
          // Key Geometric Data Card (Front / Blink)
          <div>
            <div className="border-b border-sky-500/30 pb-1 mb-1.5 flex justify-between items-center">
              <span className="font-bold text-sky-300 tracking-wider uppercase">Key Geometric Data</span>
            </div>
            <div className="space-y-0.5 text-slate-300">
              <div className="flex justify-between">
                <span>Yaw :</span>
                <span className="text-emerald-400 font-bold">{Math.round(gd.yaw)}°</span>
              </div>
              <div className="flex justify-between">
                <span>Pitch :</span>
                <span className="text-emerald-400 font-bold">{Math.round(gd.pitch)}°</span>
              </div>
              <div className="flex justify-between">
                <span>Roll :</span>
                <span className="text-emerald-400 font-bold">{Math.round(gd.roll)}°</span>
              </div>
              <div className="flex justify-between">
                <span>Eye Distance :</span>
                <span className="text-emerald-400 font-bold">{gd.eyeDistance}</span>
              </div>
              <div className="flex justify-between">
                <span>Face Ratio :</span>
                <span className="text-emerald-400 font-bold">{gd.faceRatio}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prominent Bottom Green Detection Status Banner */}
      <div className="absolute bottom-2.5 inset-x-12 z-20 flex items-center justify-center">
        <div className="font-mono text-[10.5px] font-bold px-4 py-1.5 rounded-full bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.7)] backdrop-blur-md flex items-center gap-2 animate-in fade-in zoom-in-95">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{getStatusBannerText()}</span>
        </div>
      </div>
    </div>
  );
};

export default GeometricFacePatternHUD;
