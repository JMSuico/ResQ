// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Feed of dispatches allocated to the active responder agency with tactical progression controls.
// Enhanced tactical mobile dispatch HUD with rapid field legibility, severity chips, and GPS quick navigation triggers.
// DO NOT permit resolution of incidents assigned to external agencies.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getAgencyReports, ReportItem } from '@/Endpoints/reportsApi';
import { verifyReport } from '@/Endpoints/adminGovernanceApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { SearchBar } from '@/Shared/SearchBar';
import { TableCardToggle, useTableCardView } from '@/Shared/TableCardToggle';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { formatIsoTimestamp, formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';

export const UnitIncidentsFeed: React.FC = () => {
  const { session } = useSession();
  const [incidents, setIncidents] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'CRITICAL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [backupModalIncident, setBackupModalIncident] = useState<ReportItem | null>(null);
  const [backupAgency, setBackupAgency] = useState<string>('PNP');
  const [backupNote, setBackupNote] = useState<string>('');
  const { viewMode, setViewMode } = useTableCardView('card');

  const agencyKey = session?.unit || 'RHU';

  const loadIncidents = useCallback(async () => {
    if (!session || session.unit === 'None') return;
    try {
      const data = await getAgencyReports(session.unit);
      setIncidents(data);
    } catch (err) {
      console.error('Failed to load agency incident dispatches:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useValueRefreshAuto(loadIncidents, {
    intervalMs: 6000,
    enabled: true
  });

  useEffect(() => {
    loadIncidents();
  }, [loadIncidents]);

  const showToast = (msg: string) => {
    setActionSuccessToast(msg);
    setTimeout(() => setActionSuccessToast(null), 3000);
  };

  const handleStatusProgression = async (reportId: string, nextStatus: string) => {
    try {
      await verifyReport(reportId, nextStatus, `Status updated to ${nextStatus} by responder ${session?.fullName}`);
      showToast(`DISPATCH [${reportId.slice(0, 8)}] UPDATED TO ${nextStatus.toUpperCase()}`);
      await loadIncidents();
    } catch (err) {
      console.error('Status progression failed:', err);
      showToast(`FAILED TO UPDATE STATUS: ${nextStatus}`);
    }
  };

  const handleQuickNavigate = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyCoordinates = (lat: number, lng: number) => {
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    showToast(`COORDINATES COPIED: ${text}`);
  };

  // Agency Emblem & Title
  const agencyBadge = useMemo(() => {
    switch (session?.unit) {
      case 'RHU':
        return {
          label: 'RHU EMERGENCY MEDICAL SERVICES',
          code: 'RHU-EMS',
          badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          icon: '🚑',
          accent: 'border-l-sky-500'
        };
      case 'FIRE':
        return {
          label: 'BFP BUREAU OF FIRE PROTECTION',
          code: 'BFP-FIRE',
          badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          icon: '🚒',
          accent: 'border-l-orange-500'
        };
      case 'PNP':
        return {
          label: 'PNP POLICE TACTICAL DISPATCH',
          code: 'PNP-POL',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          icon: '🚓',
          accent: 'border-l-indigo-500'
        };
      default:
        return {
          label: 'MUNICIPAL TACTICAL DISPATCH FORCE',
          code: 'LDRRMO',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          icon: '🚨',
          accent: 'border-l-rose-500'
        };
    }
  }, [session?.unit]);

  // Telemetry metric counters
  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === 'Critical' || i.severity === 'High').length,
    [incidents]
  );
  const activeCount = useMemo(
    () => incidents.filter((i) => i.status === 'EnRoute' || i.status === 'OnScene' || i.status === 'Allocated').length,
    [incidents]
  );
  const resolvedCount = useMemo(
    () => incidents.filter((i) => i.status === 'Resolved').length,
    [incidents]
  );

  // Filtered list
  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Filter tab check
      if (filterMode === 'CRITICAL' && inc.severity !== 'Critical' && inc.severity !== 'High') return false;
      if (filterMode === 'ACTIVE' && inc.status !== 'EnRoute' && inc.status !== 'OnScene' && inc.status !== 'Allocated') return false;
      if (filterMode === 'RESOLVED' && inc.status !== 'Resolved') return false;

      // Search query check
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const refMatch = inc.referenceCode?.toLowerCase().includes(query);
        const titleMatch = inc.title?.toLowerCase().includes(query);
        const locMatch = inc.locationLabel?.toLowerCase().includes(query);
        const reporterMatch = inc.reporterName?.toLowerCase().includes(query);
        if (!refMatch && !titleMatch && !locMatch && !reporterMatch) return false;
      }

      return true;
    });
  }, [incidents, filterMode, searchQuery]);

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-8 w-full">
      {/* Toast Notification */}
      {actionSuccessToast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{actionSuccessToast}</span>
        </div>
      )}

      {/* Header & Tactical Telemetry Strip */}
      <div className="tactical-card p-5 bg-slate-900/90 border-2 border-slate-700/80 rounded-xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-black border uppercase tracking-wider ${agencyBadge.badgeClass}`}>
                {agencyBadge.icon} {agencyBadge.label}
              </span>
              <span className="text-slate-600 font-mono">|</span>
              <span className="text-xs font-mono font-bold text-sky-400">UNIT INCIDENTS FEED</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
              Tactical Field Incident Dispatches
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Active operational assignments allocated to {session?.unit || 'Field Unit'} tactical response force
            </p>
          </div>

          {/* Rapid Field Telemetry Badges */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold">TOTAL</span>
              <span className="text-base font-black text-white">{incidents.length}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800/80 flex flex-col items-center">
              <span className="text-[10px] text-rose-400 font-bold">CRITICAL</span>
              <span className="text-base font-black text-rose-400 animate-pulse">{criticalCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-amber-950/60 border border-amber-800/80 flex flex-col items-center">
              <span className="text-[10px] text-amber-400 font-bold">ACTIVE</span>
              <span className="text-base font-black text-amber-400">{activeCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 flex flex-col items-center">
              <span className="text-[10px] text-emerald-400 font-bold">RESOLVED</span>
              <span className="text-base font-black text-emerald-400">{resolvedCount}</span>
            </div>
          </div>
        </div>

        {/* Filter Pills and Quick Search Input */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'ALL'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.5)]'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              ALL DISPATCHES ({incidents.length})
            </button>
            <button
              onClick={() => setFilterMode('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'CRITICAL'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                  : 'bg-slate-950 text-rose-400 border-rose-900/50 hover:border-rose-800'
              }`}
            >
              🚨 CRITICAL / SEVERE ({criticalCount})
            </button>
            <button
              onClick={() => setFilterMode('ACTIVE')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'ACTIVE'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  : 'bg-slate-950 text-amber-400 border-amber-900/50 hover:border-amber-800'
              }`}
            >
              ⚡ ACTIVE QUEUE ({activeCount})
            </button>
            <button
              onClick={() => setFilterMode('RESOLVED')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'RESOLVED'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-950 text-emerald-400 border-emerald-900/50 hover:border-emerald-800'
              }`}
            >
              ✓ RESOLVED ({resolvedCount})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search code, street, title..."
              className="w-full sm:w-60"
            />
            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>
      </div>

      {/* 3. CARD FEED FOR EMERGENCY INCIDENTS */}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse">
            LOADING TACTICAL DISPATCH TELEMETRY...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="tactical-card p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="text-3xl mb-2">📡</div>
            <h3 className="text-base font-bold text-white font-mono">ALL ASSIGNED QUEUES CLEAR</h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              No emergency incidents found matching filter [{filterMode}]. Standing by on frequency.
            </p>
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            // Severity Chip Configuration
            const isCritical = inc.severity === 'Critical';
            const isSevere = inc.severity === 'High';
            const isModerate = inc.severity === 'Medium';

            const severityBadge = isCritical ? (
              <span className="px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 border-2 border-rose-500 text-[10px] font-black uppercase font-mono tracking-wider animate-pulse flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.4)]">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                <span>CRITICAL</span>
              </span>
            ) : isSevere ? (
              <span className="px-2.5 py-0.5 rounded bg-orange-950 text-orange-300 border border-orange-500 text-[10px] font-extrabold uppercase font-mono tracking-wider flex items-center gap-1">
                <span>⚠️</span>
                <span>SEVERE</span>
              </span>
            ) : isModerate ? (
              <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500 text-[10px] font-bold uppercase font-mono tracking-wider">
                MODERATE
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-500 text-[10px] font-bold uppercase font-mono tracking-wider">
                ROUTINE
              </span>
            );

            // Status Badge Configuration
            const statusConfig = {
              Allocated: {
                bg: 'bg-purple-950/80',
                text: 'text-purple-300',
                border: 'border-purple-600/60',
                dot: 'bg-purple-400',
                label: 'PENDING EN ROUTE'
              },
              EnRoute: {
                bg: 'bg-amber-950/80',
                text: 'text-amber-300',
                border: 'border-amber-500',
                dot: 'bg-amber-400 animate-ping',
                label: 'EN ROUTE'
              },
              OnScene: {
                bg: 'bg-cyan-950/80',
                text: 'text-cyan-300',
                border: 'border-cyan-500',
                dot: 'bg-cyan-400 animate-pulse',
                label: 'ON SCENE'
              },
              Resolved: {
                bg: 'bg-emerald-950/80',
                text: 'text-emerald-300',
                border: 'border-emerald-500',
                dot: 'bg-emerald-400',
                label: 'RESOLVED'
              }
            }[inc.status] || {
              bg: 'bg-slate-900',
              text: 'text-slate-300',
              border: 'border-slate-700',
              dot: 'bg-slate-400',
              label: inc.status
            };

            // Card border accent based on severity and status
            const cardBorder = isCritical
              ? 'border-l-4 border-l-rose-500 border-rose-900/60 bg-gradient-to-r from-rose-950/20 via-slate-900/90 to-slate-900/90'
              : inc.status === 'EnRoute'
              ? 'border-l-4 border-l-amber-500 border-amber-900/60 bg-gradient-to-r from-amber-950/20 via-slate-900/90 to-slate-900/90'
              : inc.status === 'OnScene'
              ? 'border-l-4 border-l-cyan-500 border-cyan-900/60 bg-gradient-to-r from-cyan-950/20 via-slate-900/90 to-slate-900/90'
              : 'border-l-4 border-l-slate-700 border-slate-800 bg-slate-900/90';

            return (
              <div
                key={inc.id}
                className={`tactical-card p-5 border rounded-xl shadow-lg transition-all flex flex-col xl:flex-row items-start xl:items-center justify-between gap-5 ${cardBorder}`}
              >
                {/* Left: Visual Evidence & Telemetry Details */}
                <div className="flex flex-col sm:flex-row items-start gap-4 w-full xl:w-auto">
                  {/* Evidence Thumbnail / Tactical Radar Placeholder */}
                  <div className="relative flex-shrink-0">
                    {inc.hasImage && inc.imageUrl ? (
                      <div className="relative group">
                        <img
                          src={inc.imageUrl}
                          alt={inc.title}
                          onClick={() => setLightboxImageUrl(inc.imageUrl || null)}
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg object-cover border-2 border-slate-700 cursor-pointer group-hover:border-sky-400 transition-colors"
                        />
                        <div
                          onClick={() => setLightboxImageUrl(inc.imageUrl || null)}
                          className="absolute inset-0 bg-slate-950/40 group-hover:bg-transparent rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-mono font-bold text-sky-300"
                        >
                          🔍 ZOOM
                        </div>
                        {inc.isHardwareGeolocated && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-slate-950/90 border border-emerald-500 text-[9px] font-mono text-emerald-400 font-bold">
                            🛰️ LOCKED
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-slate-950 border-2 border-slate-800 flex flex-col items-center justify-center text-slate-500">
                        <span className="text-2xl mb-1">{agencyBadge.icon}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-bold">NO PHOTO</span>
                      </div>
                    )}
                  </div>

                  {/* Incident Context & Header */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {/* Reference Code */}
                      <span className="font-mono text-xs font-black text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                        {inc.referenceCode}
                      </span>

                      {/* Agency Badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider ${agencyBadge.badgeClass}`}>
                        {agencyBadge.icon} {session?.unit || 'RHU'}
                      </span>

                      {/* Severity Chip (CRITICAL, SEVERE, MODERATE) */}
                      {severityBadge}

                      {/* Status Chip */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider flex items-center gap-1 ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        <span>{statusConfig.label}</span>
                      </span>

                      {inc.isBlurry && (
                        <span className="px-2 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-500 text-[10px] font-mono font-bold">
                          ⚠️ VERIFY IMAGE
                        </span>
                      )}
                    </div>

                    {/* Incident Title */}
                    <h2 className="text-base sm:text-lg font-black text-white tracking-wide">
                      {inc.title}
                    </h2>

                    {/* Operational Note */}
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl font-sans leading-relaxed">
                      {inc.note || 'No specific field dispatcher annotations provided.'}
                    </p>

                    {/* Map Coordinates & Field Telemetry Row */}
                    <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 mt-3 text-xs font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                      {/* Interactive Map Coordinates */}
                      <div className="flex items-center gap-1 text-sky-300 font-bold">
                        <span>📍</span>
                        <span
                          onClick={() => copyCoordinates(inc.latitude, inc.longitude)}
                          className="hover:underline cursor-pointer tracking-wider"
                          title="Click to copy GPS coordinates"
                        >
                          {formatGpsCoord(inc.latitude, inc.longitude)}
                        </span>
                      </div>

                      {inc.locationLabel && (
                        <span className="text-slate-300 truncate max-w-xs">
                          🏢 {inc.locationLabel}
                        </span>
                      )}

                      <span>👤 {inc.reporterName || 'Civilian Resident'}</span>
                      <span className="text-slate-400">🕒 {formatRelativeTime(inc.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Quick Action Progression Triggers */}
                <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto justify-end pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-800">
                  {/* Quick Navigation Trigger */}
                  {/* Quick Navigation Trigger */}
                  <button
                    type="button"
                    onClick={() => handleQuickNavigate(inc.latitude, inc.longitude)}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md"
                    title="Launch external GPS navigation route"
                  >
                    <span>🧭</span>
                    <span>NAVIGATE GPS</span>
                  </button>

                  {/* Cross-Agency Backup Trigger */}
                  <button
                    type="button"
                    onClick={() => {
                      setBackupModalIncident(inc);
                      setBackupNote(`Requesting immediate backup support at ${inc.locationLabel || 'Incident Location'}`);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/50 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all shadow-md"
                    title="Request cross-agency backup"
                  >
                    <span>🛡️</span>
                    <span>CALL BACKUP</span>
                  </button>

                  {/* Evidence Inspection */}
                  {inc.hasImage && (
                    <button
                      type="button"
                      onClick={() => setLightboxImageUrl(inc.imageUrl || null)}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold uppercase tracking-wider active:scale-95 transition-all"
                    >
                      <span>📸</span>
                      <span>EVIDENCE</span>
                    </button>
                  )}

                  {/* Status Progression Tactile Buttons */}
                  {inc.status === 'Allocated' && (
                    <button
                      type="button"
                      onClick={() => handleStatusProgression(inc.id, 'EnRoute')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider border border-white shadow-[0_0_15px_rgba(245,158,11,0.5)] active:scale-95 transition-all"
                    >
                      <span>🚨</span>
                      <span>DEPLOY EN ROUTE</span>
                    </button>
                  )}

                  {inc.status === 'EnRoute' && (
                    <button
                      type="button"
                      onClick={() => handleStatusProgression(inc.id, 'OnScene')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-mono text-xs font-black uppercase tracking-wider border border-white shadow-[0_0_15px_rgba(34,211,238,0.5)] active:scale-95 transition-all"
                    >
                      <span>📍</span>
                      <span>ARRIVED ON SCENE</span>
                    </button>
                  )}

                  {inc.status === 'OnScene' && (
                    <button
                      type="button"
                      onClick={() => handleStatusProgression(inc.id, 'Resolved')}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider border border-white shadow-[0_0_15px_rgba(16,185,129,0.5)] active:scale-95 transition-all"
                    >
                      <span>✓</span>
                      <span>COMPLETE &amp; RESOLVED</span>
                    </button>
                  )}

                  {inc.status === 'Resolved' && (
                    <div className="px-3 py-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold flex items-center gap-1.5">
                      <span>✓</span>
                      <span>MISSION COMPLETE</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Structured Tactical Table View when Table Mode is Active */}
      {viewMode === 'table' && filteredIncidents.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-2xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Ref Code</th>
                <th className="p-3.5">Severity</th>
                <th className="p-3.5">Title / Summary</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Tactical Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {filteredIncidents.map((inc) => (
                <tr key={inc.id} className="hover:bg-slate-900/60 transition-colors">
                  <td className="p-3.5 text-sky-400 font-bold whitespace-nowrap">{inc.referenceCode}</td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        inc.severity === 'Critical'
                          ? 'bg-rose-950 text-rose-300 border border-rose-600'
                          : 'bg-amber-950 text-amber-300 border border-amber-600'
                      }`}
                    >
                      {inc.severity}
                    </span>
                  </td>
                  <td className="p-3.5 text-white font-sans font-medium">{inc.title}</td>
                  <td className="p-3.5 text-slate-300">{inc.category}</td>
                  <td className="p-3.5 text-slate-400 truncate max-w-[180px]">
                    {inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude)}
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      {inc.status}
                    </span>
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickNavigate(inc.latitude, inc.longitude)}
                        className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px]"
                      >
                        Navigate ↗
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setBackupModalIncident(inc);
                          setBackupNote(`Requesting immediate backup support at ${inc.locationLabel || 'Incident Location'}`);
                        }}
                        className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px]"
                      >
                        Backup 🛡️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Lightbox Modal for Full Field Photo Verification */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Field Incident Photographic Evidence"
      />

      {/* Cross-Agency Backup Request Modal */}
      {backupModalIncident && (
        <DefaultFloatingModalCard
          isOpen={backupModalIncident !== null}
          onClose={() => setBackupModalIncident(null)}
          title={`REQUEST CROSS-AGENCY BACKUP // ${backupModalIncident.referenceCode}`}
          maxWidth="max-w-lg"
        >
          <div className="flex flex-col gap-4 text-slate-200">
            <div className="p-3 rounded-lg bg-indigo-950/40 border border-indigo-500/50 text-xs">
              <span className="font-bold text-indigo-300 block mb-1">Incident Operational Context:</span>
              <p className="text-white font-bold">{backupModalIncident.title}</p>
              <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                Location: {backupModalIncident.locationLabel || formatGpsCoord(backupModalIncident.latitude, backupModalIncident.longitude)}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">REQUEST ASSISTANCE FROM AGENCY:</label>
              <div className="grid grid-cols-3 gap-2">
                {(['RHU', 'FIRE', 'PNP'] as const).map((ag) => (
                  <button
                    key={ag}
                    type="button"
                    onClick={() => setBackupAgency(ag)}
                    className={`py-2 px-3 rounded-lg font-mono text-xs font-bold border transition-all ${
                      backupAgency === ag
                        ? 'bg-indigo-600 text-white border-white shadow-lg'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {ag === 'RHU' ? '🚑 RHU Medics' : ag === 'FIRE' ? '🚒 BFP Fire' : '🚓 PNP Police'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono font-bold text-slate-300">TACTICAL SITUATION NOTE:</label>
              <textarea
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                placeholder="Reason for backup (e.g., severe road blockage, hostile crowd, 2nd casualty needing ambulance)..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBackupModalIncident(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  showToast(`CROSS-AGENCY BACKUP TRANSMITTED TO ${backupAgency} CENTRAL`);
                  setBackupModalIncident(null);
                }}
              >
                Transmit Backup Request 📡
              </Button>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}
    </div>
  );
};

export default UnitIncidentsFeed;