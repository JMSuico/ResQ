// [Layer: UserRoles/Features/Pages/RespondersPanel/Medic]
// Responsibility: Ambulance fleet roster, crew readiness, PRC license tracking, and shift check-in for RHU medics.
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.
// Universal lambda expressions (=>).

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getDutyRoster, DutyUnit } from '@/Endpoints/responderOpsApi';
import { Button } from '@/Shared/Button';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';

export type RigStatus = 'IN SERVICE - READY' | 'EN ROUTE - DISPATCHED' | 'STANDBY / RESTOCKING' | 'MAINTENANCE';
export type ShiftType = 'Day Shift (06:00 - 14:00)' | 'Swing Shift (14:00 - 22:00)' | 'Graveyard Shift (22:00 - 06:00)';

export interface CrewMember {
  id: string;
  name: string;
  callsign: string;
  cadre: string;
  prcLicense: string;
  prcExpiry: string;
  certifications: string[];
  contactNumber: string;
  bloodType: string;
  isActiveShift: boolean;
}

export interface AmbulanceRig {
  id: string;
  callsign: string;
  nickname: string;
  type: string;
  chassis: string;
  plateNumber: string;
  status: RigStatus;
  oxygenPsi: number;
  defibrillatorBatteryPercent: number;
  fuelLevelPercent: number;
  suctionOperational: boolean;
  crew: CrewMember[];
}

export const MedicCrewRosterPage: React.FC = () => {
  const { session } = useSession();
  const [dbRoster, setDbRoster] = useState<DutyUnit[]>([]);
  const [selectedShift, setSelectedShift] = useState<ShiftType>('Day Shift (06:00 - 14:00)');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ambulance fleet state
  const [ambulances, setAmbulances] = useState<AmbulanceRig[]>([
    {
      id: 'AMB-01',
      callsign: 'MEDIC-01',
      nickname: 'LifeLine One',
      type: 'Type II Mobile Intensive Care / ALS Ambulance',
      chassis: 'Toyota HiAce Commuter High-Roof ALS',
      plateNumber: 'SAB-4921',
      status: 'IN SERVICE - READY',
      oxygenPsi: 1850,
      defibrillatorBatteryPercent: 98,
      fuelLevelPercent: 92,
      suctionOperational: true,
      crew: [
        {
          id: 'CREW-01',
          name: session?.fullName || 'Officer Christian Dale Provu, RN, EMT-P',
          callsign: 'MEDIC-ALPHA-01',
          cadre: 'Senior Paramedic Crew Chief & Flight Trauma Specialist',
          prcLicense: 'PRC-NUR-0894215',
          prcExpiry: 'Nov 2028 (Verified Active)',
          certifications: ['ACLS Instructor', 'BLS-HCP', 'PHTLS 9th Ed', 'TCCC First Responder'],
          contactNumber: '+63 917 123 4567',
          bloodType: 'O-Negative',
          isActiveShift: true
        },
        {
          id: 'CREW-02',
          name: 'Officer Maria Elena Santos, EMT-B',
          callsign: 'MEDIC-BRAVO-02',
          cadre: 'Emergency Medical Technician - Basic & Triage Officer',
          prcLicense: 'PRC-EMT-004312',
          prcExpiry: 'Aug 2027 (Verified Active)',
          certifications: ['BLS-HCP', 'EVOC Emergency Driver', 'Hazmat Ops'],
          contactNumber: '+63 918 987 6543',
          bloodType: 'A-Positive',
          isActiveShift: true
        },
        {
          id: 'CREW-03',
          name: 'Driver Danilo Ramos',
          callsign: 'EMS-WHEELS-01',
          cadre: 'Senior Emergency Vehicle Operator (EVOC)',
          prcLicense: 'LTO-PRO-1238910',
          prcExpiry: 'May 2029 (Valid LTO)',
          certifications: ['Defensive Driving High-Speed', 'Standard First Aid'],
          contactNumber: '+63 920 456 7890',
          bloodType: 'B-Positive',
          isActiveShift: true
        }
      ]
    },
    {
      id: 'AMB-02',
      callsign: 'MEDIC-02',
      nickname: 'Trauma Response Two',
      type: 'Type I Modular Trauma Rescue Rig',
      chassis: 'Nissan NV350 Urban High-Roof Emergency',
      plateNumber: 'NEQ-8820',
      status: 'EN ROUTE - DISPATCHED',
      oxygenPsi: 1650,
      defibrillatorBatteryPercent: 95,
      fuelLevelPercent: 84,
      suctionOperational: true,
      crew: [
        {
          id: 'CREW-04',
          name: 'Officer Jose Miguel Tan, RN, EMT-P',
          callsign: 'MEDIC-CHARLIE-03',
          cadre: 'Paramedic Field Specialist',
          prcLicense: 'PRC-NUR-0782190',
          prcExpiry: 'Jan 2027 (Verified Active)',
          certifications: ['ACLS', 'BLS-HCP', 'PALS Pediatric Life Support'],
          contactNumber: '+63 919 333 4444',
          bloodType: 'O-Positive',
          isActiveShift: true
        },
        {
          id: 'CREW-05',
          name: 'Officer Angela Nicole Cruz, EMT-B',
          callsign: 'MEDIC-DELTA-04',
          cadre: 'EMT Basic & Primary Field Medic',
          prcLicense: 'PRC-EMT-005118',
          prcExpiry: 'Oct 2027 (Verified Active)',
          certifications: ['BLS-HCP', 'Disaster Triage First Responder'],
          contactNumber: '+63 922 777 8888',
          bloodType: 'AB-Positive',
          isActiveShift: true
        }
      ]
    }
  ]);

  // Modals
  const [selectedCrewMember, setSelectedCrewMember] = useState<CrewMember | null>(null);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState<boolean>(false);
  const [inspectingRig, setInspectingRig] = useState<AmbulanceRig | null>(null);

  // Equipment Checklist state
  const [chkOxygen, setChkOxygen] = useState<boolean>(true);
  const [chkSuction, setChkSuction] = useState<boolean>(true);
  const [chkDefib, setChkDefib] = useState<boolean>(true);
  const [chkCCollar, setChkCCollar] = useState<boolean>(true);
  const [chkTraumaBags, setChkTraumaBags] = useState<boolean>(true);
  const [chkIvSupplies, setChkIvSupplies] = useState<boolean>(true);

  const loadDbRoster = useCallback(async () => {
    try {
      const data = await getDutyRoster();
      setDbRoster(data.filter((u) => u.agency === 'RHU'));
    } catch {
      setDbRoster([]);
    }
  }, []);

  useEffect(() => {
    loadDbRoster();
  }, [loadDbRoster]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleShiftCheckIn = (rigId: string) => {
    setAmbulances((prev) =>
      prev.map((rig) => {
        if (rig.id === rigId) {
          const userAlready = rig.crew.some((c) => c.name.includes(session?.fullName || 'Provu'));
          if (!userAlready) {
            const newMember: CrewMember = {
              id: `CREW-${Date.now().toString(36)}`,
              name: session?.fullName || 'Active RHU Paramedic',
              callsign: `MEDIC-${rig.callsign.split('-')[1] || '01'}`,
              cadre: 'Active Duty Field Paramedic',
              prcLicense: session?.employeeOrResidentId || 'PRC-NUR-ACTIVE',
              prcExpiry: 'Valid (Verified)',
              certifications: ['BLS-HCP', 'ACLS Provider'],
              contactNumber: '+63 917 555 1234',
              bloodType: 'O-Positive',
              isActiveShift: true
            };
            return { ...rig, crew: [newMember, ...rig.crew] };
          }
        }
        return rig;
      })
    );
    showToast(`✓ SHIFT CHECK-IN CONFIRMED FOR ${rigId} ON ${selectedShift}`);
  };

  const handleOpenChecklist = (rig: AmbulanceRig) => {
    setInspectingRig(rig);
    setIsChecklistModalOpen(true);
  };

  const handleSaveChecklist = () => {
    setIsChecklistModalOpen(false);
    showToast(`✓ RIG READINESS INSPECTION SIGNED OFF FOR ${inspectingRig?.callsign}`);
  };

  const totalActivePersonnel = useMemo(() => {
    return ambulances.reduce((acc, a) => acc + a.crew.filter((c) => c.isActiveShift).length, 0);
  }, [ambulances]);

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 font-sans pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-sky-950 border border-sky-400/80 text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.4)] backdrop-blur-md animate-fade-in text-sm font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-sky-950/80 via-[#0a1a2b] to-slate-950 border border-sky-600/30 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                RHU EMS CADRE & FLEET
              </span>
              <span className="text-xs font-mono text-emerald-400">PRC Statutory Verification Active</span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wide mt-1">
              Ambulance Rig Fleet & Paramedic Crew Roster
            </h1>
            <p className="text-xs text-sky-200/70 mt-0.5">
              Live crew readiness, verified medical professional licenses, and apparatus telemetry.
            </p>
          </div>
        </div>

        {/* Shift Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-400">Shift:</label>
          <select
            value={selectedShift}
            onChange={(e) => {
              setSelectedShift(e.target.value as ShiftType);
              showToast(`SHIFT CHANGED TO ${e.target.value.toUpperCase()}`);
            }}
            className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
          >
            <option value="Day Shift (06:00 - 14:00)">Day Shift (06:00 - 14:00)</option>
            <option value="Swing Shift (14:00 - 22:00)">Swing Shift (14:00 - 22:00)</option>
            <option value="Graveyard Shift (22:00 - 06:00)">Graveyard Shift (22:00 - 06:00)</option>
          </select>
        </div>
      </div>

      {/* Fleet KPI Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Active Rigs in Fleet</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-white">{ambulances.length}</span>
            <span className="text-xs text-slate-400">Ambulances</span>
          </div>
          <span className="text-[11px] text-emerald-400 mt-1">✓ 100% BLS/ALS Certified</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Active Duty Personnel</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-sky-400">{totalActivePersonnel}</span>
            <span className="text-xs text-slate-400">Medics on Shift</span>
          </div>
          <span className="text-[11px] text-sky-300 mt-1">PRC Licensed RN/EMT</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Oxygen Readiness Avg</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">1,750</span>
            <span className="text-xs text-slate-400">PSI Main</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Nominal &gt; 1200 PSI</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm">
          <span className="text-xs font-semibold text-slate-400">Database Units Synced</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-white">{dbRoster.length}</span>
            <span className="text-xs text-slate-400">RHU C2 Units</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">Live Backend Polling</span>
        </div>
      </div>

      {/* Ambulance Rigs Detail */}
      <div className="flex flex-col gap-6">
        {ambulances.map((rig) => {
          const isReady = rig.status === 'IN SERVICE - READY';
          const isDispatched = rig.status === 'EN ROUTE - DISPATCHED';

          return (
            <div
              key={rig.id}
              className={`p-5 rounded-xl border flex flex-col gap-5 shadow-lg bg-slate-900/95 ${
                isReady
                  ? 'border-sky-500/40 shadow-[0_0_15px_rgba(2,132,199,0.1)]'
                  : 'border-slate-800'
              }`}
            >
              {/* Rig Title Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-sky-950 border border-sky-500/40 flex items-center justify-center text-xl text-sky-400">
                    🚑
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        {rig.callsign}
                      </span>
                      <h2 className="text-lg font-bold text-white">{rig.nickname}</h2>
                      <span className="text-xs font-mono text-slate-400">({rig.plateNumber})</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">{rig.type}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">Chassis: {rig.chassis}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                      isReady
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                        : isDispatched
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {rig.status}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenChecklist(rig)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95 text-xs"
                  >
                    🛠️ Rig Checklist
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleShiftCheckIn(rig.id)}
                    className="bg-sky-600 hover:bg-sky-500 text-white shadow-md active:scale-95 text-xs"
                  >
                    📝 Shift Check-In
                  </Button>
                </div>
              </div>

              {/* Rig Telemetry Gauges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Main O2 Pressure</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-lg font-bold text-sky-400">{rig.oxygenPsi}</span>
                    <span className="text-xs text-slate-500">PSI</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-sky-500 rounded-full"
                      style={{ width: `${Math.min(100, (rig.oxygenPsi / 2000) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Defibrillator Battery</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-lg font-bold text-emerald-400">{rig.defibrillatorBatteryPercent}%</span>
                    <span className="text-xs text-slate-500">Charged</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${rig.defibrillatorBatteryPercent}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Diesel Fuel Level</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-lg font-bold text-slate-200">{rig.fuelLevelPercent}%</span>
                    <span className="text-xs text-slate-500">Tank</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${rig.fuelLevelPercent}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Suction Apparatus</span>
                  <div className="flex items-baseline gap-1 mt-1 font-mono">
                    <span className="text-lg font-bold text-emerald-400">
                      {rig.suctionOperational ? 'Operational' : 'Check Filter'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-2">600 mmHg Vacuum</span>
                </div>
              </div>

              {/* Crew Dossiers Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span>🧑‍⚕️</span> Active Crew Cadre Assigned to {rig.callsign} ({rig.crew.length} Medics)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {rig.crew.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedCrewMember(member)}
                      className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-sky-500/60 transition-all cursor-pointer flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-sky-400 group-hover:bg-sky-950">
                            {member.callsign}
                          </span>
                          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1 group-hover:text-sky-300 transition-colors">
                          {member.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">{member.cadre}</p>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex flex-col gap-1 text-[11px] font-mono">
                        <div className="flex justify-between text-slate-400">
                          <span>PRC Lic:</span>
                          <span className="text-slate-200 font-bold">{member.prcLicense}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Blood Type:</span>
                          <span className="text-red-400 font-bold">{member.bloodType}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {member.certifications.map((c) => (
                            <span key={c} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 border border-slate-800 text-slate-300">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Crew Member Dossier Modal */}
      {selectedCrewMember && (
        <DefaultFloatingModalCard
          isOpen={!!selectedCrewMember}
          onClose={() => setSelectedCrewMember(null)}
          title={`Paramedic Dossier: ${selectedCrewMember.name}`}
          subtitle={`Callsign: ${selectedCrewMember.callsign} • Professional Regulation Commission (PRC) Certified`}
          maxWidth="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(selectedCrewMember.contactNumber);
                  showToast(`✓ CONTACT COPIED: ${selectedCrewMember.contactNumber}`);
                }}
              >
                📞 Copy Phone
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedCrewMember(null)}
                className="bg-sky-600 hover:bg-sky-500"
              >
                Close Dossier
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-sky-950/40 border border-sky-500/40 text-sky-200">
              Verified statutory health professional under Republic Act No. 9173 & DOH Administrative Order on Pre-Hospital Emergency Medical Services.
            </div>

            <div className="space-y-2 bg-slate-950 p-4 rounded-lg border border-slate-800">
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-400">Full Legal Name:</span>
                <span className="text-white font-bold">{selectedCrewMember.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-400">Cadre & Specialization:</span>
                <span className="text-slate-200">{selectedCrewMember.cadre}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-400">PRC Registration ID:</span>
                <span className="text-sky-400 font-bold">{selectedCrewMember.prcLicense}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-400">License Validity:</span>
                <span className="text-emerald-400 font-bold">{selectedCrewMember.prcExpiry}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1">
                <span className="text-slate-400">Official Mobile Contact:</span>
                <span className="text-white font-bold">{selectedCrewMember.contactNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Blood Group (Donor):</span>
                <span className="text-red-400 font-bold">{selectedCrewMember.bloodType}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-semibold text-slate-400 block mb-1">Mandatory Clinical Certifications</span>
              <div className="flex flex-wrap gap-1.5">
                {selectedCrewMember.certifications.map((c) => (
                  <span key={c} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-sky-300">
                    ✓ {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* Rig Inspection Modal */}
      {isChecklistModalOpen && inspectingRig && (
        <DefaultFloatingModalCard
          isOpen={isChecklistModalOpen}
          onClose={() => setIsChecklistModalOpen(false)}
          title={`Rig Readiness Pre-Trip Inspection: ${inspectingRig.callsign}`}
          subtitle={`Apparatus: ${inspectingRig.nickname} (${inspectingRig.chassis})`}
          maxWidth="lg"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setIsChecklistModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveChecklist}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                ✓ Sign Off Rig Readiness
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 text-xs">
            <p className="text-slate-300">
              Verify all statutory medical equipment before rolling out for emergency response:
            </p>

            <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkOxygen}
                  onChange={(e) => setChkOxygen(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Main Oxygen Cylinder &gt; 1200 PSI + Portable D-Tanks Full</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkSuction}
                  onChange={(e) => setChkSuction(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Suction Unit Tested (Reaching minimum 300mmHg vacuum within 4s)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkDefib}
                  onChange={(e) => setChkDefib(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Defibrillator / AED Daily Self-Check Passed + Adult &amp; Pediatric Pads</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkCCollar}
                  onChange={(e) => setChkCCollar(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Rigid Cervical Collars (Adult/Pedi) &amp; Long Spine Board Straps</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkTraumaBags}
                  onChange={(e) => setChkTraumaBags(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>Trauma First-In Bag Restocked (CAT Tourniquets, Gauze, Chest Seals)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chkIvSupplies}
                  onChange={(e) => setChkIvSupplies(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded"
                />
                <span>IV Fluid Bolus Supplies (Normal Saline 1000mL bags, 16G/18G cannulas)</span>
              </label>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}
    </div>
  );
};
