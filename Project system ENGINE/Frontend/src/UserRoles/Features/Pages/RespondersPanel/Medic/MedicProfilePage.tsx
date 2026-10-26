// [Layer: UserRoles/Features/Pages/RespondersPanel/Medic]
// Responsibility: Professional paramedic profile, PRC statutory medical licenses, certifications, and shift logs.
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.
// Universal lambda expressions (=>).

import React, { useState, useMemo } from 'react';
import { useSession } from '@/Hooks/useSession';
import { Button } from '@/Shared/Button';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';

export interface ShiftLogEntry {
  id: string;
  incidentRef: string;
  category: string;
  receivingFacility: string;
  outcome: string;
  date: string;
  durationMins: number;
}

export const MedicProfilePage: React.FC = () => {
  const { session } = useSession();
  const [isOnCall, setIsOnCall] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Editable bio contacts
  const [emergencyContactName, setEmergencyContactName] = useState<string>('Dr. Eleanor Provu (Spouse)');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState<string>('+63 917 555 9876');
  const [bloodType] = useState<string>('O-Negative (Universal Donor)');
  const [allergies] = useState<string>('NKDA (No Known Drug Allergies)');

  const [isEditContactModalOpen, setIsEditContactModalOpen] = useState<boolean>(false);
  const [tempContactName, setTempContactName] = useState<string>(emergencyContactName);
  const [tempContactPhone, setTempContactPhone] = useState<string>(emergencyContactPhone);

  const [shiftLogs] = useState<ShiftLogEntry[]>([
    {
      id: 'LOG-881',
      incidentRef: 'MED-2026-X992',
      category: 'Vehicular Accident (Head Trauma)',
      receivingFacility: 'Zamboanga del Norte Medical Center (ZNMC)',
      outcome: 'Trauma Bay Stabilized & Admitted',
      date: 'Oct 26, 2026 • 11:34 AM',
      durationMins: 38
    },
    {
      id: 'LOG-880',
      incidentRef: 'MED-2026-X981',
      category: 'Cardiac Arrest (ROSC Achieved)',
      receivingFacility: 'Zamboanga del Norte Medical Center (ZNMC)',
      outcome: 'ROSC Maintained post-Defib (Admitted to ICU)',
      date: 'Oct 25, 2026 • 04:12 PM',
      durationMins: 52
    },
    {
      id: 'LOG-879',
      incidentRef: 'MED-2026-X974',
      category: 'Pedestrian Hit (Lower Extremity Fracture)',
      receivingFacility: 'Corazon C. Aquino Memorial Hospital',
      outcome: 'Splinted & Transferred to Orthopedics',
      date: 'Oct 24, 2026 • 08:45 AM',
      durationMins: 29
    },
    {
      id: 'LOG-878',
      incidentRef: 'MED-2026-X960',
      category: 'Severe Respiratory Distress (Asthma/COPD)',
      receivingFacility: 'Dipolog City Health Center / RHU Main',
      outcome: 'Nebulized & Stabilized (Discharged)',
      date: 'Oct 23, 2026 • 02:18 PM',
      durationMins: 45
    }
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleOnCall = () => {
    setIsOnCall((prev) => !prev);
    showToast(`ON-CALL EMERGENCY STATUS: ${!isOnCall ? 'ACTIVE' : 'OFF-DUTY STANDBY'}`);
  };

  const handleSaveContact = () => {
    setEmergencyContactName(tempContactName);
    setEmergencyContactPhone(tempContactPhone);
    setIsEditContactModalOpen(false);
    showToast('✓ EMERGENCY CONTACT INFORMATION UPDATED');
  };

  const totalRuns = shiftLogs.length + 142; // Historical baseline

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 font-sans pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-sky-950 border border-sky-400/80 text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.4)] backdrop-blur-md animate-fade-in text-sm font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          {toastMessage}
        </div>
      )}

      {/* Profile Hero Header */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-sky-950/90 via-[#0a1a2b] to-slate-950 border border-sky-600/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar with Verified Ring */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-sky-600/20 border-2 border-sky-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(56,189,248,0.3)]">
              🧑‍⚕️
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center text-[10px] text-white font-bold" title="Face & PRC Biometrics Verified">
              ✓
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
                VERIFIED RHU EMS RESPONDER
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                FACE VERIFIED (100% MATCH)
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-white mt-1.5 tracking-wide">
              {session?.fullName || 'Officer Christian Dale Provu, RN, EMT-P'}
            </h1>

            <p className="text-xs text-sky-200/80 mt-0.5 font-mono">
              Callsign: <strong>RHU-MEDIC-042</strong> • AMB-01 Crew Chief • Senior Paramedic Flight Specialist
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Dipolog City Rural Health Unit • Bureau of Emergency Medical Services
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleOnCall}
            className={`border font-mono text-xs active:scale-95 ${
              isOnCall
                ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
            {isOnCall ? '🟢 STATUS: ON-CALL ACTIVE' : '⚪ STATUS: OFF-DUTY'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setTempContactName(emergencyContactName);
              setTempContactPhone(emergencyContactPhone);
              setIsEditContactModalOpen(true);
            }}
            className="bg-sky-600 hover:bg-sky-500 text-white shadow-md active:scale-95 text-xs"
          >
            ⚙️ Edit Emergency Contacts
          </Button>
        </div>
      </div>

      {/* Performance KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Total Pre-Hospital Runs</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-white">{totalRuns}</span>
            <span className="text-xs text-slate-400">Dispatches</span>
          </div>
          <span className="text-[11px] text-emerald-400 mt-1">✓ 100% PCR Submissions</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Avg ER Transit Time</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-sky-400">6.8</span>
            <span className="text-xs text-slate-400">Minutes</span>
          </div>
          <span className="text-[11px] text-sky-300 mt-1">Code 3 Siren Navigation</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Cardiac ROSC Rate</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">98.4%</span>
            <span className="text-xs text-slate-400">Stabilized</span>
          </div>
          <span className="text-[11px] text-emerald-400 mt-1">High-Performance CPR</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Monthly Duty Hours</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-white">168.0</span>
            <span className="text-xs text-slate-400">Hours</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Shift Compliance 100%</span>
        </div>
      </div>

      {/* Main Content Grid: Credentials Dossier & Shift Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Statutory PRC License & Certifications */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Statutory PRC License Card */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                <span>🪪</span> PRC Statutory Medical License
              </h2>
              <span className="text-xs font-mono text-emerald-400">Valid &amp; Active</span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-sky-950 via-slate-900 to-slate-950 border border-sky-500/40 shadow-inner flex flex-col gap-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-sky-300 font-bold">Republic of the Philippines</span>
                <span className="text-[10px] text-slate-400">Professional Regulation Commission</span>
              </div>

              <div className="border-t border-sky-500/30 pt-2 flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400">License ID:</span>
                  <span className="text-white font-extrabold text-sm">PRC-NUR-0894215</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profession:</span>
                  <span className="text-sky-300 font-bold">Registered Nurse (RN) / EMT-P</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Expiration Date:</span>
                  <span className="text-emerald-400 font-bold">November 28, 2028</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Statutory Authority:</span>
                  <span className="text-slate-200">Board of Nursing / DOH HEMB</span>
                </div>
              </div>
            </div>

            {/* Certifications List */}
            <div className="flex flex-col gap-2 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Active Life Support Certifications
              </h3>

              <div className="flex flex-col gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-white font-bold block">ACLS Instructor &amp; Provider</span>
                    <span className="text-[10px] text-slate-400">American Heart Association (AHA)</span>
                  </div>
                  <span className="text-emerald-400 font-bold">Exp: 2027</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-white font-bold block">PHTLS 9th Edition Trauma</span>
                    <span className="text-[10px] text-slate-400">National Association of EMTs (NAEMT)</span>
                  </div>
                  <span className="text-emerald-400 font-bold">Exp: 2028</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-white font-bold block">BLS for Healthcare Providers</span>
                    <span className="text-[10px] text-slate-400">Philippine Red Cross / AHA</span>
                  </div>
                  <span className="text-emerald-400 font-bold">Exp: 2027</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-white font-bold block">TCCC Tactical Combat Casualty Care</span>
                    <span className="text-[10px] text-slate-400">Military &amp; Tactical EMS Alliance</span>
                  </div>
                  <span className="text-emerald-400 font-bold">Exp: 2029</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Bio-Data & Emergency Medical Profile */}
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col gap-3 font-mono text-xs">
            <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2 border-b border-slate-800 pb-2">
              <span>🩺</span> Medic Bio-Data &amp; Emergency Contacts
            </h2>

            <div className="space-y-2 pt-1">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Blood Type (Donor):</span>
                <span className="text-red-400 font-bold">{bloodType}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Allergies / Flags:</span>
                <span className="text-emerald-400 font-bold">{allergies}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Emergency Contact:</span>
                <span className="text-white font-bold">{emergencyContactName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400">Contact Hotline:</span>
                <span className="text-sky-300 font-bold">{emergencyContactPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Medical Director:</span>
                <span className="text-slate-300">Dr. R. Lim, MD • (065) 212-8822</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Historical Shift Runs & Pre-Hospital Activity Log */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                  <span>📋</span> Pre-Hospital Emergency Mission Audit Logs
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Verifiable electronic care records logged under active medic session
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">{shiftLogs.length} Recent Runs</span>
            </div>

            <div className="flex flex-col gap-3">
              {shiftLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        {log.incidentRef}
                      </span>
                      <h3 className="text-xs font-bold text-white">{log.category}</h3>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">{log.date}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono mt-1">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Receiving Facility:</span>
                      <span className="text-slate-200 font-bold">{log.receivingFacility}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Patient Outcome:</span>
                      <span className="text-emerald-400 font-semibold">{log.outcome}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/40 text-[11px] font-mono text-slate-400">
                    <span>Mission Duration: <strong className="text-white">{log.durationMins} mins</strong></span>
                    <button
                      type="button"
                      onClick={() => showToast(`INSPECTING PCR TRANSCRIPT FOR ${log.incidentRef}`)}
                      className="text-sky-400 hover:text-sky-300 hover:underline"
                    >
                      View Digital PCR ↗
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Contacts Modal */}
      {isEditContactModalOpen && (
        <DefaultFloatingModalCard
          isOpen={isEditContactModalOpen}
          onClose={() => setIsEditContactModalOpen(false)}
          title="Update Medic Emergency Contacts"
          subtitle="Direct emergency notification line for active responder"
          maxWidth="md"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setIsEditContactModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveContact}
                className="bg-sky-600 hover:bg-sky-500 text-white"
              >
                Save Contact
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-xs">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Emergency Contact Name &amp; Relationship
              </label>
              <input
                type="text"
                value={tempContactName}
                onChange={(e) => setTempContactName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Emergency Contact Mobile Phone
              </label>
              <input
                type="text"
                value={tempContactPhone}
                onChange={(e) => setTempContactPhone(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono"
              />
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}
    </div>
  );
};
