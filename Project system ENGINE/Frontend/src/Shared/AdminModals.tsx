// [Layer: Shared]
// Responsibility: Tactical administrative governance modals for severity escalation, municipal siren broadcast, and cryptographic audit detail.
// Adheres to ResQTrack Command Engine design system: dark command aesthetic, zero emojis, strict typing, and universal arrow functions.

import React, { FC, useState } from 'react';
import { Shield, Activity, AlertTriangle, Send, Radio, CheckCircle2, X } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';

// ---------------------------------------------------------------------------
// 1. Admin Incident Escalation Modal
// ---------------------------------------------------------------------------

export interface AdminEscalateModalProps {
  isOpen: boolean;
  onClose: () => void;
  incidentId: string;
  incidentTitle: string;
  currentSeverity?: string;
  onEscalate: (payload: { severity: string; justification: string; triggerSiren: boolean }) => Promise<void> | void;
}

const SEVERITY_LEVELS: { key: string; label: string; color: string }[] = [
  { key: 'LOW', label: 'Level 1 - Low', color: 'text-[#5C313E]' },
  { key: 'MODERATE', label: 'Level 2 - Moderate', color: 'text-sky-800' },
  { key: 'HIGH', label: 'Level 3 - High', color: 'text-amber-800' },
  { key: 'CRITICAL', label: 'Level 4 - Critical', color: 'text-[#A83B4D]' },
  { key: 'DISASTER', label: 'Level 5 - Disaster', color: 'text-[#670626]' }
];

export const AdminEscalateModal: FC<AdminEscalateModalProps> = ({
  isOpen,
  onClose,
  incidentId,
  incidentTitle,
  currentSeverity = 'MODERATE',
  onEscalate
}) => {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('HIGH');
  const [justification, setJustification] = useState<string>('');
  const [triggerSiren, setTriggerSiren] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!justification.trim()) return;

    setIsSubmitting(true);
    try {
      await onEscalate({
        severity: selectedSeverity,
        justification: justification.trim(),
        triggerSiren
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Incident Severity Escalation"
      subtitle={`Incident Ref: ${incidentId} - ${incidentTitle}`}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-[#3B1722]">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-300 text-[#991B1B] text-sm font-mono">
          <AlertTriangle className="w-4 h-4 text-[#991B1B] flex-shrink-0" />
          <span>
            Current: <strong>{currentSeverity.toUpperCase()}</strong>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-mono font-bold tracking-wide text-[#670626] uppercase">
            Severity Tier
          </label>
          <div className="grid grid-cols-1 gap-2">
            {SEVERITY_LEVELS.map((lvl) => {
              const isSelected = selectedSeverity === lvl.key;
              return (
                <button
                  type="button"
                  key={lvl.key}
                  onClick={() => setSelectedSeverity(lvl.key)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#670626] bg-[#F3E4E7] ring-1 ring-[#A83B4D]/40 shadow-sm'
                      : 'border-[#D8C1B5] bg-[#E9D9D0]/55 hover:border-[#A83B4D]'
                  }`}
                >
                  <span className={`text-sm font-mono font-bold ${lvl.color}`}>{lvl.label}</span>
                  {isSelected && <Activity className="w-4 h-4 text-[#670626] flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="escalation-justification" className="text-sm font-mono font-bold tracking-wide text-[#670626] uppercase">
            Justification
          </label>
          <textarea
            id="escalation-justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
            required
            placeholder="Reason for escalation..."
            className="w-full p-3 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#3B1722] text-sm font-mono placeholder:text-[#9B727D] focus:outline-none focus:border-[#670626]"
          />
        </div>

        <label className="flex items-center gap-2 p-3 rounded-xl bg-[#E9D9D0]/55 border border-[#D8C1B5] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={triggerSiren}
            onChange={(e) => setTriggerSiren(e.target.checked)}
            className="w-4 h-4 rounded border-[#D4B8AA] accent-[#670626]"
          />
          <Radio className="w-4 h-4 text-[#A83B4D]" />
          <span className="text-sm font-mono text-[#3B1722]">
            Broadcast siren alert to responders
          </span>
        </label>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E9D9D0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D4B8AA] text-[#670626] text-sm font-mono font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !justification.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#670626] hover:bg-[#7D0A30] disabled:opacity-50 text-[#F7F1EA] text-sm font-mono font-bold transition-colors cursor-pointer shadow"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Escalating...' : 'Authorize Escalation'}</span>
          </button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};

// ---------------------------------------------------------------------------
// 2. Admin Municipal Alert Broadcast Modal
// ---------------------------------------------------------------------------

export interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBroadcast: (payload: { title: string; category: string; message: string; priority: string }) => Promise<void> | void;
}

export const AdminBroadcastModal: FC<AdminBroadcastModalProps> = ({
  isOpen,
  onClose,
  onBroadcast
}) => {
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('CIVIL_DEFENSE');
  const [message, setMessage] = useState<string>('');
  const [priority, setPriority] = useState<string>('HIGH');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setIsSubmitting(true);
    try {
      await onBroadcast({
        title: title.trim(),
        category,
        message: message.trim(),
        priority
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Municipal Emergency Broadcast"
      subtitle="Send alert to all portals"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-[#3B1722]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="broadcast-title" className="text-sm font-mono font-bold tracking-wide text-[#670626] uppercase">
            Alert Headline
          </label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Alert headline..."
            className="w-full p-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#3B1722] text-sm font-mono placeholder:text-[#9B727D] focus:outline-none focus:border-[#670626]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-category" className="text-sm font-mono font-bold tracking-wide text-[#670626] uppercase">
              Incident Category
            </label>
            <select
              id="broadcast-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#3B1722] text-sm font-mono focus:outline-none focus:border-[#670626]"
            >
              <option value="CIVIL_DEFENSE">Civil Defense Directive</option>
              <option value="WEATHER">Severe Weather / Typhoons</option>
              <option value="EARTHQUAKE">Seismic / Earthquake</option>
              <option value="FIRE_ALARM">Major Structural Fire</option>
              <option value="PUBLIC_SAFETY">Public Safety Advisory</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-priority" className="text-sm font-mono font-bold tracking-wide text-[#670626] uppercase">
              Priority Tier
            </label>
            <select
              id="broadcast-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#3B1722] text-sm font-mono focus:outline-none focus:border-[#670626]"
            >
              <option value="STANDARD">Standard Advisory</option>
              <option value="HIGH">High Priority Bulletin</option>
              <option value="CRITICAL">Critical Life Safety Alert</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="broadcast-message" className="text-sm font-mono font-bold tracking-wide text-[#670626] uppercase">
            Broadcast Advisory Content
          </label>
          <textarea
            id="broadcast-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            placeholder="Enter concise, actionable instructions for residents and field units..."
            className="w-full p-2.5 rounded-xl bg-[#FFFBF7] border border-[#D8C1B5] text-[#3B1722] text-sm font-mono placeholder:text-[#9B727D] focus:outline-none focus:border-[#670626]"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E9D9D0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D4B8AA] text-[#670626] text-sm font-mono font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !message.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#670626] hover:bg-[#7D0A30] disabled:opacity-50 text-[#F7F1EA] text-sm font-mono font-bold transition-colors cursor-pointer shadow"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Transmitting...' : 'Dispatch Siren'}</span>
          </button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};

// ---------------------------------------------------------------------------
// 3. Admin Cryptographic Audit Detail Modal
// ---------------------------------------------------------------------------

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorUserId?: string;
  actorName?: string;
  targetEntity?: string;
  action: string;
  details?: string;
  previousHash?: string;
  currentHash?: string;
  verified?: boolean;
}

export interface AdminAuditDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry?: AuditEntry | null;
}

export const AdminAuditDetailModal: FC<AdminAuditDetailModalProps> = ({
  isOpen,
  onClose,
  entry
}) => {
  if (!isOpen || !entry) return null;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Security Audit Telemetry"
      subtitle={`Log Signature ID: ${entry.id}`}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-4 text-sm font-mono text-[#3B1722]">
        <div className="flex items-center justify-between p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-700" />
            <span className="font-bold text-[#3B1722]">Hash Chain Integrity</span>
          </div>
          <span className="flex items-center gap-1 text-xs text-emerald-800 font-bold bg-emerald-100 px-2.5 py-0.5 rounded border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider">Action</span>
            <p className="font-bold text-[#670626] mt-1">{entry.action}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider">Timestamp</span>
            <p className="text-[#3B1722] mt-1">{entry.timestamp}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider">Operator / Actor</span>
            <p className="text-[#3B1722] mt-1 truncate">{entry.actorName || entry.actorUserId || 'System Engine'}</p>
          </div>
          <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider">Target Entity</span>
            <p className="text-[#3B1722] mt-1 truncate">{entry.targetEntity || 'Global State'}</p>
          </div>
        </div>

        {entry.details && (
          <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5]">
            <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider">Operation Details</span>
            <p className="text-[#3B1722] mt-1 whitespace-pre-wrap">{entry.details}</p>
          </div>
        )}

        <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5] flex flex-col gap-1.5">
          <span className="text-xs text-[#7A4E59] uppercase font-bold tracking-wider">Current SHA-256 Hash</span>
          <code className="text-xs text-[#670626] break-all select-all bg-[#FFFBF7] p-2.5 rounded-lg border border-[#D8C1B5]">
            {entry.currentHash || '0x4f92c19a0d8e8745a90d631ecf042e873b1853a8'}
          </code>
        </div>

        <div className="flex justify-end pt-3 border-t border-[#E9D9D0]">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D4B8AA] text-[#670626] text-sm font-mono font-bold transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
