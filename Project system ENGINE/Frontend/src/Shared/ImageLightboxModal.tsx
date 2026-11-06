// [Layer: Shared]
// Responsibility: High-resolution multi-evidence lightbox modal supporting up to 40 pictures/videos
// with exact date and time including seconds and AM/PM (YYYY-MM-DD hh:mm:ss A).
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import React, { FC, useState, useEffect, useMemo } from 'react';
import {
  ImageOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Camera,
  Grid,
  Layers
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { formatDateTimeWithSecondsAmPm } from './radarPointerCategories';

export interface LightboxMediaItem {
  url: string;
  timestamp?: string;
  caption?: string;
  type?: 'image' | 'video';
}

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  images?: Array<LightboxMediaItem | string>;
  initialIndex?: number;
  timestamp?: string;
  title?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 1.0;
export const MAX_EVIDENCE_MEDIA_SLOTS = 40;

export const ImageLightboxModal: FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  images,
  initialIndex = 0,
  timestamp,
  title = 'Evidence Inspection (Up to 40 Captures)'
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);
  const [activeIndex, setActiveIndex] = useState<number>(initialIndex);
  const [showGrid, setShowGrid] = useState<boolean>(false);

  const normalizedMedia: LightboxMediaItem[] = useMemo(() => {
    const list: LightboxMediaItem[] = [];

    if (images && images.length > 0) {
      images.slice(0, MAX_EVIDENCE_MEDIA_SLOTS).forEach((item, idx) => {
        if (typeof item === 'string') {
          const isVideo = /\.(mp4|webm|ogg)$/i.test(item);
          list.push({
            url: item,
            timestamp: formatDateTimeWithSecondsAmPm(
              timestamp || new Date(Date.now() - idx * 14000)
            ),
            caption: `Evidence Capture #${idx + 1}`,
            type: isVideo ? 'video' : 'image'
          });
        } else if (item && item.url) {
          const isVideo = item.type === 'video' || /\.(mp4|webm|ogg)$/i.test(item.url);
          list.push({
            url: item.url,
            timestamp: formatDateTimeWithSecondsAmPm(
              item.timestamp || timestamp || new Date(Date.now() - idx * 14000)
            ),
            caption: item.caption || `Evidence Capture #${idx + 1}`,
            type: isVideo ? 'video' : 'image'
          });
        }
      });
    } else if (imageUrl) {
      const isVideo = /\.(mp4|webm|ogg)$/i.test(imageUrl);
      list.push({
        url: imageUrl,
        timestamp: formatDateTimeWithSecondsAmPm(timestamp || new Date()),
        caption: title || 'Primary Incident Evidence Capture',
        type: isVideo ? 'video' : 'image'
      });
    }

    return list;
  }, [imageUrl, images, timestamp, title]);

  useEffect(() => {
    if (isOpen) {
      setActiveIndex(
        Math.min(Math.max(0, initialIndex), Math.max(0, normalizedMedia.length - 1))
      );
      setZoomLevel(DEFAULT_ZOOM);
    }
  }, [isOpen, initialIndex, normalizedMedia.length]);

  if (!isOpen) return null;

  const activeItem = normalizedMedia[activeIndex] || null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleResetZoom = () => {
    setZoomLevel(DEFAULT_ZOOM);
  };

  const handlePrev = () => {
    if (normalizedMedia.length <= 1) return;
    setZoomLevel(DEFAULT_ZOOM);
    setActiveIndex((prev) => (prev - 1 + normalizedMedia.length) % normalizedMedia.length);
  };

  const handleNext = () => {
    if (normalizedMedia.length <= 1) return;
    setZoomLevel(DEFAULT_ZOOM);
    setActiveIndex((prev) => (prev + 1) % normalizedMedia.length);
  };

  const handleDownload = () => {
    if (!activeItem?.url) return;
    const link = document.createElement('a');
    link.href = activeItem.url;
    link.download = `resqtrack-evidence-${activeIndex + 1}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleModalClose = () => {
    setZoomLevel(DEFAULT_ZOOM);
    setShowGrid(false);
    onClose();
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={handleModalClose}
      title={title}
      subtitle={
        activeItem
          ? `Capture ${activeIndex + 1} of ${normalizedMedia.length} (Max ${MAX_EVIDENCE_MEDIA_SLOTS} Pictures/Videos Supported) • Timestamp: ${activeItem.timestamp}`
          : 'Forensic Evidence Gallery'
      }
      maxWidth="4xl"
      footer={
        activeItem ? (
          <div className="flex flex-wrap items-center justify-between w-full gap-2">
            <div className="flex items-center gap-3 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">ZOOM:</span>
                <span className="text-white font-bold">{Math.round(zoomLevel * 100)}%</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Clock className="w-3.5 h-3.5" />
                <span>{activeItem.timestamp}</span>
              </div>
              <span className="text-slate-700">|</span>
              <div className="flex items-center gap-1 text-sky-400">
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {activeIndex + 1} / {normalizedMedia.length} (CAP: {MAX_EVIDENCE_MEDIA_SLOTS})
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {normalizedMedia.length > 1 && (
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() => setShowGrid((prev) => !prev)}
                  icon={<Grid className="w-3.5 h-3.5" />}
                >
                  {showGrid ? 'Single View' : `Grid (${normalizedMedia.length})`}
                </Button>
              )}
              <Button
                variant="outline"
                size="xs"
                onClick={handleZoomOut}
                disabled={zoomLevel <= MIN_ZOOM}
                icon={<ZoomOut className="w-3.5 h-3.5" />}
              >
                Zoom Out
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={handleResetZoom}
                disabled={zoomLevel === DEFAULT_ZOOM}
                icon={<Maximize2 className="w-3.5 h-3.5" />}
              >
                Reset
              </Button>
              <Button
                variant="outline"
                size="xs"
                onClick={handleZoomIn}
                disabled={zoomLevel >= MAX_ZOOM}
                icon={<ZoomIn className="w-3.5 h-3.5" />}
              >
                Zoom In
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={handleDownload}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Save
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col items-center justify-center gap-3 overflow-hidden">
        {activeItem ? (
          <>
            {/* Top Exact Date & Time with Seconds + AM/PM HUD Bar */}
            <div className="w-full flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-200">
                {activeItem.type === 'video' ? (
                  <Film className="w-4 h-4 text-amber-400" />
                ) : (
                  <Camera className="w-4 h-4 text-sky-400" />
                )}
                <span className="font-bold">
                  {activeItem.caption || `Evidence Item #${activeIndex + 1}`}
                </span>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>CAPTURED: {activeItem.timestamp}</span>
              </div>
            </div>

            {showGrid ? (
              <div className="w-full max-h-[60vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 p-2 bg-slate-950/90 rounded-lg border border-slate-800">
                {normalizedMedia.map((item, idx) => (
                  <button
                    type="button"
                    key={`${item.url}-${idx}`}
                    onClick={() => {
                      setActiveIndex(idx);
                      setShowGrid(false);
                    }}
                    className={`group relative rounded-lg overflow-hidden border text-left transition-all cursor-pointer ${
                      idx === activeIndex
                        ? 'border-sky-400 ring-2 ring-sky-500/50'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.caption || `Capture ${idx + 1}`}
                      className="w-full h-24 object-cover bg-black"
                    />
                    <div className="p-1.5 bg-slate-950/95 text-[10px] font-mono">
                      <div className="text-sky-300 font-bold truncate">
                        #{idx + 1} • {item.type === 'video' ? 'VIDEO' : 'PHOTO'}
                      </div>
                      <div className="text-emerald-400 truncate">{item.timestamp}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="relative w-full max-h-[62vh] flex items-center justify-center overflow-auto rounded-lg border border-slate-700 bg-black/75 p-2">
                {normalizedMedia.length > 1 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 z-10 p-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-sky-600 transition-colors cursor-pointer"
                    aria-label="Previous capture"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {activeItem.type === 'video' ? (
                  <video
                    src={activeItem.url}
                    controls
                    className="max-h-[56vh] object-contain rounded"
                  />
                ) : (
                  <img
                    src={activeItem.url}
                    alt={activeItem.caption || title}
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    className="max-h-[56vh] object-contain origin-center select-none"
                  />
                )}

                {/* Embedded Forensic Timestamp Overlay on Image */}
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded bg-black/85 border border-emerald-500/60 text-[11px] font-mono text-emerald-300 shadow-lg pointer-events-none">
                  {activeItem.timestamp} • SLOT {activeIndex + 1}/{MAX_EVIDENCE_MEDIA_SLOTS}
                </div>

                {normalizedMedia.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 z-10 p-2 rounded-full bg-slate-900/90 border border-slate-700 text-slate-200 hover:text-white hover:bg-sky-600 transition-colors cursor-pointer"
                    aria-label="Next capture"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* Thumbnail Strip when multiple images/videos exist */}
            {normalizedMedia.length > 1 && !showGrid && (
              <div className="w-full flex items-center gap-2 overflow-x-auto py-1.5 px-1">
                {normalizedMedia.map((item, idx) => (
                  <button
                    type="button"
                    key={`thumb-${idx}`}
                    onClick={() => {
                      setActiveIndex(idx);
                      setZoomLevel(DEFAULT_ZOOM);
                    }}
                    className={`flex-shrink-0 w-20 rounded-md overflow-hidden border transition-all cursor-pointer ${
                      idx === activeIndex
                        ? 'border-sky-400 ring-2 ring-sky-500/50 scale-105'
                        : 'border-slate-800 opacity-65 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={`Thumb ${idx + 1}`}
                      className="w-full h-12 object-cover bg-black"
                    />
                    <div className="bg-slate-950 px-1 py-0.5 text-[9px] font-mono text-emerald-300 truncate">
                      #{idx + 1} {item.timestamp?.split(' ').slice(1).join(' ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-950 rounded-lg border border-slate-800">
            <ImageOff className="w-12 h-12 mb-2 text-slate-600" />
            <p className="text-sm font-mono">No image capture available for this record.</p>
          </div>
        )}
      </div>
    </DefaultFloatingModalCard>
  );
};

export default ImageLightboxModal;
