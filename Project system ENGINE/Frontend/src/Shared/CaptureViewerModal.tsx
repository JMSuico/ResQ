// [Layer: Shared]
// Responsibility: Capture viewer modal displaying the 3 biometric images for a selected user: Face Capture, ID Front Card, ID Back Card.
// DO NOT lose zoom or aspect ratio.
// Universal lambda expressions (=>).

import React, { FC, useState } from 'react';
import { User, CreditCard, ShieldCheck, ImageOff } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';

export interface CaptureViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userName?: string;
}

interface BiometricKind {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const BIOMETRIC_KINDS: BiometricKind[] = [
  { key: 'face', label: 'Face Capture', icon: User },
  { key: 'front', label: 'ID Front Card', icon: CreditCard },
  { key: 'back', label: 'ID Back Card', icon: ShieldCheck }
];

export const CaptureViewerModal: FC<CaptureViewerModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName = 'User'
}) => {
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  if (!isOpen || !userId) return null;

  const handleImageError = (key: string) => {
    setLoadErrors((prev) => ({ ...prev, [key]: true }));
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={() => {
        setLoadErrors({});
        onClose();
      }}
      title={`Biometric Captures: ${userName}`}
      maxWidth="4xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BIOMETRIC_KINDS.map(({ key, label, icon: IconComponent }) => {
          const hasError = !!loadErrors[key];
          const imageSrc = `/api/users/${encodeURIComponent(userId)}/captures/${key}`;

          return (
            <div key={key} className="flex flex-col items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-300 mb-2">
                <IconComponent className="w-3.5 h-3.5 text-sky-400" />
                <span>{label}</span>
              </div>
              <div className="w-full h-64 bg-slate-900 rounded border border-slate-800 flex items-center justify-center overflow-hidden relative">
                {!hasError ? (
                  <img
                    src={imageSrc}
                    alt={`${label} for ${userName}`}
                    className="w-full h-full object-contain"
                    onError={() => handleImageError(key)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-slate-500">
                    <ImageOff className="w-8 h-8 text-slate-600" />
                    <span className="text-xs font-mono">No capture available</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </DefaultFloatingModalCard>
  );
};

export default CaptureViewerModal;
