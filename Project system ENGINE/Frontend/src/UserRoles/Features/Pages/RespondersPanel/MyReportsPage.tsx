// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Displays situation reports filed by the active responder with KPI telemetry,
// SearchBar, TableCardToggle, continuous auto-refresh, and direct field camera report trigger.
// DO NOT mix personal filed reports with municipal-wide triage queues.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getMyReports, createReport, ReportItem } from '@/Endpoints/reportsApi';
import { useSession } from '@/Hooks/useSession';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { SearchBar } from '@/Shared/SearchBar';
import { TableCardToggle, useTableCardView } from '@/Shared/TableCardToggle';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { CameraCaptureModal, CameraCaptureMetadata } from '@/Shared/CameraCaptureModal';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { Button } from '@/Shared/Button';
import { formatIsoTimestamp, formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS, STATUS_COLORS } from '@/Libs/Assets/data';

export const MyReportsPage: React.FC = () => {
  const { session } = useSession();
  const { coords, isHardwareGeolocated } = useGpsLocation();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [newSeverity, setNewSeverity] = useState<string>('High');
  const [newCategory, setNewCategory] = useState<string>('VehicularAccident');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const { viewMode, setViewMode } = useTableCardView('card');

  const loadReports = useCallback(async () => {
    try {
      const data = await getMyReports();
      setReports(data || []);
    } catch (err) {
      console.error('Failed to load my reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useValueRefreshAuto(loadReports, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // KPI telemetry metrics
  const totalReports = reports.length;
  const activeReportsCount = useMemo(
    () => reports.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected').length,
    [reports]
  );
  const verifiedReportsCount = useMemo(
    () => reports.filter((r) => r.verifiedAt || r.status === 'Verified' || r.status === 'Allocated' || r.status === 'EnRoute' || r.status === 'OnScene').length,
    [reports]
  );
  const resolvedReportsCount = useMemo(
    () => reports.filter((r) => r.status === 'Resolved').length,
    [reports]
  );

  // Filtered & searched reports
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterStatus === 'ACTIVE' && (r.status === 'Resolved' || r.status === 'Rejected')) return false;
      if (filterStatus === 'RESOLVED' && r.status !== 'Resolved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const refMatch = r.referenceCode?.toLowerCase().includes(q);
        const titleMatch = r.title?.toLowerCase().includes(q);
        const locMatch = r.locationLabel?.toLowerCase().includes(q);
        const noteMatch = r.note?.toLowerCase().includes(q);
        if (!refMatch && !titleMatch && !locMatch && !noteMatch) return false;
      }
      return true;
    });
  }, [reports, filterStatus, searchQuery]);

  const handleCapture = (dataUrl: string, _meta: CameraCaptureMetadata) => {
    setCapturedImage(dataUrl);
    setIsCameraOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await createReport({
        title: newTitle.trim(),
        note: newNote.trim(),
        category: newCategory,
        severity: newSeverity,
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationLabel: 'Field Responder Geotag',
        imageDataUrl: capturedImage || undefined,
        isHardwareGeolocated
      });
      showToast('SITUATION REPORT LOGGED & BROADCAST TO DISPATCH');
      setIsCreateModalOpen(false);
      setNewTitle('');
      setNewNote('');
      setCapturedImage(null);
      await loadReports();
    } catch (err) {
      console.error(err);
      showToast('FAILED TO TRANSMIT REPORT');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-10 w-full">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header with Log Report Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-sky-400">FIELD OPERATIONAL LOGS</span>
            <span className="text-slate-600 font-mono">|</span>
            <span className="text-xs font-mono text-slate-400">UNIT: {session?.unit || 'RHU'}</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">My Submitted Situation Reports</h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Emergency incidents and tactical field assessments logged from this unit terminal
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCameraOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-950/60 active:scale-95 transition-all"
        >
          <span>📸</span>
          <span>LOG FIELD INCIDENT</span>
        </button>
      </div>

      {/* 1. 4 TELEMETRY KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-sky-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">TOTAL LOGGED</span>
            <span className="w-2 h-2 rounded-full bg-sky-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-white">{totalReports}</span>
            <span className="text-xs font-mono text-sky-400 font-bold">REPORTS</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">LIFETIME LOGS</div>
        </div>

        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-amber-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">ACTIVE IN ACTION</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-amber-400">{activeReportsCount}</span>
            <span className="text-xs font-mono text-amber-300 font-bold">ACTIVE</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">ONGOING OPERATIONS</div>
        </div>

        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-cyan-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">VERIFIED ACTIONED</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-cyan-400">{verifiedReportsCount}</span>
            <span className="text-xs font-mono text-cyan-300 font-bold">VERIFIED</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">VALIDATED EVIDENCE</div>
        </div>

        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">RESOLVED MISSIONS</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-emerald-400">{resolvedReportsCount}</span>
            <span className="text-xs font-mono text-emerald-300 font-bold">CLOSED</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">SUCCESSFUL RESOLUTION</div>
        </div>
      </div>

      {/* 2. SEARCH, FILTER TABS & TABLE-TO-CARD SWITCHER */}
      <div className="tactical-card p-4 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
              filterStatus === 'ALL' ? 'bg-sky-500 text-slate-950 border-sky-400' : 'bg-slate-950 text-slate-300 border-slate-800'
            }`}
          >
            ALL ({reports.length})
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
              filterStatus === 'ACTIVE' ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-amber-400 border-slate-800'
            }`}
          >
            ACTIVE ({activeReportsCount})
          </button>
          <button
            onClick={() => setFilterStatus('RESOLVED')}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
              filterStatus === 'RESOLVED' ? 'bg-emerald-500 text-slate-950 border-emerald-400' : 'bg-slate-950 text-emerald-400 border-slate-800'
            }`}
          >
            RESOLVED ({resolvedReportsCount})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search code, title, street..."
            className="w-full sm:w-60"
          />
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* 3. REPORT ITEMS FEED (CARD GRID OR TABLE) */}
      {loading ? (
        <div className="tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse">
          LOADING SITUATION REPORTS...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="tactical-card p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
          <div className="text-3xl mb-2">📋</div>
          <h3 className="text-base font-bold text-white font-mono">NO SITUATION REPORTS FOUND</h3>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Tap &quot;LOG FIELD INCIDENT&quot; above to capture a camera snapshot and file an incident.
          </p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((r) => {
            const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Medium;
            const stat = STATUS_COLORS[r.status] || STATUS_COLORS.Reported;

            return (
              <div
                key={r.id}
                onClick={() => setSelectedReport(r)}
                className="tactical-card p-5 border border-slate-800 bg-slate-950/90 hover:border-sky-500/70 transition-all rounded-xl cursor-pointer group shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400 group-hover:underline">
                        {r.referenceCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                        {r.severity}
                      </span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${stat.bg} ${stat.text}`}>
                      {r.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white line-clamp-1">{r.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.note || 'No notes provided.'}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between font-mono text-[11px] text-slate-400">
                  <span className="truncate max-w-[180px]">
                    📍 {r.locationLabel || formatGpsCoord(r.latitude, r.longitude)}
                  </span>
                  <div className="flex items-center gap-2">
                    {r.hasImage && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxImageUrl(r.imageUrl || null);
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold hover:bg-slate-700"
                      >
                        Photo 📸
                      </button>
                    )}
                    <span className="text-sky-300 font-bold">{formatRelativeTime(r.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-2xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Ref Code</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Headline</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredReports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => setSelectedReport(r)}
                  className="hover:bg-slate-900/60 transition-colors cursor-pointer"
                >
                  <td className="p-3.5 text-sky-400 font-bold whitespace-nowrap">{r.referenceCode}</td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                      {r.severity}
                    </span>
                  </td>
                  <td className="p-3.5 text-white font-sans font-medium">{r.title}</td>
                  <td className="p-3.5 text-slate-300">{r.category}</td>
                  <td className="p-3.5 text-slate-400 truncate max-w-[180px]">
                    {r.locationLabel || formatGpsCoord(r.latitude, r.longitude)}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      {r.status}
                    </span>
                  </td>
                  <td className="p-3.5 whitespace-nowrap text-slate-400">{formatRelativeTime(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Detail Drill-down Modal */}
      {selectedReport && (
        <DefaultFloatingModalCard
          isOpen={selectedReport !== null}
          onClose={() => setSelectedReport(null)}
          title={`SITUATION REPORT // ${selectedReport.referenceCode}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-slate-200 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-sky-400 font-bold text-xs">{selectedReport.referenceCode}</span>
                <h3 className="text-lg font-bold text-white font-sans mt-0.5">{selectedReport.title}</h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-sky-950 text-sky-300 border border-sky-500 font-bold">
                {selectedReport.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">CATEGORY</span>
                <span className="text-white font-bold">{selectedReport.category}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-slate-500 block text-[10px]">SEVERITY</span>
                <span className="text-rose-400 font-bold">{selectedReport.severity}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 col-span-2">
                <span className="text-slate-500 block text-[10px]">COORDINATES &amp; LOCATION</span>
                <span className="text-emerald-400 font-bold">
                  {formatGpsCoord(selectedReport.latitude, selectedReport.longitude)}
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">{selectedReport.locationLabel || 'N/A'}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-500 block text-[10px] mb-1">FIELD NOTES</span>
              <p className="text-slate-200 leading-relaxed font-sans">{selectedReport.note || 'No notes provided.'}</p>
            </div>

            {selectedReport.imageUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-800">
                <img src={selectedReport.imageUrl} alt="Report site" className="w-full h-48 object-cover" />
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
                Close
              </Button>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
        title="Capture Field Situation Photo"
      />

      {/* Create Report Form Modal */}
      {isCreateModalOpen && (
        <DefaultFloatingModalCard
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="LOG TACTICAL SITUATION REPORT"
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleCreateReport} className="flex flex-col gap-4 text-xs font-mono">
            {capturedImage && (
              <div className="rounded-lg overflow-hidden border border-emerald-500/50 h-36">
                <img src={capturedImage} alt="Snapshot" className="w-full h-full object-cover" />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-bold">INCIDENT HEADLINE / TITLE *</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Road Collision at KM 284"
                required
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-bold">CATEGORY</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="VehicularAccident">Vehicular Accident</option>
                  <option value="MedicalEmergency">Medical Emergency</option>
                  <option value="StructuralFire">Structural Fire</option>
                  <option value="HazardFixture">Hazard Fixture</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-300 font-bold">SEVERITY</label>
                <select
                  value={newSeverity}
                  onChange={(e) => setNewSeverity(e.target.value)}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-300 font-bold">OBSERVATIONS &amp; STATUS</label>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
                placeholder="Details of casualties, road clearance, unit actions..."
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" type="submit" isLoading={isSubmitting}>
                Broadcast Report 📡
              </Button>
            </div>
          </form>
        </DefaultFloatingModalCard>
      )}

      {/* Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Situation Report Photo"
      />
    </div>
  );
};

export default MyReportsPage;
