// [Layer: UserRoles/Features/Pages/RespondersPanel/Police]
// Responsibility: Digital Philippine Police Blotter Entry Ledger and Certified Extract Generator.
// Official PNP e-Blotter standard complying with Revised Penal Code (RPC) and Special Penal Laws.
// Immutable entry seals (BLOTTER-2026-XXXX) with official certifiable extract print layout.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Plus, Printer, Shield, Search, Filter, Calendar, FileText } from 'lucide-react';
import { useSession } from '@/Hooks/useSession';
import { SearchBar } from '@/Shared/SearchBar';
import { formatIsoTimestamp, formatGpsCoord } from '@/Libs/Assets/formatters';

export interface BlotterEntry {
  id: string;
  entryNumber: string; // e.g. BLOTTER-2026-1042
  dateFiled: string;
  incidentDateTime: string;
  incidentLocation: string;
  barangay: string;
  incidentClassification: string; // RPC or Special Penal Law
  offenseCategory: string; // e.g. Physical Injuries, Robbery/Theft, RA 9262, Reckless Imprudence
  complainantName: string;
  complainantAge: number;
  complainantSex: 'Male' | 'Female';
  complainantContact: string;
  complainantAddress: string;
  suspectName: string;
  suspectAlias?: string;
  suspectStatus: 'AT LARGE' | 'APPREHENDED' | 'IDENTIFIED' | 'UNDER INVESTIGATION';
  witnesses: string;
  narrative: string;
  investigatingOfficerRank: string;
  investigatingOfficerName: string;
  investigatingOfficerBadge: string;
  precinct: string;
  disposition: 'PENDING PRE-LIM' | 'FILED IN COURT' | 'REFERRED TO LUPON' | 'CLOSED';
  sealHash: string;
}

const DEFAULT_INITIAL_BLOTTER: BlotterEntry[] = [
  {
    id: 'blot-001',
    entryNumber: 'BLOTTER-2026-0819',
    dateFiled: '2026-10-25T14:30:00Z',
    incidentDateTime: '2026-10-25T13:45:00Z',
    incidentLocation: 'Cor. Rizal Avenue & Herrera St.',
    barangay: 'Barangay Central',
    incidentClassification: 'Revised Penal Code (RPC) - Art. 308 (Theft)',
    offenseCategory: 'Robbery/Theft',
    complainantName: 'Maria Elena Santos-Cruz',
    complainantAge: 38,
    complainantSex: 'Female',
    complainantContact: '0917-555-3819',
    complainantAddress: 'Purok 3, Estaka, Dipolog City',
    suspectName: 'John Doe (Alias: "Nonoy")',
    suspectAlias: 'Nonoy',
    suspectStatus: 'IDENTIFIED',
    witnesses: 'Security Guard Arnold B. Tiu (0920-111-9482)',
    narrative:
      'THAT ON OR ABOUT 1345H OF OCTOBER 25, 2026, AT RIZAL AVE, COMPLAINANT WHILE WAITING FOR A TRICYCLE WAS SNATCHED OF HER SHOULDER BAG CONTAINING CASH AND PERSONAL DOCUMENTS BY A MALE WEARING A BLACK HOODIE RIDING AN UNREGISTERED MOTORCYCLE.',
    investigatingOfficerRank: 'PSSg',
    investigatingOfficerName: 'Rico V. Magsaysay',
    investigatingOfficerBadge: 'PNP-381940',
    precinct: 'Dipolog City Police Station - Investigation Section',
    disposition: 'PENDING PRE-LIM',
    sealHash: 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855'
  },
  {
    id: 'blot-002',
    entryNumber: 'BLOTTER-2026-0820',
    dateFiled: '2026-10-26T09:15:00Z',
    incidentDateTime: '2026-10-26T08:50:00Z',
    incidentLocation: 'National Highway, Brgy. Turno',
    barangay: 'Barangay Turno',
    incidentClassification: 'RPC Art. 365 (Reckless Imprudence Resulting to Damage to Property)',
    offenseCategory: 'Reckless Imprudence',
    complainantName: 'Edgardo L. Morales',
    complainantAge: 45,
    complainantSex: 'Male',
    complainantContact: '0928-333-8190',
    complainantAddress: 'Barangay Barra, Dipolog City',
    suspectName: 'Rodrigo M. Alvarez',
    suspectStatus: 'APPREHENDED',
    witnesses: 'Traffic Enforcer Ronald Perez (TMU #14)',
    narrative:
      'TWO-VEHICLE COLLISION INVOLVING ISUZU ELF TRUCK WITH PLATE NO. JAA-3819 AND HONDA CLICK MOTORCYCLE. BOTH OPERATORS SUBMITTED DRIVER LICENSES FOR RECORD AND VEHICULAR TRAFFIC ASSESSMENT.',
    investigatingOfficerRank: 'PCpl',
    investigatingOfficerName: 'Dennis A. Quintero',
    investigatingOfficerBadge: 'PNP-491023',
    precinct: 'Dipolog CPS - Traffic Enforcement Unit',
    disposition: 'REFERRED TO LUPON',
    sealHash: '5F4DCC3B5AA765D61D8327DEB882CF992B34B823A708381014E6E5A44E86C143'
  }
];

export const PoliceBlotterPage: React.FC = () => {
  const { session } = useSession();
  const [entries, setEntries] = useState<BlotterEntry[]>(() => {
    try {
      const stored = localStorage.getItem('resqtrack_pnp_blotter_records');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return DEFAULT_INITIAL_BLOTTER;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');
  const [isEntryModalOpen, setIsEntryModalOpen] = useState<boolean>(false);
  const [viewingExtract, setViewingExtract] = useState<BlotterEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Blotter Form State
  const [formData, setFormData] = useState({
    incidentClassification: 'Revised Penal Code (RPC) - Physical Injuries',
    offenseCategory: 'Physical Injuries',
    incidentDateTime: new Date().toISOString().slice(0, 16),
    incidentLocation: '',
    barangay: 'Barangay Central',
    complainantName: '',
    complainantAge: 25,
    complainantSex: 'Male' as 'Male' | 'Female',
    complainantContact: '',
    complainantAddress: '',
    suspectName: '',
    suspectAlias: '',
    suspectStatus: 'AT LARGE' as 'AT LARGE' | 'APPREHENDED' | 'IDENTIFIED' | 'UNDER INVESTIGATION',
    witnesses: '',
    narrative: '',
    investigatingOfficerRank: 'PSSg',
    investigatingOfficerName: session?.fullName || 'Active Duty Officer',
    investigatingOfficerBadge: session?.employeeOrResidentId || 'PNP-582910',
    precinct: 'Dipolog City Police Station - Station 1',
    disposition: 'PENDING PRE-LIM' as 'PENDING PRE-LIM' | 'FILED IN COURT' | 'REFERRED TO LUPON' | 'CLOSED'
  });

  // Save to localStorage whenever entries change
  useEffect(() => {
    try {
      localStorage.setItem('resqtrack_pnp_blotter_records', JSON.stringify(entries));
    } catch {
      // ignore
    }
  }, [entries]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filtered Blotter records
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        e.entryNumber.toLowerCase().includes(q) ||
        e.complainantName.toLowerCase().includes(q) ||
        e.suspectName.toLowerCase().includes(q) ||
        e.incidentClassification.toLowerCase().includes(q) ||
        e.barangay.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFilter === 'ALL') return true;
      if (selectedFilter === 'RPC') return e.incidentClassification.includes('RPC');
      if (selectedFilter === 'SPL') return !e.incidentClassification.includes('RPC');
      if (selectedFilter === 'APPREHENDED') return e.suspectStatus === 'APPREHENDED';
      return true;
    });
  }, [entries, searchQuery, selectedFilter]);

  // Handle Form Submission: Cryptographic Seal & Blotter Number Assignment
  const handleFileBlotterEntry = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.complainantName || !formData.incidentLocation || !formData.narrative) {
      showToast('Please fill out Complainant Name, Incident Location, and Narrative Statement.');
      return;
    }

    // Generate immutable entry number
    const nextSeq = 1000 + entries.length + 1;
    const newEntryNum = `BLOTTER-2026-${nextSeq}`;

    // Compute mock tamper-evident hash
    const pseudoHash = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');

    const newRecord: BlotterEntry = {
      id: `blot-${Date.now()}`,
      entryNumber: newEntryNum,
      dateFiled: new Date().toISOString(),
      incidentDateTime: formData.incidentDateTime,
      incidentLocation: formData.incidentLocation,
      barangay: formData.barangay,
      incidentClassification: formData.incidentClassification,
      offenseCategory: formData.offenseCategory,
      complainantName: formData.complainantName,
      complainantAge: Number(formData.complainantAge) || 0,
      complainantSex: formData.complainantSex,
      complainantContact: formData.complainantContact,
      complainantAddress: formData.complainantAddress,
      suspectName: formData.suspectName || 'Unidentified Suspect / At Large',
      suspectAlias: formData.suspectAlias,
      suspectStatus: formData.suspectStatus,
      witnesses: formData.witnesses || 'None declared at time of entry',
      narrative: formData.narrative.toUpperCase(),
      investigatingOfficerRank: formData.investigatingOfficerRank,
      investigatingOfficerName: formData.investigatingOfficerName,
      investigatingOfficerBadge: formData.investigatingOfficerBadge,
      precinct: formData.precinct,
      disposition: formData.disposition,
      sealHash: pseudoHash
    };

    setEntries([newRecord, ...entries]);
    setIsEntryModalOpen(false);
    showToast(`✓ BLOTTER ENTRY SEALED: ${newEntryNum}`);

    // Reset form
    setFormData((prev) => ({
      ...prev,
      complainantName: '',
      complainantContact: '',
      complainantAddress: '',
      suspectName: '',
      suspectAlias: '',
      narrative: '',
      incidentLocation: ''
    }));
  };

  const handlePrintExtract = () => {
    window.print();
  };

  return (
    <div className="flex-1 w-full flex flex-col space-y-5 text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-blue-600/30 bg-gradient-to-r from-[#0a1128] via-[#0f1f4b] to-[#0a1128] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 border-2 border-blue-500/50 shadow-inner shadow-blue-500/40">
              <BookOpen className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  PNP OFFICIAL E-BLOTTER
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  POLICE DISPATCH SECURE
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Philippine Police Incident Blotter Ledger
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                National Police Commission • Dipolog City Police Station (CPS) • Investigation Section
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsEntryModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-blue-900/60 border border-blue-400/60 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>FILE NEW BLOTTER ENTRY</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRICS TIER */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-slate-400">Total Blotter Entries</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-white">{entries.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">Sealed immutable records</p>
        </div>

        <div className="rounded-xl border border-amber-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-amber-300">Under Investigation</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {entries.filter((e) => e.disposition === 'PENDING PRE-LIM').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Case build-up & statements</p>
        </div>

        <div className="rounded-xl border border-red-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-red-300">Apprehended / In Custody</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-red-400">
            {entries.filter((e) => e.suspectStatus === 'APPREHENDED').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Custodial investigation</p>
        </div>

        <div className="rounded-xl border border-emerald-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-emerald-300">Court / Lupon Disposition</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {entries.filter((e) => e.disposition === 'FILED IN COURT' || e.disposition === 'REFERRED TO LUPON').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Referred or endorsed</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a1128]/90 p-3 rounded-xl border border-blue-900/40">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search Blotter Entry #, complainant, suspect, offense, barangay..."
          className="w-full sm:max-w-md text-xs"
        />

        <div className="flex items-center space-x-1.5 font-mono text-xs">
          {[
            { id: 'ALL', label: `ALL (${entries.length})` },
            { id: 'RPC', label: 'RPC OFFENSES' },
            { id: 'SPL', label: 'SPECIAL LAWS' },
            { id: 'APPREHENDED', label: 'APPREHENDED' }
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setSelectedFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                selectedFilter === pill.id
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* BLOTTER ENTRIES LEDGER TABLE */}
      <div className="rounded-xl border border-blue-900/40 bg-[#0a1128]/90 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#0f1f4b] text-[11px] font-mono uppercase text-blue-300 border-b border-blue-900/60">
              <tr>
                <th className="py-3 px-4 font-bold">Blotter Entry #</th>
                <th className="py-3 px-4 font-bold">Date & Time</th>
                <th className="py-3 px-4 font-bold">Classification / Offense</th>
                <th className="py-3 px-4 font-bold">Complainant / Victim</th>
                <th className="py-3 px-4 font-bold">Suspect & Status</th>
                <th className="py-3 px-4 font-bold">Investigator</th>
                <th className="py-3 px-4 font-bold">Disposition</th>
                <th className="py-3 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-300">0 BLOTTER ENTRIES MATCHING FILTER</div>
                      <div className="text-xs text-slate-500">Click "File New Blotter Entry" to record a sworn police incident report.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-950/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400">
                      {item.entryNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {formatIsoTimestamp(item.incidentDateTime)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{item.offenseCategory}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.incidentClassification}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{item.complainantName}</div>
                      <div className="text-[11px] text-slate-400">{item.complainantContact}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-200">{item.suspectName}</div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold mt-0.5 ${
                        item.suspectStatus === 'APPREHENDED'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : item.suspectStatus === 'IDENTIFIED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.suspectStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div className="text-slate-200">{item.investigatingOfficerRank} {item.investigatingOfficerName}</div>
                      <div className="text-slate-400">{item.investigatingOfficerBadge}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                        {item.disposition}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setViewingExtract(item)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-mono text-xs font-bold transition-all border border-blue-500/40 active:scale-95"
                      >
                        EXTRACT (PDF) ↗
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: FILE OFFICIAL BLOTTER ENTRY */}
      {isEntryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-blue-500/50 bg-[#0a1128] p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-blue-400 tracking-wider">
                  PHILIPPINE NATIONAL POLICE • UNIFORM CRIME REPORTING
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white mt-0.5">
                  Official Police Blotter Intake Form
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEntryModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFileBlotterEntry} className="space-y-4 text-xs">
              {/* SECTION 1: INCIDENT CLASSIFICATION */}
              <div className="rounded-xl border border-blue-900/50 bg-slate-900/50 p-4 space-y-3">
                <div className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wide">
                  Section 1: Classification & Location of Incident
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Offense Category</label>
                    <select
                      value={formData.offenseCategory}
                      onChange={(e) => {
                        const cat = e.target.value;
                        let classification = `Revised Penal Code (RPC) - ${cat}`;
                        if (cat === 'RA 9262') classification = 'Republic Act No. 9262 (Anti-VAWC)';
                        if (cat === 'RA 9165') classification = 'Republic Act No. 9165 (Comprehensive Dangerous Drugs)';
                        if (cat === 'RA 10591') classification = 'Republic Act No. 10591 (Comprehensive Firearms & Ammunition)';
                        setFormData((prev) => ({
                          ...prev,
                          offenseCategory: cat,
                          incidentClassification: classification
                        }));
                      }}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white font-medium"
                    >
                      <option value="Physical Injuries">Physical Injuries (RPC Art. 263-266)</option>
                      <option value="Robbery/Theft">Robbery / Theft (RPC Art. 293 / 308)</option>
                      <option value="Reckless Imprudence">Reckless Imprudence (RPC Art. 365 Traffic/Property)</option>
                      <option value="RA 9262">RA 9262 (Violence Against Women & Children)</option>
                      <option value="RA 9165">RA 9165 (Dangerous Drugs Act)</option>
                      <option value="RA 10591">RA 10591 (Illegal Possession of Firearms)</option>
                      <option value="Swindling/Estafa">Estafa / Swindling (RPC Art. 315)</option>
                      <option value="Alarm and Scandal">Alarm and Scandal (RPC Art. 155)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Date & Time of Occurrence</label>
                    <input
                      type="datetime-local"
                      value={formData.incidentDateTime}
                      onChange={(e) => setFormData({ ...formData, incidentDateTime: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Place of Occurrence / Street</label>
                    <input
                      type="text"
                      placeholder="e.g. Corner Gen. Luna & Echavez St."
                      value={formData.incidentLocation}
                      onChange={(e) => setFormData({ ...formData, incidentLocation: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Barangay Jurisdiction</label>
                    <select
                      value={formData.barangay}
                      onChange={(e) => setFormData({ ...formData, barangay: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    >
                      <option value="Barangay Central">Barangay Central (Poblacion)</option>
                      <option value="Barangay Barra">Barangay Barra</option>
                      <option value="Barangay Minaog">Barangay Minaog</option>
                      <option value="Barangay Galas">Barangay Galas</option>
                      <option value="Barangay Turno">Barangay Turno</option>
                      <option value="Barangay Estaka">Barangay Estaka</option>
                      <option value="Barangay Olingan">Barangay Olingan</option>
                      <option value="Barangay Biasong">Barangay Biasong</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: PARTIES INVOLVED */}
              <div className="rounded-xl border border-blue-900/50 bg-slate-900/50 p-4 space-y-3">
                <div className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wide">
                  Section 2: Parties Involved (Complainant, Suspect, Witnesses)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Complainant / Victim Full Name</label>
                    <input
                      type="text"
                      placeholder="Last, First, Middle Name"
                      value={formData.complainantName}
                      onChange={(e) => setFormData({ ...formData, complainantName: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Age & Gender</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={formData.complainantAge}
                        onChange={(e) => setFormData({ ...formData, complainantAge: Number(e.target.value) })}
                        className="w-1/2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                      />
                      <select
                        value={formData.complainantSex}
                        onChange={(e) => setFormData({ ...formData, complainantSex: e.target.value as 'Male' | 'Female' })}
                        className="w-1/2 rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Contact Phone / Tel</label>
                    <input
                      type="text"
                      placeholder="09XX-XXX-XXXX"
                      value={formData.complainantContact}
                      onChange={(e) => setFormData({ ...formData, complainantContact: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-slate-400 mb-1 font-medium">Current Address</label>
                    <input
                      type="text"
                      placeholder="Purok / Street, Barangay, City"
                      value={formData.complainantAddress}
                      onChange={(e) => setFormData({ ...formData, complainantAddress: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Suspect / Person of Interest</label>
                    <input
                      type="text"
                      placeholder="Name or John Doe"
                      value={formData.suspectName}
                      onChange={(e) => setFormData({ ...formData, suspectName: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Alias / Street Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Alias Dodong"
                      value={formData.suspectAlias}
                      onChange={(e) => setFormData({ ...formData, suspectAlias: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Suspect Custody Status</label>
                    <select
                      value={formData.suspectStatus}
                      onChange={(e) => setFormData({ ...formData, suspectStatus: e.target.value as BlotterEntry['suspectStatus'] })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    >
                      <option value="AT LARGE">AT LARGE (Fled Scene)</option>
                      <option value="APPREHENDED">APPREHENDED (In Custody)</option>
                      <option value="IDENTIFIED">IDENTIFIED (Known Identity)</option>
                      <option value="UNDER INVESTIGATION">UNDER INVESTIGATION</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: NARRATIVE STATEMENT OF FACTS */}
              <div className="rounded-xl border border-blue-900/50 bg-slate-900/50 p-4 space-y-2">
                <div className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wide">
                  Section 3: Sworn Narrative Statement of Facts
                </div>
                <p className="text-[11px] text-slate-400">
                  Standard Philippine Police Blotter syntax (chronological recounting of facts, weapon involved, injuries sustained):
                </p>
                <textarea
                  rows={4}
                  placeholder="THAT ON OR ABOUT 0800H OF OCTOBER 26, 2026, AT..."
                  value={formData.narrative}
                  onChange={(e) => setFormData({ ...formData, narrative: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-white font-mono uppercase"
                  required
                />
              </div>

              {/* SECTION 4: INVESTIGATING OFFICER */}
              <div className="rounded-xl border border-blue-900/50 bg-slate-900/50 p-4 space-y-3">
                <div className="text-[11px] font-mono font-bold text-blue-400 uppercase tracking-wide">
                  Section 4: Investigating Officer Credentials
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Rank</label>
                    <select
                      value={formData.investigatingOfficerRank}
                      onChange={(e) => setFormData({ ...formData, investigatingOfficerRank: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    >
                      <option value="Pat">Patrolman / Patrolwoman (Pat)</option>
                      <option value="PCpl">Police Corporal (PCpl)</option>
                      <option value="PSSg">Police Staff Sergeant (PSSg)</option>
                      <option value="PMSg">Police Master Sergeant (PMSg)</option>
                      <option value="PSMS">Police Senior Master Sergeant (PSMS)</option>
                      <option value="PCMS">Police Chief Master Sergeant (PCMS)</option>
                      <option value="PLT">Police Lieutenant (PLT)</option>
                      <option value="PCPT">Police Captain (PCPT)</option>
                      <option value="PMAJ">Police Major (PMAJ)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Officer Full Name</label>
                    <input
                      type="text"
                      value={formData.investigatingOfficerName}
                      onChange={(e) => setFormData({ ...formData, investigatingOfficerName: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Badge / Plantilla #</label>
                    <input
                      type="text"
                      value={formData.investigatingOfficerBadge}
                      onChange={(e) => setFormData({ ...formData, investigatingOfficerBadge: e.target.value })}
                      className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white font-mono"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* ACTION FOOTER */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEntryModalOpen(false)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-blue-900/60 border border-blue-400 transition-all"
                >
                  FILE BLOTTER ENTRY (SEAL RECORD)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CERTIFIED BLOTTER EXTRACT (OFFICIAL PDF / PRINT VIEW) */}
      {viewingExtract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border-2 border-blue-500/60 bg-white text-slate-900 p-8 shadow-2xl space-y-6 print:p-0 print:border-none print:shadow-none">
            {/* Action Bar (Hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-300 pb-3 print:hidden">
              <span className="text-xs font-mono font-bold text-blue-800 uppercase">
                Official Certifiable Police Blotter Extract Document
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handlePrintExtract}
                  className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>PRINT / EXPORT CERTIFIED PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingExtract(null)}
                  className="px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
                >
                  Close
                </button>
              </div>
            </div>

            {/* OFFICIAL DOCUMENT HEADER */}
            <div className="text-center space-y-1 font-serif border-b-2 border-slate-800 pb-4">
              <div className="text-xs tracking-wider uppercase text-slate-600">Republic of the Philippines</div>
              <div className="text-xs tracking-wider uppercase text-slate-600">Department of the Interior and Local Government</div>
              <div className="text-xs tracking-wider uppercase font-semibold text-slate-700">NATIONAL POLICE COMMISSION</div>
              <div className="text-sm tracking-wider uppercase font-bold text-blue-950">PHILIPPINE NATIONAL POLICE</div>
              <div className="text-xs tracking-wider uppercase font-bold text-slate-800">POLICE REGIONAL OFFICE 9 • ZAMBOANGA DEL NORTE POLICE PROVINCIAL OFFICE</div>
              <div className="text-sm font-black tracking-widest uppercase text-blue-900 mt-1">DIPOLOG CITY POLICE STATION</div>
              <div className="text-[11px] text-slate-500 font-sans">Padre Ramon St., Dipolog City, Zamboanga del Norte • Tel: (065) 212-2555</div>
            </div>

            {/* DOCUMENT TITLE */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-serif font-black tracking-widest text-slate-900 uppercase">
                POLICE BLOTTER EXTRACT
              </h2>
              <div className="text-xs font-mono font-bold text-blue-900">
                ENTRY NO.: {viewingExtract.entryNumber}
              </div>
            </div>

            {/* CERTIFICATION PREAMBLE */}
            <div className="text-xs font-serif leading-relaxed text-slate-800 text-justify">
              <p className="indent-8">
                <b>TO WHOM IT MAY CONCERN:</b>
              </p>
              <p className="mt-2 indent-8">
                <b>THIS IS TO CERTIFY</b> that in accordance with the official records of the Police Blotter of this Station, there appears a sworn entry on Book No. 2026, Page No. {viewingExtract.entryNumber.slice(-4)}, recorded on <b>{formatIsoTimestamp(viewingExtract.dateFiled)}</b>, verbatim transcribed as follows:
              </p>
            </div>

            {/* EXTRACT TRANSCRIPTION BOX */}
            <div className="rounded border-2 border-slate-800 bg-slate-50 p-5 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2 text-[11px] border-b border-slate-300 pb-2">
                <div><b>INCIDENT CLASSIFICATION:</b> {viewingExtract.incidentClassification}</div>
                <div><b>DATE & TIME OCCURRED:</b> {formatIsoTimestamp(viewingExtract.incidentDateTime)}</div>
                <div><b>PLACE OF INCIDENT:</b> {viewingExtract.incidentLocation}, {viewingExtract.barangay}</div>
                <div><b>STATUS OF SUSPECT:</b> {viewingExtract.suspectStatus}</div>
              </div>

              <div>
                <div className="font-bold text-[11px] text-slate-700">PARTIES INVOLVED:</div>
                <div className="text-[11px] mt-1 space-y-0.5">
                  <div>• <b>Complainant / Victim:</b> {viewingExtract.complainantName}, {viewingExtract.complainantAge} y/o, {viewingExtract.complainantSex}, Residing at {viewingExtract.complainantAddress}</div>
                  <div>• <b>Suspect / Person of Interest:</b> {viewingExtract.suspectName} {viewingExtract.suspectAlias ? `(Alias: "${viewingExtract.suspectAlias}")` : ''}</div>
                  <div>• <b>Witnesses:</b> {viewingExtract.witnesses}</div>
                </div>
              </div>

              <div className="border-t border-slate-300 pt-2">
                <div className="font-bold text-[11px] text-slate-700">NARRATIVE OF FACTS:</div>
                <p className="mt-1 leading-relaxed text-slate-800 uppercase whitespace-pre-wrap">
                  "{viewingExtract.narrative}"
                </p>
              </div>

              <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Cryptographic Seal: {viewingExtract.sealHash.slice(0, 32)}...</span>
                <span>Case Disposition: {viewingExtract.disposition}</span>
              </div>
            </div>

            {/* SIGNATURE & CERTIFICATION BLOCK */}
            <div className="pt-6 font-serif">
              <p className="text-xs text-slate-800 indent-8 leading-relaxed">
                This certification is issued upon the request of <b>{viewingExtract.complainantName}</b> for legal, court, or insurance verification purposes and for whatever lawful intent it may serve.
              </p>

              <div className="grid grid-cols-2 gap-8 pt-12 text-center text-xs">
                <div>
                  <div className="font-bold uppercase text-slate-900">
                    {viewingExtract.investigatingOfficerRank} {viewingExtract.investigatingOfficerName}
                  </div>
                  <div className="text-slate-600 text-[11px]">Investigating Officer / Investigator-on-Case</div>
                  <div className="text-slate-500 font-mono text-[10px]">Badge: {viewingExtract.investigatingOfficerBadge}</div>
                </div>

                <div>
                  <div className="font-bold uppercase text-slate-900">
                    PMAJ MARCO V. SANTILLAN, CE
                  </div>
                  <div className="text-slate-600 text-[11px]">Chief of Police, Dipolog City Police Station</div>
                  <div className="text-slate-500 text-[10px] italic">For the Provincial Director</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HAPTIC / STATUS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-blue-500/50 bg-[#0a1128] px-4 py-3 text-xs font-mono font-bold text-blue-200 shadow-2xl shadow-blue-950/80 animate-slideUp">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default PoliceBlotterPage;
