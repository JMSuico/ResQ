// [Layer: Shared]
// PatientCareRecordModal.tsx -- RHU Paramedic Patient Care Record (PCR) and trauma vitals entry modal.
// Universal lambda expressions (=>). Strictly typed with zero 'any' and 100% pure Lucide icons.

import React, { FC, useState } from 'react';
import { HeartPulse, Activity, Check, FileText, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { submitPcrRecord, PatientCareRecord, CreatePcrPayload } from '../Endpoints/responderOpsApi';

export interface PatientCareRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId?: string;
  onSuccess?: (pcr: PatientCareRecord) => void;
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

export const PatientCareRecordModal: FC<PatientCareRecordModalProps> = ({
  isOpen,
  onClose,
  reportId,
  onSuccess
}) => {
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState<number>(28);
  const [gender, setGender] = useState('Male');
  const [levelOfConsciousness, setLevelOfConsciousness] = useState('Alert');
  const [bpSystolic, setBpSystolic] = useState<number>(120);
  const [bpDiastolic, setBpDiastolic] = useState<number>(80);
  const [heartRate, setHeartRate] = useState<number>(78);
  const [respiratoryRate, setRespiratoryRate] = useState<number>(16);
  const [spO2, setSpO2] = useState<number>(98);
  const [glucose, setGlucose] = useState<number>(105);
  const [temp, setTemp] = useState<number>(36.8);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [narrative, setNarrative] = useState('');
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleIntervention = (item: string) => () =>
    setSelectedInterventions(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim()) {
      setErrorMessage('Patient full name or unidentified identifier is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload: CreatePcrPayload = {
        reportId: reportId || undefined,
        patientName: patientName.trim(),
        age: Number(age) || 0,
        gender,
        levelOfConsciousness,
        bloodPressureSystolic: Number(bpSystolic) || 120,
        bloodPressureDiastolic: Number(bpDiastolic) || 80,
        heartRateBpm: Number(heartRate) || 80,
        respiratoryRate: Number(respiratoryRate) || 16,
        spO2Percent: Number(spO2) || 98,
        bloodGlucoseMgDl: Number(glucose) || 100,
        temperatureCelsius: Number(temp) || 36.5,
        interventions: selectedInterventions,
        chiefComplaint: chiefComplaint.trim(),
        narrative: narrative.trim()
      };

      const res = await submitPcrRecord(payload);
      if (res.data) {
        onSuccess?.(res.data);
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
      title="Patient Care Record (PCR) & Trauma Vitals"
      subtitle={reportId ? `Linked Incident: ${reportId.slice(0, 8)}...` : 'Pre-Hospital Triage Record'}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 bg-rose-950/80 border border-rose-800 rounded text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Patient Demographics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Patient Full Name / Identity
            </label>
            <input
              type="text"
              required
              value={patientName}
              onChange={e => setPatientName(e.target.value)}
              placeholder="e.g. Juan dela Cruz (or John Doe / Trauma 01)"
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Age</label>
            <input
              type="number"
              min={0}
              max={150}
              value={age}
              onChange={e => setAge(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
        </div>

        {/* Gender & Consciousness */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unknown">Unidentified</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Level of Consciousness (AVPU)</label>
            <select
              value={levelOfConsciousness}
              onChange={e => setLevelOfConsciousness(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
            >
              <option value="Alert">Alert (Spontaneous Eye & Speech)</option>
              <option value="Verbal">Verbal (Responds to Voice)</option>
              <option value="Pain">Pain (Responds to Trapezius Squeeze)</option>
              <option value="Unresponsive">Unresponsive (No Response)</option>
            </select>
          </div>
        </div>

        {/* Vitals Matrix */}
        <div className="p-3 bg-slate-950/70 border border-rose-950/80 rounded-lg">
          <div className="flex items-center gap-2 mb-2 text-rose-400 text-xs font-semibold uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5" />
            <span>Pre-Hospital Vitals Telemetry</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">BP (mmHg)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={bpSystolic}
                  onChange={e => setBpSystolic(Number(e.target.value))}
                  className="w-1/2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                  placeholder="SYS"
                />
                <span className="text-slate-500">/</span>
                <input
                  type="number"
                  value={bpDiastolic}
                  onChange={e => setBpDiastolic(Number(e.target.value))}
                  className="w-1/2 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
                  placeholder="DIA"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">Heart Rate (BPM)</label>
              <input
                type="number"
                value={heartRate}
                onChange={e => setHeartRate(Number(e.target.value))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">SpO2 (%)</label>
              <input
                type="number"
                value={spO2}
                onChange={e => setSpO2(Number(e.target.value))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">Resp Rate (/min)</label>
              <input
                type="number"
                value={respiratoryRate}
                onChange={e => setRespiratoryRate(Number(e.target.value))}
                className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* Interventions Checkchips */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Administered Medical Interventions
          </label>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_INTERVENTIONS.map(item => {
              const isSelected = selectedInterventions.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  onClick={toggleIntervention(item)}
                  className={`px-2.5 py-1 text-xs rounded transition-colors flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-rose-950/80 border-rose-700 text-rose-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Check className={`w-3 h-3 ${isSelected ? 'opacity-100 text-rose-400' : 'opacity-20'}`} />
                  <span>{item}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Narrative & Chief Complaint */}
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Chief Complaint</label>
            <input
              type="text"
              value={chiefComplaint}
              onChange={e => setChiefComplaint(e.target.value)}
              placeholder="e.g. Multiple lacerations, blunt chest trauma following motorcycle collision"
              className="w-full px-3 py-1.5 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Clinical Field Narrative</label>
            <textarea
              rows={3}
              value={narrative}
              onChange={e => setNarrative(e.target.value)}
              placeholder="Detailed pre-hospital timeline, patient status change during transit..."
              className="w-full px-3 py-2 bg-slate-900/90 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
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
            Store Patient Care Record
          </Button>
        </div>
      </form>
    </DefaultFloatingModalCard>
  );
};
