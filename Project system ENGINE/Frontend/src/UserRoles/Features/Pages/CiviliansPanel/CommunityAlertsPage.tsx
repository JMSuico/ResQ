// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public community safety alerts and official advisories stream for residents.
// High-urgency, modern, and accessible tactical broadcast feed.
// DO NOT hide severe weather or evacuation advisories from residents.

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getPublicAlerts } from '@/Endpoints/civilianPortalApi';
import { AlertItem } from '@/Endpoints/reportsApi';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';

type SeverityFilter = 'all' | 'Critical' | 'High' | 'Medium';

export const CommunityAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<SeverityFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAlerts = async () => {
    setIsRefreshing(true);
    try {
      const data = await getPublicAlerts();
      setAlerts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      const matchesSeverity = filterSeverity === 'all' || a.severity === filterSeverity;
      const matchesSearch =
        !searchQuery.trim() ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.referenceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-10">
      {/* Header with Official Civil Defense Verification Seal */}
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

        <button
          type="button"
          onClick={loadAlerts}
          className="self-start sm:self-auto px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-mono flex items-center gap-2 transition-colors min-h-[40px]"
        >
          <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Critical Emergency Banner (if any critical alerts exist) */}
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
                Residents are advised to monitor official guidance and avoid hazardous road sectors.
              </p>
            </div>
          </div>

          <Link
            to="/civilian/report"
            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold font-mono whitespace-nowrap shadow-md shadow-rose-950/60 transition-colors"
          >
            Report Incident →
          </Link>
        </div>
      )}

      {/* Search & Severity Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterSeverity('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${filterSeverity === 'all' ? 'bg-slate-800 text-white border border-slate-700' : 'text-slate-400 hover:text-slate-200'}`}
          >
            All Notices ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('Critical')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${filterSeverity === 'Critical' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-400 hover:text-rose-300'}`}
          >
            Critical ({criticalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('High')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${filterSeverity === 'High' ? 'bg-orange-600 text-white shadow-sm' : 'text-slate-400 hover:text-orange-300'}`}
          >
            High ({highCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterSeverity('Medium')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${filterSeverity === 'Medium' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-amber-300'}`}
          >
            Advisory
          </button>
        </div>

        <div className="relative sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keywords or ref..."
            className="w-full px-3 py-1.5 pl-8 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono"
          />
          <svg className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Advisory Feed */}
      <div className="flex flex-col gap-4">
        {filteredAlerts.length === 0 ? (
          <div className="tactical-card p-10 rounded-2xl bg-slate-900/80 border border-slate-800 text-center flex flex-col items-center justify-center gap-3 shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">All Municipal Sectors Clear</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchQuery || filterSeverity !== 'all'
                ? "No advisories matching the selected filter or search criteria."
                : "No active severe weather or emergency advisories are currently in effect for the municipality."}
            </p>
          </div>
        ) : (
          filteredAlerts.map((a) => {
            const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.Medium;
            const isCritical = a.severity === 'Critical';

            return (
              <div
                key={a.reportId}
                className={`tactical-card p-5 rounded-2xl bg-slate-900/90 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-xl relative overflow-hidden ${
                  isCritical ? 'border-rose-600/40 hover:border-rose-500/70' : 'border-slate-800 hover:border-slate-700/80'
                }`}
              >
                {/* Left Severity Accent Edge */}
                <div
                  className={`absolute left-0 inset-y-0 w-1.5 ${
                    isCritical
                      ? 'bg-rose-500 shadow-[0_0_12px_rgba(225,29,72,0.8)]'
                      : a.severity === 'High'
                      ? 'bg-orange-500'
                      : a.severity === 'Medium'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />

                <div className="flex items-start sm:items-center gap-4 pl-2">
                  {/* Evidence Thumbnail */}
                  {a.hasImage && a.imageUrl ? (
                    <div
                      onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                      className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-slate-700/80 cursor-pointer flex-shrink-0 group shadow-md"
                      title="Inspect evidence photo"
                    >
                      <img
                        src={a.imageUrl}
                        alt={a.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors" />
                      <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 text-center py-0.5 text-[8px] font-mono text-sky-300 border-t border-slate-700/50">
                        View
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                      <span className="text-2xl">📢</span>
                    </div>
                  )}

                  {/* Advisory Text & Metadata */}
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-600/30">
                        {a.referenceCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                        {a.severity}
                      </span>
                      {a.category && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-950 border border-slate-800">
                          {a.category}
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatRelativeTime(a.timestamp)}
                      </span>
                    </div>

                    <h2 className="text-sm sm:text-base font-bold text-white tracking-wide mt-0.5">
                      {a.title}
                    </h2>

                    <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span>LDRRMO VERIFIED</span>
                      </span>
                      <span>•</span>
                      <span>Broadcast: {formatIsoTimestamp(a.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action */}
                {a.hasImage && (
                  <button
                    type="button"
                    onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                    className="self-stretch sm:self-auto px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-sky-400 border border-slate-800 hover:border-sky-500/40 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5 min-h-[44px]"
                  >
                    <span>View Evidence</span>
                    <span>🔍</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Emergency Hotline Quick Reminder Footer Strip */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2.5 text-slate-400">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>Facing an immediate life-threatening emergency? Call municipal dispatch directly:</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="tel:911"
            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors shadow-sm"
          >
            Call 911 (LDRRMO)
          </a>
          <Link
            to="/civilian/hotlines"
            className="text-sky-400 hover:text-sky-300 font-bold underline"
          >
            Full Directory →
          </Link>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Community Advisory Photo Evidence"
      />
    </div>
  );
};

export default CommunityAlertsPage;