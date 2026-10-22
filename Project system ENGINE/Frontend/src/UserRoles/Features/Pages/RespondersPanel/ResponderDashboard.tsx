// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical field operations console for RHU, BFP Fire, and PNP units with live dispatches and GPS.
// DO NOT permit cross-agency mutations from unassigned units.

import React, { useState, useEffect } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getAgencyReports } from '@/Endpoints/reportsApi';
import { getIncidentFixtures } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { useReportEventBus } from '@/Hooks/useReportEventBus';

export const ResponderDashboard: React.FC = () => {
  const { session } = useSession();
  const { coords, isLocating, refreshGps } = useGpsLocation();
  const [dispatches, setDispatches] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);

  const loadData = async () => {
    if (!session || session.unit === 'None') return;
    try {
      const [reps, fixs] = await Promise.all([
        getAgencyReports(session.unit),
        getIncidentFixtures()
      ]);
      setDispatches(reps);
      setFixtures(fixs);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  useReportEventBus(() => {
    loadData();
  });

  const markers: MapMarker[] = [
    {
      id: 'self-gps',
      lat: coords.latitude,
      lng: coords.longitude,
      title: `${session?.fullName || 'My Unit'} (Current Position)`,
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
    ...dispatches.map((d) => ({
      id: d.id,
      lat: d.latitude,
      lng: d.longitude,
      title: d.title,
      type: 'incident' as const,
      category: d.category,
      severity: d.severity
    }))
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tactical Status Banner */}
      <div className="tactical-card p-5 bg-gradient-to-r from-slate-900 to-sky-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-sky-400">TACTICAL DISPATCH ACTIVE</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs font-mono text-slate-300">AGENCY: {session?.unit}</span>
          </div>
          <h2 className="text-xl font-bold text-white">{session?.fullName} - {session?.rankOrTitle || 'Field Unit Commander'}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Assigned Station: {session?.departmentOrBarangay || 'Central Tactical Headquarters'}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshGps}
            disabled={isLocating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-sky-300 border border-slate-700 transition-colors"
          >
            <span>📡</span>
            <span>{isLocating ? 'Locating...' : 'Broadcast GPS Ping'}</span>
          </button>
          <div className="px-3 py-1.5 bg-slate-950 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            {coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="tactical-card p-4">
          <p className="text-xs font-mono text-slate-400 font-bold uppercase">Assigned Unit Dispatches</p>
          <h3 className="text-2xl font-extrabold text-white mt-1">{dispatches.length}</h3>
          <span className="text-[10px] text-sky-400 font-mono">Immediate Action Queue</span>
        </div>
        <div className="tactical-card p-4">
          <p className="text-xs font-mono text-slate-400 font-bold uppercase">En Route / On Scene</p>
          <h3 className="text-2xl font-extrabold text-amber-400 mt-1">
            {dispatches.filter((d) => d.status === 'EnRoute' || d.status === 'OnScene').length}
          </h3>
          <span className="text-[10px] text-amber-400 font-mono">Active Deployment</span>
        </div>
        <div className="tactical-card p-4">
          <p className="text-xs font-mono text-slate-400 font-bold uppercase">Resolved Incidents</p>
          <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">
            {dispatches.filter((d) => d.status === 'Resolved').length}
          </h3>
          <span className="text-[10px] text-emerald-400 font-mono">Mission Complete</span>
        </div>
      </div>

      {/* Tactical Map */}
      <div className="h-[440px] w-full">
        <SatelliteCommandMap
          markers={markers}
          centerLat={coords.latitude}
          centerLng={coords.longitude}
          className="h-full"
        />
      </div>
    </div>
  );
};
