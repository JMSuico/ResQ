// [Layer: Shared]
// BackupOptionsModal.tsx -- 3-mode Tactical Call Backup & Emergency Reinforcement Modal.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import React, { FC, useState } from 'react';
import {
  ShieldAlert,
  Radio,
  PhoneCall,
  Mail,
  CheckCircle2,
  Send,
  Siren,
  Users,
  Building2,
  X
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { formatDateTimeWithSecondsAmPm } from './radarPointerCategories';
import { sendEmergencyBroadcast } from '@/Endpoints/reportsApi';
import { createMedicDispatchRequest } from '@/Endpoints/responderOpsApi';

export type BackupOptionMode = 'ADMIN_RECOMMEND' | 'DISTRESS_NEARBY' | 'CALL_OR_EMAIL';

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
  const [callNumber, setCallNumber] = useState<string>('+63 917 891 1911');
  const [emailAddress, setEmailAddress] = useState<string>('command.ldrrmo@katipunan.gov.ph');
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
      title="CALL BACKUP — TACTICAL REINFORCEMENT PROTOCOL"
      subtitle={`Unit: ${unitCode} • Linked Incident: ${incidentId} (${incidentLocation})`}
      size="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[11px] font-mono text-slate-400">
            Select any of the 3 authorized backup transmission channels above
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            icon={<X className="w-4 h-4" />}
          >
            Close Window
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {dispatchedRecord && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border-2 border-emerald-500/80 flex items-start gap-3 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  BACKUP SIGNAL TRANSMITTED ({dispatchedRecord.id})
                </span>
                <span className="text-[11px] font-mono text-emerald-200">
                  {dispatchedRecord.timestamp}
                </span>
              </div>
              <p className="text-xs text-emerald-100 font-semibold mt-1">
                {dispatchedRecord.optionLabel}
              </p>
              {dispatchedRecord.contactTarget && (
                <p className="text-[11px] font-mono text-emerald-300 mt-0.5">
                  Target Channel: {dispatchedRecord.contactTarget}
                </p>
              )}
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                {dispatchedRecord.notes}
              </p>
            </div>
          </div>
        )}

        {/* Optional Situational Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Tactical Situation Brief / Reinforcement Reason (Optional)
          </label>
          <input
            type="text"
            value={tacticalNote}
            onChange={(e) => setTacticalNote(e.target.value)}
            placeholder="e.g. Multiple casualties on highway, requesting 2nd ambulance and PNP perimeter control..."
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Option 1 */}
        <div
          onClick={() => setSelectedMode('ADMIN_RECOMMEND')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMode === 'ADMIN_RECOMMEND'
              ? 'bg-sky-950/50 border-sky-500/80 shadow-lg shadow-sky-950/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-sky-500/20 border border-sky-500/50 flex items-center justify-center text-sky-400 flex-shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-sky-200 tracking-wide">
                  1. RECOMMEND REQUEST BACKUP VIA ADMIN SO ADMIN CAN DISPATCH REQUEST
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Routes a formal reinforcement recommendation to LDRRMO Command Center for coordinated multi-agency dispatch.
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
                  '1. RECOMMEND REQUEST BACKUP VIA ADMIN SO ADMIN CAN DISPATCH REQUEST',
                  'LDRRMO Command Dispatch Desk'
                );
              }}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Request Via Admin
            </Button>
          </div>
        </div>

        {/* Option 2 */}
        <div
          onClick={() => setSelectedMode('DISTRESS_NEARBY')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMode === 'DISTRESS_NEARBY'
              ? 'bg-rose-950/50 border-rose-500/80 shadow-lg shadow-rose-950/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/20 border border-rose-500/50 flex items-center justify-center text-rose-400 flex-shrink-0">
                <Siren className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-rose-200 tracking-wide">
                  2. SEND DISTRESS SIGNAL FOR ALL NEARBY RESPONDERS (MEDIC OR NON-MEDIC)
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcasts an omnidirectional SOS beacon to all RHU Medics, BFP Fire, and PNP Police units within a 10km radius.
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
                  '2. SEND DISTRESS SIGNAL FOR ALL NEARBY RESPONDERS (MEDIC OR NON-MEDIC)',
                  'ALL NEARBY UNITS (RHU / PNP / BFP / LDRRMO)'
                );
              }}
              icon={<Radio className="w-3.5 h-3.5" />}
            >
              Broadcast Distress SOS
            </Button>
          </div>
        </div>

        {/* Option 3 */}
        <div
          onClick={() => setSelectedMode('CALL_OR_EMAIL')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedMode === 'CALL_OR_EMAIL'
              ? 'bg-amber-950/40 border-amber-500/80 shadow-lg shadow-amber-950/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 flex-shrink-0">
                <PhoneCall className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-extrabold text-amber-200 tracking-wide">
                  3. SEND VIA CALL NUMBER OR EMAIL
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  Direct emergency hotline dial or automated tactical dispatch email to hospital ER, PNP station, or command desk.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-400">
                  EMERGENCY HOTLINE / CALL NUMBER
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={callNumber}
                    onChange={(e) => setCallNumber(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                    placeholder="+63 917 891 1911"
                  />
                  <Button
                    type="button"
                    variant="warning"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMode('CALL_OR_EMAIL');
                      triggerBackupOption(
                        'CALL_OR_EMAIL',
                        '3. SEND VIA CALL NUMBER OR EMAIL',
                        `CALL: ${callNumber}`
                      );
                    }}
                    icon={<PhoneCall className="w-3.5 h-3.5" />}
                  >
                    Call Now
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-400">
                  EMERGENCY DISPATCH EMAIL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                    placeholder="command.ldrrmo@katipunan.gov.ph"
                  />
                  <Button
                    type="button"
                    variant="action-green"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMode('CALL_OR_EMAIL');
                      triggerBackupOption(
                        'CALL_OR_EMAIL',
                        '3. SEND VIA CALL NUMBER OR EMAIL',
                        `EMAIL: ${emailAddress}`
                      );
                    }}
                    icon={<Mail className="w-3.5 h-3.5" />}
                  >
                    Send Email
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};

export default BackupOptionsModal;
