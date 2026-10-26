// [Layer: UserRoles/Features/Pages/RespondersPanel/Police]
// Responsibility: Beat Patrol Roster, Mobile Car Units, Motorcycle Cadre & Shift Assignments.
// Strictly tracks PNP Officer ranks (Patrolman to PMAJ), mobile patrol apparatus (PATROL-01),
// and tactical duty readiness.

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { SearchBar } from '@/Shared/SearchBar';

export type PoliceRank =
  | 'Pat' // Patrolman / Patrolwoman
  | 'PCpl' // Police Corporal
  | 'PSSg' // Police Staff Sergeant
  | 'PMSg' // Police Master Sergeant
  | 'PSMS' // Police Senior Master Sergeant
  | 'PCMS' // Police Chief Master Sergeant
  | 'PEMS' // Police Executive Master Sergeant
  | 'PLT' // Police Lieutenant
  | 'PCPT' // Police Captain
  | 'PMAJ'; // Police Major

export interface PoliceRosterPersonnel {
  id: string;
  badgeNumber: string;
  rank: PoliceRank;
  fullName: string;
  role: 'PATROL DRIVER' | 'TACTICAL OFFICER' | 'DESK OFFICER' | 'INVESTIGATOR' | 'BEAT SUPERVISOR' | 'K9 HANDLER';
  callsign: string;
  assignedUnit: string; // e.g. PATROL-01 (ALPHA)
  unitType: 'MOBILE PATROL CAR' | 'MOTORCYCLE CADRE' | 'SWAT TACTICAL' | 'FOOT BEAT' | 'K9 UNIT';
  sectorBeat: string;
  shift: 'DAY SHIFT (0600H - 1400H)' | 'SWING SHIFT (1400H - 2200H)' | 'GRAVEYARD SHIFT (2200H - 0600H)';
  dutyStatus: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty';
  dutySidearm: string;
  bodyCamStatus: 'RECORDING / ONLINE' | 'STANDBY' | 'DOCKED';
  contactRadio: string;
}

const DEFAULT_PERSONNEL: PoliceRosterPersonnel[] = [
  {
    id: 'pnp-01',
    badgeNumber: 'PNP-77491',
    rank: 'PMAJ',
    fullName: 'Marco V. Santillan',
    role: 'BEAT SUPERVISOR',
    callsign: 'COMMANDER-1',
    assignedUnit: 'HEADQUARTERS COMMAND',
    unitType: 'FOOT BEAT',
    sectorBeat: 'City-Wide Tactical Command',
    shift: 'SWING SHIFT (1400H - 2200H)',
    dutyStatus: 'OnDuty',
    dutySidearm: 'GLOCK 17 Gen 4 (S/N: PNP-984421-G17)',
    bodyCamStatus: 'RECORDING / ONLINE',
    contactRadio: 'TAC-01 (154.850 MHz)'
  },
  {
    id: 'pnp-02',
    badgeNumber: 'PNP-381940',
    rank: 'PSSg',
    fullName: 'Rico V. Magsaysay',
    role: 'PATROL DRIVER',
    callsign: 'PATROL-01 (ALPHA)',
    assignedUnit: 'PATROL-01 (ALPHA)',
    unitType: 'MOBILE PATROL CAR',
    sectorBeat: 'Sector 1 - Central Business District / Rizal Ave',
    shift: 'SWING SHIFT (1400H - 2200H)',
    dutyStatus: 'OnDuty',
    dutySidearm: 'GLOCK 17 Gen 4 (S/N: PNP-448201)',
    bodyCamStatus: 'RECORDING / ONLINE',
    contactRadio: 'TAC-02 (154.850 MHz)'
  },
  {
    id: 'pnp-03',
    badgeNumber: 'PNP-491023',
    rank: 'PCpl',
    fullName: 'Dennis A. Quintero',
    role: 'TACTICAL OFFICER',
    callsign: 'PATROL-01 (BRAVO-CREW)',
    assignedUnit: 'PATROL-01 (ALPHA)',
    unitType: 'MOBILE PATROL CAR',
    sectorBeat: 'Sector 1 - Central Business District / Rizal Ave',
    shift: 'SWING SHIFT (1400H - 2200H)',
    dutyStatus: 'OnDuty',
    dutySidearm: 'Taurus TS9 9mm (S/N: PNP-889104)',
    bodyCamStatus: 'RECORDING / ONLINE',
    contactRadio: 'TAC-02 (154.850 MHz)'
  },
  {
    id: 'pnp-04',
    badgeNumber: 'PNP-552019',
    rank: 'PMSg',
    fullName: 'Rommel C. Cruz',
    role: 'PATROL DRIVER',
    callsign: 'PATROL-02 (BRAVO)',
    assignedUnit: 'PATROL-02 (BRAVO)',
    unitType: 'MOBILE PATROL CAR',
    sectorBeat: 'Sector 2 - Dipolog Sunset Boulevard Coastal Zone',
    shift: 'SWING SHIFT (1400H - 2200H)',
    dutyStatus: 'Dispatched',
    dutySidearm: 'GLOCK 17 Gen 4 (S/N: PNP-390112)',
    bodyCamStatus: 'RECORDING / ONLINE',
    contactRadio: 'TAC-03 (154.850 MHz)'
  },
  {
    id: 'pnp-05',
    badgeNumber: 'PNP-612994',
    rank: 'PCpl',
    fullName: 'Franklin D. Bautista',
    role: 'TACTICAL OFFICER',
    callsign: 'MOTOR-01 (CHARLIE)',
    assignedUnit: 'MOTOR-01 (CHARLIE)',
    unitType: 'MOTORCYCLE CADRE',
    sectorBeat: 'Sector 3 - Turno National Highway & Transit Corridor',
    shift: 'SWING SHIFT (1400H - 2200H)',
    dutyStatus: 'OnDuty',
    dutySidearm: 'GLOCK 19 Gen 5 (S/N: PNP-294012)',
    bodyCamStatus: 'RECORDING / ONLINE',
    contactRadio: 'TAC-04 (154.850 MHz)'
  },
  {
    id: 'pnp-06',
    badgeNumber: 'PNP-730192',
    rank: 'PSMS',
    fullName: 'Gabriel O. Tan',
    role: 'TACTICAL OFFICER',
    callsign: 'MOTOR-02 (DELTA)',
    assignedUnit: 'MOTOR-02 (DELTA)',
    unitType: 'MOTORCYCLE CADRE',
    sectorBeat: 'Sector 4 - Minaog Airport & North Perimeter',
    shift: 'SWING SHIFT (1400H - 2200H)',
    dutyStatus: 'Standby',
    dutySidearm: 'GLOCK 17 Gen 4 (S/N: PNP-884192)',
    bodyCamStatus: 'STANDBY',
    contactRadio: 'TAC-05 (154.850 MHz)'
  },
  {
    id: 'pnp-07',
    badgeNumber: 'PNP-810492',
    rank: 'Pat',
    fullName: 'Eduardo M. Santos',
    role: 'TACTICAL OFFICER',
    callsign: 'SWAT-01 (SHIELD)',
    assignedUnit: 'SWAT-TACTICAL-01',
    unitType: 'SWAT TACTICAL',
    sectorBeat: 'City-Wide High-Risk Support',
    shift: 'DAY SHIFT (0600H - 1400H)',
    dutyStatus: 'OffDuty',
    dutySidearm: 'Beretta 92FS (S/N: PNP-194012)',
    bodyCamStatus: 'DOCKED',
    contactRadio: 'TAC-06 (154.850 MHz)'
  }
];

export const PolicePatrolRosterPage: React.FC = () => {
  const { session } = useSession();
  const [personnel, setPersonnel] = useState<PoliceRosterPersonnel[]>(() => {
    try {
      const stored = localStorage.getItem('resqtrack_pnp_patrol_roster');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_PERSONNEL;
  });

  const [backendRoster, setBackendRoster] = useState<DutyUnit[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedPersonnel, setSelectedPersonnel] = useState<PoliceRosterPersonnel | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('resqtrack_pnp_patrol_roster', JSON.stringify(personnel));
    } catch {
      // ignore
    }
  }, [personnel]);

  // Fetch backend duty roster
  useEffect(() => {
    getDutyRoster()
      .then((data) => setBackendRoster(data.filter((u) => u.agency === 'PNP' || u.agency === 'POLICE')))
      .catch(() => setBackendRoster([]));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredPersonnel = useMemo(() => {
    return personnel.filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        p.badgeNumber.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.assignedUnit.toLowerCase().includes(q) ||
        p.sectorBeat.toLowerCase().includes(q) ||
        p.rank.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'OnDuty') return p.dutyStatus === 'OnDuty';
      if (statusFilter === 'Dispatched') return p.dutyStatus === 'Dispatched';
      if (statusFilter === 'Standby') return p.dutyStatus === 'Standby';
      if (statusFilter === 'OffDuty') return p.dutyStatus === 'OffDuty';
      return true;
    });
  }, [personnel, searchQuery, statusFilter]);

  // Tactile Status Toggle
  const handleToggleStatus = async (officerId: string) => {
    setPersonnel((prev) =>
      prev.map((p) => {
        if (p.id !== officerId) return p;
        let nextStatus: PoliceRosterPersonnel['dutyStatus'] = 'OnDuty';
        if (p.dutyStatus === 'OnDuty') nextStatus = 'Dispatched';
        else if (p.dutyStatus === 'Dispatched') nextStatus = 'Standby';
        else if (p.dutyStatus === 'Standby') nextStatus = 'OffDuty';
        else if (p.dutyStatus === 'OffDuty') nextStatus = 'OnDuty';

        showToast(`Officer ${p.rank} ${p.fullName} transitioned to ${nextStatus}`);

        // If backend unit exists, sync
        const matchUnit = backendRoster.find((u) => u.unitName.includes(p.assignedUnit));
        if (matchUnit) {
          updateUnitDutyStatus(matchUnit.id, nextStatus).catch(() => {});
        }

        return { ...p, dutyStatus: nextStatus };
      })
    );
  };

  return (
    <div className="flex-1 w-full flex flex-col space-y-5 text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-blue-600/30 bg-gradient-to-r from-[#0a1128] via-[#0f1f4b] to-[#0a1128] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 border-2 border-blue-500/50 shadow-inner shadow-blue-500/40">
              <svg className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  PNP ACTIVE PATROL ROSTER
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  SWING SHIFT 1400H–2200H
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Sector Beat Patrol Roster & Fleet Dispatch
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Dipolog City Police Station (CPS) • Mobile Cars PATROL-01/02 • Motorcycle Beat Cadre • SWAT
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="rounded-lg bg-blue-950/70 border border-blue-500/30 px-3.5 py-2 text-right">
              <div className="text-[10px] font-mono uppercase text-blue-400 font-bold">Duty Commander</div>
              <div className="text-xs font-black text-white">{session?.fullName || 'PMAJ Marco Santillan'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRICS TIER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-slate-400">Total Officers on Roll</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-white">{personnel.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">Station roster count</p>
        </div>

        <div className="rounded-xl border border-emerald-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-emerald-300">Active On Duty</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {personnel.filter((p) => p.dutyStatus === 'OnDuty').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Securing beats</p>
        </div>

        <div className="rounded-xl border border-red-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-red-300">Dispatched (Code 3)</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-red-400">
            {personnel.filter((p) => p.dutyStatus === 'Dispatched').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">En route to calls</p>
        </div>

        <div className="rounded-xl border border-amber-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-amber-300">Standby / Quarters</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {personnel.filter((p) => p.dutyStatus === 'Standby').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Reserve tactical ready</p>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a1128]/90 p-3 rounded-xl border border-blue-900/40">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search Officer Name, Badge ID, Rank, Unit or Beat..."
          className="w-full sm:max-w-md text-xs"
        />

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {[
            { id: 'ALL', label: `ALL (${personnel.length})` },
            { id: 'OnDuty', label: 'ON DUTY' },
            { id: 'Dispatched', label: 'DISPATCHED' },
            { id: 'Standby', label: 'STANDBY' },
            { id: 'OffDuty', label: 'OFF DUTY' }
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                statusFilter === pill.id
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* PERSONNEL ROSTER TABLE */}
      <div className="rounded-xl border border-blue-900/40 bg-[#0a1128]/90 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#0f1f4b] text-[11px] font-mono uppercase text-blue-300 border-b border-blue-900/60">
              <tr>
                <th className="py-3 px-4 font-bold">Badge / Plantilla</th>
                <th className="py-3 px-4 font-bold">Rank & Officer Name</th>
                <th className="py-3 px-4 font-bold">Assigned Unit & Callsign</th>
                <th className="py-3 px-4 font-bold">Sector Beat Area</th>
                <th className="py-3 px-4 font-bold">Duty Sidearm</th>
                <th className="py-3 px-4 font-bold">Body Cam</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredPersonnel.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-300">0 OFFICERS FOUND</div>
                      <div className="text-xs text-slate-500">No officers matched the selected query or filter.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPersonnel.map((officer) => (
                  <tr key={officer.id} className="hover:bg-blue-950/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400 whitespace-nowrap">
                      {officer.badgeNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center space-x-1.5">
                        <span className="text-blue-400 font-mono">{officer.rank}</span>
                        <span>{officer.fullName}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{officer.role}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{officer.assignedUnit}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{officer.callsign}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 max-w-xs truncate">
                      {officer.sectorBeat}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                      {officer.dutySidearm}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                        officer.bodyCamStatus.includes('RECORDING')
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {officer.bodyCamStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(officer.id)}
                        className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-tight uppercase transition-all active:scale-95 ${
                          officer.dutyStatus === 'OnDuty'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                            : officer.dutyStatus === 'Dispatched'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 animate-pulse'
                            : officer.dutyStatus === 'Standby'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                        title="Click to advance status: OnDuty -> Dispatched -> Standby -> OffDuty"
                      >
                        {officer.dutyStatus} ↻
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedPersonnel(officer)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-mono text-xs font-bold transition-all border border-blue-500/40 active:scale-95"
                      >
                        DOSSIER ↗
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OFFICER DOSSIER MODAL */}
      {selectedPersonnel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-blue-500/50 bg-[#0a1128] p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-3">
                <div className="h-12 w-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-xl">
                  👮
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-blue-400">
                    {selectedPersonnel.badgeNumber} • {selectedPersonnel.rank}
                  </div>
                  <h3 className="text-lg font-black text-white">{selectedPersonnel.fullName}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPersonnel(null)}
                className="h-8 w-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Operational Role & Assignment</div>
                <div className="font-bold text-white">{selectedPersonnel.role}</div>
                <div className="text-slate-300 font-mono text-[11px]">{selectedPersonnel.assignedUnit} ({selectedPersonnel.callsign})</div>
                <div className="text-slate-400 text-[11px]">{selectedPersonnel.sectorBeat}</div>
              </div>

              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Shift Schedule & Tactical Comm</div>
                <div className="font-bold text-emerald-400 font-mono">{selectedPersonnel.shift}</div>
                <div className="text-blue-300 font-mono text-[11px]">Radio Channel: {selectedPersonnel.contactRadio}</div>
              </div>

              <div className="rounded-lg bg-slate-900/60 p-3 border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Armory & Equipment Verification</div>
                <div className="text-white font-mono text-[11px]">Sidearm: <b>{selectedPersonnel.dutySidearm}</b></div>
                <div className="text-slate-300 font-mono text-[11px]">Body Cam: <b>{selectedPersonnel.bodyCamStatus}</b></div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPersonnel(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-blue-500/50 bg-[#0a1128] px-4 py-3 text-xs font-mono font-bold text-blue-200 shadow-2xl shadow-blue-950/80 animate-slideUp">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default PolicePatrolRosterPage;
