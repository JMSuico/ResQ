// [Layer: Shared]
// PoliceBlotterModal.tsx -- PNP Police blotter entry and cryptographic incident record modal.
// Universal lambda expressions (=>). Strictly typed with zero 'any' and 100% pure Lucide icons.

import React, { FC, useState } from 'react';
import { Shield, FileText, Check, AlertCircle, Lock, BadgeCheck } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { filePoliceBlotter, PoliceBlotterEntry, CreateBlotterPayload } from '../Endpoints/responderOpsApi';

export interface PoliceBlotterModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  defaultLocation?: string;
  onSuccess?: (blotter: PoliceBlotterEntry) => void;
}

const CLASSIFICATIONS = [
  'Reckless Imprudence Resulting to Physical Injuries / Damage to Property',
  'Vehicular Hit-and-Run Incident',
  'Alarm and Scandal / Public Disturbance',
  'Robbery / Theft Under Investigation',
  'Physical Assault / Grave Threats',
  'Special Incident / Suspicious Activity'
];

export const PoliceBlotterModal: FC<PoliceBlotterModalProps> = ({
  isOpen,
  onClose,
  reportId,
  defaultLocation = 'Dipolog City Central Highway',
  onSuccess
}) => {
  const [classification, setClassification] = useState(CLASSIFICATIONS[0]);
  const [complainantName, setComplainantName] = useState('');
  const [complainantContact, setComplainantContact] = useState('');
  const [complainantAddress, setComplainantAddress] = useState('');
  const [suspectName, setSuspectName] = useState('Unidentified / At Large');
  const [suspectDescription, setSuspectDescription] = useState('');
  const [witnesses, setWitnesses] = useState('');
  const [narrativeStatement, setNarrativeStatement] = useState('');
  const [location, setLocation] = useState(defaultLocation);
  const [officerName, setOfficerName] = useState('P/Cpl. R. Dela Cruz');
  const [badgeNumber, setBadgeNumber] = useState('PNP-8841');
  const [station, setStation] = useState('Dipolog City Police Station');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complainantName.trim() || !narrativeStatement.trim()) {
      setErrorMessage('Complainant identity and sworn narrative statement are required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: CreateBlotterPayload = {
        reportId: reportId || undefined,
        incidentClassification: classification,
        complainantName: complainantName.trim(),
        complainantContact: complainantContact.trim() || undefined,
        complainantAddress: complainantAddress.trim() || undefined,
        suspectName: suspectName.trim() || undefined,
        suspectDescription: suspectDescription.trim() || undefined,
        witnesses: witnesses.trim() || undefined,
        narrativeStatement: narrativeStatement.trim(),
        incidentLocation: location.trim(),
        investigatingOfficerName: officerName.trim(),
        investigatingOfficerBadge: badgeNumber.trim(),
        station: station.trim()
      };

      const res = await filePoliceBlotter(payload);
      if (res.data) {
        onSuccess?.(res.data);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to file official police blotter entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Police Blotter Entry"
      subtitle={reportId ? `Incident: ${reportId.slice(0, 8)}...` : 'Station Investigation Record'}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-300 rounded-xl text-[#991B1B] text-sm font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#991B1B]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Classification */}
        <div>
          <label className="block text-sm font-bold text-[#670626] mb-1 flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#A83B4D]" />
            <span>Classification</span>
          </label>
          <select
            value={classification}
            onChange={e => setClassification(e.target.value)}
            className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
          >
            {CLASSIFICATIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Complainant & Suspect Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[#E9D9D0]/60 border border-[#D8C1B5] rounded-xl">
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#670626] uppercase tracking-wider block">
              Complainant
            </span>
            <input
              type="text"
              required
              value={complainantName}
              onChange={e => setComplainantName(e.target.value)}
              placeholder="Full Name (Required)"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
            <input
              type="text"
              value={complainantContact}
              onChange={e => setComplainantContact(e.target.value)}
              placeholder="Digital Contact / Barangay Reference (Optional)"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
            <input
              type="text"
              value={complainantAddress}
              onChange={e => setComplainantAddress(e.target.value)}
              placeholder="Address"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold text-[#670626] uppercase tracking-wider block">
              Suspect Info
            </span>
            <input
              type="text"
              value={suspectName}
              onChange={e => setSuspectName(e.target.value)}
              placeholder="Suspect Name (or Unidentified)"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
            <input
              type="text"
              value={suspectDescription}
              onChange={e => setSuspectDescription(e.target.value)}
              placeholder="Description / Vehicle"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
            <input
              type="text"
              value={witnesses}
              onChange={e => setWitnesses(e.target.value)}
              placeholder="Witnesses (Optional)"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
        </div>

        {/* Location & Narrative */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Location</label>
            <input
              type="text"
              required
              value={location}
              onChange={e => setLocation(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Incident Narrative</label>
            <textarea
              rows={4}
              required
              value={narrativeStatement}
              onChange={e => setNarrativeStatement(e.target.value)}
              placeholder="Describe the incident details..."
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626] resize-none"
            />
          </div>
        </div>

        {/* Investigating Officers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Investigating Officer</label>
            <input
              type="text"
              required
              value={officerName}
              onChange={e => setOfficerName(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Badge Number</label>
            <input
              type="text"
              required
              value={badgeNumber}
              onChange={e => setBadgeNumber(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Station Jurisdiction</label>
            <input
              type="text"
              required
              value={station}
              onChange={e => setStation(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
        </div>

        {/* Cryptographic Seal Notice */}
        <div className="flex items-center gap-2 p-2.5 bg-[#E9D9D0]/60 border border-[#D8C1B5] rounded-xl text-xs font-semibold text-[#5C313E]">
          <Lock className="w-4 h-4 text-[#670626] flex-shrink-0" />
          <span>Audit hash sealed on submit.</span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E9D9D0]">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="action-green"
            size="sm"
            isLoading={isSubmitting}
            icon={<BadgeCheck className="w-4 h-4" />}
          >
            File Blotter
          </Button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
