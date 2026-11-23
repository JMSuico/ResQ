// [Layer: Shared]
// BackupOptionsModal.tsx -- 3-mode Digital/Radio Tactical Backup & Emergency Reinforcement Modal.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis, zero phone hotlines).

import React, { FC, useState } from 'react';
import {
  Radio,
  MessageSquare,
  CheckCircle2,
  Send,
  Siren,
  Building2,
  X
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { formatDateTimeWithSecondsAmPm } from './radarPointerCategories';
import { sendEmergencyBroadcast } from '@/Endpoints/reportsApi';
import { createMedicDispatchRequest } from '@/Endpoints/responderOpsApi';

export type BackupOptionMode = 'ADMIN_RECOMMEND' | 'DISTRESS_NEARBY' | 'OFFICIAL_DISPATCH';

export interface BackupDispatchEventPayload {
  id: string;
  mode: BackupOptionMode;
  optionLabel: string;
  incidentId?: string;
  incidentLocation?: string;
  unitCode: string;
  responderName: string;
  contactTarget?: string;
  notes?: string;
  timestamp: string;
}

export interface BackupOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId?: string;
  incidentTitle?: string;
  incidentLocation?: string;
  unitCode?: string;
  responderName?: string;
  onBackupDispatched?: (payload: BackupDispatchEventPayload) => void;
}

export const BackupOptionsModal: FC<BackupOptionsModalProps> = ({
  isOpen,
  onClose,
  incidentId = 'INC-ACTIVE-01',
  incidentTitle = 'Active Field Emergency',
  incidentLocation = 'Katipunan National Highway Sector',
  unitCode = 'RHU-MEDIC-01',
  responderName = 'Duty Paramedic',
  onBackupDispatched
}) => {
  const [selectedMode, setSelectedMode] = useState<BackupOptionMode>('ADMIN_RECOMMEND');
  const [dispatchChannel, setDispatchChannel] = useState<string>('KATIPUNAN-C2-TAC1');
  const [tacticalNote, setTacticalNote] = useState<string>('');
  const [dispatchedRecord, setDispatchedRecord] = useState<BackupDispatchEventPayload | null>(null);

  const triggerBackupOption = (mode: BackupOptionMode, optionLabel: string, contactTarget?: string) => {
    const timestamp = formatDateTimeWithSecondsAmPm(new Date());
    const payload: BackupDispatchEventPayload = {
      id: `BKP-${Date.now().toString().slice(-6)}`,
      mode,
      optionLabel,
      incidentId,
      incidentLocation,
      unitCode,
      responderName,
      contactTarget,
      notes: tacticalNote.trim() || `Emergency reinforcement requested for ${incidentTitle} at ${incidentLocation}.`,
      timestamp
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('resqtrack:report', {
          detail: {
            type: 'BACKUP_REQUEST',
            ...payload
          }
        })
      );
      window.dispatchEvent(
        new CustomEvent('resqtrack:notification', {
          detail: {
            id: payload.id,
            title: `CALL BACKUP: ${optionLabel}`,
            message: `${unitCode} (${responderName}) triggered "${optionLabel}" at ${timestamp}.`,
            severity: mode === 'DISTRESS_NEARBY' ? 'critical' : 'high',
            timestamp
          }
        })
      );
    }

    // Persist emergency alert broadcast to relational backend via POST /api/alerts/broadcast
    void sendEmergencyBroadcast({
      title: `CALL BACKUP: ${optionLabel} (${unitCode})`,
      message: `${unitCode} (${responderName}) triggered tactical reinforcement: "${optionLabel}". Target: ${contactTarget || 'LDRRMO Command Center'}. Sector: ${incidentLocation}. Notes: ${payload.notes}`,
      severity: mode === 'DISTRESS_NEARBY' ? 'Critical' : 'High'
    }).catch((err: unknown) => {
      console.warn('[BackupOptionsModal] Failed to send emergency broadcast:', err);
    });

    // Persist tactical medic dispatch request to backend relational ledger via createMedicDispatchRequest
    void createMedicDispatchRequest({
      incidentId: incidentId || `INC-${payload.id}`,
      incidentCode: payload.id,
      incidentTitle: `TACTICAL BACKUP // ${optionLabel} (${unitCode})`,
      category: 'BackupReinforcement',
      severity: mode === 'DISTRESS_NEARBY' ? 'Critical' : 'High',
      location: incidentLocation,
      responderName,
      notes: payload.notes
    }).catch((err: unknown) => {
      console.warn('[BackupOptionsModal] Failed to create medic dispatch request:', err);
    });

    setDispatchedRecord(payload);
    if (onBackupDispatched) {
      onBackupDispatched(payload);
    }
  };

  const handleClose = () => {
    setDispatchedRecord(null);
    onClose();
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={handleClose}
      title="Request Backup"
      subtitle={`${unitCode} · ${incidentId}`}
      size="2xl"
      footer={
        <div className="flex items-center justify-end w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            icon={<X className="w-4 h-4" />}
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {dispatchedRecord && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-400 flex items-start gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold uppercase tracking-wider text-emerald-900">
                  BACKUP SIGNAL TRANSMITTED ({dispatchedRecord.id})
                </span>
                <span className="text-xs font-mono font-bold text-emerald-800">
                  {dispatchedRecord.timestamp}
                </span>
              </div>
              <p className="text-sm text-emerald-950 font-semibold mt-1">
                {dispatchedRecord.optionLabel}
              </p>
              {dispatchedRecord.contactTarget && (
                <p className="text-xs font-mono font-bold text-emerald-800 mt-0.5">
                  Target Channel: {dispatchedRecord.contactTarget}
                </p>
              )}
              <p className="text-xs text-emerald-900/90 mt-0.5">
                {dispatchedRecord.notes}
              </p>
            </div>
          </div>
        )}

        {/* Optional Situational Note */}
        <div>
          <label className="block text-sm font-bold text-[#670626] mb-1">
            Note (Optional)
          </label>
          <input
            type="text"
            value={tacticalNote}
            onChange={(e) => setTacticalNote(e.target.value)}
            placeholder="Reason for backup..."
            className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-sm text-[#3B1722] placeholder-[#9B727D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25"
          />
        </div>

        {/* Option 1: In-App Broadcast via Admin Dispatch */}
        <div
          onClick={() => setSelectedMode('ADMIN_RECOMMEND')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMode === 'ADMIN_RECOMMEND'
              ? 'bg-[#E9D9D0]/85 border-[#670626] shadow-[0_8px_20px_-6px_rgba(103,6,38,0.2)]'
              : 'bg-[#E9D9D0]/45 border-[#D8C1B5] hover:border-[#A83B4D]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#670626]/12 border border-[#A83B4D]/40 flex items-center justify-center text-[#670626] flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#670626] tracking-wide">
                  1. Request via Admin Dispatch
                </h4>
                <p className="text-xs font-mono text-[#7A4E59]">
                  In-App Broadcast to LDRRMO Command Desk
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMode('ADMIN_RECOMMEND');
                triggerBackupOption(
                  'ADMIN_RECOMMEND',
                  '1. Request via Admin Dispatch',
                  'In-App Broadcast: LDRRMO Command Dispatch Desk'
                );
              }}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              In-App Broadcast
            </Button>
          </div>
        </div>

        {/* Option 2: Distress Backup / Incident to Nearby Responders */}
        <div
          onClick={() => setSelectedMode('DISTRESS_NEARBY')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMode === 'DISTRESS_NEARBY'
              ? 'bg-rose-50 border-[#991B1B] shadow-[0_8px_20px_-6px_rgba(153,27,27,0.22)]'
              : 'bg-[#E9D9D0]/45 border-[#D8C1B5] hover:border-[#A83B4D]'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 border border-rose-300 flex items-center justify-center text-[#991B1B] flex-shrink-0">
                <Siren className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#991B1B] tracking-wide">
                  2. Distress Backup / Incident to Nearby Responders
                </h4>
                <p className="text-xs font-mono text-[#7A4E59]">
                  Priority Digital Beacon to RHU / PNP / BFP / LDRRMO
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMode('DISTRESS_NEARBY');
                triggerBackupOption(
                  'DISTRESS_NEARBY',
                  '2. Distress Backup / Incident to Nearby Responders',
                  'In-App Broadcast: ALL NEARBY UNITS (RHU / PNP / BFP / LDRRMO)'
                );
              }}
              icon={<Radio className="w-3.5 h-3.5" />}
            >
              Broadcast Distress Backup / Incident
            </Button>
          </div>
        </div>

        {/* Option 3: Official Dispatch Message (Digital / Radio Channel) */}
        <div
          onClick={() => setSelectedMode('OFFICIAL_DISPATCH')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMode === 'OFFICIAL_DISPATCH'
              ? 'bg-[#E9D9D0]/85 border-[#A83B4D] shadow-[0_8px_20px_-6px_rgba(103,6,38,0.18)]'
              : 'bg-[#E9D9D0]/45 border-[#D8C1B5] hover:border-[#A83B4D]'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#670626]/12 border border-[#A83B4D]/40 flex items-center justify-center text-[#670626] flex-shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-[#670626] tracking-wide">
                  3. Official Dispatch Message
                </h4>
                <p className="text-xs font-mono text-[#7A4E59]">
                  Encrypted Digital &amp; Tactical Radio Relay Channel
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5 pt-2 border-t border-[#D8C1B5]">
              <div className="flex-1 space-y-1">
                <label className="block text-xs font-mono font-bold text-[#670626]">
                  Radio / Digital Dispatch Channel
                </label>
                <input
                  type="text"
                  value={dispatchChannel}
                  onChange={(e) => setDispatchChannel(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-3 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-sm font-mono text-[#3B1722] focus:outline-none focus:border-[#670626]"
                  placeholder="KATIPUNAN-C2-TAC1"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMode('OFFICIAL_DISPATCH');
                    triggerBackupOption(
                      'OFFICIAL_DISPATCH',
                      'In-App Broadcast',
                      `DIGITAL CHANNEL: ${dispatchChannel}`
                    );
                  }}
                  icon={<Radio className="w-3.5 h-3.5" />}
                >
                  In-App Broadcast
                </Button>
                <Button
                  type="button"
                  variant="action-green"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMode('OFFICIAL_DISPATCH');
                    triggerBackupOption(
                      'OFFICIAL_DISPATCH',
                      'Official Dispatch Message',
                      `RADIO DISPATCH: ${dispatchChannel}`
                    );
                  }}
                  icon={<MessageSquare className="w-3.5 h-3.5" />}
                >
                  Official Dispatch Message
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};

export default BackupOptionsModal;
