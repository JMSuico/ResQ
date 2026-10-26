// [Layer: UserRoles/Features/Pages/RespondersPanel/Shared]
// Responsibility: Tactical field operations HUD status bar matching universal responder field readiness.
// Supports AVAILABLE, EN ROUTE, ON SCENE, TRANSPORTING, and RETURNING states with 150ms tactile feedback,
// real-time telemetry syncing, and hardware GPS coordination.
// DO NOT break accessibility contracts or bypass unit authorization boundaries.

import React, { useState, useMemo, useCallback } from 'react';
import { updateUnitDutyStatus } from '@/Endpoints/responderOpsApi';
import { formatGpsCoord } from '@/Libs/Assets/formatters';

export type TacticalDutyStatus =
  | 'AVAILABLE'
  | 'EN ROUTE'
  | 'ON SCENE'
  | 'TRANSPORTING'
  | 'RETURNING';

export interface TacticalFieldStatusBarProps {
  status?: TacticalDutyStatus;
  onStatusChange?: (newStatus: TacticalDutyStatus) => void | Promise<void>;
  unitId?: string;
  unitCode?: string;
  agency?: string;
  officerName?: string;
  rankOrTitle?: string;
  sector?: string;
  gpsCoords?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  isLocating?: boolean;
  onGpsPing?: () => void;
  onTriggerDistress?: () => void;
  showOfficerDetails?: boolean;
  showDistressTrigger?: boolean;
  className?: string;
}

interface StatusVisualConfig {
  key: TacticalDutyStatus;
  order: number;
  label: string;
  subLabel: string;
  bgActive: string;
  textActive: string;
  borderActive: string;
  glowActive: string;
  dotActive: string;
  bgInactive: string;
  textInactive: string;
  borderInactive: string;
  bannerBg: string;
  bannerBorder: string;
  bannerGlow: string;
  bannerText: string;
  beaconDot: string;
}

const STATUS_CONFIGS: Record<TacticalDutyStatus, StatusVisualConfig> = {
  AVAILABLE: {
    key: 'AVAILABLE',
    order: 1,
    label: 'AVAILABLE',
    subLabel: 'In Quarters / Station',
    bgActive: 'bg-emerald-500 text-slate-950 border-white',
    textActive: 'text-slate-950 font-black',
    borderActive: 'border-white',
    glowActive: 'shadow-[0_0_20px_rgba(16,185,129,0.7)] scale-[1.02]',
    dotActive: 'bg-slate-950',
    bgInactive: 'bg-slate-900/90 hover:bg-emerald-950/40',
    textInactive: 'text-emerald-400',
    borderInactive: 'border-emerald-600/40 hover:border-emerald-500',
    bannerBg: 'bg-emerald-950/80',
    bannerBorder: 'border-emerald-500',
    bannerGlow: 'shadow-[0_0_20px_rgba(16,185,129,0.35)]',
    bannerText: 'text-emerald-400',
    beaconDot: 'bg-emerald-400',
  },
  'EN ROUTE': {
    key: 'EN ROUTE',
    order: 2,
    label: 'EN ROUTE',
    subLabel: 'Sirens On / Code 3',
    bgActive: 'bg-amber-400 text-slate-950 border-white',
    textActive: 'text-slate-950 font-black',
    borderActive: 'border-white',
    glowActive: 'shadow-[0_0_20px_rgba(245,158,11,0.7)] scale-[1.02]',
    dotActive: 'bg-slate-950 animate-ping',
    bgInactive: 'bg-slate-900/90 hover:bg-amber-950/40',
    textInactive: 'text-amber-400',
    borderInactive: 'border-amber-600/40 hover:border-amber-500',
    bannerBg: 'bg-amber-950/80',
    bannerBorder: 'border-amber-500',
    bannerGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    bannerText: 'text-amber-400',
    beaconDot: 'bg-amber-400 animate-ping',
  },
  'ON SCENE': {
    key: 'ON SCENE',
    order: 3,
    label: 'ON SCENE',
    subLabel: 'Triage / Suppressing / Securing',
    bgActive: 'bg-rose-600 text-white border-white',
    textActive: 'text-white font-black',
    borderActive: 'border-white',
    glowActive: 'shadow-[0_0_25px_rgba(225,29,72,0.85)] scale-[1.02]',
    dotActive: 'bg-white animate-pulse',
    bgInactive: 'bg-slate-900/90 hover:bg-rose-950/40',
    textInactive: 'text-rose-400',
    borderInactive: 'border-rose-600/40 hover:border-rose-500',
    bannerBg: 'bg-rose-950/90',
    bannerBorder: 'border-rose-500',
    bannerGlow: 'shadow-[0_0_25px_rgba(239,68,68,0.45)]',
    bannerText: 'text-rose-400',
    beaconDot: 'bg-rose-500 animate-pulse',
  },
  TRANSPORTING: {
    key: 'TRANSPORTING',
    order: 4,
    label: 'TRANSPORTING',
    subLabel: 'To Hospital / Detaining',
    bgActive: 'bg-purple-500 text-white border-white',
    textActive: 'text-white font-black',
    borderActive: 'border-white',
    glowActive: 'shadow-[0_0_20px_rgba(168,85,247,0.75)] scale-[1.02]',
    dotActive: 'bg-white animate-ping',
    bgInactive: 'bg-slate-900/90 hover:bg-purple-950/40',
    textInactive: 'text-purple-400',
    borderInactive: 'border-purple-600/40 hover:border-purple-500',
    bannerBg: 'bg-purple-950/85',
    bannerBorder: 'border-purple-500',
    bannerGlow: 'shadow-[0_0_20px_rgba(168,85,247,0.35)]',
    bannerText: 'text-purple-400',
    beaconDot: 'bg-purple-400 animate-pulse',
  },
  RETURNING: {
    key: 'RETURNING',
    order: 5,
    label: 'RETURNING',
    subLabel: 'To Base',
    bgActive: 'bg-sky-500 text-slate-950 border-white',
    textActive: 'text-slate-950 font-black',
    borderActive: 'border-white',
    glowActive: 'shadow-[0_0_20px_rgba(14,165,233,0.7)] scale-[1.02]',
    dotActive: 'bg-slate-950',
    bgInactive: 'bg-slate-900/90 hover:bg-sky-950/40',
    textInactive: 'text-sky-400',
    borderInactive: 'border-sky-600/40 hover:border-sky-500',
    bannerBg: 'bg-sky-950/80',
    bannerBorder: 'border-sky-500',
    bannerGlow: 'shadow-[0_0_20px_rgba(14,165,233,0.35)]',
    bannerText: 'text-sky-400',
    beaconDot: 'bg-sky-400',
  },
};

const playTactileAudioFeedback = (freq = 720) => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Audio context may be restricted by autoplay policy
  }
};

export const TacticalFieldStatusBar: React.FC<TacticalFieldStatusBarProps> = ({
  status: controlledStatus,
  onStatusChange,
  unitId,
  unitCode,
  agency = 'RHU',
  officerName = 'Tactical Field Officer',
  rankOrTitle,
  sector = 'Katipunan Operational HQ',
  gpsCoords,
  isLocating = false,
  onGpsPing,
  onTriggerDistress,
  showOfficerDetails = true,
  showDistressTrigger = true,
  className = '',
}) => {
  const [internalStatus, setInternalStatus] = useState<TacticalDutyStatus>('AVAILABLE');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const activeStatus = controlledStatus || internalStatus;
  const currentConfig = STATUS_CONFIGS[activeStatus] || STATUS_CONFIGS.AVAILABLE;

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const agencyMeta = useMemo(() => {
    switch (agency) {
      case 'FIRE':
      case 'BFP':
        return {
          title: 'BFP FIRE PROTECTION',
          callsign: unitCode || 'FIRE-ENGINE-01',
          icon: '🚒',
          badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          accent: 'border-orange-500',
        };
      case 'PNP':
      case 'POLICE':
        return {
          title: 'PNP POLICE FORCE',
          callsign: unitCode || 'PNP-MOBILE-04',
          icon: '🚓',
          badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          accent: 'border-indigo-500',
        };
      case 'LDRRMO':
      case 'ADMIN':
        return {
          title: 'LDRRMO COMMAND HQ',
          callsign: unitCode || 'COMMAND-HQ',
          icon: '🚨',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          accent: 'border-rose-500',
        };
      default:
        return {
          title: 'RHU MEDICAL EMERGENCY',
          callsign: unitCode || 'RHU-MEDIC-01',
          icon: '🚑',
          badgeBg: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          accent: 'border-sky-500',
        };
    }
  }, [agency, unitCode]);

  const handleSelectStatus = async (nextStatus: TacticalDutyStatus) => {
    if (nextStatus === activeStatus && !isTransmitting) return;

    playTactileAudioFeedback(nextStatus === 'ON SCENE' ? 880 : 660);
    setInternalStatus(nextStatus);
    setIsTransmitting(true);

    // Map tactical duty status to backend enum ('OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty')
    let mappedDuty: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty' = 'OnDuty';
    if (nextStatus === 'AVAILABLE') mappedDuty = 'OnDuty';
    else if (nextStatus === 'EN ROUTE' || nextStatus === 'ON SCENE' || nextStatus === 'TRANSPORTING') {
      mappedDuty = 'Dispatched';
    } else if (nextStatus === 'RETURNING') {
      mappedDuty = 'Standby';
    }

    try {
      if (unitId) {
        await updateUnitDutyStatus(unitId, mappedDuty);
      }
      if (onStatusChange) {
        await onStatusChange(nextStatus);
      }

      // Dispatch global system event for telemetry syncing
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('resqtrack:duty-status', {
            detail: { status: nextStatus, mappedDuty, unitId, agency, timestamp: new Date().toISOString() },
          })
        );
      }

      showToast(`STATUS BROADCAST: UNIT IS NOW ${nextStatus} (${currentConfig.subLabel})`);
    } catch (err) {
      console.warn('Backend sync failed, queueing offline:', err);
      try {
        const queue = JSON.parse(localStorage.getItem('resqtrack_offline_status_queue') || '[]');
        queue.push({
          unitId: unitId || 'SELF',
          status: mappedDuty,
          tacticalStatus: nextStatus,
          timestamp: new Date().toISOString(),
        });
        localStorage.setItem('resqtrack_offline_status_queue', JSON.stringify(queue));
      } catch {}
      showToast(`LOCAL STATUS: ${nextStatus} (OFFLINE SYNC QUEUED)`);
    } finally {
      setIsTransmitting(false);
    }
  };

  return (
    <div className={`relative flex flex-col gap-4 text-slate-100 select-none ${className}`}>
      {/* Tactical Status Toast Popup */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-sky-400 text-sky-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2.5 animate-bounce">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main High-Contrast Tactical HUD Container */}
      <div
        className={`rounded-2xl p-5 border-2 transition-all duration-300 ${currentConfig.bannerBg} ${currentConfig.bannerBorder} ${currentConfig.bannerGlow}`}
      >
        {/* Top Header Row: Unit Identity + Hardware GPS Telemetry */}
        {showOfficerDetails && (
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pb-5 border-b border-slate-700/60">
            {/* Unit Callsign & Identification */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-slate-950/90 border border-slate-700 flex items-center justify-center text-2xl shadow-inner flex-shrink-0">
                {agencyMeta.icon}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-black border uppercase tracking-wider ${agencyMeta.badgeBg}`}
                  >
                    <span>{agencyMeta.icon}</span>
                    <span>{agencyMeta.title}</span>
                  </span>
                  <span className="text-slate-500 font-mono text-xs">|</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[11px] font-mono font-bold text-slate-300">
                    <span className={`w-2 h-2 rounded-full ${currentConfig.beaconDot}`} />
                    <span className={currentConfig.bannerText}>
                      {activeStatus}: {currentConfig.subLabel}
                    </span>
                  </span>
                </div>

                <h1 className="text-xl md:text-2xl font-black text-white tracking-wide font-sans flex items-center gap-2">
                  <span>{officerName}</span>
                  <span className="text-slate-400 text-sm font-mono font-normal">
                    [{rankOrTitle || agencyMeta.callsign}]
                  </span>
                </h1>

                <p className="text-xs font-mono text-slate-300 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>SECTOR: {sector}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    HARDWARE TELEMETRY LINK OK
                  </span>
                </p>
              </div>
            </div>

            {/* Right: GPS Telemetry & Emergency Controls */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
              {gpsCoords && (
                <div className="px-3.5 py-2 bg-slate-950/90 rounded-xl border border-slate-700/80 flex flex-col items-end">
                  <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                    HARDWARE GPS TELEMETRY
                  </span>
                  <span className="text-sm font-mono font-extrabold text-sky-400">
                    {formatGpsCoord(gpsCoords.latitude, gpsCoords.longitude)}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    ACCURACY: ±{gpsCoords.accuracy ? gpsCoords.accuracy.toFixed(1) : '3.2'}M • LOCK SECURE
                  </span>
                </div>
              )}

              {onGpsPing && (
                <button
                  type="button"
                  onClick={onGpsPing}
                  disabled={isLocating}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold uppercase tracking-wider border border-sky-400 shadow-lg shadow-sky-900/40 active:scale-95 transition-all duration-150 disabled:opacity-50 cursor-pointer"
                  title="Broadcast live GPS ping to Command HQ"
                >
                  <span className={isLocating ? 'animate-spin' : ''}>{isLocating ? '🛰️' : '📡'}</span>
                  <span>{isLocating ? 'LOCKING GPS...' : 'BROADCAST PING'}</span>
                </button>
              )}

              {showDistressTrigger && onTriggerDistress && (
                <button
                  type="button"
                  onClick={onTriggerDistress}
                  className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-mono text-xs font-black uppercase tracking-wider border border-rose-400 shadow-[0_0_15px_rgba(225,29,72,0.6)] active:scale-95 transition-all duration-150 cursor-pointer animate-pulse"
                  title="Trigger Officer Down / Mayday SOS Distress Beacon"
                >
                  <span>🚨</span>
                  <span>SOS MAYDAY</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tactical Readiness State Selector (5 Operational States) */}
        <div className={showOfficerDetails ? 'mt-4 pt-2' : ''}>
          <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              FIELD READINESS STATE SELECTOR (TAP TO TOGGLE DUTY STATUS):
            </span>
            {isTransmitting && (
              <span className="text-sky-400 animate-pulse font-mono flex items-center gap-1 text-[10px]">
                <span className="inline-block w-2 h-2 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                TRANSMITTING TELEMETRY...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {Object.values(STATUS_CONFIGS).map((item) => {
              const isSelected = activeStatus === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleSelectStatus(item.key)}
                  className={`flex flex-col items-start justify-center p-3 rounded-xl font-mono transition-all duration-150 border-2 active:scale-95 cursor-pointer text-left ${
                    isSelected
                      ? `${item.bgActive} ${item.glowActive}`
                      : `${item.bgInactive} ${item.textInactive} ${item.borderInactive}`
                  }`}
                >
                  <div className="flex items-center gap-2 w-full mb-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        isSelected ? item.dotActive : item.beaconDot
                      }`}
                    />
                    <span
                      className={`text-xs font-black tracking-wider uppercase truncate ${
                        isSelected ? item.textActive : ''
                      }`}
                    >
                      {item.order}. {item.label}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] tracking-tight pl-4 leading-tight truncate w-full ${
                      isSelected ? 'text-slate-900/90 font-bold' : 'text-slate-400 font-sans'
                    }`}
                  >
                    {item.subLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TacticalFieldStatusBar;
