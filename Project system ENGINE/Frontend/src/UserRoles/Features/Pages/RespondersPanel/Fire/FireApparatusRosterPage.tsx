// [Layer: UserRoles/Features/Pages/RespondersPanel/Fire]
// Responsibility: Engine Company Shift Roster & Firefighter Apparatus Assignment Tracking.
// Features: BFP Rank Hierarchy (FO1 to CINSP), Badge Numbers, Apparatus Crew Roles,
// Specialized Qualifications (HAZMAT, SAR, PUMP, EMT, ARSON), and Real-time Duty Status Toggles.
// Katipuneros Architecture: Strict typing, universal lambda syntax (=>), ZERO 'any' usage.

import React, { useState, useMemo } from 'react';

// --------------------------------------------------------------------------
// Types & Contracts
// --------------------------------------------------------------------------

export type BfpRank =
  | 'CINSP'
  | 'SINSP'
  | 'INSP'
  | 'SFO4'
  | 'SFO3'
  | 'SFO2'
  | 'SFO1'
  | 'FO3'
  | 'FO2'
  | 'FO1';

export type ApparatusRole =
  | 'Incident Commander'
  | 'Shift Commander'
  | 'Lead Arson Investigator'
  | 'Driver / Pump Operator'
  | 'Lead Nozzleman'
  | 'Backup Nozzleman'
  | 'Hydrantman / Supply'
  | 'Ventilation & Entry'
  | 'Rescue Specialist';

export type RosterDutyStatus =
  | 'ON DUTY'
  | 'DISPATCHED'
  | 'STANDBY'
  | 'TRAINING'
  | 'OFF DUTY';

export interface FirePersonnel {
  id: string;
  badgeNumber: string;
  fullName: string;
  rank: BfpRank;
  rankTitle: string;
  shift: 'Shift A' | 'Shift B' | 'Shift C';
  assignedApparatus: 'Engine 01' | 'Engine 02 (Tender)' | 'Ladder 01' | 'Rescue 01' | 'HQ Command';
  apparatusRole: ApparatusRole;
  status: RosterDutyStatus;
  qualifications: Array<'HAZMAT' | 'SAR' | 'PUMP' | 'EMT' | 'ARSON' | 'SCUBA'>;
  yearsOfService: number;
  contactCallsign: string;
  scbaCertified: boolean;
}

// --------------------------------------------------------------------------
// BFP Dipolog Central Fire Station Crew Dataset
// --------------------------------------------------------------------------
export const BFP_PERSONNEL_ROSTER: FirePersonnel[] = [
  {
    id: 'BFP-001',
    badgeNumber: 'BFP-92810',
    fullName: 'Eduardo M. Ramirez',
    rank: 'CINSP',
    rankTitle: 'Chief Inspector (City Fire Marshal)',
    shift: 'Shift A',
    assignedApparatus: 'HQ Command',
    apparatusRole: 'Incident Commander',
    status: 'ON DUTY',
    qualifications: ['ARSON', 'HAZMAT', 'SAR'],
    yearsOfService: 18,
    contactCallsign: 'DIPOLOG-MARSHAL-1',
    scbaCertified: true
  },
  {
    id: 'BFP-002',
    badgeNumber: 'BFP-88421',
    fullName: 'Roberto A. Gomez',
    rank: 'INSP',
    rankTitle: 'Inspector (Station Commander)',
    shift: 'Shift A',
    assignedApparatus: 'Engine 01',
    apparatusRole: 'Shift Commander',
    status: 'ON DUTY',
    qualifications: ['PUMP', 'HAZMAT', 'EMT'],
    yearsOfService: 12,
    contactCallsign: 'COMMANDER-A',
    scbaCertified: true
  },
  {
    id: 'BFP-003',
    badgeNumber: 'BFP-77319',
    fullName: 'Mark Kenneth Dela Cruz',
    rank: 'SFO2',
    rankTitle: 'Senior Fire Officer 2',
    shift: 'Shift A',
    assignedApparatus: 'HQ Command',
    apparatusRole: 'Lead Arson Investigator',
    status: 'ON DUTY',
    qualifications: ['ARSON', 'SAR'],
    yearsOfService: 10,
    contactCallsign: 'INVESTIGATOR-1',
    scbaCertified: true
  },
  {
    id: 'BFP-004',
    badgeNumber: 'BFP-66280',
    fullName: 'Vicente J. Tan',
    rank: 'FO3',
    rankTitle: 'Fire Officer 3 (Pump Operator)',
    shift: 'Shift A',
    assignedApparatus: 'Engine 01',
    apparatusRole: 'Driver / Pump Operator',
    status: 'ON DUTY',
    qualifications: ['PUMP', 'HAZMAT'],
    yearsOfService: 7,
    contactCallsign: 'OPERATOR-01',
    scbaCertified: true
  },
  {
    id: 'BFP-005',
    badgeNumber: 'BFP-55194',
    fullName: 'Arnel C. Macalisang',
    rank: 'FO2',
    rankTitle: 'Fire Officer 2',
    shift: 'Shift A',
    assignedApparatus: 'Engine 01',
    apparatusRole: 'Lead Nozzleman',
    status: 'ON DUTY',
    qualifications: ['SAR', 'EMT'],
    yearsOfService: 5,
    contactCallsign: 'NOZZLE-1',
    scbaCertified: true
  },
  {
    id: 'BFP-006',
    badgeNumber: 'BFP-44021',
    fullName: 'Danilo P. Villar',
    rank: 'FO1',
    rankTitle: 'Fire Officer 1',
    shift: 'Shift A',
    assignedApparatus: 'Engine 01',
    apparatusRole: 'Backup Nozzleman',
    status: 'ON DUTY',
    qualifications: ['SAR'],
    yearsOfService: 3,
    contactCallsign: 'HOSE-1',
    scbaCertified: true
  },
  {
    id: 'BFP-007',
    badgeNumber: 'BFP-44189',
    fullName: 'Christian B. Real',
    rank: 'FO1',
    rankTitle: 'Fire Officer 1',
    shift: 'Shift A',
    assignedApparatus: 'Engine 01',
    apparatusRole: 'Hydrantman / Supply',
    status: 'ON DUTY',
    qualifications: ['PUMP'],
    yearsOfService: 2,
    contactCallsign: 'HYDRANT-1',
    scbaCertified: true
  },
  {
    id: 'BFP-008',
    badgeNumber: 'BFP-66512',
    fullName: 'Reynaldo S. Alcantara',
    rank: 'FO3',
    rankTitle: 'Fire Officer 3',
    shift: 'Shift A',
    assignedApparatus: 'Engine 02 (Tender)',
    apparatusRole: 'Driver / Pump Operator',
    status: 'ON DUTY',
    qualifications: ['PUMP'],
    yearsOfService: 8,
    contactCallsign: 'TENDER-DRIVER',
    scbaCertified: true
  },
  {
    id: 'BFP-009',
    badgeNumber: 'BFP-77402',
    fullName: 'Joseph E. Barbaso',
    rank: 'SFO1',
    rankTitle: 'Senior Fire Officer 1',
    shift: 'Shift A',
    assignedApparatus: 'Ladder 01',
    apparatusRole: 'Ventilation & Entry',
    status: 'STANDBY',
    qualifications: ['SAR', 'PUMP'],
    yearsOfService: 9,
    contactCallsign: 'LADDER-LEAD',
    scbaCertified: true
  },
  {
    id: 'BFP-010',
    badgeNumber: 'BFP-55823',
    fullName: 'Rodel M. Cabigas',
    rank: 'FO2',
    rankTitle: 'Fire Officer 2',
    shift: 'Shift A',
    assignedApparatus: 'Rescue 01',
    apparatusRole: 'Rescue Specialist',
    status: 'ON DUTY',
    qualifications: ['SAR', 'EMT', 'SCUBA'],
    yearsOfService: 6,
    contactCallsign: 'RESCUE-TECH-1',
    scbaCertified: true
  },
  {
    id: 'BFP-011',
    badgeNumber: 'BFP-88190',
    fullName: 'Manuel L. Roxas',
    rank: 'SINSP',
    rankTitle: 'Senior Inspector (Deputy Marshal)',
    shift: 'Shift B',
    assignedApparatus: 'HQ Command',
    apparatusRole: 'Shift Commander',
    status: 'OFF DUTY',
    qualifications: ['ARSON', 'HAZMAT'],
    yearsOfService: 14,
    contactCallsign: 'COMMANDER-B',
    scbaCertified: true
  },
  {
    id: 'BFP-012',
    badgeNumber: 'BFP-66440',
    fullName: 'Crisanto B. Yu',
    rank: 'FO3',
    rankTitle: 'Fire Officer 3',
    shift: 'Shift B',
    assignedApparatus: 'Engine 01',
    apparatusRole: 'Driver / Pump Operator',
    status: 'OFF DUTY',
    qualifications: ['PUMP'],
    yearsOfService: 7,
    contactCallsign: 'OPERATOR-02',
    scbaCertified: true
  }
];

// --------------------------------------------------------------------------
// Audio Feedback Helper
// --------------------------------------------------------------------------
const triggerTactileBeep = (freq = 720, duration = 0.05): void => {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, ctx.currentTime + duration);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
};

// --------------------------------------------------------------------------
// Component: FireApparatusRosterPage
// --------------------------------------------------------------------------
export const FireApparatusRosterPage: React.FC = () => {
  const [roster, setRoster] = useState<FirePersonnel[]>(BFP_PERSONNEL_ROSTER);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedShift, setSelectedShift] = useState<string>('Shift A');
  const [selectedApparatus, setSelectedApparatus] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedRank, setSelectedRank] = useState<string>('ALL');

  // Duty Status Toggle
  const handleToggleDutyStatus = (personId: string, nextStatus: RosterDutyStatus) => {
    triggerTactileBeep(nextStatus === 'DISPATCHED' ? 880 : 700, 0.05);
    setRoster((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, status: nextStatus } : p))
    );
  };

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter((p) => {
      const matchSearch =
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.badgeNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.apparatusRole.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.contactCallsign.toLowerCase().includes(searchQuery.toLowerCase());

      const matchShift = selectedShift === 'ALL' || p.shift === selectedShift;
      const matchApparatus = selectedApparatus === 'ALL' || p.assignedApparatus === selectedApparatus;
      const matchStatus = selectedStatus === 'ALL' || p.status === selectedStatus;
      const matchRank = selectedRank === 'ALL' || p.rank === selectedRank;

      return matchSearch && matchShift && matchApparatus && matchStatus && matchRank;
    });
  }, [roster, searchQuery, selectedShift, selectedApparatus, selectedStatus, selectedRank]);

  // Statistics Summary
  const stats = useMemo(() => {
    const onDuty = roster.filter((p) => p.status === 'ON DUTY').length;
    const dispatched = roster.filter((p) => p.status === 'DISPATCHED').length;
    const standby = roster.filter((p) => p.status === 'STANDBY').length;
    const hazmatCertified = roster.filter((p) => p.qualifications.includes('HAZMAT')).length;
    return { onDuty, dispatched, standby, hazmatCertified };
  }, [roster]);

  return (
    <div className="w-full flex flex-col gap-5 text-slate-100 font-sans pb-10">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header: Shift Roster & Personnel Assignment Console */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/90 border border-orange-500/30 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-600 to-orange-700 border-2 border-orange-400 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(234,88,12,0.5)] flex-shrink-0">
            🚒
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-orange-500/20 text-orange-400 border border-orange-500/40 uppercase tracking-widest">
                BFP DIPOLOG STATION // APPARATUS ROSTER
              </span>
              <span className="text-slate-500 font-mono text-xs">|</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                ACTIVE SHIFT: {selectedShift} (24/48 HR ROTATION)
              </span>
            </div>

            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>ENGINE COMPANY SHIFT ROSTER</span>
            </h1>

            <p className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
              <span>BFP RANKS FO1 TO CINSP • BADGE REGISTRY • SPECIALIZED RESCUE QUALIFICATIONS</span>
            </p>
          </div>
        </div>

        {/* Live Shift KPI Counters */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-emerald-500/40 text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ON DUTY: {stats.onDuty}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>DISPATCHED: {stats.dispatched}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-orange-500/40 text-orange-400 flex items-center gap-1.5">
            <span>HAZMAT TECHS: {stats.hazmatCertified}</span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Filter & Shift Control Ribbon */}
      {/* ------------------------------------------------------------------ */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
        {/* Search Input */}
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <span className="text-slate-400">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Firefighter Name, Badge #, Apparatus Role, or Callsign..."
            className="w-full bg-slate-950 px-3 py-2 rounded-lg border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {/* Shift Selector */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(['ALL', 'Shift A', 'Shift B', 'Shift C'] as const).map((sh) => (
            <button
              key={sh}
              type="button"
              onClick={() => setSelectedShift(sh)}
              className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                selectedShift === sh
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sh}
            </button>
          ))}
        </div>

        {/* Apparatus Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">APPARATUS:</span>
          <select
            value={selectedApparatus}
            onChange={(e) => setSelectedApparatus(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="ALL">ALL APPARATUS</option>
            <option value="Engine 01">Engine 01 (Pumper)</option>
            <option value="Engine 02 (Tender)">Engine 02 (Water Tender)</option>
            <option value="Ladder 01">Ladder 01 (Aerial)</option>
            <option value="Rescue 01">Rescue 01 (Special Rescue)</option>
            <option value="HQ Command">HQ Command</option>
          </select>
        </div>

        {/* Rank Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">RANK:</span>
          <select
            value={selectedRank}
            onChange={(e) => setSelectedRank(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
          >
            <option value="ALL">ALL RANKS</option>
            <option value="CINSP">CINSP (Chief Inspector)</option>
            <option value="SINSP">SINSP (Senior Inspector)</option>
            <option value="INSP">INSP (Inspector)</option>
            <option value="SFO2">SFO2</option>
            <option value="SFO1">SFO1</option>
            <option value="FO3">FO3 (Pump Operator)</option>
            <option value="FO2">FO2 (Nozzleman)</option>
            <option value="FO1">FO1 (Hoseman / Entry)</option>
          </select>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Personnel Table / Card Grid */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRoster.map((person) => {
          const isOnDuty = person.status === 'ON DUTY';
          const isDispatched = person.status === 'DISPATCHED';

          return (
            <div
              key={person.id}
              className={`p-5 rounded-2xl border-2 transition-all duration-150 flex flex-col justify-between gap-4 ${
                isOnDuty
                  ? 'bg-slate-900/90 border-orange-500/40 shadow-xl'
                  : isDispatched
                  ? 'bg-amber-950/30 border-amber-500/50 shadow-xl animate-pulse'
                  : 'bg-slate-950/80 border-slate-800 opacity-75'
              }`}
            >
              {/* Personnel Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2 font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-orange-600/20 text-orange-400 border border-orange-500/40 font-black">
                      {person.rank}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-bold">
                      {person.badgeNumber}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                      isOnDuty
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : isDispatched
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {person.status}
                  </span>
                </div>

                <h3 className="text-lg font-black text-white tracking-tight">{person.fullName}</h3>
                <p className="text-xs font-mono text-orange-400 font-bold mt-0.5">
                  {person.apparatusRole}
                </p>
                <p className="text-[11px] font-sans text-slate-400">{person.rankTitle}</p>
              </div>

              {/* Apparatus & Telemetry Specs */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs flex flex-col gap-1.5">
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 text-[11px]">ASSIGNED APPARATUS:</span>
                  <span className="font-bold text-white">{person.assignedApparatus}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 text-[11px]">RADIO CALLSIGN:</span>
                  <span className="text-amber-400 font-bold">{person.contactCallsign}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span className="text-slate-400 text-[11px]">EXPERIENCE:</span>
                  <span>{person.yearsOfService} Years in BFP Service</span>
                </div>
              </div>

              {/* Specialized Qualifications Badges */}
              <div className="flex flex-col gap-1 font-mono text-xs">
                <span className="text-[10px] text-slate-400">CERTIFIED SPECIALIZATIONS:</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {person.qualifications.map((q) => (
                    <span
                      key={q}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-200"
                    >
                      {q === 'HAZMAT' && '☣️ HAZMAT'}
                      {q === 'SAR' && '🧗 USAR / SAR'}
                      {q === 'PUMP' && '🚰 PUMP OPERATOR'}
                      {q === 'EMT' && '🚑 EMT-BASIC'}
                      {q === 'ARSON' && '🔍 ARSON INVESTIGATOR'}
                      {q === 'SCUBA' && '🤿 WATER RESCUE DIVER'}
                    </span>
                  ))}
                  {person.scbaCertified && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-500/40">
                      SCBA 4,500 PSI OK
                    </span>
                  )}
                </div>
              </div>

              {/* Duty Status Action Bar */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1 font-mono text-[10px]">
                <span className="text-slate-400">DUTY STATUS:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleDutyStatus(person.id, 'ON DUTY')}
                    className={`px-2 py-1 rounded font-bold cursor-pointer transition-all ${
                      person.status === 'ON DUTY'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    ON DUTY
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleDutyStatus(person.id, 'DISPATCHED')}
                    className={`px-2 py-1 rounded font-bold cursor-pointer transition-all ${
                      person.status === 'DISPATCHED'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    DISPATCH
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleDutyStatus(person.id, 'OFF DUTY')}
                    className={`px-2 py-1 rounded font-bold cursor-pointer transition-all ${
                      person.status === 'OFF DUTY'
                        ? 'bg-slate-700 text-white'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FireApparatusRosterPage;
