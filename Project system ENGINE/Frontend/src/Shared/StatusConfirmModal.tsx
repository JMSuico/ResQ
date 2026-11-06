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
    badgeColor: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
  },
  {
    stepNumber: 2,
    code: 'EN ROUTE',
    label: '2. EN ROUTE',
    badgeColor: 'bg-amber-950/90 border-amber-500/60 text-amber-300'
  },
  {
    stepNumber: 3,
    code: 'ON SCENE',
    label: '3. ON SCENE',
    badgeColor: 'bg-rose-950/90 border-rose-500/60 text-rose-300'
  },
  {
    stepNumber: 4,
    code: 'RETURNING',
    label: '4. RETURNING',
    badgeColor: 'bg-sky-950/90 border-sky-500/60 text-sky-300'
  }
];

export const formatTacticalStatusLabel = (status?: string): string => {
  if (!status) return '1. AVAILABLE';
  const normalized = status.trim().toUpperCase().replace(/_/g, ' ');
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
      title="DO YOU WANT TO CHANGE STATUS?"
      subtitle={`Unit Telemetry Confirmation • ${unitCode} (${responderName})`}
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
        <div className="p-3.5 rounded-xl bg-amber-950/80 border-2 border-amber-500/80 flex items-start gap-3 shadow-lg shadow-amber-950/50">
          <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="space-y-1">
            <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              CAUTION: THIS STATUS CHANGE WILL IMMEDIATELY BROADCAST AND BE VISIBLE IN THE LDRRMO ADMIN COMMAND.
            </p>
            <p className="text-[11px] text-amber-200/80">
              All status transitions are logged in the immutable tactical dispatch ledger with real-time GPS coordinates and timestamp.
            </p>
          </div>
        </div>

        {/* Status Transition Comparison */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span>DO YOU WANT TO CHANGE STATUS?</span>
            </span>
            <span className="text-sky-400 font-semibold">{unitCode}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-7 items-center gap-2.5">
            <div className="sm:col-span-3 p-3 rounded-lg bg-slate-900 border border-slate-700/80 text-center">
              <span className="block text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                CURRENT STATE
              </span>
              <span className="text-xs font-bold text-slate-200 font-mono">
                {formattedCurrent}
              </span>
            </div>

            <div className="sm:col-span-1 flex items-center justify-center py-1">
              <div className="w-8 h-8 rounded-full bg-sky-950 border border-sky-700/70 flex items-center justify-center text-sky-400">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>

            <div className="sm:col-span-3 p-3 rounded-lg bg-emerald-950/50 border-2 border-emerald-500/70 text-center shadow-inner">
              <span className="block text-[10px] uppercase tracking-widest text-emerald-300 mb-1">
                TARGET STATE
              </span>
              <span className="text-xs font-extrabold text-emerald-200 font-mono">
                {formattedTarget}
              </span>
            </div>
          </div>

          {/* 4-State Tactical Pipeline Reference */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-slate-400" />
              <span>4-Stage Tactical Responder Pipeline</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TACTICAL_STATUS_STEPS.map((step) => {
                const isTarget = formattedTarget === step.label;
                const isCurrent = formattedCurrent === step.label;
                return (
                  <div
                    key={step.code}
                    className={`px-2 py-1.5 rounded border text-[10px] font-mono font-bold text-center transition-all ${
                      isTarget
                        ? `${step.badgeColor} ring-2 ring-emerald-400/60 scale-[1.02]`
                        : isCurrent
                        ? 'bg-slate-800 border-slate-600 text-slate-200'
                        : 'bg-slate-900/50 border-slate-800/80 text-slate-500'
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
