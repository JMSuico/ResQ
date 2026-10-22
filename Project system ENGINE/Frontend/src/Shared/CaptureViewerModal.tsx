// [Layer: Shared]
// Responsibility: Capture viewer modal displaying the 3 biometric images for a selected user: Face Capture, ID Front Card, ID Back Card.
// DO NOT lose zoom or aspect ratio.

import React from 'react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';

export const CaptureViewerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userName?: string;
}> = ({ isOpen, onClose, userId, userName = 'User' }) => {
  if (!isOpen || !userId) return null;

  const kinds = [
    { key: 'face', label: 'Face Capture' },
    { key: 'front', label: 'ID Front Card' },
    { key: 'back', label: 'ID Back Card' }
  ];

  return (
    <DefaultFloatingModalCard isOpen={isOpen} onClose={onClose} title={`Biometric Captures: ${userName}`} maxWidth="4xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kinds.map(({ key, label }) => (
          <div key={key} className="flex flex-col items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-xs font-mono font-medium text-slate-300 mb-2">{label}</span>
            <div className="w-full h-64 bg-slate-900 rounded border border-slate-800 flex items-center justify-center overflow-hidden">
              <img
                src={`/api/users/${encodeURIComponent(userId)}/captures/${key}`}
                alt={`${label} for ${userName}`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLElement;
                  target.style.display = 'none';
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </DefaultFloatingModalCard>
  );
};
