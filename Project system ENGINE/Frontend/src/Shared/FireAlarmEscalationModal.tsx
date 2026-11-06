// [Layer: Shared]
// FireAlarmEscalationModal.tsx -- BFP Fire Rescue alarm escalation and structural fire status modal.
// Universal lambda expressions (=>). Strictly typed with zero 'any' and 100% pure Lucide icons.

import React, { FC, useState } from 'react';
import { Flame, Droplets, Building, Check, AlertTriangle, AlertCircle } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { setFireAlarmLevel, FireAlarmStatusRecord, SetAlarmLevelPayload } from '../Endpoints/responderOpsApi';

export interface FireAlarmEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  onSuccess?: (alarm: FireAlarmStatusRecord) => void;
}

const ALARM_LEVELS = [
  { level: '1st Alarm', desc: 'Initial Response (2 Engines)' },
  { level: '2nd Alarm', desc: 'Reinforced (4 Engines + Ladder)' },
  { level: '3rd Alarm', desc: 'District Mutual Aid (6+ Engines)' },
  { level: '4th Alarm', desc: 'Regional Response Units' },
  { level: '5th Alarm', desc: 'City-Wide Mobilization' },
  { level: 'Task Force Alpha', desc: 'Major Conflagration Response' },
  { level: 'General Alarm', desc: 'Total Disaster Mobilization' },
];

export const FireAlarmEscalationModal: FC<FireAlarmEscalationModalProps> = ({
  isOpen,
  onClose,
  reportId,
  onSuccess
}) => {
  const [alarmLevel, setAlarmLevel] = useState('1st Alarm');
  const [buildingType, setBuildingType] = useState('Residential');
  const [trappedOccupants, setTrappedOccupants] = useState<number>(0);
  const [waterGallons, setWaterGallons] = useState<number>(2000);
  const [commanderName, setCommanderName] = useState('FO3 R. Santos');
  const [reportingUnit, setReportingUnit] = useState('BFP-ALPHA');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: SetAlarmLevelPayload = {
        reportId: reportId || undefined,
        alarmLevel,
        buildingType,
        trappedOccupantsCount: Number(trappedOccupants) || 0,
        waterSupplyGallons: Number(waterGallons) || 0,
        commanderName: commanderName.trim(),
        reportingUnit: reportingUnit.trim(),
        remarks: remarks.trim()
      };

      const res = await setFireAlarmLevel(payload);
      if (res.data) {
        onSuccess?.(res.data);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update fire alarm status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="BFP Fire Alarm Escalation & Status Record"
      subtitle={reportId ? `Incident Reference: ${reportId.slice(0, 8)}...` : 'Structural Fire Incident Command'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-rose-950/80 border border-rose-800 rounded text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Alarm Level Selector Grid */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Official Bureau of Fire Protection Alarm Escalation Level</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALARM_LEVELS.map(al => {
              const isSelected = alarmLevel === al.level;
              return (
                <button
                  type="button"
                  key={al.level}
                  onClick={() => setAlarmLevel(al.level)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'bg-amber-950/80 border-amber-500 text-amber-200 ring-1 ring-amber-500/50'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-semibold text-xs text-slate-100">{al.level}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <span className="text-[11px] text-slate-400 leading-tight block">{al.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Structural Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/70 border border-amber-950/80 rounded-lg">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Building Type</span>
            </label>
            <select
              value={buildingType}
              onChange={e => setBuildingType(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            >
              <option value="Residential">Residential Single/Multi</option>
              <option value="Commercial">Commercial / Retail</option>
              <option value="Industrial">Industrial Warehouse</option>
              <option value="Institutional">Hospital / School</option>
              <option value="Hazardous">Chemical / Hazmat Facility</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Trapped Occupants</span>
            </label>
            <input
              type="number"
              min={0}
              value={trappedOccupants}
              onChange={e => setTrappedOccupants(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-cyan-400" />
              <span>Water On-Board (Gal)</span>
            </label>
            <input
              type="number"
              min={0}
              step={250}
              value={waterGallons}
              onChange={e => setWaterGallons(Number(e.target.value))}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Field Command Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Incident Ground Commander</label>
            <input
              type="text"
              required
              value={commanderName}
              onChange={e => setCommanderName(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Responding Fire Apparatus</label>
            <input
              type="text"
              required
              value={reportingUnit}
              onChange={e => setReportingUnit(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Tactical Field Remarks</label>
          <textarea
            rows={2}
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            placeholder="e.g. Exposure protection established on North flank. Requesting additional tanker for relay pumping."
            className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="warning"
            size="sm"
            isLoading={isSubmitting}
            icon={<Flame className="w-4 h-4" />}
          >
            Broadcast Alarm Escalation
          </Button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
