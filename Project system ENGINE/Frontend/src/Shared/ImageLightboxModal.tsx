// [Layer: Shared]
// Responsibility: High-resolution image lightbox modal for inspecting accident evidence and biometric captures.
// DO NOT break aspect ratio when zooming in evidence photos.
// Universal lambda expressions (=>).

import React, { FC, useState } from 'react';
import { ImageOff, ZoomIn, ZoomOut, Maximize2, Download } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';

export interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.25;
const DEFAULT_ZOOM = 1.0;

export const ImageLightboxModal: FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title = 'Evidence Inspection'
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(DEFAULT_ZOOM);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  };

  const handleResetZoom = () => {
    setZoomLevel(DEFAULT_ZOOM);
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `resqtrack-evidence-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleModalClose = () => {
    setZoomLevel(DEFAULT_ZOOM);
    onClose();
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={handleModalClose}
      title={title}
      maxWidth="4xl"
      footer={
        imageUrl ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
              <span>ZOOM:</span>
              <span className="text-white font-bold">{Math.round(zoomLevel * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
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
        {imageUrl ? (
          <div className="w-full max-h-[70vh] flex items-center justify-center overflow-auto rounded-lg border border-slate-700 bg-black/60 p-2">
            <img
              src={imageUrl}
              alt={title}
              style={{
                transform: `scale(${zoomLevel})`,
                transition: 'transform 150ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              className="max-h-[65vh] object-contain origin-center select-none"
            />
          </div>
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
