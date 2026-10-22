// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Agency-filtered emergency alerts feed for field responders.
// Tactical mobile dispatch unit HUD with rapid field legibility, severity chips, and quick acknowledge controls.
// DO NOT hide critical severity alerts from tactical units.

import React, { useState, useEffect, useMemo } from 'react';
import { getAlerts, markAlertRead, AlertItem } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';

export const ResponderAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNREAD' | 'CRITICAL' | 'ACKNOWLEDGED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [acknowledgeToast, setAcknowledgeToast] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load responder alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const showToast = (msg: string) => {
    setAcknowledgeToast(msg);
    setTimeout(() => setAcknowledgeToast(null), 3000);
  };

  const handleMarkRead = async (reportId: string) => {
    try {
      await markAlertRead(reportId);
      setAlerts((prev) =>
        prev.map((a) => (a.reportId === reportId ? { ...a, isRead: true } : a))
      );
      showToast(`ALERT [${reportId.slice(0, 8)}] ACKNOWLEDGED & LOGGED`);
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
      showToast('ERROR ACKNOWLEDGING ALERT');
    }
  };

  // Telemetry metric counts
  const totalAlerts = alerts.length;
  const unreadCount = useMemo(() => alerts.filter((a) => !a.isRead).length, [alerts]);
  const criticalCount = useMemo(
    () => alerts.filter((a) => a.severity === 'Critical' || a.severity === 'High').length,
    [alerts]
  );
  const unreadCriticalCount = useMemo(
    () => alerts.filter((a) => !a.isRead && (a.severity === 'Critical' || a.severity === 'High')).length,
    [alerts]
  );

  // Agency identification helper
  const inferAgencyBadge = (category: string, title: string) => {
    const text = `${category} ${title}`.toLowerCase();
    if (text.includes('medic') || text.includes('casualty') || text.includes('ambulance') || text.includes('trauma')) {
      return { label: 'RHU MEDICAL', icon: '🚑', color: 'bg-sky-500/20 text-sky-300 border-sky-500/50' };
    }
    if (text.includes('fire') || text.includes('flame') || text.includes('smoke') || text.includes('hazmat')) {
      return { label: 'BFP FIRE', icon: '🚒', color: 'bg-orange-500/20 text-orange-300 border-orange-500/50' };
    }
    if (text.includes('police') || text.includes('crime') || text.includes('security') || text.includes('patrol')) {
      return { label: 'PNP POLICE', icon: '🚓', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' };
    }
    return { label: 'LDRRMO COMMAND', icon: '🚨', color: 'bg-rose-500/20 text-rose-300 border-rose-500/50' };
  };

  // Filtered Alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (filterMode === 'UNREAD' && a.isRead) return false;
      if (filterMode === 'CRITICAL' && a.severity !== 'Critical' && a.severity !== 'High') return false;
      if (filterMode === 'ACKNOWLEDGED' && !a.isRead) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const refMatch = a.referenceCode?.toLowerCase().includes(query);
        const titleMatch = a.title?.toLowerCase().includes(query);
        const catMatch = a.category?.toLowerCase().includes(query);
        if (!refMatch && !titleMatch && !catMatch) return false;
      }

      return true;
    });
  }, [alerts, filterMode, searchQuery]);

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-8">
      {/* Toast Feedback */}
      {acknowledgeToast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-sky-400 text-sky-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
          <span>{acknowledgeToast}</span>
        </div>
      )}

      {/* 1. HIGH-CONTRAST EMERGENCY BROADCAST BANNER & TELEMETRY */}
      <div className="tactical-card p-5 bg-slate-900/90 border-2 border-slate-700/80 rounded-xl shadow-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-xs font-mono font-bold text-rose-400">EMERGENCY BROADCAST CHANNEL</span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono text-slate-300">FIELD FREQ: 142.850 MHZ</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
              Tactical Responder Emergency Alerts
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Real-time incident dispatches, hazard warnings, and high-priority cross-agency alarms
            </p>
          </div>

          {/* Rapid Telemetry Counters */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-col items-center">
              <span className="text-[10px] text-slate-400 font-bold">TOTAL</span>
              <span className="text-base font-black text-white">{totalAlerts}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 flex flex-col items-center">
              <span className="text-[10px] text-rose-400 font-bold">UNREAD CRITICAL</span>
              <span className="text-base font-black text-rose-400 animate-pulse">{unreadCriticalCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-sky-950/60 border border-sky-800 flex flex-col items-center">
              <span className="text-[10px] text-sky-400 font-bold">UNREAD QUEUE</span>
              <span className="text-base font-black text-sky-300">{unreadCount}</span>
            </div>
          </div>
        </div>

        {/* Filter Pills & Search Input */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'ALL'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold shadow-[0_0_10px_rgba(14,165,233,0.4)]'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              ALL ALERTS ({totalAlerts})
            </button>
            <button
              onClick={() => setFilterMode('UNREAD')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'UNREAD'
                  ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-950 text-amber-400 border-amber-900/60 hover:border-amber-800'
              }`}
            >
              ⚡ UNREAD ({unreadCount})
            </button>
            <button
              onClick={() => setFilterMode('CRITICAL')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'CRITICAL'
                  ? 'bg-rose-600 text-white border-rose-400 font-bold shadow-[0_0_10px_rgba(239,68,68,0.4)]'
                  : 'bg-slate-950 text-rose-400 border-rose-900/60 hover:border-rose-800'
              }`}
            >
              🚨 CRITICAL ONLY ({criticalCount})
            </button>
            <button
              onClick={() => setFilterMode('ACKNOWLEDGED')}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all ${
                filterMode === 'ACKNOWLEDGED'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                  : 'bg-slate-950 text-emerald-400 border-emerald-900/60 hover:border-emerald-800'
              }`}
            >
              ✓ ACKNOWLEDGED
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference code..."
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. CARD FEED FOR EMERGENCY ALERTS */}
      <div className="flex flex-col gap-3">
        {loading ? (
          <div className="tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse">
            LOADING EMERGENCY BROADCAST ALARMS...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="tactical-card p-12 text-center bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="text-3xl mb-2">📡</div>
            <h3 className="text-base font-bold text-white font-mono">ALL ALERT FEEDS ACKNOWLEDGED</h3>
            <p className="text-xs text-slate-400 font-mono mt-1">
              No active alert signals found for filter [{filterMode}]. Monitoring municipal broadcast frequencies.
            </p>
          </div>
        ) : (
          filteredAlerts.map((a) => {
            const agency = inferAgencyBadge(a.category, a.title);
            const isCritical = a.severity === 'Critical';
            const isSevere = a.severity === 'High';
            const isModerate = a.severity === 'Medium';

            // Severity Chip Configuration
            const severityChip = isCritical ? (
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

            // High-contrast night-vision card border styling
            const cardStyle = !a.isRead
              ? isCritical
                ? 'border-2 border-rose-500 bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 shadow-[0_0_18px_rgba(239,68,68,0.3)]'
                : 'border-2 border-sky-400 bg-gradient-to-r from-sky-950/40 via-slate-900 to-slate-900 shadow-[0_0_18px_rgba(14,165,233,0.3)]'
              : 'border border-slate-800 bg-slate-950/80 hover:border-slate-700';

            return (
              <div
                key={a.reportId}
                className={`tactical-card p-4 rounded-xl transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${cardStyle}`}
              >
                {/* Left: Photographic Evidence & Alert Content */}
                <div className="flex items-start gap-4">
                  {/* Photo or Tactical Radar Icon */}
                  {a.hasImage && a.imageUrl ? (
                    <div className="relative group flex-shrink-0">
                      <img
                        src={a.imageUrl}
                        alt={a.title}
                        onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover border-2 border-slate-700 cursor-pointer group-hover:border-sky-400 transition-colors"
                      />
                      <div
                        onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                        className="absolute inset-0 bg-slate-950/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] font-mono font-bold text-sky-300"
                      >
                        ZOOM
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-slate-950 border-2 border-slate-800 flex flex-col items-center justify-center text-slate-500 flex-shrink-0">
                      <span className="text-xl">{agency.icon}</span>
                      <span className="text-[9px] font-mono text-slate-400 font-bold">ALARM</span>
                    </div>
                  )}

                  {/* Alert Context */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono text-xs font-black text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800">
                        {a.referenceCode}
                      </span>

                      {/* Agency Badge */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider ${agency.color}`}>
                        {agency.icon} {agency.label}
                      </span>

                      {/* Severity Chip (CRITICAL, SEVERE, MODERATE) */}
                      {severityChip}

                      <span className="text-[11px] font-mono text-slate-400">
                        🕒 {formatRelativeTime(a.timestamp)}
                      </span>

                      {!a.isRead && (
                        <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px] font-black uppercase tracking-wider animate-pulse">
                          NEW UNREAD
                        </span>
                      )}
                    </div>

                    <h2 className="text-base font-bold text-white tracking-wide">
                      {a.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs font-mono text-slate-400">
                      <span>CATEGORY: <strong className="text-slate-300">{a.category}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>TIME: {formatIsoTimestamp(a.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Tactical Action Controls */}
                <div className="flex items-center gap-2.5 self-end md:self-center flex-shrink-0">
                  {!a.isRead ? (
                    <button
                      type="button"
                      onClick={() => handleMarkRead(a.reportId)}
                      className="px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-mono text-xs font-black uppercase tracking-wider border border-white shadow-[0_0_12px_rgba(16,185,129,0.5)] active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <span>✓</span>
                      <span>ACKNOWLEDGE</span>
                    </button>
                  ) : (
                    <div className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs flex items-center gap-1.5">
                      <span>✓</span>
                      <span>ACKNOWLEDGED</span>
                    </div>
                  )}

                  {a.hasImage && (
                    <button
                      type="button"
                      onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                      className="px-3 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-bold uppercase tracking-wider active:scale-95 transition-all"
                    >
                      <span>📸 PHOTO</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Lightbox Modal for Full Alert Photographic Verification */}
      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Tactical Alert Image Evidence Inspection"
      />
    </div>
  );
};

export default ResponderAlerts;