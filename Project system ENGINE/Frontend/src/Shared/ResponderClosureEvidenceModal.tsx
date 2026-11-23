// [Layer: Shared]
// ResponderClosureEvidenceModal.tsx -- Responder scene evidence upload, colleague tagging, and AI/Admin closure modal.
// Universal arrow lambdas (=>). ZERO 'any', ZERO emojis.

import React, { FC, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  FileCheck2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Upload,
  X
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { ColleagueMentionPicker } from './ColleagueMentionPicker';
import {
  ClosureEvidenceSubmissionResult,
  ReportItem,
  submitClosureEvidence
} from '@/Endpoints/reportsApi';
import { ColleagueResponderItem } from '@/Endpoints/responderOpsApi';

export interface ResponderClosureEvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: ReportItem | null;
  responderUnit?: string;
  onSubmitted?: (result: ClosureEvidenceSubmissionResult) => void;
}

type RequestedOutcomeOption = 'Auto' | 'InProgress' | 'Resolved';

const MAX_IMAGE_WIDTH = 1280;
const JPEG_QUALITY = 0.82;

const compressImageFileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read evidence photo file.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('Empty image data.'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        const scale = img.width > MAX_IMAGE_WIDTH ? MAX_IMAGE_WIDTH / img.width : 1;
        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });

export const ResponderClosureEvidenceModal: FC<ResponderClosureEvidenceModalProps> = ({
  isOpen,
  onClose,
  incident,
  responderUnit,
  onSubmitted
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [requestedOutcome, setRequestedOutcome] = useState<RequestedOutcomeOption>('Auto');
  const [notes, setNotes] = useState<string>('');
  const [selectedColleagues, setSelectedColleagues] = useState<ColleagueResponderItem[]>([]);
  const [triggerAiAutoApprove, setTriggerAiAutoApprove] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<ClosureEvidenceSubmissionResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setImageDataUrl('');
    setRequestedOutcome('Auto');
    setNotes('');
    setSelectedColleagues([]);
    setTriggerAiAutoApprove(true);
    setErrorMessage(null);
    setSubmissionResult(null);
  }, [isOpen, incident?.id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage(null);
    setIsCompressing(true);
    try {
      const compressed = await compressImageFileToDataUrl(file);
      setImageDataUrl(compressed);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!incident) return;
    if (!imageDataUrl) {
      setErrorMessage('Please upload or capture scene evidence photo before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await submitClosureEvidence(incident.id, {
        imageDataUrl,
        notes: notes.trim() || undefined,
        requestedOutcome,
        taggedColleagueIds: selectedColleagues.map((c) => c.id),
        triggerAiAutoApprove
      });

      setSubmissionResult(result);
      onSubmitted?.(result);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to submit duty closure evidence.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const unitScope =
    responderUnit || incident?.allocatedUnitCode || incident?.recommendedAgencyUnit || undefined;

  const outcomeOptions: Array<{
    value: RequestedOutcomeOption;
    title: string;
    subtitle: string;
  }> = [
    {
      value: 'Auto',
      title: 'Auto (Let AI Decide)',
      subtitle: 'AI classifies Done vs Working Progress'
    },
    {
      value: 'InProgress',
      title: 'Working Progress',
      subtitle: 'Ongoing treatment, suppression, or investigation'
    },
    {
      value: 'Resolved',
      title: 'Case Done / Resolved',
      subtitle: 'Scene cleared, stabilized, or resolved'
    }
  ];

  const getVerdictBannerStyle = (res: ClosureEvidenceSubmissionResult) => {
    const normVerdict = (res.verdict || res.reportStatus || '').toLowerCase();
    if (normVerdict.includes('resolved') || normVerdict.includes('done') || normVerdict.includes('closed')) {
      return {
        container: 'bg-emerald-50 border-emerald-400 text-emerald-950',
        badge: 'bg-emerald-600 text-white',
        label: 'MARK AS DONE'
      };
    }
    if (normVerdict.includes('progress') || normVerdict.includes('working')) {
      return {
        container: 'bg-sky-50 border-sky-400 text-sky-950',
        badge: 'bg-sky-600 text-white',
        label: 'WORKING PROGRESS'
      };
    }
    return {
      container: 'bg-amber-50 border-amber-400 text-amber-950',
      badge: 'bg-amber-600 text-white',
      label: 'AWAITING ADMIN MANUAL APPROVE'
    };
  };

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Duty Evidence & Case Outcome"
      subtitle={
        incident
          ? `${incident.referenceCode || incident.id} · ${incident.title}`
          : 'Scene Evidence & Closure Review'
      }
      size="2xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            icon={<X className="w-4 h-4" />}
          >
            {submissionResult ? 'Close' : 'Cancel'}
          </Button>
          {!submissionResult && (
            <Button
              type="submit"
              form="responder-closure-evidence-form"
              variant="action-green"
              size="sm"
              isLoading={isSubmitting}
              disabled={!incident || !imageDataUrl || isCompressing}
              icon={<FileCheck2 className="w-4 h-4" />}
            >
              Submit Evidence
            </Button>
          )}
        </div>
      }
    >
      <form id="responder-closure-evidence-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Live AI Verdict Banner */}
        {submissionResult && (() => {
          const banner = getVerdictBannerStyle(submissionResult);
          return (
            <div className={`p-4 rounded-xl border-2 space-y-2 ${banner.container}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-extrabold uppercase tracking-wider">
                    {submissionResult.verdict || submissionResult.reportStatus}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${banner.badge}`}>
                  {banner.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded bg-white/75 border border-black/10 font-bold">
                  Approval Mode: {submissionResult.approvalMode}
                </span>
                {submissionResult.modelUsed && (
                  <span className="px-2 py-0.5 rounded bg-white/75 border border-black/10">
                    Model: {submissionResult.modelUsed}
                  </span>
                )}
              </div>

              {submissionResult.aiReasoning && (
                <p className="text-xs leading-relaxed font-medium">
                  {submissionResult.aiReasoning}
                </p>
              )}
            </div>
          );
        })()}

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-mono font-bold text-[#991B1B] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Photo Evidence Uploader */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#670626]">
              <Camera className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>Scene Action / Resolution Photo Evidence</span>
            </label>
            {imageDataUrl && !submissionResult && (
              <button
                type="button"
                onClick={() => {
                  setImageDataUrl('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-xs font-mono font-bold text-[#991B1B] hover:underline cursor-pointer"
              >
                Clear Photo
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {imageDataUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-[#D4B8AA] bg-[#3B1722]">
              <img
                src={imageDataUrl}
                alt="Responder scene closure evidence"
                className="w-full max-h-56 object-cover"
              />
              {!submissionResult && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-[#670626]/90 hover:bg-[#670626] text-[#F7F1EA] text-xs font-mono font-bold flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Replace Photo</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isCompressing || Boolean(submissionResult)}
              className="w-full p-6 rounded-xl border-2 border-dashed border-[#D4B8AA] bg-[#FFFBF7] hover:bg-[#EFE5DC]/60 hover:border-[#670626] transition-all flex flex-col items-center justify-center gap-2 text-center cursor-pointer"
            >
              {isCompressing ? (
                <>
                  <Loader2 className="w-7 h-7 text-[#670626] animate-spin" />
                  <span className="text-xs font-mono font-bold text-[#670626]">
                    Compressing evidence photo...
                  </span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-[#E9D9D0] flex items-center justify-center text-[#670626]">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-[#670626]">
                    Capture or Upload Field Evidence Photo
                  </div>
                  <p className="text-[11px] font-mono text-[#7A4E59] max-w-md">
                    Photo of scene on investigation, injured victim treated, suspect apprehended, or fire contained.
                  </p>
                </>
              )}
            </button>
          )}
        </div>

        {/* Requested Outcome Toggle */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#670626]">
            <Clock className="w-3.5 h-3.5 text-[#A83B4D]" />
            <span>Requested Case Outcome</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {outcomeOptions.map((opt) => {
              const isSelected = requestedOutcome === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={Boolean(submissionResult)}
                  onClick={() => setRequestedOutcome(opt.value)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer disabled:opacity-60 ${
                    isSelected
                      ? 'bg-[#670626] border-[#670626] text-[#F7F1EA] shadow-sm'
                      : 'bg-[#FFFBF7] border-[#D8C1B5] text-[#3B1722] hover:border-[#A83B4D]'
                  }`}
                >
                  <div className="text-xs font-extrabold">{opt.title}</div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      isSelected ? 'text-[#F7F1EA]/85' : 'text-[#7A4E59]'
                    }`}
                  >
                    {opt.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Responder Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-extrabold uppercase tracking-wider text-[#670626]">
            Field Notes &amp; Actions Taken
          </label>
          <textarea
            rows={3}
            value={notes}
            disabled={Boolean(submissionResult)}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe victim treatment, containment status, suspect custody, or ongoing scene work..."
            className="w-full px-3 py-2 bg-[#FFFBF7] border border-[#D8C1B5] rounded-xl text-xs font-mono text-[#3B1722] placeholder-[#9B727D] focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#A83B4D]/25 disabled:opacity-60"
          />
        </div>

        {/* Embedded Same-Unit Colleague Picker */}
        <ColleagueMentionPicker
          unitLabel={unitScope}
          selectedColleagues={selectedColleagues}
          onChange={setSelectedColleagues}
          disabled={Boolean(submissionResult)}
        />

        {/* Trigger AI Evaluation Toggle */}
        <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#E9D9D0]/55 border border-[#D8C1B5] cursor-pointer">
          <input
            type="checkbox"
            checked={triggerAiAutoApprove}
            disabled={Boolean(submissionResult)}
            onChange={(e) => setTriggerAiAutoApprove(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#670626] text-[#670626] focus:ring-[#A83B4D]"
          />
          <div className="text-xs">
            <div className="font-extrabold text-[#670626] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#A83B4D]" />
              <span>Run AI Closure Verification &amp; Auto-Approve</span>
            </div>
            <p className="text-[11px] font-mono text-[#7A4E59] mt-0.5">
              When enabled, AI inspects the photo evidence and notes to auto-approve Done or Working Progress; otherwise routes to Admin Manual Approve.
            </p>
          </div>
        </label>
      </form>
    </DefaultFloatingModalCard>
  );
};

export default ResponderClosureEvidenceModal;
