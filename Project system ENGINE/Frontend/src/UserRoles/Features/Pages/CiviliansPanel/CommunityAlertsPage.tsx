// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public community safety alerts and official advisories stream for residents.
// High-urgency tactical broadcast feed with SearchBar, TableCardToggle, audio siren toggle,
// severity filtering, and continuous auto-refresh.
// DO NOT hide severe weather or evacuation advisories from residents.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPublicAlerts } from '@/Endpoints/civilianPortalApi';
import { AlertItem } from '@/Endpoints/reportsApi';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { SearchBar } from '@/Shared/SearchBar';
import { TableCardToggle, useTableCardView } from '@/Shared/TableCardToggle';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';

type SeverityFilter = 'all' | 'Critical' | 'High' | 'Medium';

export const CommunityAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<SeverityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sirenMuted, setSirenMuted] = useState<boolean>(false);

  const { viewMode, setViewMode } = useTableCardView('card');

  const loadAlerts = useCallback(async () => {
    try {
      const data = await getPublicAlerts();
      setAlerts(data || []);
    } catch (err) {
      console.error('Failed to load public community alerts:', err);
    }
  }, []);

  // Continuous auto-refresh every 8 seconds
  useValueRefreshAuto(loadAlerts, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
      const matchesSearch =
        !searchQuery.trim() ||
        a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.referenceCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.category && a.category.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSeverity && matchesSearch;
    });
  }, [alerts, filterSeverity, searchQuery]);

  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === 'Critical').length,
    [alerts]
  );
  const highCount = useMemo(
    () => alerts.filter((a) => a.severity === 'High').length,
    [alerts]
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Header with Official Civil Defense Verification Seal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-600/20 text-amber-400 text-xs font-mono font-bold border border-amber-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>AUTHENTICATED MUNICIPAL BROADCAST STREAM</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Community Emergency Advisories</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified public safety notices, weather alerts, road closures, and evacuation advisories from LDRRMO Command
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Siren Audio Toggle */}
          <button
            type="button"
            onClick={() => setSirenMuted((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              sirenMuted
                ? 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                : 'bg-rose-950/80 text-rose-300 border-rose-600/60 shadow-[0_0_12px_rgba(225,29,72,0.3)] animate-pulse'
            }`}
            title={sirenMuted ? 'Unmute Emergency Siren' : 'Mute Emergency Siren'}
          >
            <span>{sirenMuted ? '🔇' : '🚨'}</span>
            <span>{sirenMuted ? 'AUDIO MUTED' : 'AUDIO ACTIVE'}</span>
          </button>

          <Link
            to="/civilian/report"
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono whitespace-nowrap shadow-md shadow-rose-950/60 transition-colors"
          >
            + Report Incident
          </Link>
        </div>
      </div>

      {/* 2. High Priority Warning Banner */}
      {criticalCount > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-slate-950 border border-rose-600/60 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500 flex items-center justify-center text-rose-400 font-black text-lg flex-shrink-0 animate-pulse">
              🚨
            </div>
            <div>
              <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-wider block">
                HIGH-PRIORITY ACTIVE WARNINGS ({criticalCount})
              </span>
              <p className="text-xs text-slate-200 mt-0.5">
                Residents are advised to monitor official guidance, avoid flood-prone zones, and obey traffic cordons.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. Search & Severity Filter Bar with TableCardToggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterSeverity('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              filterSeverity === 'all'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Advisories ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('Critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              filterSeverity === 'Critical'
                ? 'bg-rose-950 text-rose-300 border border-rose-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>Critical ({criticalCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('High')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              filterSeverity === 'High'
                ? 'bg-amber-950 text-amber-300 border border-amber-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            High ({highCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('Medium')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
              filterSeverity === 'Medium'
                ? 'bg-sky-950 text-sky-300 border border-sky-600 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Medium
          </button>
        </div>

        {/* Search & Layout Toggle */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search reference, keyword..."
            className="w-full sm:w-56"
          />
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>
      </div>

      {/* 4. Empty State */}
      {filteredAlerts.length === 0 ? (
        <div className="tactical-card p-12 text-center flex flex-col items-center justify-center gap-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-2xl">
            🛡️
          </div>
          <h3 className="text-base font-bold text-white">All Municipal Sectors Nominal</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchQuery
              ? `No advisories found matching "${searchQuery}".`
              : 'There are currently no active public safety warnings or weather advisories in effect for Katipunan, ZN.'}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* 5. CARD FEED FOR COMMUNITY ADVISORIES */
        <div className="flex flex-col gap-4">
          {filteredAlerts.map((a) => {
            const isCritical = a.severity === 'Critical';
            const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.Low;

            return (
              <div
                key={a.reportId}
                className={`tactical-card p-5 rounded-2xl border transition-all duration-300 shadow-xl flex flex-col gap-3.5 ${
                  isCritical
                    ? 'bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border-rose-600/70 shadow-rose-950/40'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-black text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded border border-amber-600/40">
                      #{a.referenceCode}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${sev.bg} ${sev.text} ${sev.border}`}>
                      {a.severity} Urgency
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {a.category || 'Public Safety'}
                    </span>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    Broadcast {formatRelativeTime(a.timestamp)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <h2 className="text-base font-bold text-white leading-snug">{a.title}</h2>
                    <span className="text-[11px] font-mono text-slate-500">
                      Dispatched by: LDRRMO Emergency Operations Center
                    </span>
                  </div>

                  {a.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                      className="group relative w-20 h-20 rounded-xl overflow-hidden border border-slate-700 hover:border-sky-400 transition-all flex-shrink-0 block"
                    >
                      <img
                        src={a.imageUrl}
                        alt="Advisory visual attachment"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-mono">
                        View
                      </div>
                    </button>
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
                  <th className="p-3.5">Advisory Title</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Severity</th>
                  <th className="p-3.5">Broadcast Time</th>
                  <th className="p-3.5 text-right">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {filteredAlerts.map((a) => {
                  const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.Low;

                  return (
                    <tr key={a.reportId} className="hover:bg-slate-900/60 transition-colors">
                      <td className="p-3.5 text-amber-400 font-bold whitespace-nowrap">
                        #{a.referenceCode}
                      </td>
                      <td className="p-3.5 max-w-sm">
                        <span className="font-sans font-bold text-slate-200 block truncate">{a.title}</span>
                      </td>
                      <td className="p-3.5 text-slate-300 whitespace-nowrap">{a.category || 'General'}</td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${sev.bg} ${sev.text} ${sev.border}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(a.timestamp)}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        {a.imageUrl ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                            className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-sky-400 hover:text-white text-[10px] font-bold"
                          >
                            Inspect Photo
                          </button>
                        ) : (
                          <span className="text-slate-600 text-[10px]">Text Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        isOpen={Boolean(lightboxImageUrl)}
        imageUrl={lightboxImageUrl}
        onClose={() => setLightboxImageUrl(null)}
        title="Official Civil Defense Notice Attachment"
      />
    </div>
  );
};

export default CommunityAlertsPage;