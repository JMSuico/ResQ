// [Layer: Shared]
// StatusConfirmModal.tsx -- Tactical confirmation modal before broadcasting unit status changes
// (1. AVAILABLE, 2. EN ROUTE, 3. ON SCENE, 4. RETURNING) to LDRRMO Admin Command.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import React, { FC } from 'react';
import { AlertTriangle, CheckCircle2, XCircle, LogOut, Radio, ArrowRight, ShieldAlert } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';

export type TacticalResponderStatus = 'AVAILABLE' | 'EN ROUTE' | 'ON SCENE' | 'RETURNING' | string;

export interface StatusConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (targetStatus: TacticalResponderStatus) => void;
  onCancel?: () => void;
  currentStatus?: TacticalResponderStatus;
  targetStatus: TacticalResponderStatus;
  unitCode?: string;
  responderName?: string;
  isLoading?: boolean;
}

export const TACTICAL_STATUS_STEPS: Array<{
  stepNumber: number;
  code: string;
  label: string;
  badgeColor: string;
}> = [
  {
    stepNumber: 1,
    code: 'AVAILABLE',
    label: '1. AVAILABLE',
    badgeColor: 'bg-emerald-100 border-emerald-400 text-emerald-900'
  },
  {
    stepNumber: 2,
    code: 'EN ROUTE',
    label: '2. EN ROUTE',
    badgeColor: 'bg-amber-100 border-amber-400 text-amber-900'
  },
  {
    stepNumber: 3,
    code: 'ON SCENE',
    label: '3. ON SCENE',
    badgeColor: 'bg-rose-100 border-rose-400 text-[#991B1B]'
  },
  {
    stepNumber: 4,
    code: 'RETURNING',
    label: '4. RETURNING',
    badgeColor: 'bg-[#F3E4E7] border-[#A83B4D] text-[#670626]'
  }
];

export const formatTacticalStatusLabel = (status?: string): string => {
  if (!status) return '1. AVAILABLE';
  const normalized = String(status ?? '').trim().toUpperCase().replace(/_/g, ' ');
  const matched = TACTICAL_STATUS_STEPS.find(
    (s) =>
      s.code === normalized ||
      s.label === normalized ||
      (normalized.includes('AVAILABLE') && s.code === 'AVAILABLE') ||
      (normalized.includes('ON DUTY') && s.code === 'AVAILABLE') ||
      (normalized.includes('ROUTE') && s.code === 'EN ROUTE') ||
      (normalized.includes('DISPATCH') && s.code === 'EN ROUTE') ||
      (normalized.includes('SCENE') && s.code === 'ON SCENE') ||
      (normalized.includes('RETURN') && s.code === 'RETURNING') ||
      (normalized.includes('STANDBY') && s.code === 'RETURNING')
  );
  return matched ? matched.label : normalized;
};

export const StatusConfirmModal: FC<StatusConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onCancel,
  currentStatus = '1. AVAILABLE',
  targetStatus,
  unitCode = 'RHU-MEDIC-01',
  responderName = 'Duty Paramedic',
  isLoading = false
}) => {
  const formattedCurrent = formatTacticalStatusLabel(currentStatus);
  const formattedTarget = formatTacticalStatusLabel(targetStatus);

  const handleYes = () => {
    onConfirm(targetStatus);
  };

  const handleNo = () => {
    if (onCancel) {
      onCancel();
    } else {
      onClose();
    }
  };

  const handleExit = () => {
    onClose();
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={handleExit}
      title="Confirm Status Change"
      subtitle={`${unitCode} · ${responderName}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleExit}
            disabled={isLoading}
            icon={<LogOut className="w-4 h-4" />}
          >
            EXIT
          </Button>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleNo}
              disabled={isLoading}
              icon={<XCircle className="w-4 h-4" />}
            >
              NO
            </Button>
            <Button
              type="button"
              variant="action-green"
              size="sm"
              onClick={handleYes}
              isLoading={isLoading}
              icon={<CheckCircle2 className="w-4 h-4" />}
            >
              YES
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* High-Visibility Caution Banner */}
        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-400 flex items-center gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 animate-pulse" />
          <p className="text-sm font-semibold text-amber-950">
            Notice: This change broadcasts immediately to dispatch.
          </p>
        </div>

        {/* Status Transition Comparison */}
        <div className="p-4 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5] space-y-3">
          <div className="flex items-center justify-end text-xs font-mono uppercase tracking-wider text-[#7A4E59]">
            <span className="text-[#670626] font-bold flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>{unitCode}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-7 items-center gap-2.5">
            <div className="sm:col-span-3 p-3 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-center">
              <span className="block text-xs uppercase tracking-widest text-[#7A4E59] mb-1 font-bold">
                CURRENT STATE
              </span>
              <span className="text-sm font-bold text-[#3B1722] font-mono">
                {formattedCurrent}
              </span>
            </div>

            <div className="sm:col-span-1 flex items-center justify-center py-1">
              <div className="w-8 h-8 rounded-full bg-[#F3E4E7] border border-[#A83B4D]/40 flex items-center justify-center text-[#670626]">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            <div className="sm:col-span-3 p-3 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-center shadow-inner">
              <span className="block text-xs uppercase tracking-widest text-emerald-800 mb-1 font-bold">
                TARGET STATE
              </span>
              <span className="text-sm font-extrabold text-emerald-950 font-mono">
                {formattedTarget}
              </span>
            </div>
          </div>

          {/* 4-State Tactical Pipeline Reference */}
          <div className="pt-2 border-t border-[#D8C1B5]">
            <div className="text-xs font-mono uppercase tracking-wider text-[#7A4E59] mb-2 flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>Status Pipeline</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TACTICAL_STATUS_STEPS.map((step) => {
                const isTarget = formattedTarget === step.label;
                const isCurrent = formattedCurrent === step.label;
                return (
                  <div
                    key={step.code}
                    className={`px-2 py-1.5 rounded-lg border text-xs font-mono font-bold text-center transition-all ${
                      isTarget
                        ? `${step.badgeColor} ring-2 ring-emerald-500/50 scale-[1.02]`
                        : isCurrent
                        ? 'bg-[#FFFBF7] border-[#670626] text-[#670626]'
                        : 'bg-[#F7F1EA]/70 border-[#D8C1B5] text-[#7A4E59]'
                    }`}
                  >
                    {step.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};

export default StatusConfirmModal;
