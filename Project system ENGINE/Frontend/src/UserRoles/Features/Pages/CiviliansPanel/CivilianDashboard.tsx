// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public emergency citizen dashboard featuring 1-tap accident reporting and hazard maps.
// DO NOT hide municipal emergency hotlines from resident users.

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPublicAlerts } from '@/Endpoints/civilianPortalApi';
import { getIncidentFixtures } from '@/Endpoints/adminGovernanceApi';
import { SatelliteCommandMap, MapMarker } from '@/Shared/SatelliteCommandMap';
import { Button } from '@/Shared/Button';
import { CameraCaptureModal } from '@/Shared/CameraCaptureModal';
import { createReport } from '@/Endpoints/reportsApi';
import { useReportEventBus } from '@/Hooks/useReportEventBus';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { AGENCY_METADATA } from '@/Libs/Assets/data';

export const CivilianDashboard: React.FC = () => {
  const { coords } = useGpsLocation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);

  const { dispatchReportEvent } = useReportEventBus();

  const loadData = async () => {
    try {
      const [a, f] = await Promise.all([getPublicAlerts(), getIncidentFixtures()]);
      setAlerts(a);
      setFixtures(f);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useReportEventBus(() => {
    loadData();
  });

  const handleQuickReport = async (dataUrl: string) => {
    try {
      const res = await createReport({
        title: 'Emergency Reported via Citizen Dashboard',
        note: 'Submitted via 1-Tap Quick Action Camera.',
        category: 'VehicularAccident',
        severity: 'High',
        latitude: coords.latitude,
        longitude: coords.longitude,
        locationLabel: 'Citizen Current GPS Location',
        imageDataUrl: dataUrl
      });
      dispatchReportEvent(res.report);
      setReportSuccess(`Incident logged with reference: ${res.report.referenceCode}. Emergency responders notified.`);
      setTimeout(() => setReportSuccess(null), 6000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const markers: MapMarker[] = [
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
    }))
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1-Tap Emergency Banner */}
      <div className="tactical-card p-6 bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900 border-rose-600/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-rose-600/20 text-rose-400 text-xs font-mono font-bold border border-rose-600/30 mb-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>24/7 EMERGENCY ASSISTANCE</span>
          </div>
          <h2 className="text-2xl font-black text-white">Witnessed or Involved in an Incident?</h2>
          <p className="text-xs text-slate-300 max-w-xl mt-1">
            Tap the button below to take a live photo. Your GPS coordinates and image will be immediately broadcast to LDRRMO Command, RHU Medics, BFP Fire, and PNP Officers.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <Button
            variant="danger"
            size="lg"
            onClick={() => setIsCameraOpen(true)}
            className="w-full sm:w-auto text-base !py-3.5 shadow-xl shadow-rose-950/80 animate-pulse font-extrabold"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
          >
            Report Accident (Photo)
          </Button>
          <Link to="/civilian/report" className="w-full sm:w-auto">
            <Button variant="outline" size="lg" className="w-full">
              Detailed Report
            </Button>
          </Link>
        </div>
      </div>

      {reportSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-medium flex items-center gap-3">
          <span className="text-lg">✓</span>
          <span>{reportSuccess}</span>
        </div>
      )}

      {/* Satellite Hazard Map & Evacuation Centers */}
      <div className="tactical-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🗺️</span>
            <span>Municipal Evacuation Centers & Safe Zones</span>
          </h3>
          <span className="text-[11px] font-mono text-slate-400">
            Current GPS: {coords.latitude.toFixed(4)}° N, {coords.longitude.toFixed(4)}° E
          </span>
        </div>
        <div className="h-[380px] w-full">
          <SatelliteCommandMap
            markers={markers}
            centerLat={coords.latitude}
            centerLng={coords.longitude}
            className="h-full"
          />
        </div>
      </div>

      {/* Emergency Hotlines Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(AGENCY_METADATA).map(([key, meta]) => (
          <div key={key} className="tactical-card p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase text-slate-400 font-bold">{meta.short}</p>
              <h4 className="text-xs font-bold text-white mt-0.5">{meta.name}</h4>
              <p className="text-sm font-mono font-extrabold text-sky-400 mt-1">{meta.hotline}</p>
            </div>
          </div>
        ))}
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleQuickReport}
        title="1-Tap Emergency Accident Reporter"
        instructionText="Take photo of the emergency. Your exact location will be automatically geotagged."
      />
    </div>
  );
};
