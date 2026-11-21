// [Layer: Shared]
// Responsibility: Capture viewer modal displaying biometric images for a selected user: Face Capture, Government ID, ID Front Card, ID Back Card.
// Prefixes URLs with getApiBaseUrl() for cross-port / cross-origin stability.
// DO NOT lose zoom or aspect ratio.
// Universal lambda expressions (=>).

import React, { FC, useState } from 'react';
import { User, CreditCard, ShieldCheck, ImageOff } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { getApiBaseUrl } from '@/Endpoints/apiClient';

export type CaptureKind = 'face' | 'id' | 'front' | 'back';

export interface CaptureViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
  userName?: string;
  kinds?: CaptureKind[];
}

interface BiometricKind {
  key: CaptureKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ALL_BIOMETRIC_KINDS: BiometricKind[] = [
  { key: 'face', label: 'Face Capture', icon: User },
  { key: 'id', label: 'Government ID', icon: CreditCard },
  { key: 'front', label: 'ID Front Card', icon: CreditCard },
  { key: 'back', label: 'ID Back Card', icon: ShieldCheck }
];

export const CaptureViewerModal: FC<CaptureViewerModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName = 'User',
  kinds
}) => {
  const [loadErrors, setLoadErrors] = useState<Record<string, boolean>>({});

  if (!isOpen || !userId) return null;

  const handleImageError = (key: string) => {
    setLoadErrors((prev) => ({ ...prev, [key]: true }));
  };

  const activeKinds = kinds && kinds.length > 0
    ? ALL_BIOMETRIC_KINDS.filter((item) => kinds.includes(item.key))
    : ALL_BIOMETRIC_KINDS;

  const baseUrl = getApiBaseUrl();

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
      <div
        className={`grid grid-cols-1 ${
          activeKinds.length === 1
            ? 'max-w-md mx-auto'
            : activeKinds.length === 2
            ? 'md:grid-cols-2'
            : activeKinds.length === 3
            ? 'md:grid-cols-3'
            : 'sm:grid-cols-2 lg:grid-cols-4'
        } gap-4`}
      >
        {activeKinds.map(({ key, label, icon: IconComponent }) => {
          const hasError = !!loadErrors[key];
          const imageSrc = `${baseUrl}/api/users/${encodeURIComponent(userId)}/captures/${key}`;

          return (
            <div key={key} className="flex flex-col items-center bg-[#E9D9D0]/60 p-3 rounded-xl border border-[#D8C1B5]">
              <div className="flex items-center gap-1.5 text-sm font-mono font-bold text-[#670626] mb-2">
                <IconComponent className="w-4 h-4 text-[#A83B4D]" />
                <span>{label}</span>
              </div>
              <div className="w-full h-64 bg-[#FFFBF7] rounded-lg border border-[#D8C1B5] flex items-center justify-center overflow-hidden relative">
                {!hasError ? (
                  <img
                    src={imageSrc}
                    alt={`${label} for ${userName}`}
                    className="w-full h-full object-contain"
                    onError={() => handleImageError(key)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-[#7A4E59]">
                    <ImageOff className="w-8 h-8 text-[#A83B4D]/60" />
                    <span className="text-sm font-mono">No capture available</span>
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
