// [Layer: UserRoles/Features/Pages/AdminsPanel]
// Responsibility: LDRRMO incidents triage board for verifying reports and allocating emergency units.
// DO NOT allow non-super-admins to allocate agency duty units.

import React, { useState, useEffect } from 'react';
import { getAllReports } from '@/Endpoints/reportsApi';
import { verifyReport, allocateReportUnit } from '@/Endpoints/adminGovernanceApi';
import { getDutyRoster } from '@/Endpoints/responderOpsApi';
import { Button } from '@/Shared/Button';
import { SearchBar } from '@/Shared/FormPrimitives';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatGpsCoord } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS, STATUS_COLORS } from '@/Libs/Assets/data';

export const IncidentsBoard: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [dutyUnits, setDutyUnits] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');

  // Allocation Modal State
  const [allocatingReport, setAllocatingReport] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  // Lightbox State
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [r, u] = await Promise.all([getAllReports(), getDutyRoster()]);
      setReports(r);
      setDutyUnits(u);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleVerify = async (reportId: string, status: string) => {
    try {
      await verifyReport(reportId, status, 'Verified by LDRRMO Admin via Command Board');
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAllocate = async () => {
    if (!allocatingReport || !selectedUnitId) return;
    try {
      await allocateReportUnit(allocatingReport.id, selectedUnitId);
      setAllocatingReport(null);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.referenceCode.toLowerCase().includes(search.toLowerCase()) ||
      r.reporterName.toLowerCase().includes(search.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || r.category === selectedCategory;
    const matchesSev = selectedSeverity === 'ALL' || r.severity === selectedSeverity;
    return matchesSearch && matchesCat && matchesSev;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Live Incidents Command Board</h2>
          <p className="text-xs text-slate-400 mt-0.5">Triage verification and tactical multi-agency unit dispatch</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar value={search} onChange={setSearch} className="w-64" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
          >
            <option value="ALL">All Categories</option>
            <option value="VehicularAccident">Vehicular Accident</option>
            <option value="MedicalEmergency">Medical Emergency</option>
            <option value="StructuralFire">Structural Fire</option>
            <option value="CrimeOrSecurity">Crime / Security</option>
            <option value="NaturalDisaster">Natural Disaster</option>
          </select>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200"
          >
            <option value="ALL">All Severities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      <div className="tactical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
              <tr>
                <th className="p-3.5">Ref Code</th>
                <th className="p-3.5">Incident Title</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Location / GPS</th>
                <th className="p-3.5">Allocated Unit</th>
                <th className="p-3.5">Evidence</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    No emergency incident reports matching criteria.
                  </td>
                </tr>
              ) : (
                filteredReports.map((r) => {
                  const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Medium;
                  const stat = STATUS_COLORS[r.status] || STATUS_COLORS.Reported;

                  return (
                    <tr key={r.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-sky-400 font-bold whitespace-nowrap">
                        {r.referenceCode}
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-100">{r.title}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{r.reporterName} ({r.reporterRole})</div>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${stat.bg} ${stat.text}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[11px] text-slate-400">
                        <div>{r.locationLabel || 'GPS Coordinates'}</div>
                        <div className="text-[10px] text-slate-500">{formatGpsCoord(r.latitude, r.longitude)}</div>
                      </td>
                      <td className="p-3.5">
                        {r.allocatedUnitCode ? (
                          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-mono text-[10px] border border-sky-800">
                            {r.allocatedUnitCode}
                          </span>
                        ) : (
                          <span className="text-slate-600 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        {r.hasImage ? (
                          <button
                            onClick={() => setLightboxImageUrl(r.imageUrl)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700"
                          >
                            📷 View PNG
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[10px]">No photo</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {r.status === 'Reported' && (
                            <Button variant="outline" size="sm" onClick={() => handleVerify(r.id, 'Verified')}>
                              Verify
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setAllocatingReport(r);
                              setSelectedUnitId(dutyUnits[0]?.id || '');
                            }}
                          >
                            Allocate Unit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agency Allocation Modal */}
      <DefaultFloatingModalCard
        isOpen={allocatingReport !== null}
        onClose={() => setAllocatingReport(null)}
        title={`Dispatch Agency for ${allocatingReport?.referenceCode}`}
        maxWidth="md"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate-300">
            Select an active emergency unit to dispatch to incident{' '}
            <strong className="text-white">{allocatingReport?.title}</strong>:
          </p>

          <div className="flex flex-col gap-2">
            {dutyUnits.map((unit) => (
              <label
                key={unit.id}
                className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-colors ${
                  selectedUnitId === unit.id
                    ? 'bg-sky-950/80 border-sky-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="unit_select"
                    checked={selectedUnitId === unit.id}
                    onChange={() => setSelectedUnitId(unit.id)}
                    className="text-sky-600"
                  />
                  <div>
                    <p className="font-bold text-xs">{unit.unitName} ({unit.unitCode})</p>
                    <p className="text-[10px] text-slate-400">Agency: {unit.agency} // Commander: {unit.commanderName}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-emerald-400">
                  {unit.status}
                </span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setAllocatingReport(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleAllocate}>
              Confirm Dispatch
            </Button>
          </div>
        </div>
      </DefaultFloatingModalCard>

      {/* Image Inspection Lightbox */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Incident Evidence Capture Inspection"
      />
    </div>
  );
};
