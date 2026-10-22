// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical duty roster check-in and shift schedule inspection for responders.
// Tactical mobile dispatch HUD with high-contrast field status banner, agency badges, and GPS quick navigation.
// DO NOT mutate shift assignments without recording operational timestamp.

import React, { useState, useEffect, useMemo } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getAgencyReports } from '@/Endpoints/reportsApi';
import { formatGpsCoord, formatRelativeTime } from '@/Libs/Assets/formatters';

export const DutyRosterView: React.FC = () => {
  const { session } = useSession();
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [agencyFilter, setAgencyFilter] = useState<'ALL' | 'RHU' | 'FIRE' | 'PNP'>('ALL');
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [activeDispatchesCount, setActiveDispatchesCount] = useState<number>(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getDutyRoster();
      setRoster(data);

      if (session?.unit && session.unit !== 'None') {
        const reps = await getAgencyReports(session.unit).catch(() => []);
        setActiveDispatchesCount(reps.filter((r) => r.status !== 'Resolved').length);
      }
    } catch (err) {
      console.error('Failed to load duty roster data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const myUnit = roster.find((u) => u.agency === session?.unit);

  const showToast = (msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const handleToggleDuty = async (newStatus: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty') => {
    if (!myUnit) return;
    try {
      await updateUnitDutyStatus(myUnit.id, newStatus);
      showToast(`DUTY STATUS UPDATED TO: ${newStatus.toUpperCase()}`);
      await loadData();
    } catch (err) {
      console.error('Failed to update duty status:', err);
      showToast(`ERROR UPDATING STATUS TO ${newStatus}`);
    }
  };

  const handleQuickNavigate = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const copyCoordinates = (lat: number, lng: number) => {
    const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard?.writeText(text);
    showToast(`BASE COORDINATES COPIED: ${text}`);
  };

  // Telemetry metric calculations
  const totalOnDuty = useMemo(() => roster.filter((u) => u.status === 'OnDuty').length, [roster]);
  const totalDispatched = useMemo(() => roster.filter((u) => u.status === 'Dispatched').length, [roster]);
  const totalStandby = useMemo(() => roster.filter((u) => u.status === 'Standby').length, [roster]);
  const totalPersonnel = useMemo(
    () => roster.reduce((sum, u) => sum + (u.activePersonnelCount || 0), 0),
    [roster]
  );

  const filteredRoster = useMemo(() => {
    if (agencyFilter === 'ALL') return roster;
    return roster.filter((u) => u.agency === agencyFilter);
  }, [roster, agencyFilter]);

  // Agency styling helper
  const getAgencyBadge = (agency: string) => {
    switch (agency) {
      case 'RHU':
        return {
          label: 'RHU MEDICAL',
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          icon: '🚑'
        };
      case 'FIRE':
        return {
          label: 'BFP FIRE',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          icon: '🚒'
        };
      case 'PNP':
        return {
          label: 'PNP POLICE',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          icon: '🚓'
        };
      default:
        return {
          label: 'LDRRMO COMMAND',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          icon: '🚨'
        };
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-8">
      {/* Toast Feedback */}
      {statusFeedback && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Header & Tactical Context */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono font-bold text-sky-400">FIRST RESPONDER TACTICAL ROSTER</span>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono text-slate-300">SHIFT &amp; READINESS CHECK-IN</span>
        </div>
        <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
          Unit Duty Roster &amp; Operational Check-In
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">
          Tactical deployment status, agency shift schedules, and field station coordinates
        </p>
      </div>

      {/* 1. HIGH-CONTRAST FIELD STATUS BANNER WITH TACTILE TOGGLE BUTTONS */}
      {myUnit && (
        <div
          className={`tactical-card p-6 rounded-xl border-2 transition-all duration-300 shadow-2xl ${
            myUnit.status === 'OnDuty'
              ? 'bg-slate-900/95 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : myUnit.status === 'Dispatched'
              ? 'bg-slate-900/95 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
              : myUnit.status === 'Standby'
              ? 'bg-slate-900/95 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.3)]'
              : 'bg-slate-950/95 border-slate-700'
          }`}
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded bg-sky-950 text-sky-400 font-mono text-xs font-extrabold border border-sky-700">
                  MY ACTIVE UNIT CALLSIGN
                </span>
                <span className="font-mono text-xs text-slate-400 font-bold">[{myUnit.unitCode}]</span>
                <span className="text-slate-600">•</span>
                <span className="font-mono text-xs text-slate-300">COMMANDER: {myUnit.commanderName}</span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-wide">
                {myUnit.unitName}
              </h2>

              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono text-slate-300">
                <span className="flex items-center gap-1.5">
                  <span className="text-slate-400">CURRENT STATUS:</span>
                  <span
                    className={`font-black px-2 py-0.5 rounded uppercase ${
                      myUnit.status === 'OnDuty'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500'
                        : myUnit.status === 'Dispatched'
                        ? 'bg-amber-950 text-amber-400 border border-amber-500 animate-pulse'
                        : myUnit.status === 'Standby'
                        ? 'bg-sky-950 text-sky-400 border border-sky-500'
                        : 'bg-slate-900 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {myUnit.status === 'OnDuty' ? 'AVAILABLE / ON DUTY' : myUnit.status === 'Dispatched' ? 'DISPATCHED / EN ROUTE' : myUnit.status === 'Standby' ? 'STANDBY / ON SCENE' : 'OFF DUTY / RETURNING'}
                  </span>
                </span>
                <span className="text-slate-600">|</span>
                <span>SHIFT: <strong className="text-white">{myUnit.shiftSchedule}</strong></span>
                <span className="text-slate-600">|</span>
                <span>CREW: <strong className="text-emerald-400">{myUnit.activePersonnelCount} PERSONNEL</strong></span>
              </div>
            </div>

            {/* Quick Station Base Telemetry */}
            <div className="px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col items-end font-mono">
              <span className="text-[10px] text-slate-400 font-bold">BASE HEADQUARTERS GPS</span>
              <span className="text-xs font-bold text-sky-400 tracking-wider">
                {formatGpsCoord(myUnit.baseLatitude, myUnit.baseLongitude)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">HOTLINE: {myUnit.contactHotline}</span>
            </div>
          </div>

          {/* Tactile Toggle Buttons Bar */}
          <div className="mt-5 pt-4 border-t border-slate-800">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider block mb-2">
              TACTILE READINESS TOGGLE BUTTONS:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Button 1: On Duty (AVAILABLE) */}
              <button
                type="button"
                onClick={() => handleToggleDuty('OnDuty')}
                className={`py-3 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 ${
                  myUnit.status === 'OnDuty'
                    ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_18px_rgba(16,185,129,0.7)] scale-[1.02]'
                    : 'bg-slate-900/90 text-emerald-400 border-emerald-600/40 hover:bg-emerald-950/40 hover:border-emerald-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${myUnit.status === 'OnDuty' ? 'bg-slate-950' : 'bg-emerald-400'}`} />
                <span>1. ON DUTY (AVAILABLE)</span>
              </button>

              {/* Button 2: Dispatched (EN ROUTE) */}
              <button
                type="button"
                onClick={() => handleToggleDuty('Dispatched')}
                className={`py-3 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 ${
                  myUnit.status === 'Dispatched'
                    ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_18px_rgba(245,158,11,0.7)] scale-[1.02]'
                    : 'bg-slate-900/90 text-amber-400 border-amber-600/40 hover:bg-amber-950/40 hover:border-amber-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${myUnit.status === 'Dispatched' ? 'bg-slate-950 animate-ping' : 'bg-amber-400'}`} />
                <span>2. DISPATCHED (EN ROUTE)</span>
              </button>

              {/* Button 3: Standby (ON SCENE) */}
              <button
                type="button"
                onClick={() => handleToggleDuty('Standby')}
                className={`py-3 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 ${
                  myUnit.status === 'Standby'
                    ? 'bg-sky-400 text-slate-950 border-white shadow-[0_0_18px_rgba(56,189,248,0.7)] scale-[1.02]'
                    : 'bg-slate-900/90 text-sky-400 border-sky-600/40 hover:bg-sky-950/40 hover:border-sky-500'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${myUnit.status === 'Standby' ? 'bg-slate-950' : 'bg-sky-400'}`} />
                <span>3. STANDBY (ON SCENE)</span>
              </button>

              {/* Button 4: Off Duty (RETURNING) */}
              <button
                type="button"
                onClick={() => handleToggleDuty('OffDuty')}
                className={`py-3 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 ${
                  myUnit.status === 'OffDuty'
                    ? 'bg-rose-600 text-white border-white shadow-[0_0_18px_rgba(225,29,72,0.7)] scale-[1.02]'
                    : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${myUnit.status === 'OffDuty' ? 'bg-white' : 'bg-slate-500'}`} />
                <span>4. OFF DUTY (RETURNING)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REAL-TIME MISSION TELEMETRY COUNTERS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-emerald-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              ONLINE AVAILABLE UNITS
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-emerald-400">{totalOnDuty}</span>
            <span className="text-xs font-mono text-emerald-300 font-bold">READY TO DEPLOY</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
            MUNICIPAL EMERGENCY FORCE
          </div>
        </div>

        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-amber-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              ACTIVE DISPATCHES
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-amber-400">
              {totalDispatched > 0 ? totalDispatched : activeDispatchesCount}
            </span>
            <span className="text-xs font-mono text-amber-300 font-bold">IN THE FIELD</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
            EN ROUTE OR ON SCENE
          </div>
        </div>

        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-sky-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              TOTAL FIELD PERSONNEL
            </span>
            <span className="w-2 h-2 rounded-full bg-sky-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-white">{totalPersonnel}</span>
            <span className="text-xs font-mono text-sky-400 font-bold">DEPLOYED OFFICERS</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
            CROSS-AGENCY PARAMEDIC/FIRE/POLICE
          </div>
        </div>

        <div className="tactical-card p-4 bg-slate-900/90 border-slate-700/80 hover:border-rose-500/60 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              STANDBY STAGING
            </span>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black font-mono text-slate-200">{totalStandby}</span>
            <span className="text-xs font-mono text-slate-400 font-bold">STAGING UNITS</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800 pt-2">
            RESERVE FIELD ASSETS
          </div>
        </div>
      </div>

      {/* 3. MUNICIPAL RESPONSE AGENCY UNITS FEED */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          <h2 className="text-base font-black font-sans text-white tracking-wide uppercase flex items-center gap-2">
            <span>🛡️ ALL MUNICIPAL RESPONSE AGENCY UNITS</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-400 font-mono text-[11px]">
              {filteredRoster.length} UNITS
            </span>
          </h2>

          {/* Agency Filter Tabs */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <button
              onClick={() => setAgencyFilter('ALL')}
              className={`px-3 py-1 rounded border transition-colors ${
                agencyFilter === 'ALL'
                  ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setAgencyFilter('RHU')}
              className={`px-3 py-1 rounded border transition-colors ${
                agencyFilter === 'RHU'
                  ? 'bg-sky-600 text-white border-sky-400 font-bold'
                  : 'bg-slate-900 text-sky-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🚑 RHU
            </button>
            <button
              onClick={() => setAgencyFilter('FIRE')}
              className={`px-3 py-1 rounded border transition-colors ${
                agencyFilter === 'FIRE'
                  ? 'bg-orange-600 text-white border-orange-400 font-bold'
                  : 'bg-slate-900 text-orange-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🚒 FIRE
            </button>
            <button
              onClick={() => setAgencyFilter('PNP')}
              className={`px-3 py-1 rounded border transition-colors ${
                agencyFilter === 'PNP'
                  ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                  : 'bg-slate-900 text-indigo-400 border-slate-700 hover:bg-slate-800'
              }`}
            >
              🚓 PNP
            </button>
          </div>
        </div>

        {/* Units Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-2 tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse">
              LOADING ROSTER UNITS...
            </div>
          ) : filteredRoster.length === 0 ? (
            <div className="col-span-2 tactical-card p-12 text-center text-slate-400 font-mono text-xs">
              NO UNITS FOUND FOR FILTER [{agencyFilter}].
            </div>
          ) : (
            filteredRoster.map((u) => {
              const badge = getAgencyBadge(u.agency);
              const isOnDuty = u.status === 'OnDuty';
              const isDispatched = u.status === 'Dispatched';

              return (
                <div
                  key={u.id}
                  className={`tactical-card p-5 border rounded-xl shadow-lg flex flex-col justify-between transition-all ${
                    isOnDuty
                      ? 'border-emerald-600/60 bg-slate-900/90 hover:border-emerald-500'
                      : isDispatched
                      ? 'border-amber-600/60 bg-slate-900/90 hover:border-amber-500'
                      : 'border-slate-800 bg-slate-950/80 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider ${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                        <span className="font-mono text-xs font-bold text-sky-400">[{u.unitCode}]</span>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border flex items-center gap-1 ${
                          isOnDuty
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
                            : isDispatched
                            ? 'bg-amber-950 text-amber-400 border-amber-500 animate-pulse'
                            : u.status === 'Standby'
                            ? 'bg-sky-950 text-sky-400 border-sky-500'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isOnDuty ? 'bg-emerald-400' : isDispatched ? 'bg-amber-400' : 'bg-slate-400'
                          }`}
                        />
                        <span>{u.status}</span>
                      </span>
                    </div>

                    {/* Unit Name & Commander */}
                    <h3 className="text-base font-bold text-white">{u.unitName}</h3>
                    <p className="text-xs text-slate-300 font-mono mt-1">
                      Commander: <strong className="text-slate-100">{u.commanderName}</strong>
                    </p>

                    {/* Telemetry Details */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
                      <div>
                        <span className="text-slate-500 block text-[10px]">HOTLINE</span>
                        <a
                          href={`tel:${u.contactHotline}`}
                          className="text-sky-400 hover:underline font-bold"
                        >
                          📞 {u.contactHotline}
                        </a>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">CREW STRENGTH</span>
                        <span className="text-emerald-400 font-bold">
                          🛡️ {u.activePersonnelCount} PERSONNEL
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Base Coordinates & Quick Navigation Trigger */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between font-mono text-xs">
                    <span
                      onClick={() => copyCoordinates(u.baseLatitude, u.baseLongitude)}
                      className="text-slate-400 hover:text-sky-300 cursor-pointer truncate max-w-[200px]"
                      title="Click to copy base coordinates"
                    >
                      📍 {formatGpsCoord(u.baseLatitude, u.baseLongitude)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleQuickNavigate(u.baseLatitude, u.baseLongitude)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-bold tracking-wider active:scale-95 transition-all"
                    >
                      <span>🧭</span>
                      <span>NAVIGATE</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DutyRosterView;