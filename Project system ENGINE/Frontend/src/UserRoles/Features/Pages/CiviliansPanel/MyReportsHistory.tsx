// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays real-time status progression of citizen's filed reports with photo lightbox,
// SearchBar, TableCardToggle, continuous auto-refresh, approaching unit badge, and citizen post-resolution feedback.
// DO NOT expose private notes from other civilian reporters.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getMyReports, ReportItem } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { SearchBar } from '@/Shared/SearchBar';
import { TableCardToggle, useTableCardView } from '@/Shared/TableCardToggle';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { formatIsoTimestamp, formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';
import { useReportEventBus } from '@/Hooks/useReportEventBus';

type FilterTab = 'all' | 'active' | 'resolved';

export const MyReportsHistory: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedFeedbackReport, setSelectedFeedbackReport] = useState<ReportItem | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSuccessToast, setFeedbackSuccessToast] = useState<string | null>(null);

  const { viewMode, setViewMode } = useTableCardView('card');

  const loadReports = useCallback(async () => {
    try {
      const data = await getMyReports();
      setReports(data || []);
    } catch (err) {
      console.error('Failed to load citizen reports history:', err);
    }
  }, []);

  // Continuous auto-refresh every 8 seconds
  useValueRefreshAuto(loadReports, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useReportEventBus(() => {
    loadReports();
  });

  // Helper for deterministic status calculation
  // Stage 0: PENDING
  // Stage 1: VERIFIED
  // Stage 2: DISPATCHED (Allocated / EnRoute / OnScene)
  // Stage 3: RESOLVED
  const getDeterministicStatus = (r: ReportItem): {
    normalizedStatus: 'PENDING' | 'VERIFIED' | 'DISPATCHED' | 'RESOLVED' | 'REJECTED';
    currentStage: number; // 0, 1, 2, 3 (or -1 for rejected)
    badgeClasses: { bg: string; text: string; border: string };
  } => {
    const raw = (r.status || 'Reported').toUpperCase();

    if (raw === 'REJECTED') {
      return {
        normalizedStatus: 'REJECTED',
        currentStage: -1,
        badgeClasses: { bg: 'bg-rose-950/80', text: 'text-rose-400', border: 'border-rose-600/50' }
      };
    }

    if (raw === 'RESOLVED' || r.resolvedAt) {
      return {
        normalizedStatus: 'RESOLVED',
        currentStage: 3,
        badgeClasses: { bg: 'bg-emerald-950/80', text: 'text-emerald-400', border: 'border-emerald-500/50' }
      };
    }

    if (raw === 'ALLOCATED' || raw === 'ENROUTE' || raw === 'ONSCENE' || r.allocatedUnitCode) {
      return {
        normalizedStatus: 'DISPATCHED',
        currentStage: 2,
        badgeClasses: { bg: 'bg-cyan-950/80', text: 'text-cyan-400', border: 'border-cyan-500/50' }
      };
    }

    if (raw === 'VERIFIED' || r.verifiedAt) {
      return {
        normalizedStatus: 'VERIFIED',
        currentStage: 1,
        badgeClasses: { bg: 'bg-indigo-950/80', text: 'text-indigo-400', border: 'border-indigo-500/50' }
      };
    }

    // Default is PENDING
    return {
      normalizedStatus: 'PENDING',
      currentStage: 0,
      badgeClasses: { bg: 'bg-amber-950/80', text: 'text-amber-400', border: 'border-amber-500/50' }
    };
  };

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const { normalizedStatus } = getDeterministicStatus(r);
      if (activeTab === 'resolved' && normalizedStatus !== 'RESOLVED') return false;
      if (activeTab === 'active' && !(normalizedStatus === 'PENDING' || normalizedStatus === 'VERIFIED' || normalizedStatus === 'DISPATCHED')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const codeMatch = r.referenceCode?.toLowerCase().includes(q);
        const titleMatch = r.title?.toLowerCase().includes(q);
        const locMatch = r.locationLabel?.toLowerCase().includes(q);
        const catMatch = r.category?.toLowerCase().includes(q);
        const statusMatch = normalizedStatus.toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !locMatch && !catMatch && !statusMatch) return false;
      }

      return true;
    });
  }, [reports, activeTab, searchQuery]);

  const activeCount = useMemo(() => {
    return reports.filter((r) => {
      const { normalizedStatus } = getDeterministicStatus(r);
      return normalizedStatus === 'PENDING' || normalizedStatus === 'VERIFIED' || normalizedStatus === 'DISPATCHED';
    }).length;
  }, [reports]);

  const resolvedCount = useMemo(() => {
    return reports.filter((r) => {
      const { normalizedStatus } = getDeterministicStatus(r);
      return normalizedStatus === 'RESOLVED';
    }).length;
  }, [reports]);

  const handleSubmitFeedback = () => {
    if (!selectedFeedbackReport) return;
    setFeedbackSuccessToast(`Thank you! Response rating submitted for #${selectedFeedbackReport.referenceCode}.`);
    setSelectedFeedbackReport(null);
    setFeedbackComment('');
    setTimeout(() => setFeedbackSuccessToast(null), 5000);
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-sky-600/20 text-sky-400 text-xs font-mono font-bold border border-sky-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
            <span>INCIDENT LIFECYCLE AUDIT</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">My Emergency Reports Timeline</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time status progression from submission through dispatch and final resolution
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/civilian/report">
            <Button variant="danger" size="sm" className="font-bold min-h-[38px]">
              + File New Report
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Feedback Success Toast */}
      {feedbackSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/95 border border-emerald-500 text-emerald-200 text-xs font-medium flex items-center gap-3 shadow-lg shadow-emerald-950/50">
          <span className="text-base">✓</span>
          <span>{feedbackSuccessToast}</span>
        </div>
      )}

      {/* 3. Filter Tabs, Search Bar, and TableCardToggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Reports ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'active'
                ? 'bg-rose-950/80 text-rose-300 border border-rose-600/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Active & Dispatched ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              activeTab === 'resolved'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        {/* Search & Layout Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search code, title, address..."
            className="w-full sm:w-56"
          />
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* 4. Empty State */}
      {filteredReports.length === 0 ? (
        <div className="tactical-card p-12 text-center flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl">
            📋
          </div>
          <h3 className="text-base font-bold text-white">No Emergency Reports Found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchQuery
              ? `No records matching "${searchQuery}". Clear your search query to view all.`
              : 'You have not submitted any emergency accident reports yet. Reports filed via 1-Tap SOS or the detailed reporting form will be tracked here in real-time.'}
          </p>
          <Link to="/civilian/report" className="mt-2">
            <Button variant="danger" size="sm" className="font-bold">
              Submit Incident Report
            </Button>
          </Link>
        </div>
      ) : viewMode === 'card' ? (
        /* 5. CARD VIEW: DETAILED INTERACTIVE PROGRESSION TIMELINE */
        <div className="flex flex-col gap-5">
          {filteredReports.map((r) => {
            const { normalizedStatus, currentStage, badgeClasses } = getDeterministicStatus(r);
            const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Low;

            return (
              <div
                key={r.id}
                className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl flex flex-col gap-4"
              >
                {/* Header Row: Title, Reference Code, Severity */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-sky-400 bg-sky-950/80 px-2.5 py-0.5 rounded border border-sky-600/40">
                        #{r.referenceCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${sev.bg} ${sev.text} ${sev.border}`}>
                        {r.severity} Severity
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {r.category || 'Road Collision'}
                      </span>
                    </div>

                    <h2 className="text-base font-bold text-white mt-1">{r.title}</h2>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span>📍</span>
                      <span>{r.locationLabel || 'Katipunan Municipal Road Sector'}</span>
                      <span className="text-slate-600">•</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatGpsCoord(r.latitude, r.longitude)}
                      </span>
                    </span>
                  </div>

                  {/* Status Badge & Approaching Unit Indicator */}
                  <div className="flex flex-col sm:items-end gap-1.5">
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase border ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}>
                      ● {normalizedStatus}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      Filed {formatRelativeTime(r.createdAt)}
                    </span>

                    {normalizedStatus === 'DISPATCHED' && r.allocatedUnitCode && (
                      <span className="mt-1 px-2.5 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 font-mono text-[10px] font-bold flex items-center gap-1.5 animate-pulse">
                        <span>🚑 Unit En Route:</span>
                        <strong className="text-white">{r.allocatedUnitCode}</strong>
                      </span>
                    )}

                    {normalizedStatus === 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={() => setSelectedFeedbackReport(r)}
                        className="mt-1 text-[11px] font-mono text-emerald-400 hover:text-emerald-300 font-bold underline text-right"
                      >
                        ★ Rate Response Quality
                      </button>
                    )}
                  </div>
                </div>

                {/* Real-time Stepped Incident Progression Bar */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-bold">
                    <span className={currentStage >= 0 ? 'text-amber-400' : 'text-slate-500'}>1. Submitted</span>
                    <span className={currentStage >= 1 ? 'text-indigo-400' : 'text-slate-500'}>2. Command Verified</span>
                    <span className={currentStage >= 2 ? 'text-cyan-400' : 'text-slate-500'}>3. Units Dispatched</span>
                    <span className={currentStage >= 3 ? 'text-emerald-400' : 'text-slate-500'}>4. Resolved</span>
                  </div>

                  <div className="relative w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 rounded-full ${
                        currentStage === 3
                          ? 'w-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                          : currentStage === 2
                          ? 'w-3/4 bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                          : currentStage === 1
                          ? 'w-1/2 bg-gradient-to-r from-amber-500 to-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]'
                          : 'w-1/4 bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]'
                      }`}
                    />
                  </div>
                </div>

                {/* Note and Photo Lightbox Trigger */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  {r.note && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex-1 leading-relaxed">
                      <span className="text-slate-500 font-mono text-[10px] uppercase block mb-1">REPORTER FIELD NOTES:</span>
                      {r.note}
                    </p>
                  )}

                  {r.imageUrl && (
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setLightboxImageUrl(r.imageUrl || null)}
                        className="group relative w-24 h-24 rounded-xl overflow-hidden border border-slate-700 hover:border-sky-400 transition-all shadow-md block"
                      >
                        <img
                          src={r.imageUrl}
                          alt="Incident scene capture"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono font-bold">
                          🔍 Zoom
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 6. TACTICAL TABLE VIEW */
        <div className="tactical-card rounded-xl border border-slate-800 overflow-hidden bg-slate-950/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Ref Code</th>
                  <th className="p-3.5">Headline & Sector</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Dispatched Unit</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {filteredReports.map((r) => {
                  const { normalizedStatus, badgeClasses } = getDeterministicStatus(r);
                  const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Low;

                  return (
                    <tr key={r.id} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-3.5 text-sky-400 font-bold whitespace-nowrap">
                        #{r.referenceCode}
                      </td>
                      <td className="p-3.5 max-w-xs">
                        <span className="font-sans font-bold text-slate-200 block truncate">{r.title}</span>
                        <span className="text-[10px] text-slate-400 truncate block">{r.locationLabel}</span>
                      </td>
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">{r.category}</td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sev.bg} ${sev.text} ${sev.border}`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}>
                          {normalizedStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">
                        {r.allocatedUnitCode ? (
                          <span className="text-cyan-400 font-bold">{r.allocatedUnitCode}</span>
                        ) : (
                          <span className="text-slate-500">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {r.imageUrl && (
                            <button
                              type="button"
                              onClick={() => setLightboxImageUrl(r.imageUrl || null)}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-[10px]"
                            >
                              Photo
                            </button>
                          )}
                          {normalizedStatus === 'RESOLVED' && (
                            <button
                              type="button"
                              onClick={() => setSelectedFeedbackReport(r)}
                              className="px-2 py-1 rounded bg-emerald-950 border border-emerald-600/50 text-emerald-300 text-[10px] font-bold"
                            >
                              Rate ★
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Citizen Response Quality Rating Modal */}
      <DefaultFloatingModalCard
        isOpen={Boolean(selectedFeedbackReport)}
        onClose={() => setSelectedFeedbackReport(null)}
        title="Emergency Response Quality Survey"
        size="sm"
      >
        {selectedFeedbackReport && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <span className="text-slate-500 block mb-0.5">RESOLVED INCIDENT:</span>
              <span className="font-bold text-white block">#{selectedFeedbackReport.referenceCode} - {selectedFeedbackReport.title}</span>
              <span className="text-emerald-400 text-[10px] block mt-1">Dispatched: {selectedFeedbackReport.allocatedUnitCode || 'Municipal Response Apparatus'}</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-200">
                How would you rate the speed & professionalism of responders?
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className={`text-2xl transition-transform hover:scale-125 ${
                      star <= feedbackRating ? 'text-amber-400' : 'text-slate-700'
                    }`}
                  >
                    ★
                  </button>
                ))}
                <span className="ml-2 font-mono text-xs font-bold text-slate-300">
                  {feedbackRating === 5 && 'Outstanding (5/5)'}
                  {feedbackRating === 4 && 'Good (4/5)'}
                  {feedbackRating === 3 && 'Acceptable (3/5)'}
                  {feedbackRating <= 2 && 'Needs Improvement'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-300">
                Feedback for LDRRMO Administration <span className="text-slate-500">(Optional)</span>
              </label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                rows={3}
                placeholder="Share your experience regarding ambulance/medic arrival time, cordon efficiency..."
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleSubmitFeedback}
                className="flex-1 font-bold text-xs"
              >
                Submit Citizen Feedback
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setSelectedFeedbackReport(null)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DefaultFloatingModalCard>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImageUrl)}
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
        title="Field Incident Evidence Inspection"
      />
    </div>
  );
};

export default MyReportsHistory;