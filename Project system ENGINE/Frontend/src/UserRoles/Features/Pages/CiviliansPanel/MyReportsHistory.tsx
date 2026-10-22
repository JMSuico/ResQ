// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays real-time status progression of the citizen's filed reports with photo lightbox,
// clean incident reports timeline with deterministic status indicators (PENDING, VERIFIED, DISPATCHED, RESOLVED).
// DO NOT expose private notes from other civilian reporters.

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getMyReports, ReportItem } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';
import { useReportEventBus } from '@/Hooks/useReportEventBus';

type FilterTab = 'all' | 'active' | 'resolved';

export const MyReportsHistory: React.FC = () => {
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadReports = async () => {
    setIsRefreshing(true);
    try {
      const data = await getMyReports();
      setReports(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

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
      if (activeTab === 'resolved') {
        return normalizedStatus === 'RESOLVED';
      }
      if (activeTab === 'active') {
        return normalizedStatus === 'PENDING' || normalizedStatus === 'VERIFIED' || normalizedStatus === 'DISPATCHED';
      }
      return true;
    });
  }, [reports, activeTab]);

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

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      {/* Page Header */}
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
          <button
            type="button"
            onClick={loadReports}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-2 transition-colors min-h-[38px]"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>

          <Link to="/civilian/report">
            <Button variant="danger" size="sm" className="font-bold min-h-[38px]">
              + New Report
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Tabs & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${activeTab === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All Reports ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${activeTab === 'active' ? 'bg-cyan-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Active In-Field ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('resolved')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${activeTab === 'resolved' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-500 px-2">
          Tracking {filteredReports.length} {filteredReports.length === 1 ? 'incident' : 'incidents'}
        </span>
      </div>

      {/* Incident List */}
      <div className="flex flex-col gap-5">
        {filteredReports.length === 0 ? (
          /* Tactical Empty State */
          <div className="tactical-card p-10 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col items-center justify-center gap-4 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
              <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-white">No Emergency Reports in This View</h3>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'all'
                  ? "You have not filed any emergency accident reports yet. If you witness a road collision or disaster, use the 1-Tap SOS or Report Accident button."
                  : activeTab === 'active'
                  ? "No active incidents currently undergoing triage or dispatch."
                  : "No resolved incidents found."}
              </p>
            </div>
            <Link to="/civilian/report">
              <Button variant="danger" size="md" className="font-bold">
                File Emergency Report
              </Button>
            </Link>
          </div>
        ) : (
          filteredReports.map((r) => {
            const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Medium;
            const { normalizedStatus, currentStage, badgeClasses } = getDeterministicStatus(r);

            // Deterministic 4-stage pipeline definitions
            const stages = [
              { key: 'PENDING', label: '1. PENDING', desc: 'Queued in Command' },
              { key: 'VERIFIED', label: '2. VERIFIED', desc: 'Triage Validated' },
              { key: 'DISPATCHED', label: '3. DISPATCHED', desc: r.allocatedUnitCode ? `Unit: ${r.allocatedUnitCode}` : 'Unit En Route' },
              { key: 'RESOLVED', label: '4. RESOLVED', desc: 'Scene Cleared' }
            ];

            return (
              <div
                key={r.id}
                className="tactical-card p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col gap-4 shadow-xl"
              >
                {/* Top Bar: Reference, Badges & Time */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Reference Code */}
                    <span className="font-mono text-xs font-extrabold text-sky-400 bg-sky-950/80 px-2.5 py-1 rounded-md border border-sky-600/40">
                      {r.referenceCode}
                    </span>

                    {/* Severity Tier */}
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                      {r.severity}
                    </span>

                    {/* Deterministic Status Badge */}
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border flex items-center gap-1.5 ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}>
                      {normalizedStatus !== 'RESOLVED' && normalizedStatus !== 'REJECTED' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                      )}
                      <span>{normalizedStatus}</span>
                    </span>

                    {/* Blurry Review Indicator */}
                    {r.isBlurry && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/50">
                        ⚠️ Low Blur Score (Manual Review)
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    Filed {formatRelativeTime(r.createdAt)} ({formatIsoTimestamp(r.createdAt)})
                  </span>
                </div>

                {/* Main Content: Thumbnail & Details */}
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  {/* Photo Evidence with HUD Target */}
                  {r.hasImage && r.imageUrl ? (
                    <div
                      onClick={() => setLightboxImageUrl(r.imageUrl || null)}
                      className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden border border-slate-700/80 flex-shrink-0 cursor-pointer group shadow-md"
                      title="Click to view evidence photo in full size"
                    >
                      <img src={r.imageUrl} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-transparent transition-colors" />

                      {/* Corner Target Brackets */}
                      <div className="absolute top-1 left-1 w-2 h-2 border-t border-l border-sky-400 pointer-events-none" />
                      <div className="absolute bottom-1 right-1 w-2 h-2 border-b border-r border-sky-400 pointer-events-none" />

                      <div className="absolute bottom-1 inset-x-1 bg-slate-950/90 py-0.5 text-center text-[9px] font-mono text-sky-300 rounded border border-slate-700/50">
                        🔍 Inspect
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-600 flex-shrink-0">
                      <span className="text-2xl">🚨</span>
                      <span className="text-[9px] font-mono text-slate-500 mt-1">No Photo</span>
                    </div>
                  )}

                  {/* Incident Info */}
                  <div className="flex flex-col gap-1.5 flex-grow">
                    <h2 className="text-base font-bold text-white tracking-wide">{r.title}</h2>
                    {r.note && (
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/60">
                        {r.note}
                      </p>
                    )}

                    {/* Geotag & Dispatch Unit Telemetry */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1 text-xs font-mono text-slate-400">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <circle cx="12" cy="11" r="3" strokeWidth="2" />
                        </svg>
                        <span>{r.locationLabel || formatGpsCoord(r.latitude, r.longitude)}</span>
                      </span>

                      {r.allocatedUnitCode && (
                        <span className="flex items-center gap-1.5 text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-600/30">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                          <span>Dispatched: {r.allocatedUnitCode}</span>
                        </span>
                      )}

                      {r.hasImage && (
                        <button
                          type="button"
                          onClick={() => setLightboxImageUrl(r.imageUrl || null)}
                          className="text-xs text-sky-400 hover:text-sky-300 font-bold underline"
                        >
                          View Evidence Photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* DETERMINISTIC STATUS TIMELINE STEPPER */}
                {normalizedStatus !== 'REJECTED' && (
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-bold">
                      Deterministic Dispatch Pipeline
                    </span>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {stages.map((stage, idx) => {
                        const isCompleted = currentStage > idx;
                        const isCurrent = currentStage === idx;
                        const isPending = currentStage < idx;

                        return (
                          <div
                            key={stage.key}
                            className={`p-2.5 rounded-xl border flex flex-col gap-0.5 transition-all ${
                              isCurrent
                                ? 'bg-cyan-950/60 border-cyan-500 text-white shadow-md shadow-cyan-950/50'
                                : isCompleted
                                ? 'bg-slate-950 border-emerald-500/40 text-slate-200'
                                : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-bold tracking-tight">
                                {stage.label}
                              </span>
                              {isCompleted && (
                                <span className="text-emerald-400 font-bold text-xs">✓</span>
                              )}
                              {isCurrent && (
                                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                              )}
                            </div>
                            <span className="text-[10px] truncate opacity-80">
                              {stage.desc}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Submitted Emergency Evidence Photo"
      />
    </div>
  );
};

export default MyReportsHistory;