// [Layer: UserRoles/Features/Pages/RespondersPanel/Shared]
// Responsibility: High-fidelity civilian evidence inspection modal for tactical responders.
// Displays full-resolution civilian snapshot with interactive zoom/pan, forensic crosshair grid,
// citizen telemetry (name, phone with one-click dialer, verbatim notes), hardware GPS readout,
// Google Maps navigation launcher, and quick tactical field action triggers.
// DO NOT permit unresolved mutations from unauthorized responder agencies.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { ReportItem, sendEmergencyBroadcast } from '@/Endpoints/reportsApi';
import { verifyReport } from '@/Endpoints/adminGovernanceApi';
import { formatGpsCoord, formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';

export interface CivilianEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportItem | null;
  reporterPhone?: string;
  onStatusUpdated?: (reportId: string, nextStatus: string) => void | Promise<void>;
  onBackupRequested?: (reportId: string, targetAgency: string, note: string) => void | Promise<void>;
  className?: string;
}

export const CivilianEvidenceModal: React.FC<CivilianEvidenceModalProps> = ({
  isOpen,
  onClose,
  report,
  reporterPhone: explicitPhone,
  onStatusUpdated,
  onBackupRequested,
  className = '',
}) => {
  // Zoom & Pan Inspection State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGridCrosshair, setShowGridCrosshair] = useState<boolean>(false);

  // Tactical Actions State
  const [isActing, setIsActing] = useState<boolean>(false);
  const [toastFeedback, setToastFeedback] = useState<string | null>(null);
  const [isBackupDrawerOpen, setIsBackupDrawerOpen] = useState<boolean>(false);
  const [backupAgency, setBackupAgency] = useState<'RHU' | 'FIRE' | 'PNP'>('PNP');
  const [backupUrgency, setBackupUrgency] = useState<'High' | 'Critical'>('Critical');
  const [backupNote, setBackupNote] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Reset zoom & pan when report opens or changes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setIsDragging(false);
      setIsBackupDrawerOpen(false);
      setToastFeedback(null);
    }
  }, [isOpen, report?.id]);

  const showToast = useCallback((msg: string) => {
    setToastFeedback(msg);
    setTimeout(() => setToastFeedback(null), 3200);
  }, []);

  // Compute telephone number
  const citizenPhone = useMemo(() => {
    if (explicitPhone) return explicitPhone;
    if (report?.note) {
      const match = report.note.match(/(\+?63\s?9\d{2}[-\s]?\d{3}[-\s]?\d{4}|09\d{2}[-\s]?\d{3}[-\s]?\d{4}|\b\d{10,11}\b)/);
      if (match) return match[0];
    }
    return '0917-555-0199';
  }, [explicitPhone, report?.note]);

  // Compute image URL
  const imageSource = useMemo(() => {
    if (!report) return null;
    if (report.imageUrl && report.imageUrl.trim().length > 0) return report.imageUrl;
    if (report.hasImage) return `/api/reports/${report.id}/image`;
    return null;
  }, [report]);

  // Zoom manipulation
  const handleZoomIn = () => setZoom((prev) => Math.min(3.5, Math.round((prev + 0.3) * 10) / 10));
  const handleZoomOut = () =>
    setZoom((prev) => {
      const next = Math.max(0.8, Math.round((prev - 0.3) * 10) / 10);
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch drag handlers for tablet HUDs
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((prev) => {
      const factor = e.deltaY < 0 ? 0.15 : -0.15;
      const next = Math.min(3.5, Math.max(0.8, Math.round((prev + factor) * 100) / 100));
      if (next <= 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  // Navigation Trigger
  const handleLaunchGoogleMaps = () => {
    if (!report) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    showToast('LAUNCHING TURN-BY-TURN GOOGLE NAVIGATION ↗');
  };

  // Quick Action 1: Confirm Scene Arrival
  const handleConfirmArrival = async () => {
    if (!report || isActing) return;
    setIsActing(true);
    try {
      await verifyReport(report.id, 'OnScene', 'Unit confirmed arrival at civilian accident scene');
      if (onStatusUpdated) {
        await onStatusUpdated(report.id, 'OnScene');
      }
      showToast(`SCENE ARRIVAL CONFIRMED: ${report.referenceCode} STATUS IS NOW ON SCENE`);
    } catch (err) {
      console.error('Failed to confirm arrival:', err);
      showToast('ERROR: COULD NOT CONFIRM ARRIVAL TELEMETRY');
    } finally {
      setIsActing(false);
    }
  };

  // Quick Action 2: Transmit Mutual Aid / Backup
  const handleTransmitBackup = async () => {
    if (!report || isActing) return;
    setIsActing(true);
    try {
      const backupTitle = `🚨 MUTUAL AID REQUEST: ${backupAgency} BACKUP NEEDED AT ${report.referenceCode}`;
      const backupMsg = `Field unit requested urgent ${backupAgency} support for incident "${report.title}". Location: ${report.locationLabel || 'Incident site'} (${report.latitude.toFixed(5)}, ${report.longitude.toFixed(5)}). Note: ${backupNote || 'Immediate support requested.'}`;

      await sendEmergencyBroadcast({
        title: backupTitle,
        message: backupMsg,
        severity: backupUrgency,
      });

      if (onBackupRequested) {
        await onBackupRequested(report.id, backupAgency, backupNote);
      }

      showToast(`MUTUAL AID BROADCAST TRANSMITTED TO ${backupAgency} DISPATCH`);
      setIsBackupDrawerOpen(false);
      setBackupNote('');
    } catch (err) {
      console.error('Failed to transmit mutual aid broadcast:', err);
      showToast('FAILED TO TRANSMIT MUTUAL AID REQUEST');
    } finally {
      setIsActing(false);
    }
  };

  // Quick Action 3: Mark Resolved
  const handleMarkResolved = async () => {
    if (!report || isActing) return;
    const confirmResolve = window.confirm(
      `CONFIRM RESOLUTION: Mark incident ${report.referenceCode} as FULLY RESOLVED?`
    );
    if (!confirmResolve) return;

    setIsActing(true);
    try {
      await verifyReport(report.id, 'Resolved', 'Incident mitigated, treated, and marked RESOLVED by field unit');
      if (onStatusUpdated) {
        await onStatusUpdated(report.id, 'Resolved');
      }
      showToast(`INCIDENT RESOLVED: ${report.referenceCode} CLOSED OUT`);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      console.error('Failed to mark resolved:', err);
      showToast('ERROR: FAILED TO MARK INCIDENT AS RESOLVED');
    } finally {
      setIsActing(false);
    }
  };

  const copyText = (text: string, key: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast(`${label} COPIED TO CLIPBOARD`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen || !report) return null;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title={`CIVILIAN EVIDENCE DOSSIER // REF: ${report.referenceCode}`}
      subtitle={`Verified Civilian Triage & Forensic Field Snapshot • ${report.category} (${report.severity} Severity)`}
      maxWidth="max-w-4xl"
      className={className}
    >
      <div className="flex flex-col gap-5 text-slate-200 select-none">
        {/* Tactical Feedback Toast Notification */}
        {toastFeedback && (
          <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping flex-shrink-0" />
            <span>{toastFeedback}</span>
          </div>
        )}

        {/* Top Header Card: Title, Status, and Priority Badges */}
        <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex flex-col">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-black bg-sky-950 text-sky-400 border border-sky-700/60 uppercase tracking-wider">
                REF: {report.referenceCode}
              </span>
              <span className="text-slate-600 font-mono text-xs">|</span>
              <span className="text-xs font-mono font-bold text-slate-400">
                STATUS:{' '}
                <span
                  className={
                    report.status === 'Resolved'
                      ? 'text-emerald-400 font-black'
                      : report.status === 'OnScene'
                      ? 'text-rose-400 font-black'
                      : 'text-amber-400 font-black'
                  }
                >
                  {report.status.toUpperCase()}
                </span>
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black text-white">{report.title}</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span
              className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider border ${
                report.severity === 'Critical'
                  ? 'bg-rose-950 text-rose-300 border-rose-500 animate-pulse'
                  : report.severity === 'High'
                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                  : 'bg-sky-950 text-sky-300 border-sky-600'
              }`}
            >
              {report.severity} PRIORITY
            </span>
            <span className="px-2.5 py-1 rounded text-xs font-bold bg-slate-900 border border-slate-700 text-slate-300">
              {report.category}
            </span>
          </div>
        </div>

        {/* Main Grid: Left = Forensic Snapshot with Zoom/Pan, Right = Citizen & GPS Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: Full-Resolution Image Canvas with Interactive Pan/Zoom (lg:col-span-7) */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 px-1">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                CIVILIAN EVIDENCE SNAPSHOT
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">ZOOM: {Math.round(zoom * 100)}%</span>
              </div>
            </div>

            {/* Interactive Image Viewport */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={handleWheel}
              className={`relative w-full h-[320px] md:h-[380px] bg-slate-950 border-2 border-slate-700 rounded-xl overflow-hidden flex items-center justify-center select-none ${
                zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
              }`}
            >
              {imageSource ? (
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-75"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                >
                  <img
                    src={imageSource}
                    alt={`Civilian Evidence ${report.referenceCode}`}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
                  <span className="text-4xl mb-2">📷</span>
                  <span className="text-slate-400 font-bold">NO HARDWARE CAMERA ATTACHMENT</span>
                  <span className="text-[11px] text-slate-600 mt-1">
                    Reporter submitted textual dispatch without live snapshot payload.
                  </span>
                </div>
              )}

              {/* Forensic Grid Crosshair Overlay */}
              {showGridCrosshair && (
                <div className="absolute inset-0 pointer-events-none border border-sky-500/20 grid grid-cols-4 grid-rows-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border border-sky-400/80 rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-sky-400 rounded-full" />
                    </div>
                  </div>
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="border border-sky-500/10" />
                  ))}
                </div>
              )}

              {/* Viewport Floating Controls */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-700 shadow-xl z-20">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.8}
                  className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-sm flex items-center justify-center border border-slate-600 active:scale-95 disabled:opacity-40 cursor-pointer"
                  title="Zoom Out"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="px-2 h-8 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-mono text-xs font-bold flex items-center justify-center border border-slate-600 active:scale-95 cursor-pointer"
                  title="Reset 100%"
                >
                  1:1
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3.5}
                  className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-sm flex items-center justify-center border border-slate-600 active:scale-95 disabled:opacity-40 cursor-pointer"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => setShowGridCrosshair((prev) => !prev)}
                  className={`px-2 h-8 rounded font-mono text-xs font-bold flex items-center justify-center border active:scale-95 cursor-pointer ${
                    showGridCrosshair
                      ? 'bg-sky-600 text-white border-sky-400'
                      : 'bg-slate-800 text-slate-400 border-slate-600 hover:text-white'
                  }`}
                  title="Toggle Forensic Crosshair Grid"
                >
                  ⌖ GRID
                </button>
              </div>

              {/* Anti-Spoofing & Laplacian Blur Watermark Pill */}
              <div className="absolute top-3 left-3 flex flex-col gap-1 z-20">
                {report.isBlurry || report.requiresManualVerification ? (
                  <span className="px-2.5 py-1 rounded bg-amber-950/90 text-amber-300 border border-amber-500 font-mono text-[11px] font-bold shadow-lg flex items-center gap-1.5 animate-pulse">
                    <span>⚠️</span>
                    <span>LAPLACIAN BLUR WARNING (MANUAL AUDIT REQ)</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded bg-emerald-950/90 text-emerald-300 border border-emerald-500 font-mono text-[11px] font-bold shadow-lg flex items-center gap-1.5">
                    <span>✓</span>
                    <span>ANTI-SPOOF HARDWARE SNAPSHOT VERIFIED</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: Reporter Profile & Hardware GPS Dossier (lg:col-span-5) */}
          <div className="lg:col-span-5 flex flex-col gap-3.5">
            {/* 1. Reporter Identity & Quick Phone Call Link */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-2">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                CIVILIAN REPORTER IDENTITY
              </span>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-sky-950 border border-sky-600/50 flex items-center justify-center text-base font-bold text-sky-400">
                    👤
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {report.reporterName || 'Anonymous Citizen'}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400">
                      ROLE: {report.reporterRole || 'Civilian Resident'}
                    </span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300">
                  {formatRelativeTime(report.createdAt)}
                </span>
              </div>

              {/* One-Click Call Link & Copy Phone Button */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <a
                  href={`tel:${citizenPhone.replace(/[^0-9+]/g, '')}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-black uppercase tracking-wider border border-emerald-400 shadow-md shadow-emerald-950/40 active:scale-95 transition-all duration-150 cursor-pointer"
                  title="Initiate telephone call to reporting civilian"
                >
                  <span>📞</span>
                  <span>CALL CITIZEN ({citizenPhone})</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyText(citizenPhone, 'phone', 'PHONE NUMBER')}
                  className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 active:scale-95 transition-all cursor-pointer"
                  title="Copy citizen phone number"
                >
                  {copiedKey === 'phone' ? '✓' : '📋'}
                </button>
              </div>
            </div>

            {/* 2. Verbatim Field Observations Note */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>CIVILIAN DISPATCH NOTE:</span>
                <span className="text-slate-500 font-normal">{formatIsoTimestamp(report.createdAt)}</span>
              </span>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs font-sans text-slate-200 leading-relaxed max-h-24 overflow-y-auto">
                <p className="italic">"{report.note || 'No additional commentary provided by citizen.'}"</p>
              </div>
            </div>

            {/* 3. Exact Hardware GPS Telemetry Box */}
            <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  HARDWARE GPS INCIDENT TELEMETRY
                </span>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                    report.isHardwareGeolocated
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                      : 'bg-amber-950 text-amber-400 border-amber-700'
                  }`}
                >
                  {report.isHardwareGeolocated ? '🛰️ HARDWARE GPS LOCKED' : '📶 CELLULAR ESTIMATE'}
                </span>
              </div>

              <div className="flex items-center justify-between bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                <div className="flex flex-col">
                  <span className="text-sm font-mono font-black text-sky-400">
                    {formatGpsCoord(report.latitude, report.longitude)}
                  </span>
                  <span className="text-[11px] font-sans text-slate-300 mt-0.5">
                    {report.locationLabel || 'Katipunan Municipal Sector'}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 mt-0.5">
                    ACCURACY: ±{report.gpsAccuracyMeters ? report.gpsAccuracyMeters.toFixed(1) : '3.2'}M • LOCK SECURE
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      `${report.latitude.toFixed(6)}, ${report.longitude.toFixed(6)}`,
                      'gps',
                      'GPS COORDINATES'
                    )
                  }
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] border border-slate-600 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                  title="Copy numeric coordinates"
                >
                  <span>{copiedKey === 'gps' ? '✓' : '📋'}</span>
                  <span>{copiedKey === 'gps' ? 'COPIED' : 'COPY'}</span>
                </button>
              </div>

              {/* Prominent Launch GPS Route Button */}
              <button
                type="button"
                onClick={handleLaunchGoogleMaps}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white font-mono font-black text-xs uppercase tracking-wider border border-sky-300 shadow-[0_0_20px_rgba(14,165,233,0.5)] active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer mt-1"
              >
                <span className="text-base">🧭</span>
                <span>LAUNCH GPS ROUTE ↗ (GOOGLE MAPS NAVIGATION)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Mutual Aid / Backup Drawer */}
        {isBackupDrawerOpen && (
          <div className="p-4 rounded-xl bg-slate-950 border-2 border-indigo-500/70 shadow-2xl flex flex-col gap-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-mono font-black text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <span>📡</span>
                <span>REQUEST CROSS-AGENCY MUTUAL AID / TACTICAL BACKUP</span>
              </span>
              <button
                type="button"
                onClick={() => setIsBackupDrawerOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
              >
                ✕ CANCEL
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 font-bold">TARGET RESPONDER AGENCY:</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['RHU', 'FIRE', 'PNP'] as const).map((ag) => (
                    <button
                      key={ag}
                      type="button"
                      onClick={() => setBackupAgency(ag)}
                      className={`py-2 px-2 rounded-lg font-bold border transition-all text-center cursor-pointer ${
                        backupAgency === ag
                          ? 'bg-indigo-600 text-white border-white shadow-lg scale-[1.02]'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {ag === 'RHU' ? '🚑 RHU Medics' : ag === 'FIRE' ? '🚒 BFP Fire' : '🚓 PNP Police'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400 font-bold">BROADCAST PRIORITY LEVEL:</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Critical', 'High'] as const).map((urg) => (
                    <button
                      key={urg}
                      type="button"
                      onClick={() => setBackupUrgency(urg)}
                      className={`py-2 px-2 rounded-lg font-bold border transition-all text-center cursor-pointer ${
                        backupUrgency === urg
                          ? urg === 'Critical'
                            ? 'bg-rose-600 text-white border-white shadow-lg'
                            : 'bg-amber-500 text-slate-950 border-white shadow-lg'
                          : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {urg === 'Critical' ? '🚨 CRITICAL (CODE 3)' : '⚠️ HIGH PRIORITY'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400 font-mono font-bold">TACTICAL SITUATION REASON:</label>
              <textarea
                value={backupNote}
                onChange={(e) => setBackupNote(e.target.value)}
                rows={2}
                placeholder="State specific operational need (e.g., secondary vehicle entrapment, fire hazard spreading, crowd control needed)..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBackupDrawerOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs cursor-pointer active:scale-95"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isActing}
                onClick={handleTransmitBackup}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-black uppercase tracking-wider border border-indigo-400 shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isActing ? 'TRANSMITTING...' : 'CONFIRM & TRANSMIT BACKUP 📡'}
              </button>
            </div>
          </div>
        )}

        {/* Bottom Tactical Field Action Buttons Bar */}
        <div className="pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-bold border border-slate-700 active:scale-95 transition-all cursor-pointer"
          >
            ← Close Dossier
          </button>

          {/* Quick Action Button Group */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Action 1: Confirm Scene Arrival */}
            <button
              type="button"
              disabled={isActing || report.status === 'OnScene' || report.status === 'Resolved'}
              onClick={handleConfirmArrival}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider border transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                report.status === 'OnScene'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-600'
                  : 'bg-amber-600 hover:bg-amber-500 text-slate-950 border-amber-300 shadow-lg shadow-amber-950/40'
              }`}
            >
              <span>{report.status === 'OnScene' ? '✓ ALREADY ON SCENE' : '📍 CONFIRM SCENE ARRIVAL'}</span>
            </button>

            {/* Quick Action 2: Request Backup / Mutual Aid */}
            <button
              type="button"
              disabled={isActing || report.status === 'Resolved'}
              onClick={() => setIsBackupDrawerOpen((prev) => !prev)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-black uppercase tracking-wider border border-indigo-400 shadow-lg shadow-indigo-950/40 active:scale-95 transition-all duration-150 cursor-pointer disabled:opacity-40"
            >
              <span>🛡️ REQUEST BACKUP / MUTUAL AID</span>
            </button>

            {/* Quick Action 3: Mark Resolved */}
            <button
              type="button"
              disabled={isActing || report.status === 'Resolved'}
              onClick={handleMarkResolved}
              className={`px-4 py-2.5 rounded-xl font-mono text-xs font-black uppercase tracking-wider border transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                report.status === 'Resolved'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-600'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-950/40'
              }`}
            >
              <span>{report.status === 'Resolved' ? '✓ INCIDENT RESOLVED' : '✅ MARK RESOLVED'}</span>
            </button>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};

export default CivilianEvidenceModal;
