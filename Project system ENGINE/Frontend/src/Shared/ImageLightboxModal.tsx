// [Layer: Shared]
// Responsibility: High-resolution image lightbox modal for inspecting accident evidence and biometric captures.
// DO NOT break aspect ratio when zooming in evidence photos.

import React from 'react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';

export const ImageLightboxModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
}> = ({ isOpen, onClose, imageUrl, title = 'Evidence Inspection' }) => {
  if (!isOpen) return null;

  return (
    <DefaultFloatingModalCard isOpen={isOpen} onClose={onClose} title={title} maxWidth="2xl">
      <div className="flex flex-col items-center justify-center gap-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-full max-h-[70vh] object-contain rounded-lg border border-slate-700 bg-black/40"
          />
        ) : (
          <div className="w-full h-64 flex flex-col items-center justify-center text-slate-500 bg-slate-950 rounded-lg border border-slate-800">
            <svg className="w-12 h-12 mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">No image capture available for this record.</p>
          </div>
        )}
      </div>
    </DefaultFloatingModalCard>
  );
};
