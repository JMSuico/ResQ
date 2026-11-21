// [Layer: Shared]
// PatientCareRecordModal.tsx -- RHU Paramedic Patient Care Record (PCR) and multi-casualty trauma vitals entry modal.
// Supports "ADD NEW PCR VITAL" to record multiple injured persons/civilians within the same incident.
// Universal lambda expressions (=>). Strictly typed with zero 'any' and 100% pure Lucide icons.

import React, { FC, useState } from 'react';
import {
  HeartPulse,
  Activity,
  Check,
  AlertCircle,
  UserPlus,
  Users,
  Trash2,
  Building2,
  CheckCircle2
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { submitPcrRecord, PatientCareRecord, CreatePcrPayload } from '../Endpoints/responderOpsApi';
import { formatDateTimeWithSecondsAmPm } from './radarPointerCategories';

export interface PcrCasualtyItem {
  id: string;
  patientName: string;
  age: number;
  gender: string;
  levelOfConsciousness: string;
  bpSystolic: number;
  bpDiastolic: number;
  heartRate: number;
  respiratoryRate: number;
  spO2: number;
  glucose: number;
  temp: number;
  receivingHospital: string;
  chiefComplaint: string;
  narrative: string;
  interventions: string[];
  recordedAt: string;
}

export interface PatientCareRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  onSuccess?: (pcr: PatientCareRecord, allCasualties?: PcrCasualtyItem[]) => void;
}

const COMMON_INTERVENTIONS = [
  'O2 Therapy (High-Flow)',
  'IV Cannulation (0.9% NaCl)',
  'C-Spine Immobilization',
  'Wound Dressing / Bandaging',
  'Limb Splinting',
  'Bag-Valve-Mask Ventilation',
  'Defibrillation / AED',
  'Patient Extrication'
];

const createBlankCasualty = (index: number): PcrCasualtyItem => ({
  id: `CASUALTY-${Date.now()}-${index}`,
  patientName: '',
  age: 28,
  gender: 'Male',
  levelOfConsciousness: 'Alert',
  bpSystolic: 120,
  bpDiastolic: 80,
  heartRate: 78,
  respiratoryRate: 16,
  spO2: 98,
  glucose: 105,
  temp: 36.8,
  receivingHospital: 'Katipunan Municipal RHU Infirmary',
  chiefComplaint: '',
  narrative: '',
  interventions: [],
  recordedAt: formatDateTimeWithSecondsAmPm(new Date())
});

export const PatientCareRecordModal: FC<PatientCareRecordModalProps> = ({
  isOpen,
  onClose,
  reportId,
  onSuccess
}) => {
  const [casualties, setCasualties] = useState<PcrCasualtyItem[]>(() => [createBlankCasualty(1)]);
  const [activeCasualtyIndex, setActiveCasualtyIndex] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [addedBannerMessage, setAddedBannerMessage] = useState<string | null>(null);

  const currentCasualty: PcrCasualtyItem =
    casualties[activeCasualtyIndex] || casualties[0] || createBlankCasualty(1);

  const updateCurrentCasualty = (patch: Partial<PcrCasualtyItem>) => {
    setCasualties((prev) =>
      prev.map((item, idx) => (idx === activeCasualtyIndex ? { ...item, ...patch } : item))
    );
  };

  const toggleIntervention = (item: string) => () => {
    const existing = currentCasualty.interventions;
    const updated = existing.includes(item)
      ? existing.filter((i) => i !== item)
      : [...existing, item];
    updateCurrentCasualty({ interventions: updated });
  };

  const handleAddNewPcrVital = () => {
    if (!currentCasualty.patientName.trim()) {
      setErrorMessage(
        `Please enter Patient Full Name / Identity for Casualty #${activeCasualtyIndex + 1} before adding another injured person.`
      );
      return;
    }
    setErrorMessage(null);
    const nextNumber = casualties.length + 1;
    const newEntry = createBlankCasualty(nextNumber);
    setCasualties((prev) => [...prev, newEntry]);
    setActiveCasualtyIndex(casualties.length);
    setAddedBannerMessage(
      `Casualty #${activeCasualtyIndex + 1} (${currentCasualty.patientName}) queued. Now entering vitals for Casualty #${nextNumber}.`
    );
  };

  const handleRemoveCasualty = (indexToRemove: number) => {
    if (casualties.length <= 1) return;
    const nextList = casualties.filter((_, idx) => idx !== indexToRemove);
    setCasualties(nextList);
    setActiveCasualtyIndex(Math.max(0, Math.min(activeCasualtyIndex, nextList.length - 1)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalidIdx = casualties.findIndex((c) => !c.patientName.trim());
    if (invalidIdx !== -1) {
      setActiveCasualtyIndex(invalidIdx);
      setErrorMessage(
        `Patient full name or unidentified identifier is required for Casualty #${invalidIdx + 1}.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      let lastSavedRecord: PatientCareRecord | null = null;

      for (const c of casualties) {
        const payload: CreatePcrPayload = {
          reportId: reportId || undefined,
          patientName: c.patientName.trim(),
          age: Number(c.age) || 0,
          gender: c.gender,
          levelOfConsciousness: c.levelOfConsciousness,
          bloodPressureSystolic: Number(c.bpSystolic) || 120,
          bloodPressureDiastolic: Number(c.bpDiastolic) || 80,
          heartRateBpm: Number(c.heartRate) || 80,
          respiratoryRate: Number(c.respiratoryRate) || 16,
          spO2Percent: Number(c.spO2) || 98,
          bloodGlucoseMgDl: Number(c.glucose) || 100,
          temperatureCelsius: Number(c.temp) || 36.5,
          interventions: c.interventions,
          chiefComplaint: c.chiefComplaint.trim(),
          narrative: `${c.narrative.trim()}${
            c.receivingHospital ? ` | Receiving Facility: ${c.receivingHospital}` : ''
          }`.trim()
        };

        const res = await submitPcrRecord(payload);
        if (res.data) {
          lastSavedRecord = res.data;
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('resqtrack:report', {
            detail: {
              type: 'PCR_MULTI_CASUALTY_RECORD',
              reportId,
              casualtyCount: casualties.length,
              casualties,
              timestamp: formatDateTimeWithSecondsAmPm(new Date())
            }
          })
        );
      }

      if (lastSavedRecord) {
        onSuccess?.(lastSavedRecord, casualties);
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to store Patient Care Record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Patient Care Record (PCR)"
      subtitle={
        reportId
          ? `Incident: ${reportId}`
          : `Casualties: ${casualties.length}`
      }
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Multi-Casualty Switcher & "+ Add Casualty" Bar */}
        <div className="p-3.5 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#670626]">
              <Users className="w-4 h-4 text-[#A83B4D]" />
              <span>
                Casualties ({casualties.length})
              </span>
            </div>
            <Button
              type="button"
              variant="soft-blue"
              size="xs"
              onClick={handleAddNewPcrVital}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              + Add Casualty
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {casualties.map((c, idx) => {
              const isSelected = idx === activeCasualtyIndex;
              return (
                <div
                  key={c.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all ${
                    isSelected
                      ? 'bg-[#670626] border-[#670626] text-[#F7F1EA] font-bold shadow-sm'
                      : 'bg-[#FFFBF7] border-[#D8C1B5] text-[#5C313E] hover:border-[#A83B4D]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCasualtyIndex(idx);
                      setAddedBannerMessage(null);
                    }}
                    className="cursor-pointer"
                  >
                    #{idx + 1}: {c.patientName.trim() || `Injured Civilian ${idx + 1}`}
                  </button>
                  {casualties.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCasualty(idx)}
                      className={`ml-1 cursor-pointer ${isSelected ? 'text-[#E9D9D0] hover:text-white' : 'text-[#7A4E59] hover:text-[#991B1B]'}`}
                      title="Remove casualty entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {addedBannerMessage && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-700" />
            <span>{addedBannerMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-300 rounded-xl text-[#991B1B] text-sm font-semibold">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-[#991B1B]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Patient Demographics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-sm font-bold text-[#670626] mb-1">
              Patient Full Name / Identity (Casualty #{activeCasualtyIndex + 1})
            </label>
            <input
              type="text"
              required
              value={currentCasualty.patientName}
              onChange={(e) => updateCurrentCasualty({ patientName: e.target.value })}
              placeholder="e.g. Juan dela Cruz (or John Doe / Trauma 01)"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Age</label>
            <input
              type="number"
              min={0}
              max={150}
              value={currentCasualty.age}
              onChange={(e) => updateCurrentCasualty({ age: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
        </div>

        {/* Gender, Consciousness & Receiving Hospital */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">Gender</label>
            <select
              value={currentCasualty.gender}
              onChange={(e) => updateCurrentCasualty({ gender: e.target.value })}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unknown">Unidentified</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">
              Level of Consciousness (AVPU)
            </label>
            <select
              value={currentCasualty.levelOfConsciousness}
              onChange={(e) => updateCurrentCasualty({ levelOfConsciousness: e.target.value })}
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] text-sm focus:outline-none focus:border-[#670626]"
            >
              <option value="Alert">Alert (Spontaneous Eye & Speech)</option>
              <option value="Verbal">Verbal (Responds to Voice)</option>
              <option value="Pain">Pain (Responds to Trapezius Squeeze)</option>
              <option value="Unresponsive">Unresponsive (No Response)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>Receiving Hospital / Facility</span>
            </label>
            <input
              type="text"
              value={currentCasualty.receivingHospital}
              onChange={(e) => updateCurrentCasualty({ receivingHospital: e.target.value })}
              placeholder="e.g. Zamboanga del Norte Medical Center"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
        </div>

        {/* Vitals Matrix */}
        <div className="p-3.5 bg-[#E9D9D0]/60 border border-[#D8C1B5] rounded-xl">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2 text-[#670626] text-sm font-bold uppercase tracking-wider">
              <Activity className="w-4 h-4 text-[#A83B4D]" />
              <span>Vitals (Person #{activeCasualtyIndex + 1})</span>
            </div>
            <span className="text-xs font-mono text-[#7A4E59]">
              {currentCasualty.recordedAt}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#5C313E] mb-1">BP (mmHg)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={currentCasualty.bpSystolic}
                  onChange={(e) => updateCurrentCasualty({ bpSystolic: Number(e.target.value) })}
                  className="w-1/2 px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#3B1722]"
                  placeholder="SYS"
                />
                <span className="text-[#7A4E59]">/</span>
                <input
                  type="number"
                  value={currentCasualty.bpDiastolic}
                  onChange={(e) => updateCurrentCasualty({ bpDiastolic: Number(e.target.value) })}
                  className="w-1/2 px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#3B1722]"
                  placeholder="DIA"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C313E] mb-1">Heart Rate (BPM)</label>
              <input
                type="number"
                value={currentCasualty.heartRate}
                onChange={(e) => updateCurrentCasualty({ heartRate: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#3B1722]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C313E] mb-1">SpO2 (%)</label>
              <input
                type="number"
                value={currentCasualty.spO2}
                onChange={(e) => updateCurrentCasualty({ spO2: Number(e.target.value) })}
                className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#3B1722]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#5C313E] mb-1">Resp Rate (/min)</label>
              <input
                type="number"
                value={currentCasualty.respiratoryRate}
                onChange={(e) =>
                  updateCurrentCasualty({ respiratoryRate: Number(e.target.value) })
                }
                className="w-full px-2 py-1.5 bg-[#FFFBF7] border border-[#D8C1B5] rounded-lg text-center text-sm text-[#3B1722]"
              />
            </div>
          </div>
        </div>

        {/* Interventions Checkchips */}
        <div>
          <label className="block text-sm font-bold text-[#670626] mb-1.5">
            Interventions Administered
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_INTERVENTIONS.map((item) => {
              const isSelected = currentCasualty.interventions.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  onClick={toggleIntervention(item)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1.5 border cursor-pointer font-semibold ${
                    isSelected
                      ? 'bg-[#670626] border-[#670626] text-[#F7F1EA]'
                      : 'bg-[#E9D9D0]/55 border-[#D8C1B5] text-[#5C313E] hover:text-[#670626] hover:border-[#A83B4D]'
                  }`}
                >
                  <Check
                    className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100 text-[#F7F1EA]' : 'opacity-25'}`}
                  />
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Narrative & Chief Complaint */}
        <div className="space-y-2.5">
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">
              Chief Complaint
            </label>
            <input
              type="text"
              value={currentCasualty.chiefComplaint}
              onChange={(e) => updateCurrentCasualty({ chiefComplaint: e.target.value })}
              placeholder="e.g. Lacerations, chest trauma"
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626]"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[#670626] mb-1">
              Field Narrative
            </label>
            <textarea
              rows={2}
              value={currentCasualty.narrative}
              onChange={(e) => updateCurrentCasualty({ narrative: e.target.value })}
              placeholder="Pre-hospital timeline and patient status..."
              className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-[#3B1722] placeholder-[#9B727D] text-sm focus:outline-none focus:border-[#670626] resize-none"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#E9D9D0]">
          <Button
            type="button"
            variant="soft-blue"
            size="sm"
            onClick={handleAddNewPcrVital}
            icon={<UserPlus className="w-4 h-4" />}
          >
            + Add Casualty
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="action-green"
              size="sm"
              isLoading={isSubmitting}
              icon={<HeartPulse className="w-4 h-4" />}
            >
              Save PCR Record
            </Button>
          </div>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};

export default PatientCareRecordModal;
