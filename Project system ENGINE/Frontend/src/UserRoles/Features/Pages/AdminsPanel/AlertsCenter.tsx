// [Layer: UserRoles/Features/Pages/AdminsPanel]
// AlertsCenter.tsx -- Emergency Broadcasts Command Center.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Instructor #6: Clarifies clearly that Broadcast Warnings represent LDRRMO Official Emergency Advisories
// & Safety Notifications delivered via the system Notification Bell.
// Preserves E2E contracts: h1:has-text("Emergency Broadcasts"), div.tactical-card:has-text("Dispatched Units"), CATEGORY_SHORT_LABELS.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, FC, useMemo, useCallback, ChangeEvent, FormEvent } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Radio,
  ExternalLink,
  Users,
  Shield,
  Check,
  Megaphone,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { getAlerts, markAlertRead, sendEmergencyBroadcast, AlertItem } from '@/Endpoints/reportsApi';
import {
  SearchBar,
  Dropdown,
  TableCardToggle,
  ViewMode,
  ImageLightboxModal
} from '@/Shared';
import { usePagination, useTableDraggable, useDebounce, useValueRefreshAuto } from '@/Hooks';
import { AdminButton } from './Shared/AdminButton';
import { AdminModalCard } from './Shared/AdminModalCard';
import { CLAY_SURFACE, CLAY_WELL, CLAY_INPUT } from './Shared/adminCommandHelpers';

const SEARCH_DEBOUNCE_MS = 250;
const TOAST_DURATION_MS = 3500;
const AUTO_REFRESH_INTERVAL_MS = 6000;
const DEFAULT_PAGE_SIZE = 8;
const MAX_IMAGE_FILE_BYTES = 3 * 1024 * 1024;
const MAX_VIDEO_FILE_BYTES = 1024 * 1024 * 1024;
const BYTES_IN_MB = 1024 * 1024;
const EMPTY_COUNT = 0;
const MIN_ROUNDTRIP_MS = 1;
const PERCENTAGE_MAX = 100;
const DECIMAL_PLACES_ONE = 1;
const DECIMAL_PLACES_TWO = 2;
const FIRST_PAGE_INDEX = 1;

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read attached image file.'));
    reader.readAsDataURL(file);
  });

export interface ExtendedAlertItem extends AlertItem {
  message?: string;
  externalLink?: string;
}

export const AlertsCenter: FC = () => {
  const [alerts, setAlerts] = useState<ExtendedAlertItem[]>([]);
  const [searchRaw, setSearchRaw] = useState<string>('');
  const debouncedSearch = useDebounce(searchRaw, SEARCH_DEBOUNCE_MS);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<string>('desc_date');

  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState<boolean>(false);

  const [broadcastTitle, setBroadcastTitle] = useState<string>('');
  const [broadcastMessage, setBroadcastMessage] = useState<string>('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<string>('Severe');
  const [broadcastImage, setBroadcastImage] = useState<File | null>(null);
  const [broadcastVideo, setBroadcastVideo] = useState<File | null>(null);
  const [broadcastExternalLink, setBroadcastExternalLink] = useState<string>('');
  const [formError, setFormError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [telemetryLatencyMs, setTelemetryLatencyMs] = useState<number>(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), TOAST_DURATION_MS);
  }, []);

  const loadAlerts = useCallback(async () => {
    const startTime = performance.now();
    try {
      const data = await getAlerts();
      const elapsed = Math.max(MIN_ROUNDTRIP_MS, Math.round(performance.now() - startTime));
      setTelemetryLatencyMs(elapsed);
      setAlerts(Array.isArray(data) ? (data as ExtendedAlertItem[]) : []);
    } catch (err: unknown) {
      console.error('[AlertsCenter] Telemetry sync error:', err);
      setAlerts([]);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  const { isRefreshing } = useValueRefreshAuto(loadAlerts, { intervalMs: AUTO_REFRESH_INTERVAL_MS });
  const { containerRef } = useTableDraggable<HTMLDivElement>();

  const handleMarkRead = async (reportId: string) => {
    try {
      await markAlertRead(reportId);
      setAlerts((prev) =>
        prev.map((a) => (a.reportId === reportId ? { ...a, isRead: true } : a))
      );
      showToast('Emergency advisory acknowledged and synchronized across Notification Bell.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to acknowledge advisory.';
      showToast(msg);
    }
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      setFormError('Image exceeds limit of 3MB.');
      return;
    }
    setFormError('');
    setBroadcastImage(file);
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_VIDEO_FILE_BYTES) {
      setFormError('Video exceeds maximum limit of 1GB.');
      return;
    }
    setFormError('');
    setBroadcastVideo(file);
  };

  const handleSendBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setFormError('Title and message are required.');
      return;
    }

    try {
      const imageDataUrl = broadcastImage ? await readFileAsDataUrl(broadcastImage) : undefined;
      const payload = {
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        severity: broadcastSeverity,
        externalLink: broadcastExternalLink.trim(),
        hasImage: !!broadcastImage,
        hasVideo: !!broadcastVideo,
        ...(imageDataUrl ? { imageDataUrl } : {})
      };
      await sendEmergencyBroadcast(payload);

      showToast(`Official Advisory "${broadcastTitle}" delivered via the system Notification Bell.`);
      setIsBroadcastModalOpen(false);
      setBroadcastTitle('');
      setBroadcastMessage('');
      setBroadcastImage(null);
      setBroadcastVideo(null);
      setBroadcastExternalLink('');
      setFormError('');
      await loadAlerts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch emergency broadcast.';
      setFormError(msg);
    }
  };

  const filteredAlerts = useMemo(() => {
    return alerts
      .filter((a) => {
        if (severityFilter !== 'ALL' && (a.severity || '').toLowerCase() !== severityFilter.toLowerCase()) {
          return false;
        }
        if (!debouncedSearch) return true;
        const target = `${a.title || ''} ${a.referenceCode || ''} ${a.message || ''} ${a.category || ''}`.toLowerCase();
        return target.includes(debouncedSearch.toLowerCase());
      })
      .sort((a, b) => {
        if (sortOrder === 'asc_date') {
          return new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime();
        }
        if (sortOrder === 'asc_name') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (sortOrder === 'desc_name') {
          return (b.title || '').localeCompare(a.title || '');
        }
        return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
      });
  }, [alerts, severityFilter, debouncedSearch, sortOrder]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions
  } = usePagination(filteredAlerts, { initialPageSize: DEFAULT_PAGE_SIZE });

  const activeAlertsCount = useMemo(
    () => alerts.filter((a) => !a.isRead).length,
    [alerts]
  );

  const severeCount = useMemo(
    () => alerts.filter((a) => a.severity === 'Severe' || a.severity === 'Critical').length,
    [alerts]
  );

  const citizenReachRate = useMemo(() => {
    if (alerts.length === EMPTY_COUNT) return '0.0%';
    const readCount = alerts.filter((a) => a.isRead).length;
    const rate = ((readCount / alerts.length) * PERCENTAGE_MAX).toFixed(DECIMAL_PLACES_ONE);
    return `${rate}%`;
  }, [alerts]);

  const deliveryLatency = useMemo(
    () => (telemetryLatencyMs > EMPTY_COUNT ? `${telemetryLatencyMs}ms Push` : '0ms Push'),
    [telemetryLatencyMs]
  );

  const CATEGORY_SHORT_LABELS: Record<string, string> = {
    VehicularAccident: 'Traffic',
    CrimeOrSecurity: 'Security',
    StructuralFire: 'Fire',
    MedicalEmergency: 'Medical',
    FloodOrLandslide: 'Flood',
    NaturalDisaster: 'Disaster',
    OtherEmergency: 'Other'
  };

  const { dispatchedUnitsCount, dispatchedUnitsSummary } = useMemo(() => {
    const shortLabels = new Set<string>();
    alerts.forEach((a) => {
      if (a.category) {
        shortLabels.add(CATEGORY_SHORT_LABELS[a.category] || a.category);
      }
    });
    const count = shortLabels.size;
    const summary = Array.from(shortLabels).slice(0, 3).join(' · ') || 'No active advisories';
    return {
      dispatchedUnitsCount: `${count} ${count === 1 ? 'Unit' : 'Units'}`,
      dispatchedUnitsSummary: summary
    };
  }, [alerts]);

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] text-sm font-mono font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#670626]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar (.clay-surface #F7F1EA) */}
      <div className={`${CLAY_SURFACE} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A83B4D]">
            LDRRMO Advisories
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight mt-0.5 flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-[#A83B4D] animate-pulse" />
            Emergency Broadcasts
          </h1>
          <p className="text-sm text-[#A83B4D] font-mono mt-0.5">
            Official advisories via Notification Bell
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`${CLAY_WELL} flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono font-bold text-emerald-800`}>
            <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
            <span>{isRefreshing ? 'Updating…' : 'Bell Synced'}</span>
          </div>

          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => setIsBroadcastModalOpen(true)}
            icon={<Megaphone className="w-4 h-4" />}
          >
            + New Broadcast
          </AdminButton>
        </div>
      </div>

      {/* 5 KPI Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#670626] min-w-0 overflow-hidden`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold truncate">Active Alerts</p>
            <Bell className="w-4 h-4 text-[#670626] flex-shrink-0" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5 truncate">{activeAlertsCount} Live</h3>
          <span className="text-xs text-[#A83B4D] font-mono block truncate mt-0.5">Unread in Bell</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-amber-600 min-w-0 overflow-hidden`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold truncate">Severe Warnings</p>
            <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5 truncate">{severeCount} Critical</h3>
          <span className="text-xs text-[#A83B4D] font-mono block truncate mt-0.5">High priority</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-emerald-700 min-w-0 overflow-hidden`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold truncate">Citizen Reach</p>
            <Users className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5 truncate">{citizenReachRate}</h3>
          <span className="text-xs text-emerald-800 font-mono font-bold block truncate mt-0.5">Acknowledged</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-sky-700 min-w-0 overflow-hidden`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold truncate">Delivery Latency</p>
            <Clock className="w-4 h-4 text-sky-700 flex-shrink-0" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5 truncate">{deliveryLatency}</h3>
          <span className="text-xs text-[#A83B4D] font-mono block truncate mt-0.5">Push roundtrip</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#A83B4D] min-w-0 overflow-hidden`}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold truncate">Dispatched Units</p>
            <Shield className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5 truncate" title={`${dispatchedUnitsCount} · ${dispatchedUnitsSummary}`}>
            {dispatchedUnitsCount}
          </h3>
          <span className="text-xs text-[#A83B4D] font-mono block truncate mt-0.5" title={dispatchedUnitsSummary}>
            {dispatchedUnitsSummary}
          </span>
        </div>
      </div>

      {/* Control Bar */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-wrap items-center justify-between gap-4`}>
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="Search advisories, reference code, broadcast title…"
          />
        </div>

        <div className="flex items-center gap-2">
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Dropdown
            value={severityFilter}
            onChange={(val) => setSeverityFilter(val as string)}
            options={[
              { value: 'ALL', label: 'All Severities' },
              { value: 'Critical', label: 'Critical' },
              { value: 'Severe', label: 'Severe' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Low', label: 'Low' }
            ]}
            className="min-w-[140px]"
          />

          <Dropdown
            value={sortOrder}
            onChange={(val) => setSortOrder(val as string)}
            options={[
              { value: 'desc_date', label: 'Newest First' },
              { value: 'asc_date', label: 'Oldest First' },
              { value: 'asc_name', label: 'Title (A-Z)' },
              { value: 'desc_name', label: 'Title (Z-A)' }
            ]}
            className="min-w-[140px]"
          />
        </div>
      </div>

      {/* Main Alert List */}
      {viewMode === 'table' ? (
        <div className={`${CLAY_SURFACE} p-4 overflow-hidden`}>
          <div ref={containerRef} className={`${CLAY_WELL} overflow-x-auto w-full select-none cursor-grab`}>
            <table className="w-full text-left text-sm text-[#670626] min-w-[900px]">
              <thead className="bg-[#670626]/10 font-mono text-xs uppercase tracking-wider text-[#670626] border-b border-[#670626]/15">
                <tr>
                  <th className="py-3.5 px-4">Media</th>
                  <th className="py-3.5 px-4">Ref Code & Advisory Title</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Resource Link</th>
                  <th className="py-3.5 px-4">Bell Delivery Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10">
                {paginatedItems.map((a, i) => (
                  <tr key={a.reportId || i} className="hover:bg-[#F7F1EA]/70 transition-colors">
                    <td className="py-3.5 px-4 w-20">
                      <div className="w-14 h-11 rounded-lg bg-[#F7F1EA] border border-[#670626]/20 overflow-hidden relative flex items-center justify-center">
                        {a.imageUrl ? (
                          <img
                            src={a.imageUrl}
                            alt="Alert media"
                            onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                            className="w-full h-full object-cover cursor-pointer"
                          />
                        ) : (
                          <ShieldAlert className="w-5 h-5 text-[#A83B4D]" />
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs text-[#A83B4D] font-bold block">
                        {a.referenceCode || `ALT-${i + 1}`}
                      </span>
                      <span className="font-bold text-[#670626] text-sm truncate max-w-[240px] block mt-0.5">
                        {a.title || 'Emergency Advisory'}
                      </span>
                      <span className="text-xs text-[#670626]/80 truncate max-w-[260px] block mt-0.5">
                        {a.message || 'Official LDRRMO safety notification issued.'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase ${
                          a.severity === 'Critical' || a.severity === 'Severe'
                            ? 'bg-[#670626] text-[#F7F1EA]'
                            : a.severity === 'High'
                            ? 'bg-[#A83B4D] text-[#F7F1EA]'
                            : 'bg-[#F7F1EA] text-[#670626] border border-[#670626]/20'
                        }`}
                      >
                        {a.severity || 'Severe'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[#A83B4D] text-xs">
                      {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'Live Ingestion'}
                    </td>

                    <td className="py-3.5 px-4">
                      {a.externalLink ? (
                        <a
                          href={a.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F7F1EA] text-[#670626] border border-[#670626]/20 hover:bg-[#670626] hover:text-[#F7F1EA] transition-colors text-xs font-mono font-bold"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>LINK</span>
                        </a>
                      ) : (
                        <span className="text-[#A83B4D] font-mono text-xs">Notification Bell</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-[#670626]">
                        {a.isRead ? 'Acknowledged' : 'Active in Notification Bell'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {!a.isRead ? (
                        <AdminButton
                          variant="outline"
                          size="sm"
                          onClick={() => void handleMarkRead(a.reportId)}
                          icon={<Check className="w-3.5 h-3.5 text-emerald-700" />}
                        >
                          ACKNOWLEDGE
                        </AdminButton>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4" />
                          DELIVERED
                        </span>
                      )}
                    </td>
                  </tr>
                ))}

                {paginatedItems.length === EMPTY_COUNT && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-sm text-[#A83B4D] font-mono">
                      No matching advisories.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((a, i) => (
            <div
              key={a.reportId || i}
              className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between gap-3.5 ${
                !a.isRead ? 'border-l-4 border-l-[#670626]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-bold text-[#A83B4D]">
                    {a.referenceCode || `ALT-${i + 1}`}
                  </span>
                  <h3 className="font-bold text-[#670626] text-base mt-0.5">{a.title || 'Advisory'}</h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold uppercase bg-[#670626] text-[#F7F1EA]">
                  {a.severity || 'Severe'}
                </span>
              </div>

              <p className="text-sm text-[#670626]/85 line-clamp-3 leading-relaxed">
                {a.message || 'Official LDRRMO safety notification issued.'}
              </p>

              {a.imageUrl && (
                <div className="w-full h-32 rounded-xl overflow-hidden border border-[#670626]/20">
                  <img
                    src={a.imageUrl}
                    alt="Alert"
                    onClick={() => setLightboxImageUrl(a.imageUrl || null)}
                    className="w-full h-full object-cover cursor-pointer"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-[#670626]/15 flex items-center justify-between">
                <span className="text-xs font-mono text-[#A83B4D]">
                  {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'Live'}
                </span>
                {!a.isRead ? (
                  <AdminButton
                    variant="outline"
                    size="sm"
                    onClick={() => void handleMarkRead(a.reportId)}
                    icon={<Check className="w-3.5 h-3.5 text-emerald-700" />}
                  >
                    ACKNOWLEDGE
                  </AdminButton>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-emerald-800 font-mono text-xs font-bold">
                    <CheckCheck className="w-4 h-4" />
                    Acknowledged
                  </span>
                )}
              </div>
            </div>
          ))}
          {paginatedItems.length === EMPTY_COUNT && (
            <div className={`col-span-full ${CLAY_SURFACE} p-8 text-center text-sm text-[#A83B4D] font-mono`}>
              No matching advisories.
            </div>
          )}
        </div>
      )}

      {/* Pagination Footer */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-wrap items-center justify-between gap-3 text-sm font-mono text-[#670626]`}>
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-bold text-sm rounded-lg px-2.5 py-1"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span>per page (Total: {totalItems} advisories)</span>
        </div>

        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentPage <= FIRST_PAGE_INDEX}
            className="px-3 py-1.5 text-xs"
            icon={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            PREV
          </AdminButton>
          <span className="px-2 font-black text-[#670626]">
            Page {currentPage} of {totalPages}
          </span>
          <AdminButton
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 text-xs"
          >
            NEXT <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
          </AdminButton>
        </div>
      </div>

      {/* Issue Official Emergency Advisory Modal */}
      {isBroadcastModalOpen && (
        <AdminModalCard
          isOpen={isBroadcastModalOpen}
          onClose={() => setIsBroadcastModalOpen(false)}
          title="New Emergency Advisory"
          subtitle="Sent via Notification Bell to all portals"
          className="max-w-2xl"
        >
          <form onSubmit={handleSendBroadcast} className="space-y-4">
            {formError && (
              <div className="p-3.5 rounded-xl bg-[#670626] text-[#F7F1EA] text-sm font-mono flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="font-mono text-xs text-[#670626] font-bold block mb-1.5 uppercase tracking-wider">
                Advisory Headline
              </label>
              <input
                type="text"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                placeholder="e.g., Flash Flood Advisory: Katipunan River Basin & Coastal Barangays"
                className={CLAY_INPUT}
              />
            </div>

            <div>
              <label className="font-mono text-xs text-[#670626] font-bold block mb-1.5 uppercase tracking-wider">
                Safety Notification Details
              </label>
              <textarea
                rows={3}
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Specify protective action directives and designated Katipunan evacuation safe zones…"
                className={CLAY_INPUT}
              />
            </div>

            <div>
              <label className="font-mono text-xs text-[#670626] font-bold block mb-1.5 uppercase tracking-wider">
                Alert Severity Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                {['Low', 'Medium', 'Severe', 'Critical'].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setBroadcastSeverity(sev)}
                    className={`py-2.5 rounded-xl font-mono text-sm font-bold transition-all border cursor-pointer ${
                      broadcastSeverity === sev
                        ? 'bg-[#670626] border-[#670626] text-[#F7F1EA] shadow-md'
                        : 'bg-[#E9D9D0] border-[#670626]/20 text-[#670626]'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className={`${CLAY_WELL} grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5`}>
              <div>
                <label className="font-mono text-xs text-[#670626] font-bold block mb-1.5">
                  Attach Photo (Max 3MB)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-xs text-[#670626] file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-mono file:bg-[#670626] file:text-[#F7F1EA]"
                />
                {broadcastImage && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-800 font-mono font-bold mt-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {broadcastImage.name} ({(broadcastImage.size / BYTES_IN_MB).toFixed(DECIMAL_PLACES_TWO)} MB)
                  </span>
                )}
              </div>

              <div>
                <label className="font-mono text-xs text-[#670626] font-bold block mb-1.5">
                  Attach Video (Max 1GB)
                </label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoChange}
                  className="w-full text-xs text-[#670626] file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-mono file:bg-[#670626] file:text-[#F7F1EA]"
                />
                {broadcastVideo && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-800 font-mono font-bold mt-1.5">
                    <Check className="w-3.5 h-3.5" />
                    {broadcastVideo.name} ({(broadcastVideo.size / BYTES_IN_MB).toFixed(DECIMAL_PLACES_ONE)} MB)
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-[#670626] font-bold block mb-1.5 uppercase tracking-wider">
                External Resource Link (Optional)
              </label>
              <input
                type="url"
                value={broadcastExternalLink}
                onChange={(e) => setBroadcastExternalLink(e.target.value)}
                placeholder="https://..."
                className={CLAY_INPUT}
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#670626]/15">
              <AdminButton variant="outline" size="sm" type="button" onClick={() => setIsBroadcastModalOpen(false)}>
                CANCEL
              </AdminButton>
              <AdminButton variant="primary" size="sm" type="submit" icon={<Megaphone className="w-3.5 h-3.5" />}>
                DISPATCH ADVISORY
              </AdminButton>
            </div>
          </form>
        </AdminModalCard>
      )}

      {lightboxImageUrl && (
        <ImageLightboxModal
          isOpen={!!lightboxImageUrl}
          onClose={() => setLightboxImageUrl(null)}
          imageUrl={lightboxImageUrl}
        />
      )}
    </div>
  );
};

export default AlertsCenter;
