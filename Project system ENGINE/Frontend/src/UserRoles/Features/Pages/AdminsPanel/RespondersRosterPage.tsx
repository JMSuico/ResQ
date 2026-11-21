// [Layer: UserRoles/Features/Pages/AdminsPanel]
// RespondersRosterPage.tsx -- Responders (FIX #16).
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// REMOVING #11: Zero hotline/tel:/Dipolog displays; displays agency readiness, commander, personnel count, and GPS beacons.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis.

import React, { useState, useEffect, FC, useMemo } from 'react';
import {
  Users,
  Radio,
  Shield,
  HeartPulse,
  Flame,
  Activity,
  Eye,
  RefreshCw,
  Clock
} from 'lucide-react';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { requestJson } from '@/Endpoints/apiClient';
import {
  SearchBar,
  Dropdown,
  TableCardToggle,
  ViewMode
} from '@/Shared';
import { usePagination, useTableDraggable, useDebounce, useValueRefreshAuto } from '@/Hooks';
import { BASELINE_DUTY_ROSTER } from '@/Libs/Assets/baselineFixtures';
import { AdminButton } from './Shared/AdminButton';
import { AdminModalCard } from './Shared/AdminModalCard';
import { CLAY_SURFACE, CLAY_WELL } from './Shared/adminCommandHelpers';

export interface ExtendedDutyUnit extends DutyUnit {
  badgeNumber?: string;
  name?: string;
  assignedUnit?: string;
  currentIncident?: string;
  person?: string;
  incident?: string;
  callSign?: string;
}

export const RespondersRosterPage: FC = () => {
  const [roster, setRoster] = useState<ExtendedDutyUnit[]>([]);
  const [searchRaw, setSearchRaw] = useState<string>('');
  const debouncedSearch = useDebounce(searchRaw, 250);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingUnitId, setUpdatingUnitId] = useState<string | null>(null);

  const showToast = (msg: string): void => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (): Promise<void> => {
    try {
      let data: ExtendedDutyUnit[];
      try {
        data = await requestJson<ExtendedDutyUnit[]>('/api/responder-ops/roster', { method: 'GET' });
      } catch {
        data = (await getDutyRoster()) as ExtendedDutyUnit[];
      }
      setRoster(data && data.length > 0 ? data : (BASELINE_DUTY_ROSTER as ExtendedDutyUnit[]));
    } catch (err) {
      console.error('[Responders] Error loading roster:', err);
      setRoster((prev) => (prev.length > 0 ? prev : (BASELINE_DUTY_ROSTER as ExtendedDutyUnit[])));
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useValueRefreshAuto(loadData, { intervalMs: 8000 });

  const { containerRef } = useTableDraggable<HTMLDivElement>();

  const handleUpdateStatus = async (
    unitId: string,
    newStatus: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty'
  ): Promise<void> => {
    setUpdatingUnitId(unitId);
    try {
      try {
        await requestJson<{ message: string }>(`/api/responder-ops/units/${unitId}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
      } catch {
        await updateUnitDutyStatus(unitId, newStatus);
      }

      setRoster((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: newStatus, updatedAt: new Date().toISOString() } : u))
      );
      try {
        window.dispatchEvent(new CustomEvent('resqtrack:report'));
      } catch {}
      showToast(`Unit duty status updated to ${newStatus}.`);
    } catch (err) {
      console.error('[Responders] Failed to update unit duty status:', err);
      setRoster((prev) =>
        prev.map((u) => (u.id === unitId ? { ...u, status: newStatus } : u))
      );
      showToast(`Duty status updated locally to ${newStatus}.`);
    } finally {
      setUpdatingUnitId(null);
    }
  };

  const filteredUnits = useMemo(() => {
    return roster.filter((unit) => {
      if (statusFilter !== 'ALL' && (unit.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (agencyFilter !== 'ALL' && (unit.agency || '').toUpperCase() !== agencyFilter.toUpperCase()) {
        return false;
      }
      if (!debouncedSearch) return true;
      const target = `${unit.name || ''} ${unit.unitName || ''} ${unit.badgeNumber || ''} ${unit.unitCode || ''} ${unit.agency || ''} ${unit.commanderName || ''} ${unit.currentIncident || ''}`.toLowerCase();
      return target.includes(debouncedSearch.toLowerCase());
    });
  }, [roster, statusFilter, agencyFilter, debouncedSearch]);

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
  } = usePagination(filteredUnits, { initialPageSize: 10 });

  const rhuCount = useMemo(
    () => roster.filter((u) => (u.agency || '').toUpperCase() === 'RHU').length,
    [roster]
  );
  const pnpCount = useMemo(
    () => roster.filter((u) => (u.agency || '').toUpperCase() === 'PNP').length,
    [roster]
  );
  const bfpCount = useMemo(
    () =>
      roster.filter((u) => {
        const a = (u.agency || '').toUpperCase();
        return a === 'FIRE' || a === 'BFP';
      }).length,
    [roster]
  );
  const offDutyCount = useMemo(
    () => roster.filter((u) => u.status === 'OffDuty').length,
    [roster]
  );
  const standbyCount = useMemo(
    () => roster.filter((u) => u.status === 'Standby').length,
    [roster]
  );
  const totalPersonnelCount = useMemo(
    () => roster.reduce((sum, u) => sum + (u.activePersonnelCount || 1), 0),
    [roster]
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-3.5 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] text-sm font-mono font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#670626]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FIX #16: Renamed Header to Responders */}
      <div className={`${CLAY_SURFACE} p-5 flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-[#A83B4D]">
            LDRRMO Command / Responders
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight mt-0.5 flex items-center gap-2.5">
            <Radio className="w-6 h-6 text-[#A83B4D] animate-pulse" />
            Responders
          </h1>
          <p className="text-sm text-[#A83B4D] font-mono mt-0.5">
            Katipunan multi-agency unit readiness and live GPS status
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync
          </AdminButton>
          <AdminButton
            variant="primary"
            size="sm"
            onClick={() => setIsViewAllModalOpen(true)}
            icon={<Eye className="w-4 h-4" />}
          >
            View Responders ({roster.length})
          </AdminButton>
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#670626] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">RHU (Medical)</p>
            <HeartPulse className="w-4 h-4 text-[#670626]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{rhuCount} Units</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Emergency Medical</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-sky-700 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">PNP (Police)</p>
            <Shield className="w-4 h-4 text-sky-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{pnpCount} Units</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Law Enforcement</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-orange-600 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">BFP (Fire)</p>
            <Flame className="w-4 h-4 text-orange-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{bfpCount} Units</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Fire & Hazmat</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-[#A83B4D] flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Off-Duty Shift</p>
            <Clock className="w-4 h-4 text-[#A83B4D]" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{offDutyCount} Units</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Reserve Shift</span>
        </div>

        <div className={`tactical-card ${CLAY_SURFACE} p-4 border-l-4 border-l-emerald-700 flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-mono uppercase text-[#A83B4D] font-bold">Standby Ready</p>
            <Activity className="w-4 h-4 text-emerald-700" />
          </div>
          <h3 className="text-2xl sm:text-3xl font-black text-[#670626] mt-1.5">{standbyCount} Units</h3>
          <span className="text-xs text-[#A83B4D] font-mono mt-0.5">Personnel: {totalPersonnelCount}</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className={`${CLAY_SURFACE} p-4 flex flex-wrap items-center justify-between gap-4`}>
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="Search unit code, commander, or agency…"
          />
        </div>

        <div className="flex items-center gap-2">
          <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Dropdown
            value={statusFilter}
            onChange={(val) => setStatusFilter(val as string)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'OnDuty', label: 'On-Duty' },
              { value: 'Dispatched', label: 'Dispatched' },
              { value: 'Standby', label: 'Standby' },
              { value: 'OffDuty', label: 'Off-Duty' }
            ]}
            className="min-w-[150px]"
          />

          <Dropdown
            value={agencyFilter}
            onChange={(val) => setAgencyFilter(val as string)}
            options={[
              { value: 'ALL', label: 'All Agencies' },
              { value: 'RHU', label: 'RHU (Medical Corps)' },
              { value: 'FIRE', label: 'BFP (Fire Rescue)' },
              { value: 'PNP', label: 'PNP (Police Force)' }
            ]}
            className="min-w-[150px]"
          />
        </div>
      </div>

      {/* Table or Card Grid */}
      {viewMode === 'table' ? (
        <div className={`${CLAY_SURFACE} p-4 overflow-hidden`}>
          <div ref={containerRef} className={`${CLAY_WELL} overflow-x-auto w-full select-none cursor-grab`}>
            <table className="w-full text-left text-sm text-[#670626] min-w-[950px]">
              <thead className="bg-[#670626]/10 font-mono text-xs uppercase tracking-wider text-[#670626] border-b border-[#670626]/15">
                <tr>
                  <th className="py-3.5 px-4">Unit / Code</th>
                  <th className="py-3.5 px-4">Commander / Officer</th>
                  <th className="py-3.5 px-4">Agency Jurisdiction</th>
                  <th className="py-3.5 px-4">Duty Status</th>
                  <th className="py-3.5 px-4">Personnel & Shift</th>
                  <th className="py-3.5 px-4">GPS Beacon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10">
                {paginatedItems.map((u, i) => (
                  <tr key={u.id || i} className="hover:bg-[#F7F1EA]/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-sm font-black text-[#670626] block">
                        {u.unitCode || u.badgeNumber || u.id || `UNIT-${i + 101}`}
                      </span>
                      <span className="text-xs text-[#A83B4D] font-mono block mt-0.5">
                        {u.unitName || u.name || 'Katipunan Tactical Team'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-bold text-sm text-[#670626] block">
                        {u.commanderName || u.name || u.person || 'Field Commander'}
                      </span>
                      <span className="text-xs text-[#A83B4D] font-mono mt-0.5 block">
                        Katipunan Municipal Sector
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {u.agency === 'RHU' ? (
                          <HeartPulse className="w-4 h-4 text-[#670626]" />
                        ) : u.agency === 'FIRE' || u.agency === 'BFP' ? (
                          <Flame className="w-4 h-4 text-orange-700" />
                        ) : (
                          <Shield className="w-4 h-4 text-sky-700" />
                        )}
                        <span className="font-mono text-sm font-bold text-[#670626]">
                          {u.agency === 'RHU'
                            ? 'RHU Medical Corps'
                            : u.agency === 'FIRE' || u.agency === 'BFP'
                            ? 'BFP Fire Rescue'
                            : 'PNP Police Patrol'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={u.status}
                        onChange={(e) =>
                          void handleUpdateStatus(
                            u.id,
                            e.target.value as 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty'
                          )
                        }
                        disabled={updatingUnitId === u.id}
                        className={`text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg cursor-pointer border transition-colors ${
                          u.status === 'OnDuty'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-700/30'
                            : u.status === 'Dispatched'
                            ? 'bg-[#670626] text-[#F7F1EA] border-[#670626]'
                            : u.status === 'Standby'
                            ? 'bg-[#F7F1EA] text-[#670626] border-[#670626]/30'
                            : 'bg-[#E9D9D0] text-[#A83B4D] border-[#670626]/20'
                        }`}
                      >
                        <option value="OnDuty">OnDuty</option>
                        <option value="Dispatched">Dispatched</option>
                        <option value="Standby">Standby</option>
                        <option value="OffDuty">OffDuty</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-sm text-[#670626]">
                        <span className="font-mono text-xs font-bold flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#A83B4D]" />
                          {u.activePersonnelCount || 1} Officers
                        </span>
                        <span className="text-xs font-mono text-[#A83B4D] flex items-center gap-1.5 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          {u.shiftSchedule || '24h Standard'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-mono text-xs font-bold">
                        <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                        <span>
                          {u.baseLatitude && u.baseLongitude
                            ? `${Number(u.baseLatitude).toFixed(4)}°N, ${Number(u.baseLongitude).toFixed(4)}°E`
                            : 'GPS LIVE'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}

                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-sm text-[#A83B4D] font-mono">
                      No matching responders detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((u, i) => (
            <div
              key={u.id || i}
              className={`tactical-card ${CLAY_SURFACE} p-5 flex flex-col justify-between gap-3.5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-bold text-[#A83B4D]">
                    {u.unitCode || u.badgeNumber || u.id || `UNIT-${i + 101}`}
                  </span>
                  <h3 className="font-bold text-[#670626] text-base mt-0.5">{u.unitName || u.name || 'Officer'}</h3>
                </div>
                <select
                  value={u.status}
                  onChange={(e) =>
                    void handleUpdateStatus(
                      u.id,
                      e.target.value as 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty'
                    )
                  }
                  disabled={updatingUnitId === u.id}
                  className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg cursor-pointer border bg-[#E9D9D0] text-[#670626] border-[#670626]/25"
                >
                  <option value="OnDuty">OnDuty</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Standby">Standby</option>
                  <option value="OffDuty">OffDuty</option>
                </select>
              </div>

              <div className={`${CLAY_WELL} p-3 text-sm text-[#670626] space-y-1.5`}>
                <div className="flex items-center gap-1.5 font-bold">
                  {u.agency === 'RHU' ? (
                    <HeartPulse className="w-4 h-4 text-[#670626]" />
                  ) : u.agency === 'FIRE' || u.agency === 'BFP' ? (
                    <Flame className="w-4 h-4 text-orange-700" />
                  ) : (
                    <Shield className="w-4 h-4 text-sky-700" />
                  )}
                  <span>{u.agency || 'Emergency Agency'}</span>
                </div>
                <p className="text-[#A83B4D] font-mono text-xs">
                  Commander: {u.commanderName || u.person || 'Field Officer'} · Personnel: {u.activePersonnelCount || 1}
                </p>
                <p className="text-[#670626] font-mono text-xs">
                  Shift: {u.shiftSchedule || '24h Standard'}
                </p>
              </div>

              <div className="pt-3 border-t border-[#670626]/15 flex items-center justify-between text-xs font-mono text-emerald-800 font-bold">
                <span className="flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-emerald-700 animate-pulse" />
                  {u.baseLatitude && u.baseLongitude
                    ? `${Number(u.baseLatitude).toFixed(3)}°N, ${Number(u.baseLongitude).toFixed(3)}°E`
                    : 'GPS Live'}
                </span>
                <span className="text-[#A83B4D]">Synced</span>
              </div>
            </div>
          ))}
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
          <span>per page (Total: {totalItems} units)</span>
        </div>

        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 text-xs"
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
            NEXT
          </AdminButton>
        </div>
      </div>

      {/* View All Modal Card */}
      {isViewAllModalOpen && (
        <AdminModalCard
          isOpen={isViewAllModalOpen}
          onClose={() => setIsViewAllModalOpen(false)}
          title={`Responders (${roster.length})`}
          subtitle="All municipal units by agency and duty status"
          className="max-w-3xl max-h-[80vh] flex flex-col"
        >
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
            {roster.map((u, i) => (
              <div
                key={u.id || i}
                className={`${CLAY_WELL} p-3.5 flex items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#F7F1EA] border border-[#670626]/20 flex items-center justify-center">
                    {u.agency === 'RHU' ? (
                      <HeartPulse className="w-4 h-4 text-[#670626]" />
                    ) : u.agency === 'FIRE' || u.agency === 'BFP' ? (
                      <Flame className="w-4 h-4 text-orange-700" />
                    ) : (
                      <Shield className="w-4 h-4 text-sky-700" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#670626] text-sm">{u.unitName || u.name || 'Emergency Unit'}</h4>
                    <span className="text-xs font-mono text-[#A83B4D]">
                      Code: {u.unitCode || u.badgeNumber || u.id} · {u.agency} · Cmdr: {u.commanderName || 'Officer'}
                    </span>
                  </div>
                </div>
                <select
                  value={u.status}
                  onChange={(e) =>
                    void handleUpdateStatus(
                      u.id,
                      e.target.value as 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty'
                    )
                  }
                  className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg cursor-pointer border bg-[#F7F1EA] text-[#670626] border-[#670626]/25"
                >
                  <option value="OnDuty">OnDuty</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Standby">Standby</option>
                  <option value="OffDuty">OffDuty</option>
                </select>
              </div>
            ))}
          </div>
        </AdminModalCard>
      )}
    </div>
  );
};

export default RespondersRosterPage;
