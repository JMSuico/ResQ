// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Resident emergency dashboard with 2-column hero layout:
// Left column: Evacuation Safe Zones map with legend and ENLARGE TO REDIRECT CTA to /civilian/live-map.
// Right column: Report Emergency card with One-Tap SOS camera trigger, Detailed Report CTA,
// live GPS lock readout, optional personal contact text input, and clean status tracking.
// Strictly 100% arrow functions (=>), ZERO 'any', ZERO emojis, and ZERO tel:/sms: dial links.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Camera,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  FileText,
  Maximize2,
  Clock
} from 'lucide-react';
import { getIncidentFixtures, IncidentFixture } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { CameraCaptureModal, CameraCaptureMetadata } from '@/Shared/CameraCaptureModal';
import { createReport, getMyReports, CreateReportPayload, ReportItem } from '@/Endpoints/reportsApi';
import { useSession } from '@/Hooks/useSession';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';
import { useDistressBeacon } from '@/Hooks/useDistressBeacon';
import { BASELINE_INCIDENT_FIXTURES } from '@/Libs/Assets/baselineFixtures';
import { CivilianButton } from './Shared/CivilianButton';

const REFRESH_INTERVAL_MS = 8000;
const SUCCESS_TOAST_TIMEOUT_MS = 9000;
const CONTACT_STORAGE_KEY = 'resqtrack_reporter_contact_number';

type ExtendedReportItem = ReportItem & {
  aiAutoApproved?: boolean;
  aiVerificationStatus?: string | null;
};

interface CivilianCreateReportPayload extends CreateReportPayload {
  reporterContactNumber?: string;
}

const getStoredContactNumber = (): string => {
  try {
    return localStorage.getItem(CONTACT_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const formatDashboardStatus = (report: ExtendedReportItem): { label: string; pillClass: string } => {
  const raw = (report.status || 'Reported').toUpperCase();
  if (raw === 'REJECTED') {
    return {
      label: 'Rejected',
      pillClass: 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
    };
  }
  if (raw === 'RESOLVED' || raw === 'CLOSED' || report.resolvedAt) {
    return {
      label: 'Resolved',
      pillClass: 'bg-[#E9D9D0] text-[#670626] border-[#670626]/35'
    };
  }
  if (raw === 'ALLOCATED' || raw === 'ENROUTE' || raw === 'ONSCENE' || raw === 'DISPATCHED' || report.allocatedUnitCode) {
    return {
      label: 'Dispatched',
      pillClass: 'bg-[#A83B4D] text-[#F7F1EA] border-[#A83B4D]'
    };
  }
  if (raw === 'VERIFIED' || report.verifiedAt || report.aiAutoApproved) {
    return {
      label: report.aiAutoApproved ? 'AI Auto-Approved' : 'Verified',
      pillClass: 'bg-emerald-100 text-emerald-900 border-emerald-300'
    };
  }
  return {
    label: 'Submitted — Pending Review',
    pillClass: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/45'
  };
};

export const CivilianDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useSession();
  const { coords, isHardwareGeolocated, refreshGps } = useGpsLocation();

  const [fixtures, setFixtures] = useState<IncidentFixture[]>([]);
  const [myReports, setMyReports] = useState<ExtendedReportItem[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [gpsWarning, setGpsWarning] = useState<string | null>(null);
  const [reporterContactNumber, setReporterContactNumber] = useState<string>(() => getStoredContactNumber());
  const [includeContactCheck, setIncludeContactCheck] = useState<boolean>(() => Boolean(getStoredContactNumber()));
  const [isResyncingGps, setIsResyncingGps] = useState<boolean>(false);

  const { dispatchReportEvent } = useReportEventBus();

  const loadData = useCallback(async () => {
    try {
      const [f, myRepList] = await Promise.all([
        getIncidentFixtures().catch(() => []),
        getMyReports().catch(() => [])
      ]);

      setFixtures(Array.isArray(f) && f.length > 0 ? f : BASELINE_INCIDENT_FIXTURES);

      const safeMine = Array.isArray(myRepList) ? (myRepList as ExtendedReportItem[]) : [];
      const filteredMine = safeMine.filter((r) => {
        if (!r || !r.id) return false;
        if (session?.userId && r.reporterId) {
          return r.reporterId === session.userId;
        }
        return true;
      });
      filteredMine.sort((a, b) => {
        const ta = new Date(a.createdAt || a.submittedAt || 0).getTime();
        const tb = new Date(b.createdAt || b.submittedAt || 0).getTime();
        return tb - ta;
      });
      setMyReports(filteredMine);
    } catch (err) {
      console.error('Error refreshing civilian dashboard feeds:', err);
      setFixtures((prev) => (prev.length > 0 ? prev : BASELINE_INCIDENT_FIXTURES));
    }
  }, [session?.userId]);

  useValueRefreshAuto(loadData, {
    intervalMs: REFRESH_INTERVAL_MS,
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  useReportEventBus(() => {
    loadData();
  });

  const activeDistressIncidentId = useMemo(() => {
    try {
      const stored = localStorage.getItem('resqtrack_active_distress_incident_id');
      if (stored) return stored;
    } catch {
      // Storage guard
    }
    const activeOne = myReports.find((r) => {
      const st = (r.status || '').toLowerCase();
      return st !== 'resolved' && st !== 'closed' && st !== 'rejected';
    });
    return activeOne?.id || null;
  }, [myReports]);

  useDistressBeacon({
    activeIncidentId: activeDistressIncidentId,
    intervalMs: 60000
  });

  const handleContactChange = (val: string) => {
    setReporterContactNumber(val);
    try {
      localStorage.setItem(CONTACT_STORAGE_KEY, val);
    } catch {
      // Storage guard
    }
  };

  const handleResyncGps = () => {
    setIsResyncingGps(true);
    setGpsWarning(null);
    refreshGps();
    setTimeout(() => setIsResyncingGps(false), 1000);
  };

  const handleQuickSosTrigger = () => {
    if (!isHardwareGeolocated && coords.isFallback) {
      refreshGps();
      setGpsWarning('Enable device GPS/location before opening camera.');
      return;
    }
    setGpsWarning(null);
    setIsCameraOpen(true);
  };

  const handleQuickReport = async (dataUrl: string, meta?: CameraCaptureMetadata) => {
    try {
      const trimmedContact = includeContactCheck ? reporterContactNumber.trim() : '';
      const aiPreview = meta?.aiPreview;
      const payload: CivilianCreateReportPayload = {
        title: 'Emergency Reported via One-Tap SOS',
        note: `One-Tap SOS Camera. GPS ±${Math.round(coords.accuracy)}m.`,
        category:
          aiPreview?.isGenuineIncident !== false && aiPreview?.detectedCategory
            ? aiPreview.detectedCategory
            : 'VehicularAccident',
        severity:
          aiPreview?.isGenuineIncident !== false && aiPreview?.recommendedSeverity
            ? aiPreview.recommendedSeverity
            : 'Critical',
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracyMeters: coords.accuracy,
        isHardwareGeolocated,
        isBlurry: meta?.isBlurry ?? false,
        requiresManualVerification: meta?.requiresManualVerification ?? false,
        locationLabel: 'Citizen Current GPS Location',
        imageDataUrl: dataUrl,
        reporterContactNumber: trimmedContact || undefined,
        roboflowModelId: aiPreview?.roboflowModelId ?? null,
        roboflowPrediction: aiPreview?.roboflowPrediction ?? null,
        roboflowConfidence:
          typeof aiPreview?.roboflowConfidence === 'number' ? aiPreview.roboflowConfidence : null,
        roboflowNeedsReview: aiPreview?.roboflowNeedsReview ?? false,
        claudeModelUsed: aiPreview?.claudeModelUsed ?? null,
        claudeIncidentCategory: aiPreview?.detectedCategory ?? null,
        claudeSituationSummary: aiPreview?.situationDescription ?? null,
        claudeVisibleHazards: aiPreview?.visibleHazards ?? null,
        claudeUncertaintyNotes: aiPreview?.uncertaintyNotes ?? null,
        pointerIconType: aiPreview?.pointerIconType ?? null
      };

      const res = await createReport(payload);
      const reportItem = res.report as ExtendedReportItem;
      dispatchReportEvent(reportItem);

      try {
        const existing = JSON.parse(localStorage.getItem('resqtrack_submitted_report_ids') || '[]') as string[];
        if (!existing.includes(reportItem.id)) {
          existing.unshift(reportItem.id);
        }
        localStorage.setItem('resqtrack_submitted_report_ids', JSON.stringify(existing));
        localStorage.setItem('resqtrack_active_distress_incident_id', reportItem.id);
        if (reportItem.reporterId) {
          localStorage.setItem('resqtrack_reporter_id', reportItem.reporterId);
        }
      } catch {
        // Storage access safeguard
      }

      setMyReports((prev) => [reportItem, ...prev]);
      const isVerified = reportItem.status === 'Verified' || Boolean(reportItem.aiAutoApproved);
      setReportSuccess(
        `Report #${reportItem.referenceCode} logged (${isVerified ? 'AI Auto-Approved' : 'Pending Review'}).`
      );
      setTimeout(() => setReportSuccess(null), SUCCESS_TOAST_TIMEOUT_MS);
    } catch (err: unknown) {
      console.error('Failed to submit emergency report:', err);
    }
  };

  const markers: MapMarker[] = useMemo(
    () => [
      {
        id: 'citizen-gps',
        lat: coords.latitude,
        lng: coords.longitude,
        title: 'Your Current Position',
        type: 'gps' as const
      },
      ...fixtures.map((f) => ({
        id: f.id,
        lat: f.latitude,
        lng: f.longitude,
        title: f.title,
        type: 'fixture' as const,
        category: f.category,
        agency: f.assignedUnitType
      })),
      ...myReports.map((r) => ({
        id: `my-report-${r.id}`,
        lat: r.latitude,
        lng: r.longitude,
        title: `Your Report: ${r.title}`,
        status: r.status || 'Reported',
        type: 'incident' as const,
        category: r.category,
        agency: r.recommendedAgencyUnit || undefined
      }))
    ],
    [coords.latitude, coords.longitude, fixtures, myReports]
  );

  const latestReport = myReports[0] || null;
  const latestStatus = latestReport ? formatDashboardStatus(latestReport) : null;

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* Page Title Bar on Deep Cherry Canvas */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#F7F1EA]/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
            Katipunan Resident Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
            Civilian Safety Command
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#E9D9D0] bg-[#4A041A]/80 border border-[#F7F1EA]/20 px-3.5 py-2 rounded-xl">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isHardwareGeolocated ? 'bg-emerald-400 animate-pulse' : 'bg-[#A83B4D]'
            }`}
          />
          <span>{isHardwareGeolocated ? 'GPS Active' : 'Locating GPS'}</span>
        </div>
      </div>

      {/* Post-Submit Confirmation Toast */}
      {reportSuccess && (
        <div className="clay-surface p-4 rounded-2xl bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] text-sm font-medium flex items-center justify-between gap-3 shadow-[0_12px_28px_rgba(74,4,26,0.28)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#670626]" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-[#670626]">Incident Submitted</span>
              <span className="text-xs font-mono text-[#A83B4D] mt-0.5">{reportSuccess}</span>
            </div>
          </div>
          <Link
            to="/civilian/my-reports"
            className="text-xs font-mono font-bold text-[#670626] underline whitespace-nowrap"
          >
            My Reports
          </Link>
        </div>
      )}

      {/* 2-Column Tactical Hero Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT COLUMN: EVACUATION SAFE ZONES MAP */}
        <section
          aria-label="Evacuation Safe Zones Map"
          className="lg:col-span-7 clay-surface p-5 sm:p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_16px_38px_rgba(74,4,26,0.28),inset_0_1px_0_rgba(255,255,255,0.85)] flex flex-col justify-between gap-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#670626]/15 pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 flex items-center justify-center flex-shrink-0">
                <Navigation className="w-5 h-5 text-[#670626]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#670626] leading-tight">
                  Evacuation Safe Zones
                </h2>
                <p className="text-xs font-mono text-[#A83B4D] mt-0.5">
                  {fixtures.length} Safe Zones in Katipunan
                </p>
              </div>
            </div>

            <CivilianButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate('/civilian/live-map')}
              icon={<Maximize2 className="w-4 h-4" />}
              className="whitespace-nowrap tracking-wide text-xs font-mono uppercase"
            >
              ENLARGE TO REDIRECT
            </CivilianButton>
          </div>

          {/* Safe Zone Legend */}
          <div className="flex flex-wrap items-center gap-2.5 p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 text-xs font-mono text-[#670626]">
            <span className="inline-flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white" />
              <span>Your Position</span>
            </span>
            <span className="text-[#670626]/40">|</span>
            <span className="inline-flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 border border-white" />
              <span>Safe Zones ({fixtures.length})</span>
            </span>
            <span className="text-[#670626]/40">|</span>
            <span className="inline-flex items-center gap-1.5 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#670626] border border-white" />
              <span>My Reports ({myReports.length})</span>
            </span>
          </div>

          {/* Embedded Satellite Evacuation Map */}
          <div className="h-[320px] sm:h-[380px] lg:h-[430px] w-full rounded-xl overflow-hidden border border-[#670626]/20 bg-[#E9D9D0] relative">
            <SatelliteCommandMap
              markers={markers}
              centerLat={coords.latitude}
              centerLng={coords.longitude}
              roleFilter="Civilian"
              className="h-full w-full"
            />
          </div>
        </section>

        {/* RIGHT COLUMN: REPORT EMERGENCY CARD + CLEAN STATUS TRACKING */}
        <section
          aria-label="Report Emergency"
          className="lg:col-span-5 clay-surface p-5 sm:p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_16px_38px_rgba(74,4,26,0.28),inset_0_1px_0_rgba(255,255,255,0.85)] flex flex-col justify-between gap-5"
        >
          <div className="flex flex-col gap-4">
            <div className="border-b border-[#670626]/15 pb-3.5">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
                Emergency Dispatch
              </span>
              <h2 className="text-2xl font-black text-[#670626] tracking-tight mt-0.5">
                Report Emergency
              </h2>
            </div>

            {/* GPS Lock Readout Well */}
            <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#670626]">
                  <MapPin className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
                  <span>GPS Lock</span>
                </div>
                <button
                  type="button"
                  onClick={handleResyncGps}
                  className="text-xs font-mono font-bold text-[#670626] hover:text-[#4A041A] underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResyncingGps ? 'animate-spin' : ''}`} />
                  <span>Re-sync</span>
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="font-black text-[#670626]">
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#F7F1EA] border border-[#670626]/20 text-[#670626] font-bold">
                  ±{Math.round(coords.accuracy)}m
                </span>
              </div>
            </div>

            {gpsWarning && (
              <div className="p-3 rounded-xl bg-[#670626] text-[#F7F1EA] text-xs font-medium">
                {gpsWarning}
              </div>
            )}

            {/* Personal Contact Optional Check & Stored Text Input (NO tel: links) */}
            <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2.5">
              <label className="flex items-center gap-2 text-xs font-mono font-bold text-[#670626] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeContactCheck}
                  onChange={(e) => setIncludeContactCheck(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#670626] cursor-pointer"
                />
                <span>Contact Number (Optional)</span>
              </label>

              {includeContactCheck && (
                <input
                  type="text"
                  value={reporterContactNumber}
                  onChange={(e) => handleContactChange(e.target.value)}
                  placeholder="e.g. 0917 123 4567"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F1EA] border border-[#670626]/25 text-sm font-mono text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
                />
              )}
            </div>

            {/* One-Tap SOS Primary CTA */}
            <button
              type="button"
              onClick={handleQuickSosTrigger}
              className="w-full min-h-[72px] px-6 py-4 rounded-2xl bg-[#670626] hover:bg-[#4A041A] active:scale-[0.99] text-[#F7F1EA] shadow-[0_12px_28px_rgba(74,4,26,0.38)] border border-[#A83B4D]/50 transition-all flex items-center justify-center gap-4 cursor-pointer"
              aria-label="One-Tap SOS Emergency Camera Trigger"
            >
              <div className="w-11 h-11 rounded-xl bg-[#F7F1EA]/15 border border-[#F7F1EA]/25 flex items-center justify-center flex-shrink-0">
                <Camera className="w-6 h-6 text-[#F7F1EA]" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-lg tracking-wide leading-none">
                  One-Tap SOS
                </span>
                <span className="text-xs font-mono text-[#E9D9D0] mt-1">
                  Live camera &amp; GPS
                </span>
              </div>
            </button>

            {/* Detailed Report Secondary CTA */}
            <Link
              to="/civilian/report"
              className="w-full py-3 px-4 rounded-xl bg-[#E9D9D0] hover:bg-[#670626] text-[#670626] hover:text-[#F7F1EA] border border-[#670626]/25 text-sm font-bold transition-all flex items-center justify-center gap-2 min-h-[46px]"
            >
              <FileText className="w-4 h-4" />
              <span>Detailed Report</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Clean Status Tracking Panel */}
          <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#670626] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#A83B4D]" />
                <span>Report Status</span>
              </span>
              <Link
                to="/civilian/my-reports"
                className="text-xs font-mono font-bold text-[#670626] hover:text-[#4A041A] underline inline-flex items-center gap-1"
              >
                <span>My Reports ({myReports.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {latestReport && latestStatus ? (
              <Link
                to="/civilian/my-reports"
                className="p-3 rounded-xl bg-[#F7F1EA] border border-[#670626]/20 hover:border-[#670626] transition-colors flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-black text-[#A83B4D]">
                    #{latestReport.referenceCode}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border ${latestStatus.pillClass}`}
                  >
                    {latestStatus.label}
                  </span>
                </div>
                <span className="text-sm font-bold text-[#670626] truncate">
                  {latestReport.title}
                </span>
              </Link>
            ) : (
              <div className="p-3 rounded-xl bg-[#F7F1EA] border border-[#670626]/15 flex items-center gap-2.5 text-xs text-[#A83B4D]">
                <ShieldCheck className="w-4 h-4 text-[#670626] flex-shrink-0" />
                <span>No reports submitted yet.</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 1-Tap Emergency Camera Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleQuickReport}
        title="One-Tap SOS Camera"
        instructionText="Take a live photo of the scene."
      />
    </div>
  );
};

export default CivilianDashboard;
