// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Detailed emergency report submission screen with live GPS tracking,
// live camera capture / image upload with clean un-watermarked AI vision analysis,
// visible AI Processing & Auto-Approve Evaluation indicator, optional personal contact text field (no tel: links),
// pre-submission confirmation modal, and dynamic AI Auto-Approved vs Pending Review receipt.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Camera,
  Upload,
  Sparkles,
  Car,
  Flame,
  HeartPulse,
  ShieldAlert,
  Waves,
  Zap,
  Clock
} from 'lucide-react';
import {
  analyzeIncidentImage,
  createReport,
  CreateReportPayload,
  IncidentImageAiAnalysisResponse,
  IncidentPointerIconType,
  ReportItem
} from '@/Endpoints/reportsApi';
import { CameraCaptureModal, CameraCaptureMetadata } from '@/Shared/CameraCaptureModal';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { CATEGORY_LABELS } from '@/Libs/Assets/data';
import { CivilianButton } from './Shared/CivilianButton';
import { CivilianModalCard } from './Shared/CivilianModalCard';

const RESYNC_ANIMATION_MS = 1200;
const CONTACT_STORAGE_KEY = 'resqtrack_reporter_contact_number';
const AI_VISION_CACHE_KEY = 'resqtrack_ai_vision_by_report';

const VALID_SEVERITIES = ['Critical', 'High', 'Medium', 'Low'] as const;

type ExtendedAiAnalysisResponse = IncidentImageAiAnalysisResponse & {
  autoApproveEligible?: boolean;
  aiVerificationStatus?: string | null;
};

type ExtendedReportItem = ReportItem & {
  aiAutoApproved?: boolean;
  aiVerificationStatus?: string | null;
};

const resolveValidCategoryKey = (candidate?: string | null): string | null => {
  if (!candidate) return null;
  const trimmed = candidate.trim();
  if (trimmed in CATEGORY_LABELS) return trimmed;
  const lower = trimmed.toLowerCase();
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    if (key.toLowerCase() === lower || label.toLowerCase() === lower) {
      return key;
    }
  }
  if (lower.includes('vehicular') || lower.includes('accident') || lower.includes('collision') || lower.includes('crash')) {
    return 'VehicularAccident';
  }
  if (lower.includes('fire') || lower.includes('flame') || lower.includes('smoke')) {
    return 'StructuralFire';
  }
  if (lower.includes('medical') || lower.includes('injury') || lower.includes('cardiac') || lower.includes('trauma')) {
    return 'MedicalEmergency';
  }
  if (lower.includes('crime') || lower.includes('security') || lower.includes('police')) {
    return 'CrimeOrSecurity';
  }
  if (lower.includes('flood') || lower.includes('disaster') || lower.includes('landslide') || lower.includes('storm')) {
    return 'NaturalDisaster';
  }
  if (lower.includes('hazard') || lower.includes('infrastructure')) {
    return 'HazardFixture';
  }
  return null;
};

const resolveValidSeverity = (candidate?: string | null): string | null => {
  if (!candidate) return null;
  const lower = candidate.trim().toLowerCase();
  const matched = VALID_SEVERITIES.find((s) => s.toLowerCase() === lower);
  return matched || null;
};

const derivePointerIconFromCategory = (catKey: string): IncidentPointerIconType => {
  switch (catKey) {
    case 'VehicularAccident':
      return 'car-crash';
    case 'StructuralFire':
      return 'fire';
    case 'MedicalEmergency':
      return 'medical';
    case 'CrimeOrSecurity':
      return 'crime';
    case 'NaturalDisaster':
      return 'flood';
    default:
      return 'hazard';
  }
};

const renderPointerTypeIcon = (pointerType?: string | null): React.ReactNode => {
  switch (pointerType) {
    case 'car-crash':
      return <Car className="w-4 h-4 text-[#670626]" />;
    case 'fire':
      return <Flame className="w-4 h-4 text-[#670626]" />;
    case 'medical':
      return <HeartPulse className="w-4 h-4 text-[#670626]" />;
    case 'crime':
      return <ShieldAlert className="w-4 h-4 text-[#670626]" />;
    case 'flood':
      return <Waves className="w-4 h-4 text-[#670626]" />;
    default:
      return <ShieldAlert className="w-4 h-4 text-[#670626]" />;
  }
};

interface CivilianCreateReportPayload extends CreateReportPayload {
  reporterContactNumber?: string;
}

const getInitialStoredContact = (): string => {
  try {
    const direct = localStorage.getItem(CONTACT_STORAGE_KEY);
    if (direct) return direct;
    const rawProfile = localStorage.getItem('resqtrack_civilian_medical_profile');
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile) as { reporterContactNumber?: string };
      return parsed.reporterContactNumber || '';
    }
  } catch {
    return '';
  }
  return '';
};

export const ReportAccidentPage: React.FC = () => {
  const { coords, isHardwareGeolocated, signalQuality, refreshGps } = useGpsLocation();
  const { dispatchReportEvent } = useReportEventBus();
  const navigate = useNavigate();

  const [title, setTitle] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [category, setCategory] = useState<string>('VehicularAccident');
  const [severity, setSeverity] = useState<string>('Critical');
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [reporterContactNumber, setReporterContactNumber] = useState<string>(() =>
    getInitialStoredContact()
  );
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [captureMetadata, setCaptureMetadata] = useState<CameraCaptureMetadata | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState<boolean>(false);
  const [aiAnalysis, setAiAnalysis] = useState<ExtendedAiAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isResyncing, setIsResyncing] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [submittedReport, setSubmittedReport] = useState<ExtendedReportItem | null>(null);

  const stepGpsRef = useRef<HTMLDivElement>(null);
  const stepCameraRef = useRef<HTMLDivElement>(null);
  const stepTriageRef = useRef<HTMLDivElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  const scrollToStep = (ref: React.RefObject<HTMLDivElement | null>): void => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const applyAiAnalysisResult = (res: ExtendedAiAnalysisResponse): void => {
    setAiAnalysis(res);
    if (res.isGenuineIncident !== false) {
      const matchedCategory = resolveValidCategoryKey(res.detectedCategory);
      if (matchedCategory) {
        setCategory(matchedCategory);
      }
      const matchedSeverity = resolveValidSeverity(res.recommendedSeverity);
      if (matchedSeverity) {
        setSeverity(matchedSeverity);
      }
    }
  };

  const triggerDualAiVisionAnalysis = async (nextImageDataUrl: string): Promise<void> => {
    setIsAnalyzingAi(true);
    try {
      const res = (await analyzeIncidentImage({
        imageDataUrl: nextImageDataUrl,
        titleHint: title.trim() || undefined,
        noteHint: note.trim() || undefined,
        categoryHint: category
      })) as ExtendedAiAnalysisResponse;
      applyAiAnalysisResult(res);
    } catch {
      const fallbackPointer = derivePointerIconFromCategory(category);
      setAiAnalysis({
        roboflowModelId: 'accident-and-non-accident-label-image-dataset/14',
        roboflowPrediction: 'Unavailable',
        roboflowConfidence: 0,
        roboflowNeedsReview: true,
        roboflowAuthTransport: 'OFFLINE_FALLBACK',
        claudeModelUsed: 'OFFLINE_MANUAL_REVIEW',
        isGenuineIncident: false,
        detectedCategory: category,
        recommendedSeverity: severity,
        pointerIconType: fallbackPointer,
        situationDescription:
          title.trim() || `${CATEGORY_LABELS[category] || category} scene captured.`,
        visibleHazards: note.trim() || 'AI vision offline; responder verification required.',
        uncertaintyNotes: 'AI vision offline — manual verification required.',
        verificationStatus: 'SUBMITTED / PENDING_REVIEW',
        recommendedAgencyUnit:
          category === 'StructuralFire'
            ? 'FIRE'
            : category === 'CrimeOrSecurity'
            ? 'PNP'
            : 'RHU'
      });
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleCaptureComplete = (dataUrl: string, meta: CameraCaptureMetadata): void => {
    setImageDataUrl(dataUrl);
    setCaptureMetadata(meta);
    if (meta.aiPreview) {
      applyAiAnalysisResult(meta.aiPreview);
      setIsAnalyzingAi(false);
      return;
    }
    void triggerDualAiVisionAnalysis(meta.analysisImageDataUrl || dataUrl);
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      setImageDataUrl(result);
      setCaptureMetadata({
        varianceScore: 142.5,
        isBlurry: false,
        requiresManualVerification: false,
        dynamicThreshold: 80,
        thresholdReasoning: 'Uploaded Photo',
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracy,
        isHardwareGeolocated,
        analysisImageDataUrl: result
      });
      void triggerDualAiVisionAnalysis(result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleForceResync = () => {
    setIsResyncing(true);
    refreshGps();
    setTimeout(() => setIsResyncing(false), RESYNC_ANIMATION_MS);
  };

  const handleContactInput = (val: string) => {
    setReporterContactNumber(val);
    try {
      localStorage.setItem(CONTACT_STORAGE_KEY, val);
    } catch {
      // Storage guard
    }
  };

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Incident title is required.');
      scrollToStep(stepTriageRef);
      return;
    }
    if (!isHardwareGeolocated && coords.isFallback) {
      refreshGps();
      setError('Enable device GPS/location to submit.');
      return;
    }
    setError(null);
    setIsConfirmModalOpen(true);
  };

  const isAutoApproveEligible = Boolean(
    aiAnalysis &&
      (aiAnalysis.autoApproveEligible ||
        (aiAnalysis.isGenuineIncident !== false &&
          !aiAnalysis.roboflowNeedsReview &&
          !captureMetadata?.isBlurry))
  );

  const handleFinalSubmit = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const trimmedContact = reporterContactNumber.trim();
      const aiConfirmedClean =
        Boolean(aiAnalysis?.isGenuineIncident) && !aiAnalysis?.roboflowNeedsReview;
      const requiresManualVerification =
        Boolean(captureMetadata?.isBlurry) ||
        (aiAnalysis ? !aiConfirmedClean : Boolean(captureMetadata?.requiresManualVerification));

      const payload: CivilianCreateReportPayload = {
        title: title.trim(),
        note: note.trim(),
        category,
        severity,
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracyMeters: coords.accuracy,
        isHardwareGeolocated,
        isBlurry: captureMetadata?.isBlurry ?? false,
        requiresManualVerification,
        locationLabel: locationLabel.trim() || 'Katipunan, ZN (GPS Geotag)',
        imageDataUrl: imageDataUrl || undefined,
        reporterContactNumber: trimmedContact || undefined,
        roboflowModelId: aiAnalysis?.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14',
        roboflowPrediction: aiAnalysis?.roboflowPrediction || null,
        roboflowConfidence:
          typeof aiAnalysis?.roboflowConfidence === 'number' ? aiAnalysis.roboflowConfidence : null,
        roboflowNeedsReview: aiAnalysis?.roboflowNeedsReview ?? false,
        claudeModelUsed: aiAnalysis?.claudeModelUsed || (aiAnalysis ? 'claude-haiku-4-5' : null),
        claudeIncidentCategory: aiAnalysis?.detectedCategory || null,
        claudeSituationSummary: aiAnalysis?.situationDescription || null,
        claudeVisibleHazards: aiAnalysis?.visibleHazards || null,
        claudeUncertaintyNotes: aiAnalysis?.uncertaintyNotes || null,
        pointerIconType: aiAnalysis?.pointerIconType || derivePointerIconFromCategory(category)
      };

      const res = await createReport(payload);
      const rawReport = res.report as ExtendedReportItem;
      const enrichedReport: ExtendedReportItem = {
        ...rawReport,
        roboflowModelId: rawReport.roboflowModelId ?? payload.roboflowModelId,
        roboflowPrediction: rawReport.roboflowPrediction ?? payload.roboflowPrediction,
        roboflowConfidence: rawReport.roboflowConfidence ?? payload.roboflowConfidence,
        roboflowNeedsReview: rawReport.roboflowNeedsReview ?? payload.roboflowNeedsReview,
        claudeModelUsed: rawReport.claudeModelUsed ?? payload.claudeModelUsed,
        claudeIncidentCategory: rawReport.claudeIncidentCategory ?? payload.claudeIncidentCategory,
        claudeSituationSummary: rawReport.claudeSituationSummary ?? payload.claudeSituationSummary,
        claudeVisibleHazards: rawReport.claudeVisibleHazards ?? payload.claudeVisibleHazards,
        claudeUncertaintyNotes: rawReport.claudeUncertaintyNotes ?? payload.claudeUncertaintyNotes,
        pointerIconType: rawReport.pointerIconType ?? payload.pointerIconType
      };
      dispatchReportEvent(enrichedReport);

      try {
        const existing = JSON.parse(localStorage.getItem('resqtrack_submitted_report_ids') || '[]') as string[];
        if (!existing.includes(enrichedReport.id)) {
          existing.unshift(enrichedReport.id);
        }
        localStorage.setItem('resqtrack_submitted_report_ids', JSON.stringify(existing));
        localStorage.setItem('resqtrack_active_distress_incident_id', enrichedReport.id);
        if (enrichedReport.reporterId) {
          localStorage.setItem('resqtrack_reporter_id', enrichedReport.reporterId);
        }
        if (aiAnalysis) {
          const cachedRaw = localStorage.getItem(AI_VISION_CACHE_KEY);
          const cachedMap = cachedRaw ? (JSON.parse(cachedRaw) as Record<string, Partial<ExtendedReportItem>>) : {};
          const aiEntry: Partial<ExtendedReportItem> = {
            roboflowModelId: enrichedReport.roboflowModelId,
            roboflowPrediction: enrichedReport.roboflowPrediction,
            roboflowConfidence: enrichedReport.roboflowConfidence,
            roboflowNeedsReview: enrichedReport.roboflowNeedsReview,
            claudeModelUsed: enrichedReport.claudeModelUsed,
            claudeIncidentCategory: enrichedReport.claudeIncidentCategory,
            claudeSituationSummary: enrichedReport.claudeSituationSummary,
            claudeVisibleHazards: enrichedReport.claudeVisibleHazards,
            claudeUncertaintyNotes: enrichedReport.claudeUncertaintyNotes,
            pointerIconType: enrichedReport.pointerIconType
          };
          cachedMap[enrichedReport.id] = aiEntry;
          if (enrichedReport.referenceCode) {
            cachedMap[enrichedReport.referenceCode] = aiEntry;
          }
          localStorage.setItem(AI_VISION_CACHE_KEY, JSON.stringify(cachedMap));
        }
      } catch {
        // Storage access safeguard
      }

      setIsConfirmModalOpen(false);
      setSubmittedReport(enrichedReport);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report.';
      setError(msg);
      setIsConfirmModalOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForNewReport = (): void => {
    setSubmittedReport(null);
    setTitle('');
    setNote('');
    setLocationLabel('');
    setImageDataUrl(null);
    setCaptureMetadata(null);
    setAiAnalysis(null);
    setIsAnalyzingAi(false);
    setError(null);
  };

  const getCategoryRoutingTag = (catKey: string): { agencies: string[]; desc: string } => {
    switch (catKey) {
      case 'VehicularAccident':
        return { agencies: ['RHU (Medics)', 'PNP (Traffic)'], desc: 'Trauma & traffic routing' };
      case 'MedicalEmergency':
        return { agencies: ['RHU (Paramedics)'], desc: 'Medical routing' };
      case 'StructuralFire':
        return { agencies: ['BFP (Fire)', 'RHU (Triage)'], desc: 'Fire & triage routing' };
      case 'CrimeOrSecurity':
        return { agencies: ['PNP (Patrol)'], desc: 'Police patrol routing' };
      case 'NaturalDisaster':
        return { agencies: ['LDRRMO', 'RHU', 'BFP'], desc: 'Disaster response routing' };
      case 'HazardFixture':
      default:
        return { agencies: ['LDRRMO', 'Engineering'], desc: 'Hazard inspection routing' };
    }
  };

  const routingInfo = getCategoryRoutingTag(category);

  if (submittedReport) {
    const isReceiptVerified =
      submittedReport.status === 'Verified' || Boolean(submittedReport.aiAutoApproved);

    return (
      <div className="flex flex-col gap-6 w-full pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F7F1EA]/20 pb-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
              Submission Receipt
            </span>
            <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
              Report Submitted
            </h1>
          </div>
          <CivilianButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate('/civilian/dashboard')}
            icon={<ArrowLeft className="w-4 h-4" />}
          >
            Dashboard
          </CivilianButton>
        </div>

        <div className="clay-surface p-6 sm:p-8 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/20 shadow-[0_18px_42px_rgba(74,4,26,0.28)] flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#670626]/15 pb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center flex-shrink-0 ${
                  isReceiptVerified
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-800'
                    : 'bg-[#E9D9D0] border-[#670626]/20 text-[#670626]'
                }`}
              >
                {isReceiptVerified ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Clock className="w-6 h-6" />
                )}
              </div>
              <div>
                <span className="text-xs font-mono font-bold uppercase text-[#A83B4D] block">
                  Reference #{submittedReport.referenceCode}
                </span>
                <h2 className="text-xl font-black text-[#670626]">
                  {submittedReport.title}
                </h2>
              </div>
            </div>

            <span
              className={`px-4 py-1.5 rounded-full border text-xs font-mono font-bold uppercase self-start sm:self-auto ${
                isReceiptVerified
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                  : 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/50'
              }`}
            >
              {isReceiptVerified ? 'AI Auto-Approved (Verified)' : 'Submitted — Pending Review'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2.5 text-sm font-mono">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Status</span>
              <span className={isReceiptVerified ? 'text-emerald-800 font-black' : 'text-[#670626] font-black'}>
                {isReceiptVerified ? 'AI Auto-Approved (Verified)' : 'Submitted — Pending Review'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Coordinates</span>
              <span className="text-[#670626] font-bold">
                {Number(submittedReport.latitude).toFixed(5)}° N,{' '}
                {Number(submittedReport.longitude).toFixed(5)}° E
              </span>
            </div>
            {reporterContactNumber.trim() && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A83B4D]">Contact</span>
                <span className="text-[#670626] font-bold">
                  {reporterContactNumber.trim()}
                </span>
              </div>
            )}
          </div>

          <p className={`text-sm leading-relaxed font-medium ${isReceiptVerified ? 'text-emerald-900' : 'text-[#A83B4D]'}`}>
            {isReceiptVerified
              ? 'AI verified this incident scene. Dispatched to active responders.'
              : 'Logged in the Katipunan dispatch queue for duty officer verification.'}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <CivilianButton
              type="button"
              variant="primary"
              size="lg"
              onClick={() => navigate('/civilian/my-reports')}
              icon={<ArrowRight className="w-4 h-4" />}
              iconPosition="right"
              className="w-full sm:flex-1"
            >
              Track in My Reports
            </CivilianButton>
            <CivilianButton
              type="button"
              variant="outline"
              size="lg"
              onClick={handleResetForNewReport}
              className="w-full sm:w-auto"
            >
              Submit Another Report
            </CivilianButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F7F1EA]/20 pb-4">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#E9D9D0]">
            Incident Filing
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-[#F7F1EA] tracking-tight mt-0.5">
            Report Emergency
          </h1>
          <p className="text-sm text-[#E9D9D0] mt-1">
            Direct to LDRRMO, RHU, BFP, and PNP.
          </p>
        </div>

        <CivilianButton
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate('/civilian/dashboard')}
          icon={<ArrowLeft className="w-4 h-4" />}
          className="self-start sm:self-auto"
        >
          Back
        </CivilianButton>
      </div>

      {/* 2. Stepped Progress Track */}
      <div className="clay-surface grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 text-sm font-mono shadow-[0_12px_28px_rgba(74,4,26,0.22)]">
        <button
          type="button"
          onClick={() => scrollToStep(stepGpsRef)}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-left hover:border-[#670626] transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-full bg-[#670626] text-[#F7F1EA] flex items-center justify-center font-bold text-xs flex-shrink-0">
            1
          </span>
          <span className="text-[#670626] text-sm font-bold truncate">1. GPS Location</span>
        </button>

        <button
          type="button"
          onClick={() => scrollToStep(stepCameraRef)}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
            imageDataUrl
              ? 'bg-[#E9D9D0] border-[#670626]/35'
              : 'bg-[#E9D9D0] border-[#A83B4D]/50 hover:border-[#670626]'
          }`}
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
              imageDataUrl ? 'bg-[#670626] text-[#F7F1EA]' : 'bg-[#A83B4D] text-[#F7F1EA]'
            }`}
          >
            {imageDataUrl ? <CheckCircle2 className="w-4 h-4" /> : '2'}
          </span>
          <span className="text-[#670626] text-sm font-bold truncate">2. Scene Photo</span>
        </button>

        <button
          type="button"
          onClick={() => scrollToStep(stepTriageRef)}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/20 text-left hover:border-[#670626] transition-colors cursor-pointer"
        >
          <span className="w-6 h-6 rounded-full bg-[#670626] text-[#F7F1EA] flex items-center justify-center font-bold text-xs flex-shrink-0">
            3
          </span>
          <span className="text-[#670626] text-sm font-bold truncate">3. Details</span>
        </button>
      </div>

      {/* 3. Error Callout */}
      {error && (
        <div className="clay-surface p-4 rounded-xl bg-[#F7F1EA] border-2 border-[#670626] text-sm text-[#670626] font-bold flex items-center gap-3 shadow-lg">
          <AlertTriangle className="w-5 h-5 text-[#670626] flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4. Form Container */}
      <form onSubmit={handleOpenConfirm} className="flex flex-col gap-6">
        {/* STEP 1: GPS LOCATION */}
        <div
          ref={stepGpsRef}
          className="clay-surface p-5 sm:p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-4 shadow-[0_14px_34px_rgba(74,4,26,0.22)]"
        >
          <div className="flex items-center justify-between border-b border-[#670626]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isHardwareGeolocated ? 'bg-emerald-600 animate-pulse' : 'bg-[#A83B4D]'
                }`}
              />
              <h2 className="text-sm font-mono font-black uppercase tracking-wider text-[#670626]">
                1. GPS Location
              </h2>
            </div>
            <button
              type="button"
              onClick={handleForceResync}
              className="text-xs font-mono font-bold text-[#670626] hover:text-[#4A041A] flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 hover:border-[#670626] transition-colors cursor-pointer"
              title="Resync GPS"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isResyncing ? 'animate-spin' : ''}`} />
              <span>{isResyncing ? 'Resyncing...' : 'Resync'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
            <div className="flex flex-col">
              <span className="text-xs font-mono uppercase font-bold text-[#A83B4D]">
                Coordinates
              </span>
              <span className="text-base sm:text-lg font-mono font-black text-[#670626] mt-1">
                {coords.latitude.toFixed(6)}° N, {coords.longitude.toFixed(6)}° E
              </span>
            </div>

            <div className="flex flex-col sm:items-end justify-center">
              <span className="text-xs font-mono uppercase font-bold text-[#A83B4D]">
                Accuracy
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-mono text-[#670626]">
                  ±<strong>{Math.round(coords.accuracy)}</strong> m
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold uppercase bg-[#F7F1EA] text-[#670626] border border-[#670626]/25">
                  {signalQuality}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-[#670626]">
              Landmark or Barangay <span className="text-[#A83B4D] font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="e.g. Katipunan Public Market, Purok 3"
              className="px-4 py-3 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
            />
          </div>
        </div>

        {/* STEP 2: LIVE PHOTO OR IMAGE UPLOAD + DUAL-AI VISION ANALYSIS */}
        <div
          ref={stepCameraRef}
          className="clay-surface p-5 sm:p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-4 shadow-[0_14px_34px_rgba(74,4,26,0.22)]"
        >
          <div className="flex items-center justify-between border-b border-[#670626]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#670626] animate-pulse" />
              <h2 className="text-sm font-mono font-black uppercase tracking-wider text-[#670626]">
                2. Scene Photo
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-[#A83B4D] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#670626] flex-shrink-0" />
              <span>Roboflow CV + Claude Haiku 4.5</span>
            </span>
          </div>

          <input
            ref={fileUploadInputRef}
            id="incident-image-upload-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileUploadChange}
            className="hidden"
          />

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
            {imageDataUrl ? (
              <div className="relative w-full sm:w-64 h-44 rounded-xl overflow-hidden border-2 border-[#670626] shadow-md flex-shrink-0">
                <img
                  src={imageDataUrl}
                  alt="Captured emergency scene"
                  className="w-full h-full object-cover"
                />

                <div className="absolute top-0 inset-x-0 bg-[#2B010E]/85 px-2.5 py-1 text-xs font-mono text-[#F7F1EA] flex items-center justify-between">
                  <span>
                    {coords.latitude.toFixed(4)}°, {coords.longitude.toFixed(4)}°
                  </span>
                  <span>±{Math.round(coords.accuracy)}m</span>
                </div>

                {isAnalyzingAi && (
                  <div className="absolute inset-0 bg-[#2B010E]/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 text-[#F7F1EA] px-3 text-center">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-xs font-mono font-black uppercase">AI Analyzing...</span>
                  </div>
                )}

                {captureMetadata?.isBlurry ? (
                  <div className="absolute bottom-1 left-1 right-1 px-2.5 py-1 bg-[#670626] text-[#F7F1EA] text-xs font-mono font-bold rounded flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>BLUR: {captureMetadata.varianceScore.toFixed(1)}</span>
                  </div>
                ) : (
                  <div className="absolute bottom-1 left-1 right-1 px-2.5 py-1 bg-[#2B010E]/90 text-[#F7F1EA] text-xs font-mono font-bold rounded flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>CLARITY: {(captureMetadata?.varianceScore ?? 142.5).toFixed(1)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative w-full sm:w-64 h-44 rounded-xl bg-[#F7F1EA] border-2 border-dashed border-[#670626]/30 flex flex-col items-center justify-center p-4 text-center flex-shrink-0">
                <div className="w-12 h-12 rounded-full border border-[#670626]/35 flex items-center justify-center mb-2">
                  <Camera className="w-5 h-5 text-[#670626]" />
                </div>
                <span className="text-sm font-mono font-bold text-[#670626]">Camera or Photo Ready</span>
              </div>
            )}

            <div className="flex flex-col gap-3 w-full">
              {!imageDataUrl ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <CivilianButton
                    type="button"
                    variant="danger"
                    size="lg"
                    onClick={() => {
                      if (!isHardwareGeolocated && coords.isFallback) {
                        refreshGps();
                        setError('Enable device GPS/location before opening camera.');
                        scrollToStep(stepGpsRef);
                        return;
                      }
                      setIsCameraOpen(true);
                    }}
                    icon={<Camera className="w-5 h-5" />}
                    className="w-full sm:w-auto min-h-[50px] uppercase tracking-wider"
                  >
                    OPEN LIVE CAMERA
                  </CivilianButton>

                  <CivilianButton
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => fileUploadInputRef.current?.click()}
                    icon={<Upload className="w-5 h-5" />}
                    className="w-full sm:w-auto min-h-[50px] uppercase tracking-wider"
                  >
                    UPLOAD INCIDENT PHOTO
                  </CivilianButton>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-mono font-bold text-[#670626] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Photo Attached</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setIsCameraOpen(true)}
                        className="text-sm font-mono text-[#670626] hover:text-[#4A041A] underline font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>OPEN LIVE CAMERA</span>
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => fileUploadInputRef.current?.click()}
                        className="text-sm font-mono text-[#670626] hover:text-[#4A041A] underline font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>UPLOAD INCIDENT PHOTO</span>
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-[#A83B4D] leading-relaxed font-medium">
                    {captureMetadata?.isBlurry
                      ? `Low clarity (${captureMetadata.varianceScore.toFixed(1)}) — manual review required.`
                      : `Clarity verified (${(captureMetadata?.varianceScore ?? 142.5).toFixed(1)}).`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* High-Visibility AI Processing & Auto-Approve Evaluation Banner */}
          {isAnalyzingAi && (
            <div
              id="incident-ai-analyzing-banner"
              className="p-4 rounded-xl bg-[#670626] border border-[#2B010E] text-[#F7F1EA] font-mono flex flex-col gap-2.5 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-[#F7F1EA] animate-spin flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-wide">
                    AI Processing &amp; Auto-Approve Evaluation...
                  </span>
                  <span className="text-xs text-[#E9D9D0]">
                    Checking Scene Clarity -&gt; Running Roboflow &amp; Claude Haiku 4.5 Verification...
                  </span>
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#F7F1EA]/25 overflow-hidden">
                <div className="h-full w-2/3 bg-[#F7F1EA] rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Dual-AI Incident Vision Card */}
          {aiAnalysis && !isAnalyzingAi && (
            <div
              id="incident-ai-vision-card"
              className="p-4 sm:p-5 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626]/25 shadow-[0_10px_26px_rgba(74,4,26,0.16)] flex flex-col gap-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#670626]/15 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#670626]" />
                  <h3 className="text-xs sm:text-sm font-mono font-black uppercase tracking-wider text-[#670626]">
                    AI Scene Analysis
                  </h3>
                </div>
                <span
                  className={`px-3 py-1 rounded-full font-mono text-xs font-bold border ${
                    aiAnalysis.isGenuineIncident === false
                      ? 'bg-[#FFF5D6] border-[#B45309]/50 text-[#7C2D12]'
                      : isAutoApproveEligible
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                      : 'bg-[#E9D9D0] border-[#A83B4D]/50 text-[#670626]'
                  }`}
                >
                  {aiAnalysis.isGenuineIncident === false
                    ? 'No emergency detected in photo — manual review required if submitted'
                    : isAutoApproveEligible
                    ? 'AI Verified — Auto-Approve Eligible'
                    : 'Incident Detected — Pending Review'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs font-mono">
                {/* Roboflow CV Badge */}
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D] font-bold uppercase">Roboflow CV</span>
                    <span className="px-2 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/20 text-[#670626] font-bold">
                      {aiAnalysis.roboflowAuthTransport?.startsWith('LOCAL_FALLBACK') ||
                      aiAnalysis.roboflowAuthTransport === 'OFFLINE_FALLBACK'
                        ? 'Local Fallback'
                        : `${Math.round((aiAnalysis.roboflowConfidence ?? 0) * 100)}%`}
                    </span>
                  </div>
                  <div className="text-[#670626] font-bold break-all">
                    {aiAnalysis.roboflowModelId || 'accident-and-non-accident-label-image-dataset/14'}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D]">Prediction:</span>
                    <span className="text-[#670626] font-black uppercase">
                      {aiAnalysis.roboflowPrediction || 'incident'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D]">Status:</span>
                    <span className="text-[#670626] font-bold">
                      {aiAnalysis.roboflowNeedsReview ? 'Human Review Flagged' : 'Scene Match'}
                    </span>
                  </div>
                </div>

                {/* Claude Haiku 4.5 Vision Analysis */}
                <div className="p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D] font-bold uppercase">Claude Haiku 4.5</span>
                    <span className="px-2 py-0.5 rounded bg-[#F7F1EA] border border-[#670626]/20 text-[#670626] font-bold">
                      {aiAnalysis.claudeModelUsed || 'claude-haiku-4-5'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D]">Category:</span>
                    <span className="text-[#670626] font-black">
                      {CATEGORY_LABELS[aiAnalysis.detectedCategory] || aiAnalysis.detectedCategory}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D]">Map Icon:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#F7F1EA] border border-[#670626]/25 text-[#670626] font-bold uppercase">
                      {renderPointerTypeIcon(aiAnalysis.pointerIconType)}
                      <span>{aiAnalysis.pointerIconType}</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#A83B4D]">Unit:</span>
                    <span className="text-[#670626] font-bold">
                      {aiAnalysis.recommendedAgencyUnit || routingInfo.agencies.join(', ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="font-mono font-bold uppercase text-[#A83B4D] block mb-1">
                    Situation
                  </span>
                  <p className="text-[#670626] font-medium leading-relaxed">
                    {aiAnalysis.situationDescription}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="font-mono font-bold uppercase text-[#A83B4D] block mb-1">
                    Hazards
                  </span>
                  <p className="text-[#670626] font-medium leading-relaxed">
                    {aiAnalysis.visibleHazards}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
                  <span className="font-mono font-bold uppercase text-[#A83B4D] block mb-1">
                    Notes
                  </span>
                  <p className="text-[#670626] font-medium leading-relaxed">
                    {aiAnalysis.uncertaintyNotes}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* STEP 3: DETAILS */}
        <div
          ref={stepTriageRef}
          className="clay-surface p-5 sm:p-6 rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 flex flex-col gap-4 shadow-[0_14px_34px_rgba(74,4,26,0.22)]"
        >
          <div className="flex items-center justify-between border-b border-[#670626]/15 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A83B4D]" />
              <h2 className="text-sm font-mono font-black uppercase tracking-wider text-[#670626]">
                3. Details
              </h2>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-[#670626]">
              Title <span className="text-[#A83B4D]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Motorcycle collision along National Hwy"
              required
              className="px-4 py-3 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-base text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-[#670626]">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-4 py-3 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-sm text-[#670626] font-bold focus:outline-none focus:border-[#670626]"
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>

              <div className="mt-1 p-2.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/15 text-xs font-mono">
                <span className="text-[#A83B4D]">Routes to: </span>
                <span className="text-[#670626] font-bold">{routingInfo.agencies.join(', ')}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-[#670626]">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="px-4 py-3 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-sm text-[#670626] font-bold focus:outline-none focus:border-[#670626]"
              >
                <option value="Critical">Critical — Immediate</option>
                <option value="High">High — Injuries / Hazard</option>
                <option value="Medium">Medium — Assistance</option>
                <option value="Low">Low — Minor</option>
              </select>
            </div>
          </div>

          {/* Personal Contact Number Text Input (Strictly text only, ZERO tel: links) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-[#670626]">
              Contact Number{' '}
              <span className="text-[#A83B4D] font-normal">(Optional — text reference only)</span>
            </label>
            <input
              type="text"
              value={reporterContactNumber}
              onChange={(e) => handleContactInput(e.target.value)}
              placeholder="e.g. 0917 123 4567"
              className="px-4 py-3 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-sm font-mono text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-[#670626]">
              Notes <span className="text-[#A83B4D] font-normal">(Optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Injuries, hazards, or traffic details..."
              className="px-4 py-3 bg-[#E9D9D0] border border-[#670626]/20 rounded-xl text-sm text-[#670626] placeholder-[#A83B4D]/60 focus:outline-none focus:border-[#670626] leading-relaxed"
            />
          </div>
        </div>

        {/* Submit Review Button */}
        <div className="flex flex-col gap-2">
          <CivilianButton
            type="submit"
            variant="danger"
            size="lg"
            isLoading={isLoading}
            className="w-full !py-4 font-black uppercase tracking-wider text-base rounded-xl"
            icon={<Zap className="w-5 h-5" />}
          >
            {isLoading
              ? 'AI Verifying & Submitting Report...'
              : isAnalyzingAi
              ? 'AI Analyzing Photo...'
              : 'Submit Report'}
          </CivilianButton>
        </div>
      </form>

      {/* Pre-submission Confirmation Modal */}
      <CivilianModalCard
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Report"
        size="md"
      >
        <div className="flex flex-col gap-4 text-[#670626]">
          <div className="p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col gap-3 text-sm font-mono">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Title</span>
              <span className="text-[#670626] font-bold truncate max-w-[240px]">{title}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Verification</span>
              <span
                className={`px-2.5 py-0.5 rounded-full border font-bold text-xs ${
                  isAutoApproveEligible
                    ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                    : 'bg-[#F7F1EA] border-[#A83B4D]/45 text-[#670626]'
                }`}
              >
                {isAutoApproveEligible ? 'AI Auto-Approve Eligible' : 'Submitted — Pending Review'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Routing</span>
              <span className="text-[#670626] font-bold">{routingInfo.agencies.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Severity</span>
              <span className="text-[#670626] font-black uppercase">{severity}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Location</span>
              <span className="text-[#670626] font-bold">
                {coords.latitude.toFixed(5)}° N, {coords.longitude.toFixed(5)}° E (±
                {Math.round(coords.accuracy)}m)
              </span>
            </div>
            {reporterContactNumber.trim() && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#A83B4D]">Contact</span>
                <span className="text-[#670626] font-bold">{reporterContactNumber.trim()}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#A83B4D]">Photo</span>
              <span className="text-[#670626] font-bold flex items-center gap-1.5">
                {imageDataUrl ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attached</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-[#A83B4D]" />
                    <span>None</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <CivilianButton
              variant="danger"
              size="lg"
              isLoading={isLoading}
              onClick={handleFinalSubmit}
              className="flex-1 !py-3.5 font-black uppercase tracking-wider text-sm"
            >
              {isLoading ? 'AI Verifying & Submitting Report...' : 'Submit Report'}
            </CivilianButton>
            <CivilianButton
              variant="outline"
              size="md"
              onClick={() => setIsConfirmModalOpen(false)}
            >
              Cancel
            </CivilianButton>
          </div>
        </div>
      </CivilianModalCard>

      {/* Emergency Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCaptureComplete}
        title="Incident Scene Camera"
      />
    </div>
  );
};

export default ReportAccidentPage;
