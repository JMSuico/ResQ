// [Layer: UserRoles/Features/Pages/AdminsPanel]
// RespondersRosterPage.tsx -- Agency Fleet Roster Management.
// Conforms to Tasks 20 & 21:
// - 5 Overview KPI cards:
//   1. RHU (Medical) Active Units
//   2. PNP (Police) Active Units
//   3. BFP (Fire) Active Units
//   4. Off-Duty Roster Units
//   5. In-Transit / Standby Units
// - SearchBar with debounced input, pagination, and draggable wide table
// - Table-to-Card and Card-to-Table view toggle (TableCardToggle)
// - On-duty, Off-duty, and Dispatched filter dropdowns
// - "View All" DefaultFloatingModalCard drill-down modal

import React, { useState, useEffect, FC, useMemo } from 'react';
import { getDutyRoster } from '@/Endpoints/responderOpsApi';
import {
  SearchBar,
  Dropdown,
  Button,
  TableCardToggle,
  ViewMode,
  DefaultFloatingModalCard
} from '@/Shared';
import { usePagination, useTableDraggable, useDebounce, useValueRefreshAuto } from '@/Hooks';

export const RespondersRosterPage: FC = () => {
  const [roster, setRoster] = useState<any[]>([]);
  const [searchRaw, setSearchRaw] = useState<string>('');
  const debouncedSearch = useDebounce(searchRaw, 250);

  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [isViewAllModalOpen, setIsViewAllModalOpen] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const u = await getDutyRoster();
      setRoster(u || []);
    } catch (err) {
      console.error('[RespondersRosterPage] Error loading roster:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useValueRefreshAuto(loadData, { intervalMs: 8000 });

  const { containerRef } = useTableDraggable<HTMLDivElement>();

  // Filtered roster
  const filteredUnits = useMemo(() => {
    return roster.filter((unit) => {
      if (statusFilter !== 'ALL' && (unit.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
      if (agencyFilter !== 'ALL' && (unit.agency || '').toUpperCase() !== agencyFilter.toUpperCase()) {
        return false;
      }
      if (!debouncedSearch) return true;
      const target = `${unit.name || ''} ${unit.badgeNumber || ''} ${unit.agency || ''} ${unit.assignedUnit || ''} ${unit.currentIncident || ''}`.toLowerCase();
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

  // Task 21: Counts
  const rhuCount = roster.filter((u) => u.agency === 'RHU').length;
  const pnpCount = roster.filter((u) => u.agency === 'PNP').length;
  const bfpCount = roster.filter((u) => u.agency === 'FIRE').length;
  const offDutyCount = roster.filter((u) => u.status === 'OffDuty').length;
  const standbyCount = roster.filter((u) => u.status === 'Standby' || u.status === 'EnRoute').length;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_8px_#38bdf8]" />
            Agency Fleet Roster
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Real-time deployment and operational readiness across Philippine emergency response units
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsViewAllModalOpen(true)}
          className="text-xs font-mono font-bold flex items-center gap-1.5 border-slate-600 hover:border-slate-400"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          VIEW COMPLETE FLEET ({roster.length})
        </Button>
      </div>

      {/* Task 21: 5 KPI Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="tactical-card p-3.5 border-l-4 border-l-sky-500">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">RHU (Medical)</p>
          <h3 className="text-2xl font-extrabold text-sky-400 mt-1">{rhuCount}</h3>
          <span className="text-[10px] text-slate-400 font-mono">Active Units</span>
        </div>

        <div className="tactical-card p-3.5 border-l-4 border-l-blue-500">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">PNP (Police)</p>
          <h3 className="text-2xl font-extrabold text-blue-400 mt-1">{pnpCount}</h3>
          <span className="text-[10px] text-slate-400 font-mono">Active Units</span>
        </div>

        <div className="tactical-card p-3.5 border-l-4 border-l-orange-500">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">BFP (Fire)</p>
          <h3 className="text-2xl font-extrabold text-orange-400 mt-1">{bfpCount}</h3>
          <span className="text-[10px] text-slate-400 font-mono">Active Units</span>
        </div>

        <div className="tactical-card p-3.5 border-l-4 border-l-slate-500">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">Off-Duty Roster</p>
          <h3 className="text-2xl font-extrabold text-slate-300 mt-1">{offDutyCount}</h3>
          <span className="text-[10px] text-slate-400 font-mono">Standby Shift</span>
        </div>

        <div className="tactical-card p-3.5 border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-mono uppercase text-slate-400 font-bold">In-Transit / Standby</p>
          <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">{standbyCount}</h3>
          <span className="text-[10px] text-slate-400 font-mono">Available Response</span>
        </div>
      </div>

      {/* Control Bar: SearchBar, TableCardToggle, Status & Agency Dropdown Filters */}
      <div className="tactical-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <SearchBar
            value={searchRaw}
            onChange={setSearchRaw}
            placeholder="Search officer name, badge number, or unit ID…"
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
              { value: 'OffDuty', label: 'Off-Duty' },
              { value: 'Dispatched', label: 'Dispatched' },
              { value: 'EnRoute', label: 'En Route' },
              { value: 'Arrived', label: 'Arrived On-Site' }
            ]}
            className="min-w-[150px]"
          />

          <Dropdown
            value={agencyFilter}
            onChange={(val) => setAgencyFilter(val as string)}
            options={[
              { value: 'ALL', label: 'All Agencies' },
              { value: 'RHU', label: 'RHU (Medical)' },
              { value: 'FIRE', label: 'BFP (Fire & Rescue)' },
              { value: 'PNP', label: 'PNP (Police)' }
            ]}
            className="min-w-[150px]"
          />
        </div>
      </div>

      {/* Main Table or Card Grid View */}
      {viewMode === 'table' ? (
        <div className="tactical-card p-0 overflow-hidden">
          <div ref={containerRef} className="overflow-x-auto w-full select-none cursor-grab">
            <table className="w-full text-left text-xs text-slate-300 min-w-[850px]">
              <thead className="bg-slate-900/95 font-mono text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-700/80">
                <tr>
                  <th className="py-3 px-3">Unit / Badge</th>
                  <th className="py-3 px-3">Officer Name</th>
                  <th className="py-3 px-3">Agency Jurisdiction</th>
                  <th className="py-3 px-3">Duty Status</th>
                  <th className="py-3 px-3">Assigned Incident</th>
                  <th className="py-3 px-3">Telemetry Beacon</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {paginatedItems.map((u, i) => (
                  <tr key={u.id || i} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-sky-400">
                      {u.badgeNumber || u.id || `UNIT-${i + 101}`}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {u.name || u.person || 'Field Officer'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-slate-200">
                        {u.agency === 'RHU'
                          ? 'RHU Medical Corps'
                          : u.agency === 'FIRE'
                          ? 'BFP Fire Rescue'
                          : 'PNP Police Patrol'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          u.status === 'OnDuty'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : u.status === 'Dispatched' || u.status === 'EnRoute'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {u.status || 'OnDuty'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {u.currentIncident || u.incident || 'None (Standby)'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>GPS LIVE</span>
                      </div>
                    </td>
                  </tr>
                ))}

                {paginatedItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-500 font-mono">
                      No matching responders detected.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View (TableToCard) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((u, i) => (
            <div key={u.id || i} className="tactical-card p-4 flex flex-col justify-between gap-3 border border-slate-700/70 hover:border-sky-500/50 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono font-bold text-sky-400">
                    {u.badgeNumber || u.id || `UNIT-${i + 101}`}
                  </span>
                  <h3 className="font-bold text-white text-sm mt-0.5">{u.name || u.person || 'Officer'}</h3>
                </div>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                    u.status === 'OnDuty'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {u.status || 'OnDuty'}
                </span>
              </div>

              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-slate-200">{u.agency || 'RHU Medical'}</p>
                <p className="text-slate-400 font-mono text-[11px]">
                  Assignment: {u.currentIncident || u.incident || 'Patrol Standby'}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] font-mono text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Telemetry Locked
                </span>
                <span className="text-slate-400">C2 Linked</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Footer */}
      <div className="tactical-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <span>per page (Total: {totalItems} units)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="px-2.5 py-1 text-xs"
          >
            PREV
          </Button>
          <span className="px-2 font-bold text-white">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={nextPage}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1 text-xs"
          >
            NEXT
          </Button>
        </div>
      </div>

      {/* View All Modal Card */}
      {isViewAllModalOpen && (
        <DefaultFloatingModalCard
          isOpen={isViewAllModalOpen}
          onClose={() => setIsViewAllModalOpen(false)}
          title={`All Emergency Responders Fleet (${roster.length} Units)`}
          subtitle="Complete multi-agency on-duty, off-duty, and dispatched responder roster"
          className="max-w-3xl max-h-[80vh] flex flex-col"
        >
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {roster.map((u, i) => (
              <div
                key={u.id || i}
                className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/60 flex items-center justify-between"
              >
                <div>
                  <h4 className="font-bold text-white text-xs">{u.name || u.person || 'Officer'}</h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Badge: {u.badgeNumber || u.id} &bull; {u.agency}
                  </span>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  u.status === 'OnDuty' ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {u.status || 'Active'}
                </span>
              </div>
            ))}
          </div>
        </DefaultFloatingModalCard>
      )}
    </div>
  );
};

export default RespondersRosterPage;
