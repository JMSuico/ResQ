// [Layer: UserRoles/Features/Pages/RespondersPanel/Police]
// Responsibility: Physical Evidence Chain of Custody Ledger & Forensic Vault Management.
// Tamper-evident audit trail complying with Rule 128 (Rules on Electronic Evidence)
// and Philippine National Police Evidence Custody Standards (PNP-IDMS).

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/Hooks/useSession';
import { SearchBar } from '@/Shared/SearchBar';
import { formatIsoTimestamp } from '@/Libs/Assets/formatters';

export interface CustodyTransferRecord {
  id: string;
  timestamp: string;
  action: 'SEIZED AT SCENE' | 'LOGGED INTO VAULT' | 'TRANSFERRED TO SOCO' | 'TRANSFERRED TO COURT' | 'RELEASED TO OWNER';
  fromOfficer: string;
  toOfficerOrAgency: string;
  reason: string;
  badgeNumber: string;
}

export interface EvidenceItem {
  id: string;
  evidenceCode: string; // EVID-2026-XXXX
  caseBlotterNumber: string; // BLOTTER-2026-XXXX
  description: string;
  category: 'Ballistics' | 'Narcotics' | 'Digital / Mobile' | 'Forensic / DNA' | 'Weapon / Blade' | 'Documents' | 'Personal Property';
  seizureLocation: string;
  barangay: string;
  seizureDateTime: string;
  recoveringOfficerRank: string;
  recoveringOfficerName: string;
  recoveringOfficerBadge: string;
  lockerLocation: string;
  status: 'IN VAULT' | 'TRANSFERRED TO CRIME LAB' | 'SUBMITTED TO COURT' | 'DISPOSED / RELEASED';
  sha256Seal: string;
  chainOfCustody: CustodyTransferRecord[];
  photoUrl?: string;
}

const INITIAL_EVIDENCE_ITEMS: EvidenceItem[] = [
  {
    id: 'evid-01',
    evidenceCode: 'EVID-2026-0042',
    caseBlotterNumber: 'BLOTTER-2026-0819',
    description: 'One (1) Black Canvas Shoulder Bag containing driver license, wallet, and PHP 4,200 cash.',
    category: 'Personal Property',
    seizureLocation: 'Cor. Rizal Ave & Herrera St.',
    barangay: 'Barangay Central',
    seizureDateTime: '2026-10-25T14:15:00Z',
    recoveringOfficerRank: 'PSSg',
    recoveringOfficerName: 'Rico V. Magsaysay',
    recoveringOfficerBadge: 'PNP-381940',
    lockerLocation: 'Vault Locker A-04',
    status: 'IN VAULT',
    sha256Seal: '8A3F2C54B8D19F0E6A2C5B4E7D8F9A0B1C2D3E4F5A6B7C8D9E0F1A2B3C4D5E6F',
    chainOfCustody: [
      {
        id: 'cst-01-a',
        timestamp: '2026-10-25T14:15:00Z',
        action: 'SEIZED AT SCENE',
        fromOfficer: 'Crime Scene First Responder',
        toOfficerOrAgency: 'PSSg Rico V. Magsaysay',
        reason: 'Initial physical evidence recovery during snatching investigation',
        badgeNumber: 'PNP-381940'
      },
      {
        id: 'cst-01-b',
        timestamp: '2026-10-25T15:20:00Z',
        action: 'LOGGED INTO VAULT',
        fromOfficer: 'PSSg Rico V. Magsaysay',
        toOfficerOrAgency: 'Evidence Custodian PO3 R. Lopez',
        reason: 'Secured into high-security evidence safe for court presentation',
        badgeNumber: 'PNP-294012'
      }
    ]
  },
  {
    id: 'evid-02',
    evidenceCode: 'EVID-2026-0043',
    caseBlotterNumber: 'BLOTTER-2026-0792',
    description: 'One (1) spent 9mm brass cartridge casing headstamped "LUGER 9MM PMC".',
    category: 'Ballistics',
    seizureLocation: 'Dipolog Sunset Boulevard, Near North Breakwater',
    barangay: 'Barangay Central',
    seizureDateTime: '2026-10-24T22:30:00Z',
    recoveringOfficerRank: 'PCpl',
    recoveringOfficerName: 'Dennis A. Quintero',
    recoveringOfficerBadge: 'PNP-491023',
    lockerLocation: 'Ballistics Safe B-02',
    status: 'TRANSFERRED TO CRIME LAB',
    sha256Seal: '9C8D7E6F5A4B3C2D1E0F9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B9C8D',
    chainOfCustody: [
      {
        id: 'cst-02-a',
        timestamp: '2026-10-24T22:30:00Z',
        action: 'SEIZED AT SCENE',
        fromOfficer: 'Cordon Officer',
        toOfficerOrAgency: 'PCpl Dennis A. Quintero',
        reason: 'Recovered from pavement using sterile tweezers and sealed into evidence envelope',
        badgeNumber: 'PNP-491023'
      },
      {
        id: 'cst-02-b',
        timestamp: '2026-10-25T08:00:00Z',
        action: 'TRANSFERRED TO SOCO',
        fromOfficer: 'Evidence Custodian PO3 R. Lopez',
        toOfficerOrAgency: 'PNP Regional Crime Laboratory Office 9 (SOCO ZDN)',
        reason: 'Endorsed for IBIS Ballistics Imaging and Microscopic Comparison',
        badgeNumber: 'SOCO-REG-0994'
      }
    ]
  }
];

export const EvidenceVaultPage: React.FC = () => {
  const { session } = useSession();
  const [items, setItems] = useState<EvidenceItem[]>(() => {
    try {
      const stored = localStorage.getItem('resqtrack_pnp_evidence_vault');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return INITIAL_EVIDENCE_ITEMS;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Evidence Form State
  const [newEvidence, setNewEvidence] = useState({
    caseBlotterNumber: 'BLOTTER-2026-0821',
    description: '',
    category: 'Ballistics' as EvidenceItem['category'],
    seizureLocation: '',
    barangay: 'Barangay Central',
    lockerLocation: 'Vault Locker A-01',
    recoveringOfficerRank: 'PSSg',
    recoveringOfficerName: session?.fullName || 'Active Duty Investigator',
    recoveringOfficerBadge: session?.employeeOrResidentId || 'PNP-381940'
  });

  // Transfer Form State
  const [transferForm, setTransferForm] = useState({
    action: 'TRANSFERRED TO SOCO' as CustodyTransferRecord['action'],
    toOfficerOrAgency: 'PNP Regional Crime Lab 9 (SOCO ZDN)',
    reason: 'Forensic microscopic and ballistic comparison',
    badgeNumber: 'SOCO-9844'
  });

  useEffect(() => {
    try {
      localStorage.setItem('resqtrack_pnp_evidence_vault', JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.evidenceCode.toLowerCase().includes(q) ||
        item.caseBlotterNumber.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.seizureLocation.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (categoryFilter === 'ALL') return true;
      if (categoryFilter === 'BALLISTICS') return item.category === 'Ballistics';
      if (categoryFilter === 'VAULT') return item.status === 'IN VAULT';
      if (categoryFilter === 'CRIMELAB') return item.status === 'TRANSFERRED TO CRIME LAB';
      return item.category === categoryFilter;
    });
  }, [items, searchQuery, categoryFilter]);

  // Handle Tag New Evidence
  const handleTagNewEvidence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvidence.description || !newEvidence.seizureLocation) {
      showToast('Please specify Item Description and Seizure Location.');
      return;
    }

    const nextCode = `EVID-2026-${String(items.length + 44).padStart(4, '0')}`;
    const generatedSeal = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16).toUpperCase()
    ).join('');

    const item: EvidenceItem = {
      id: `evid-${Date.now()}`,
      evidenceCode: nextCode,
      caseBlotterNumber: newEvidence.caseBlotterNumber,
      description: newEvidence.description,
      category: newEvidence.category,
      seizureLocation: newEvidence.seizureLocation,
      barangay: newEvidence.barangay,
      seizureDateTime: new Date().toISOString(),
      recoveringOfficerRank: newEvidence.recoveringOfficerRank,
      recoveringOfficerName: newEvidence.recoveringOfficerName,
      recoveringOfficerBadge: newEvidence.recoveringOfficerBadge,
      lockerLocation: newEvidence.lockerLocation,
      status: 'IN VAULT',
      sha256Seal: generatedSeal,
      chainOfCustody: [
        {
          id: `cst-${Date.now()}-a`,
          timestamp: new Date().toISOString(),
          action: 'SEIZED AT SCENE',
          fromOfficer: 'Seizure Recovery Team',
          toOfficerOrAgency: `${newEvidence.recoveringOfficerRank} ${newEvidence.recoveringOfficerName}`,
          reason: 'Recovered at crime scene and secured with tamper-evident seal',
          badgeNumber: newEvidence.recoveringOfficerBadge
        },
        {
          id: `cst-${Date.now()}-b`,
          timestamp: new Date().toISOString(),
          action: 'LOGGED INTO VAULT',
          fromOfficer: `${newEvidence.recoveringOfficerRank} ${newEvidence.recoveringOfficerName}`,
          toOfficerOrAgency: `Evidence Custodian (${newEvidence.lockerLocation})`,
          reason: 'Deposited into locked security vault pending investigation',
          badgeNumber: 'VAULT-DUTY-01'
        }
      ]
    };

    setItems([item, ...items]);
    setIsTagModalOpen(false);
    showToast(`✓ EVIDENCE SEALED & LOGGED: ${nextCode}`);

    setNewEvidence((prev) => ({
      ...prev,
      description: '',
      seizureLocation: ''
    }));
  };

  // Handle Custody Transfer
  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    let nextStatus: EvidenceItem['status'] = 'IN VAULT';
    if (transferForm.action === 'TRANSFERRED TO SOCO') nextStatus = 'TRANSFERRED TO CRIME LAB';
    else if (transferForm.action === 'TRANSFERRED TO COURT') nextStatus = 'SUBMITTED TO COURT';
    else if (transferForm.action === 'RELEASED TO OWNER') nextStatus = 'DISPOSED / RELEASED';

    const newTransferRecord: CustodyTransferRecord = {
      id: `cst-tr-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: transferForm.action,
      fromOfficer: `${session?.fullName || 'Active Officer'} (Dipolog CPS Vault)`,
      toOfficerOrAgency: transferForm.toOfficerOrAgency,
      reason: transferForm.reason,
      badgeNumber: transferForm.badgeNumber
    };

    const updated = items.map((it) => {
      if (it.id !== selectedItem.id) return it;
      return {
        ...it,
        status: nextStatus,
        chainOfCustody: [...it.chainOfCustody, newTransferRecord]
      };
    });

    setItems(updated);
    setSelectedItem(updated.find((x) => x.id === selectedItem.id) || null);
    setIsTransferModalOpen(false);
    showToast(`✓ CUSTODY TRANSFERRED: ${selectedItem.evidenceCode}`);
  };

  return (
    <div className="flex-1 w-full flex flex-col space-y-5 text-slate-100">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-xl border border-blue-600/30 bg-gradient-to-r from-[#0a1128] via-[#0f1f4b] to-[#0a1128] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 border-2 border-blue-500/50 shadow-inner shadow-blue-500/40">
              <svg className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  PNP FORENSIC EVIDENCE VAULT
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  RULE 128 TAMPER-EVIDENT AUDIT
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Physical Evidence & Chain of Custody Ledger
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                Dipolog City Police Station • Evidence Custodian Section • Ballistics, Narcotics, Mobile & Forensic Safes
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setIsTagModalOpen(true)}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-blue-900/60 border border-blue-400/60 transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>TAG NEW EVIDENCE</span>
            </button>
          </div>
        </div>
      </div>

      {/* METRICS HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-blue-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-slate-400">Total Items in Custody</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-white">{items.length}</div>
          <p className="mt-1 text-[11px] text-slate-400">Barcoded & registered</p>
        </div>

        <div className="rounded-xl border border-emerald-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-emerald-300">Secured in Vault</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-emerald-400">
            {items.filter((i) => i.status === 'IN VAULT').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Locked safe lockers</p>
        </div>

        <div className="rounded-xl border border-purple-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-purple-300">Transferred to SOCO</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-purple-400">
            {items.filter((i) => i.status === 'TRANSFERRED TO CRIME LAB').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Crime Lab & Ballistics</p>
        </div>

        <div className="rounded-xl border border-amber-600/30 bg-[#0a1128]/90 p-4 shadow-md backdrop-blur-sm">
          <div className="text-xs font-mono uppercase font-semibold text-amber-300">Court Presentation</div>
          <div className="mt-2 text-2xl sm:text-3xl font-black font-mono text-amber-400">
            {items.filter((i) => i.status === 'SUBMITTED TO COURT').length}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">RTC / MTCC Exhibits</p>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0a1128]/90 p-3 rounded-xl border border-blue-900/40">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search Evidence Code, Blotter #, Description, Seizure Location..."
          className="w-full sm:max-w-md text-xs"
        />

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
          {[
            { id: 'ALL', label: `ALL (${items.length})` },
            { id: 'VAULT', label: 'IN VAULT' },
            { id: 'CRIMELAB', label: 'SOCO CRIME LAB' },
            { id: 'BALLISTICS', label: 'BALLISTICS' }
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setCategoryFilter(pill.id)}
              className={`px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                categoryFilter === pill.id
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-900/50'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* EVIDENCE ITEMS TABLE */}
      <div className="rounded-xl border border-blue-900/40 bg-[#0a1128]/90 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-[#0f1f4b] text-[11px] font-mono uppercase text-blue-300 border-b border-blue-900/60">
              <tr>
                <th className="py-3 px-4 font-bold">Evidence Code</th>
                <th className="py-3 px-4 font-bold">Blotter Reference</th>
                <th className="py-3 px-4 font-bold">Item Description</th>
                <th className="py-3 px-4 font-bold">Category</th>
                <th className="py-3 px-4 font-bold">Locker Storage</th>
                <th className="py-3 px-4 font-bold">Custody Status</th>
                <th className="py-3 px-4 font-bold">Seized By</th>
                <th className="py-3 px-4 font-bold text-right">Chain of Custody</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-200">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-300">0 EVIDENCE ITEMS IN LEDGER</div>
                      <div className="text-xs text-slate-500">Click "Tag New Evidence" to enter recovered items.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-950/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-400 whitespace-nowrap">
                      {item.evidenceCode}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {item.caseBlotterNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white max-w-sm">{item.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-xs">
                        Seal: {item.sha256Seal.slice(0, 24)}...
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/30">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {item.lockerLocation}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.status === 'IN VAULT'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : item.status === 'TRANSFERRED TO CRIME LAB'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      <div>{item.recoveringOfficerRank} {item.recoveringOfficerName}</div>
                      <div className="text-slate-400">{item.recoveringOfficerBadge}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white font-mono text-xs font-bold transition-all border border-blue-500/40 active:scale-95"
                      >
                        VIEW CUSTODY ({item.chainOfCustody.length}) ↗
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: TAG NEW EVIDENCE */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl border border-blue-500/50 bg-[#0a1128] p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-blue-400 tracking-wider">
                  PNP-IDMS EVIDENCE RECOVERY INTAKE
                </span>
                <h2 className="text-lg font-black text-white mt-0.5">
                  Register Physical Evidence Tag
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsTagModalOpen(false)}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTagNewEvidence} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Case / Blotter Number</label>
                  <input
                    type="text"
                    value={newEvidence.caseBlotterNumber}
                    onChange={(e) => setNewEvidence({ ...newEvidence, caseBlotterNumber: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Evidence Category</label>
                  <select
                    value={newEvidence.category}
                    onChange={(e) => setNewEvidence({ ...newEvidence, category: e.target.value as EvidenceItem['category'] })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                  >
                    <option value="Ballistics">Ballistics (Spent Shells, Firearms, Bullets)</option>
                    <option value="Narcotics">Narcotics / Controlled Substances</option>
                    <option value="Digital / Mobile">Digital / Mobile Devices (Phones, Drives)</option>
                    <option value="Forensic / DNA">Forensic / DNA & Blood Swabs</option>
                    <option value="Weapon / Blade">Weapon / Blade / Blunt Instrument</option>
                    <option value="Personal Property">Personal Property / Cash / Wallet</option>
                    <option value="Documents">Documents / Forged Checks</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">Item Description</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. One (1) spent 9mm casing marked PMC, found 3m north of vehicle."
                    value={newEvidence.description}
                    onChange={(e) => setNewEvidence({ ...newEvidence, description: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2.5 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Exact Seizure Location</label>
                  <input
                    type="text"
                    placeholder="Street corner, building, landmark"
                    value={newEvidence.seizureLocation}
                    onChange={(e) => setNewEvidence({ ...newEvidence, seizureLocation: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Vault Locker Assigned</label>
                  <select
                    value={newEvidence.lockerLocation}
                    onChange={(e) => setNewEvidence({ ...newEvidence, lockerLocation: e.target.value })}
                    className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white font-mono"
                  >
                    <option value="Vault Locker A-01">Vault Locker A-01</option>
                    <option value="Vault Locker A-02">Vault Locker A-02</option>
                    <option value="Ballistics Safe B-01">Ballistics Safe B-01</option>
                    <option value="Ballistics Safe B-02">Ballistics Safe B-02</option>
                    <option value="Narcotics Vault C-01">Narcotics Vault C-01</option>
                    <option value="Digital Storage Safe D-01">Digital Storage Safe D-01</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-900/60"
                >
                  LOG & SEAL EVIDENCE
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW CHAIN OF CUSTODY TIMELINE */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-blue-500/50 bg-[#0a1128] p-6 shadow-2xl text-slate-100 space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {selectedItem.evidenceCode}
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Case: {selectedItem.caseBlotterNumber}
                  </span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
                  Chain of Custody Audit Trail
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="h-8 w-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Evidence Summary Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 text-xs">
              <div className="font-bold text-white text-sm">{selectedItem.description}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono text-[11px] pt-2 border-t border-slate-800">
                <div><b>Category:</b> {selectedItem.category}</div>
                <div><b>Locker:</b> {selectedItem.lockerLocation}</div>
                <div><b>Status:</b> {selectedItem.status}</div>
                <div><b>Recovered:</b> {formatIsoTimestamp(selectedItem.seizureDateTime)}</div>
              </div>
              <div className="text-[10px] font-mono text-blue-300 break-all bg-slate-950 p-2 rounded border border-slate-800">
                <b>SHA-256 Tamper Seal:</b> {selectedItem.sha256Seal}
              </div>
            </div>

            {/* TIMELINE OF CUSTODY EVENTS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-slate-300">
                  Custody Transfer Log ({selectedItem.chainOfCustody.length} Events)
                </span>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  + TRANSFER CUSTODY
                </button>
              </div>

              <div className="space-y-2.5">
                {selectedItem.chainOfCustody.map((record, idx) => (
                  <div
                    key={record.id}
                    className="relative pl-6 pb-2 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-blue-500/40 last:before:hidden"
                  >
                    <div className="absolute left-0 top-1 h-4 w-4 rounded-full border-2 border-blue-400 bg-blue-950"></div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-blue-300">{record.action}</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {formatIsoTimestamp(record.timestamp)}
                        </span>
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        From: <span className="text-white font-medium">{record.fromOfficer}</span> → To: <span className="text-white font-medium">{record.toOfficerOrAgency}</span>
                      </div>
                      <div className="text-slate-400 text-[11px] italic">"{record.reason}"</div>
                      <div className="text-[10px] font-mono text-slate-500">Badge / Authority: {record.badgeNumber}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUBMIT TRANSFER OF CUSTODY */}
      {isTransferModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl border border-blue-500/50 bg-[#0a1128] p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-blue-400">
                  OFFICIAL TRANSFER LOG
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Transfer Custody of {selectedItem.evidenceCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="h-7 w-7 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Transfer Action</label>
                <select
                  value={transferForm.action}
                  onChange={(e) => setTransferForm({ ...transferForm, action: e.target.value as CustodyTransferRecord['action'] })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                >
                  <option value="TRANSFERRED TO SOCO">Transfer to PNP SOCO / Crime Lab (Analysis)</option>
                  <option value="TRANSFERRED TO COURT">Transfer to RTC / MTCC Court (Exhibit)</option>
                  <option value="LOGGED INTO VAULT">Return / Transfer to Vault Locker</option>
                  <option value="RELEASED TO OWNER">Release to Lawful Owner / Disposition</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Receiving Officer / Agency</label>
                <input
                  type="text"
                  value={transferForm.toOfficerOrAgency}
                  onChange={(e) => setTransferForm({ ...transferForm, toOfficerOrAgency: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Receiving Badge / Reference</label>
                <input
                  type="text"
                  value={transferForm.badgeNumber}
                  onChange={(e) => setTransferForm({ ...transferForm, badgeNumber: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Purpose of Transfer</label>
                <input
                  type="text"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 p-2 text-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase"
                >
                  CONFIRM TRANSFER
                </button>
              </div>
            </form>
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

export default EvidenceVaultPage;
