// [Layer: LANDING_PAGE/Features/Pages/RegisterPage]
// Responsibility: Interactive On-Device Crosshair Text Extractor Overlay (inspired by PowerToys Text Extractor).
// Functions:
// 1. Darkens viewport into a tactical crosshair overlay (cursor-crosshair) with subtle reticle guides.
// 2. Click & drag a selection box over any text on the display (from frozen video feed, preview canvas, or uploaded image).
// 3. Isolates exact ROI pixel buffer, executes on-device DPI scaling, contrast stretching, projection profiling & OCR.
// 4. Automatically copies recognized text to clipboard (with toast feedback).
// 5. Provides 1-click Quick-Assign buttons to autofill form fields (Surname, First Name, Middle Name, DOB, Address, License No, Sex, Weight, Height).
// Invariant: Strict TypeScript, ZERO 'any', 100% universal lambdas (=>), zero emojis.

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  Copy,
  Check,
  X,
  Sparkles,
  Maximize2,
  FileText,
  AlignLeft,
  Table,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Sliders,
  ChevronRight
} from 'lucide-react';
import {
  extractTextFromRoi,
  parseIdFieldsWithSpatialFsm,
  type TextExtractorLayoutMode,
  type TextExtractorCharType,
  type PixelBoundingBox,
  type TextExtractorResult
} from '@/Libs/Vision/idScanner/textExtractor';

export type AssignableField =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'dateOfBirth'
  | 'address'
  | 'licenseNumber'
  | 'sex'
  | 'weight'
  | 'height';

export interface TextExtractorOverlayProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly imageSourceUrl?: string | null;
  readonly frontImageUrl?: string | null;
  readonly backImageUrl?: string | null;
  readonly onApplyToField: (field: AssignableField, value: string) => void;
}

export const TextExtractorOverlay: React.FC<TextExtractorOverlayProps> = ({
  isOpen,
  onClose,
  imageSourceUrl,
  frontImageUrl,
  backImageUrl,
  onApplyToField
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<PixelBoundingBox | null>(null);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedResult, setExtractedResult] = useState<TextExtractorResult | null>(null);
  const [editableText, setEditableText] = useState<string>('');
  const [copiedToast, setCopiedToast] = useState<boolean>(false);
  const [assignedToast, setAssignedToast] = useState<string | null>(null);

  const [layoutMode, setLayoutMode] = useState<TextExtractorLayoutMode>('single-line');
  const [charType] = useState<TextExtractorCharType>('ALPHANUMERIC');

  // Cached base RGBA buffer for instant selection cropping
  const sourceImageRef = useRef<{
    buffer: Uint8ClampedArray;
    width: number;
    height: number;
  } | null>(null);

  const resolvedSourceUrl =
    activeSide === 'back' && backImageUrl
      ? backImageUrl
      : frontImageUrl || imageSourceUrl || backImageUrl || null;

  // Initialize source image buffer when overlay opens or side changes
  useEffect(() => {
    if (!isOpen) {
      sourceImageRef.current = null;
      setSelectionBox(null);
      setExtractedResult(null);
      setEditableText('');
      setCopiedToast(false);
      setAssignedToast(null);
      return;
    }

    const captureBuffer = (): void => {
      const offscreen = document.createElement('canvas');
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      if (!ctx || !resolvedSourceUrl) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        offscreen.width = img.naturalWidth;
        offscreen.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        sourceImageRef.current = {
          buffer: imgData.data,
          width: offscreen.width,
          height: offscreen.height
        };
      };
      img.src = resolvedSourceUrl;
    };

    captureBuffer();
  }, [isOpen, resolvedSourceUrl]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Process OCR on selection release
  const executeOcrOnSelection = useCallback(
    (box: PixelBoundingBox) => {
      if (!containerRef.current || !sourceImageRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const src = sourceImageRef.current;

      // Map display selection box to source image coordinates accounting for object-contain letterbox/pillarbox
      const containerAspect = containerRect.width / Math.max(1, containerRect.height);
      const imageAspect = src.width / Math.max(1, src.height);
      let renderW = containerRect.width;
      let renderH = containerRect.height;
      let offsetX = 0;
      let offsetY = 0;
      if (imageAspect > containerAspect) {
        renderW = containerRect.width;
        renderH = containerRect.width / imageAspect;
        offsetY = (containerRect.height - renderH) * 0.5;
      } else {
        renderH = containerRect.height;
        renderW = containerRect.height * imageAspect;
        offsetX = (containerRect.width - renderW) * 0.5;
      }

      const scaleX = src.width / Math.max(1, renderW);
      const scaleY = src.height / Math.max(1, renderH);

      const srcRoi: PixelBoundingBox = {
        x: Math.max(0, Math.floor((box.x - offsetX) * scaleX)),
        y: Math.max(0, Math.floor((box.y - offsetY) * scaleY)),
        width: Math.max(4, Math.ceil(box.width * scaleX)),
        height: Math.max(4, Math.ceil(box.height * scaleY))
      };

      setIsProcessing(true);

      setTimeout(() => {
        try {
          const res = extractTextFromRoi(
            src.buffer,
            src.width,
            src.height,
            srcRoi,
            {
              layoutMode,
              charType,
              minDpiScale: 2.5
            }
          );

          setExtractedResult(res);
          setEditableText(res.text);

          // Automatically copy recognized text directly to clipboard
          if (res.text && typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(res.text).then(() => {
              setCopiedToast(true);
              setTimeout(() => setCopiedToast(false), 2400);
            }).catch(() => {
              // Ignore clipboard permission issues
            });
          }
        } finally {
          setIsProcessing(false);
        }
      }, 50);
    },
    [layoutMode, charType]
  );

  // Mouse / Touch handlers for dragging bounding box
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsSelecting(true);
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
    setSelectionBox(null);
    setExtractedResult(null);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!isSelecting || !startPoint || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    setCurrentPoint({ x: currentX, y: currentY });

    const box: PixelBoundingBox = {
      x: Math.min(startPoint.x, currentX),
      y: Math.min(startPoint.y, currentY),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y)
    };

    setSelectionBox(box);
  };

  const handlePointerUp = (): void => {
    if (!isSelecting) return;
    setIsSelecting(false);

    if (selectionBox && selectionBox.width >= 10 && selectionBox.height >= 10) {
      executeOcrOnSelection(selectionBox);
    } else {
      setSelectionBox(null);
    }
  };

  const handleManualCopy = (): void => {
    if (!editableText) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(editableText).then(() => {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      });
    }
  };

  const handleApplyField = (field: AssignableField): void => {
    if (!editableText) return;
    onApplyToField(field, editableText);
    const fieldLabels: Record<AssignableField, string> = {
      firstName: 'First Name',
      middleName: 'Middle Name',
      lastName: 'Surname',
      dateOfBirth: 'Date of Birth',
      address: 'Address',
      licenseNumber: 'License Number',
      sex: 'Sex',
      weight: 'Weight',
      height: 'Height'
    };
    setAssignedToast(`Assigned to ${fieldLabels[field]}`);
    setTimeout(() => setAssignedToast(null), 2500);
  };

  const handleSmartAutoParse = (): void => {
    const sourceLines = extractedResult?.lines && extractedResult.lines.length > 0
      ? extractedResult.lines
      : editableText;
    if (!sourceLines) return;

    const parsed = parseIdFieldsWithSpatialFsm(sourceLines);
    let assignedCount = 0;

    if (parsed.lastName) {
      onApplyToField('lastName', parsed.lastName);
      assignedCount++;
    }
    if (parsed.firstName) {
      onApplyToField('firstName', parsed.firstName);
      assignedCount++;
    }
    if (parsed.middleName) {
      onApplyToField('middleName', parsed.middleName);
      assignedCount++;
    }
    if (parsed.birthDate) {
      onApplyToField('dateOfBirth', parsed.birthDate);
      assignedCount++;
    }
    if (parsed.idNumber) {
      onApplyToField('licenseNumber', parsed.idNumber);
      assignedCount++;
    }
    if (parsed.address) {
      onApplyToField('address', parsed.address);
      assignedCount++;
    }
    if (parsed.sex) {
      onApplyToField('sex', parsed.sex);
      assignedCount++;
    }

    setAssignedToast(
      assignedCount > 0
        ? `Smart FSM Auto-Parsed ${assignedCount} field(s)`
        : 'Select a multi-line region with labels to auto-parse'
    );
    setTimeout(() => setAssignedToast(null), 2800);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 select-none"
      onPointerUp={handlePointerUp}
    >
      {/* Top Header Bar */}
      <div className="w-full max-w-4xl bg-slate-950/95 border border-cyan-500/40 rounded-t-xl px-4 py-2.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-cyan-950/80 border border-cyan-500/50 text-cyan-400">
            <Crop className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
                Text Extractor (On-Device OCR)
              </span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-900/60 border border-cyan-500/40 text-[9px] font-mono text-cyan-300 font-semibold">
                POWERTOYS SPEC
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Drag crosshair selection box over any text to extract & autofill personal details.
            </p>
          </div>
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-2">
          {/* Uploaded ID Front / Back Switcher */}
          {(frontImageUrl || backImageUrl) && (
            <div className="flex items-center bg-slate-900 rounded border border-cyan-500/40 p-0.5 font-mono text-[9.5px]">
              <button
                type="button"
                disabled={!frontImageUrl}
                onClick={() => {
                  setActiveSide('front');
                  setSelectionBox(null);
                  setExtractedResult(null);
                }}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSide === 'front'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
                }`}
              >
                FRONT ID
              </button>
              <button
                type="button"
                disabled={!backImageUrl}
                onClick={() => {
                  setActiveSide('back');
                  setSelectionBox(null);
                  setExtractedResult(null);
                }}
                className={`px-2 py-1 rounded transition-colors ${
                  activeSide === 'back'
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200 disabled:opacity-40'
                }`}
              >
                BACK ID
              </button>
            </div>
          )}

          {/* Layout Mode Selector */}
          <div className="hidden sm:flex items-center bg-slate-900 rounded border border-slate-700/80 p-0.5 font-mono text-[9.5px]">
            <button
              type="button"
              onClick={() => {
                setLayoutMode('single-line');
                if (selectionBox) executeOcrOnSelection(selectionBox);
              }}
              className={`px-2 py-1 rounded transition-colors ${
                layoutMode === 'single-line'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single-Line
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('multi-line');
                if (selectionBox) executeOcrOnSelection(selectionBox);
              }}
              className={`px-2 py-1 rounded transition-colors ${
                layoutMode === 'multi-line'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Multi-Line
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode('table');
                if (selectionBox) executeOcrOnSelection(selectionBox);
              }}
              className={`px-2 py-1 rounded transition-colors ${
                layoutMode === 'table'
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Table
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
            title="Close Text Extractor (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport & Interactive Crosshair Canvas */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        className="relative w-full max-w-4xl bg-slate-950 border-x border-cyan-500/40 aspect-[16/10] overflow-hidden cursor-crosshair flex items-center justify-center"
        style={{
          backgroundImage:
            'radial-gradient(rgba(6, 182, 212, 0.08) 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      >
        {/* Render Uploaded Source Image */}
        {resolvedSourceUrl ? (
          <img
            src={resolvedSourceUrl}
            alt="Uploaded Government ID for Text Extraction"
            className="w-full h-full object-contain pointer-events-none select-none"
          />
        ) : (
          <div className="text-center font-mono text-xs text-slate-500">
            [No Uploaded Government ID Image Loaded]
          </div>
        )}

        {/* Crosshair Center Reticle Guide */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
          <div className="w-12 h-12 border border-dashed border-cyan-400 rounded-full" />
          <div className="absolute w-16 h-[1px] bg-cyan-400" />
          <div className="absolute h-16 w-[1px] bg-cyan-400" />
        </div>

        {/* Dynamic Selection Box with Corner Brackets & Sizing Pill */}
        {selectionBox && (
          <div
            className="absolute border-2 border-cyan-400 bg-cyan-500/15 pointer-events-none shadow-[0_0_15px_rgba(6,182,212,0.4)] z-20"
            style={{
              left: `${selectionBox.x}px`,
              top: `${selectionBox.y}px`,
              width: `${selectionBox.width}px`,
              height: `${selectionBox.height}px`
            }}
          >
            {/* Top-Left Bracket */}
            <div className="absolute -top-1.5 -left-1.5 w-3 h-3 border-t-2 border-l-2 border-white" />
            {/* Top-Right Bracket */}
            <div className="absolute -top-1.5 -right-1.5 w-3 h-3 border-t-2 border-r-2 border-white" />
            {/* Bottom-Left Bracket */}
            <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-b-2 border-l-2 border-white" />
            {/* Bottom-Right Bracket */}
            <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-b-2 border-r-2 border-white" />

            {/* Sizing Indicator Tag */}
            <div className="absolute -bottom-6 left-0 bg-slate-950/90 border border-cyan-400 text-cyan-300 font-mono text-[9px] px-1.5 py-0.5 rounded shadow whitespace-nowrap">
              {Math.round(selectionBox.width)} x {Math.round(selectionBox.height)} px
            </div>
          </div>
        )}

        {/* Loading Spinner during OCR execution */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 z-30">
            <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
            <span className="font-mono text-xs font-bold text-white tracking-wider">
              EXTRACTING TEXT (DPI UPSCALING & PROJECTION PROFILING)...
            </span>
          </div>
        )}
      </div>

      {/* Bottom Result HUD & Quick-Assign Field Buttons */}
      <div className="w-full max-w-4xl bg-slate-950/95 border border-cyan-500/40 rounded-b-xl p-3.5 shadow-2xl flex flex-col gap-2.5">
        {/* Extracted Text Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 flex items-center bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 focus-within:border-cyan-400 transition-all">
            <input
              type="text"
              value={editableText}
              onChange={(e) => setEditableText(e.target.value)}
              placeholder="Extracted text will appear here. Click & drag over ID card text..."
              className="w-full font-mono text-xs text-white bg-transparent outline-none placeholder:text-slate-500"
            />
            {editableText && (
              <span className="text-[10px] font-mono text-emerald-400 font-bold ml-2 shrink-0">
                {extractedResult?.confidence ? `${Math.round(extractedResult.confidence * 100)}% CONF` : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleManualCopy}
              disabled={!editableText}
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                copiedToast
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                  : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white'
              } ${!editableText ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {copiedToast ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>COPIED!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick-Assign Field Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800">
          <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mr-1">
            Quick-Assign To:
          </span>

          <button
            type="button"
            onClick={() => handleApplyField('lastName')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + Surname
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('firstName')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + First Name
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('middleName')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + Middle Name
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('dateOfBirth')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + DOB
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('licenseNumber')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-500/50 text-amber-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + License No
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('address')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-500/50 text-indigo-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + Address
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('sex')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + Sex
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('weight')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + Weight
          </button>

          <button
            type="button"
            onClick={() => handleApplyField('height')}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-mono text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer"
          >
            + Height
          </button>

          <button
            type="button"
            onClick={handleSmartAutoParse}
            disabled={!editableText}
            className="px-2.5 py-1 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-200 font-mono text-[10px] font-bold flex items-center gap-1 transition-all disabled:opacity-40 cursor-pointer"
            title="Parse multi-line text using Spatial Label FSM (Surname, First Name, DOB, ID No, Address)"
          >
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Smart FSM Parse</span>
          </button>

          {assignedToast && (
            <span className="ml-auto font-mono text-[10px] text-emerald-400 font-bold flex items-center gap-1 animate-pulse">
              <CheckCircle2 className="w-3 h-3" />
              {assignedToast}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
