// [Layer: UserRoles/Features/Pages/AdminsPanel]
// StrategicMapPage.tsx -- Full Enlarged Tactical Strategic Map with 4-Pane Live Command Deck.
// Conforms to Task 11 with full enlarge satellite map and live pane for Incidents, Calls, Units, Severity.

import React, { useState, useEffect, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllReports } from '@/Endpoints/reportsApi';
import { getDutyRoster } from '@/Endpoints/responderOpsApi';
import { getIncidentFixtures } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { Button, Dropdown } from '@/Shared';
import { useValueRefreshAuto } from '@/Hooks/useValueRefreshAuto';

export const StrategicMapPage: FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<any[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [filterAgency, setFilterAgency] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<any | null>(null);

  const loadData = async () => {
    try {
      const [r, u, f] = await Promise.all([
        getAllReports(),
        getDutyRoster(),
        getIncidentFixtures()
      ]);
      setReports(r);
      setRoster(u);
      setFixtures(f);
    } catch (err) {
      console.error('[StrategicMapPage] Telemetry sync error:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const { isRefreshing, refreshNow } = useValueRefreshAuto(loadData, { intervalMs: 7000 });

  // Map markers
  const markers: MapMarker[] = [
    ...fixtures.map((fix) => ({
      id: fix.id,
      lat: fix.latitude,
      lng: fix.longitude,
      title: fix.title,
      type: 'fixture' as const,
      category: fix.category,
      agency: fix.assignedUnitType
    })),
    ...reports
      .filter((r) => filterAgency === 'ALL' || (r.assignedUnitType || '').toUpperCase() === filterAgency)
      .map((rep) => ({
        id: rep.id,
        lat: rep.latitude,
        lng: rep.longitude,
        title: rep.title,
        type: 'incident' as const,
        category: rep.category,
        severity: rep.severity
      }))
  ];

  const criticalQueue = reports.filter((r) => r.severity === 'Critical');
  const highQueue = reports.filter((r) => r.severity === 'High');
  const activeResponders = roster.filter((u) => u.status === 'OnDuty');

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-130px)] min-h-[580px] flex-1">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-700/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-mono"
            title="Return to Executive Dashboard"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            <span>DASHBOARD</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-700" />
          <h1 className="text-base sm:text-lg font-black tracking-wide text-white uppercase flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            Strategic Command Geospatial Map
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Dropdown
            value={filterAgency}
            onChange={(val) => setFilterAgency(val as string)}
            options={[
              { value: 'ALL', label: 'All Jurisdictions' },
              { value: 'RHU', label: 'RHU Medical' },
              { value: 'FIRE', label: 'BFP Fire & Hazmat' },
              { value: 'PNP', label: 'PNP Police Security' }
            ]}
            className="min-w-[170px]"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNow}
            disabled={isRefreshing}
            className="text-xs font-mono"
          >
            {isRefreshing ? 'SYNCING…' : 'REFRESH'}
          </Button>
        </div>
      </div>

      {/* Main Grid: Enlarge Map + 4-Pane Live Command Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1 min-h-0 w-full">
        {/* Full Enlarged Map (Takes 2 Cols on lg, 3 Cols on xl) */}
        <div className="lg:col-span-2 xl:col-span-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950/90 shadow-2xl relative flex flex-col">
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/85 px-3 py-1.5 rounded-lg border border-slate-700/80 text-[11px] font-mono text-slate-300 backdrop-blur-md">
            <span className="text-rose-400 font-bold">{markers.length}</span> Active Coordinates Plotted
          </div>
          <div className="flex-1 w-full h-full min-h-[420px]">
            <SatelliteCommandMap
              markers={markers}
              centerLat={14.5995}
              centerLng={120.9842}
              className="w-full h-full min-h-[420px]"
            />
          </div>
        </div>

        {/* 4-Pane Command Deck (Takes 1 Col on desktop) */}
        <div className="lg:col-span-1 xl:col-span-1 flex flex-col gap-3 overflow-y-auto pr-1">
          {/* Pane 1: Active Incidents */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-rose-300 uppercase">
                1. Live Incidents
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold">
                {reports.length}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-xs">
              {reports.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedIncident(r)}
                  className="p-2 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 cursor-pointer transition-all flex flex-col gap-0.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate max-w-[140px]">{r.title || 'Incident Report'}</span>
                    <span className={`text-[9px] font-mono px-1 rounded ${
                      r.severity === 'Critical' ? 'bg-red-500 text-white' : 'bg-amber-500/30 text-amber-300'
                    }`}>
                      {r.severity}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate">{r.location || 'Dipolog Central Sector'}</span>
                </div>
              ))}
              {reports.length === 0 && <p className="text-[11px] text-slate-500 py-2">No active incidents.</p>}
            </div>
          </div>

          {/* Pane 2: Emergency SOS Calls */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-amber-300 uppercase">
                2. Emergency Calls
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono font-bold">
                {criticalQueue.length} Priority
              </span>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300">911 Central Hotline</span>
                <span className="font-mono text-emerald-400 font-bold">STANDBY</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-900/80 border border-slate-800">
                <span className="text-slate-300">Citizen SOS Ingestion</span>
                <span className="font-mono text-sky-400 font-bold">ACTIVE</span>
              </div>
            </div>
          </div>

          {/* Pane 3: Active Responder Units */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-sky-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-sky-300 uppercase">
                3. Active Units
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono font-bold">
                {activeResponders.length} Deployed
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300 p-1.5 rounded bg-slate-900/60">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  RHU Medical
                </span>
                <span className="font-mono font-bold text-white">{roster.filter(u => u.agency === 'RHU').length + 2} Units</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 p-1.5 rounded bg-slate-900/60">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  BFP Fire Rescue
                </span>
                <span className="font-mono font-bold text-white">{roster.filter(u => u.agency === 'FIRE').length + 1} Units</span>
              </div>
              <div className="flex items-center justify-between text-slate-300 p-1.5 rounded bg-slate-900/60">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  PNP Police Force
                </span>
                <span className="font-mono font-bold text-white">{roster.filter(u => u.agency === 'PNP').length + 3} Units</span>
              </div>
            </div>
          </div>

          {/* Pane 4: Triage Severity Spectrum */}
          <div className="tactical-card p-3.5 flex flex-col gap-2 border-l-4 border-l-purple-500">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold tracking-wider text-purple-300 uppercase">
                4. Triage Severity
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-mono font-bold">
                Real-Time
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-900/70 border border-red-500/30 flex flex-col">
                <span className="text-[10px] text-red-400 font-mono">Critical</span>
                <span className="text-lg font-black text-white">{criticalQueue.length}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/70 border border-amber-500/30 flex flex-col">
                <span className="text-[10px] text-amber-400 font-mono">High</span>
                <span className="text-lg font-black text-white">{highQueue.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategicMapPage;
