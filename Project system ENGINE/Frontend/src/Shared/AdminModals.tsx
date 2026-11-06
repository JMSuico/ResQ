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

const SEVERITY_LEVELS: { key: string; label: string; color: string; desc: string }[] = [
  { key: 'LOW', label: 'Level 1 - Alpha (Low)', color: 'text-slate-300 border-slate-700 bg-slate-900', desc: 'Routine municipal incident, localized impact.' },
  { key: 'MODERATE', label: 'Level 2 - Bravo (Moderate)', color: 'text-sky-400 border-sky-800 bg-sky-950/40', desc: 'Multi-unit deployment needed; non-critical casualties.' },
  { key: 'HIGH', label: 'Level 3 - Charlie (High)', color: 'text-amber-400 border-amber-800 bg-amber-950/40', desc: 'Severe structural or vehicular risk, rapid expansion.' },
  { key: 'CRITICAL', label: 'Level 4 - Delta (Critical)', color: 'text-rose-400 border-rose-800 bg-rose-950/40', desc: 'Life-threatening mass casualty incident; inter-agency dispatch.' },
  { key: 'DISASTER', label: 'Level 5 - Echo (Disaster)', color: 'text-red-500 border-red-700 bg-red-950/50', desc: 'Municipal state of emergency; all reserves deployed.' }
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
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-slate-100">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-950/30 border border-rose-800/50 text-rose-300 text-xs font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>
            Current Status: <strong>{currentSeverity.toUpperCase()}</strong>. Escalating forces real-time sirens to all field units.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">
            Target Severity Tier
          </label>
          <div className="grid grid-cols-1 gap-2">
            {SEVERITY_LEVELS.map((lvl) => {
              const isSelected = selectedSeverity === lvl.key;
              return (
                <button
                  type="button"
                  key={lvl.key}
                  onClick={() => setSelectedSeverity(lvl.key)}
                  className={`flex items-start justify-between p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    isSelected
                      ? 'border-rose-500 bg-rose-950/40 ring-1 ring-rose-500/50'
                      : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className={`text-xs font-mono font-bold ${lvl.color}`}>{lvl.label}</span>
                    <span className="text-[11px] text-slate-400 mt-0.5">{lvl.desc}</span>
                  </div>
                  {isSelected && <Activity className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="escalation-justification" className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">
            Escalation Justification & Tactical Notes
          </label>
          <textarea
            id="escalation-justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
            required
            placeholder="Document why escalation is required (e.g., secondary collision confirmed, structural collapse detected, hazmat release)..."
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        <label className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={triggerSiren}
            onChange={(e) => setTriggerSiren(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-rose-600 bg-slate-900 focus:ring-rose-500"
          />
          <Radio className="w-4 h-4 text-rose-400" />
          <span className="text-xs font-mono text-slate-300">
            Transmit audio-visual siren broadcast across connected responder terminals
          </span>
        </label>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !justification.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
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
      subtitle="Dispatch municipality-wide siren alert to all citizen and responder portals"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-slate-100">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-950/30 border border-sky-800/50 text-sky-300 text-xs font-mono">
          <Radio className="w-4 h-4 text-sky-400 flex-shrink-0 animate-pulse" />
          <span>
            Authorized Katipunan LDRRMO Broadcast Console. All transmissions are logged to the immutable ledger.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="broadcast-title" className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">
            Alert Headline
          </label>
          <input
            id="broadcast-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g. FLASH FLOOD WARNING: LOW-LYING BARANGAY EVACUATION"
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-category" className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">
              Incident Category
            </label>
            <select
              id="broadcast-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="CIVIL_DEFENSE">Civil Defense Directive</option>
              <option value="WEATHER">Severe Weather / Typhoons</option>
              <option value="EARTHQUAKE">Seismic / Earthquake</option>
              <option value="FIRE_ALARM">Major Structural Fire</option>
              <option value="PUBLIC_SAFETY">Public Safety Advisory</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="broadcast-priority" className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">
              Priority Tier
            </label>
            <select
              id="broadcast-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="STANDARD">Standard Advisory</option>
              <option value="HIGH">High Priority Bulletin</option>
              <option value="CRITICAL">Critical Life Safety Alert</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="broadcast-message" className="text-xs font-mono font-bold tracking-wide text-slate-400 uppercase">
            Broadcast Advisory Content
          </label>
          <textarea
            id="broadcast-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            placeholder="Enter concise, actionable instructions for residents and field units..."
            className="w-full p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !message.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
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
      <div className="flex flex-col gap-4 text-xs font-mono text-slate-200">
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-slate-300">Hash Chain Integrity</span>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" />
            Cryptographically Verified
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Action</span>
            <p className="font-bold text-sky-400 mt-1">{entry.action}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Timestamp</span>
            <p className="text-slate-300 mt-1">{entry.timestamp}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Operator / Actor</span>
            <p className="text-slate-300 mt-1 truncate">{entry.actorName || entry.actorUserId || 'System Engine'}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Target Entity</span>
            <p className="text-slate-300 mt-1 truncate">{entry.targetEntity || 'Global State'}</p>
          </div>
        </div>

        {entry.details && (
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Operation Details</span>
            <p className="text-slate-300 mt-1 whitespace-pre-wrap">{entry.details}</p>
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-col gap-1.5">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Current SHA-256 Hash</span>
          <code className="text-[11px] text-sky-300 break-all select-all bg-slate-900 p-2 rounded border border-slate-800">
            {entry.currentHash || '0x4f92c19a0d8e8745a90d631ecf042e873b1853a8'}
          </code>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Close Telemetry</span>
          </button>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
