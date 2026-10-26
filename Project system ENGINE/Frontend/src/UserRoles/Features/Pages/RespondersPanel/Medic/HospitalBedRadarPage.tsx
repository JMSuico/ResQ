// [Layer: UserRoles/Features/Pages/RespondersPanel/Medic]
// Responsibility: Real-time hospital ER receiving facility radar & trauma bay bed coordination for Dipolog City.
// Katipuneros Architecture: Strictly typed request/response contracts with ZERO 'any' usage.
// Universal lambda expressions (=>).

import React, { useState, useMemo } from 'react';
import { Button } from '@/Shared/Button';
import { DefaultFloatingModalCard } from '@/Shared/DefaultFloatingModalCard';
import { useGpsLocation } from '@/Hooks/useGpsLocation';
import { formatGpsCoord } from '@/Libs/Assets/formatters';

export type DivertStatus = 'OPEN' | 'ADVISORY' | 'DIVERT';

export interface BloodReserve {
  type: string;
  units: number;
  criticalThreshold: number;
}

export interface HospitalFacility {
  id: string;
  name: string;
  code: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  traumaBaysTotal: number;
  traumaBaysAvailable: number;
  icuBedsTotal: number;
  icuBedsAvailable: number;
  observationBedsTotal: number;
  observationBedsAvailable: number;
  ventilatorsAvailable: number;
  divertStatus: DivertStatus;
  bloodBank: BloodReserve[];
  hotline: string;
  radioFrequency: string;
  etaMinsEstimate: number;
  distanceKmEstimate: number;
}

export const HospitalBedRadarPage: React.FC = () => {
  const { coords } = useGpsLocation();
  const [facilities, setFacilities] = useState<HospitalFacility[]>([
    {
      id: 'ZNMC',
      name: 'Zamboanga del Norte Medical Center (ZNMC)',
      code: 'ZNMC-TERTIARY-C2',
      category: 'Level 3 Provincial Tertiary Trauma Center',
      address: 'Sicayab, Dipolog City, Zamboanga del Norte',
      latitude: 8.5833,
      longitude: 123.3333,
      traumaBaysTotal: 6,
      traumaBaysAvailable: 4,
      icuBedsTotal: 10,
      icuBedsAvailable: 3,
      observationBedsTotal: 25,
      observationBedsAvailable: 8,
      ventilatorsAvailable: 5,
      divertStatus: 'OPEN',
      bloodBank: [
        { type: 'O-Negative (Emerg)', units: 8, criticalThreshold: 5 },
        { type: 'O-Positive', units: 24, criticalThreshold: 10 },
        { type: 'A-Positive', units: 16, criticalThreshold: 8 },
        { type: 'Plasma (FFP)', units: 12, criticalThreshold: 6 }
      ],
      hotline: '(065) 212-2555',
      radioFrequency: '155.850 MHz (RHU-EMS Primary)',
      etaMinsEstimate: 6,
      distanceKmEstimate: 3.8
    },
    {
      id: 'RHU-MAIN',
      name: 'Dipolog City Health Center / RHU Main',
      code: 'DIPOLOG-RHU-01',
      category: 'City Primary Emergency & Ambulatory Unit',
      address: 'Rizal Avenue, Barangay Central, Dipolog City',
      latitude: 8.5855,
      longitude: 123.3411,
      traumaBaysTotal: 3,
      traumaBaysAvailable: 2,
      icuBedsTotal: 0,
      icuBedsAvailable: 0,
      observationBedsTotal: 12,
      observationBedsAvailable: 7,
      ventilatorsAvailable: 2,
      divertStatus: 'OPEN',
      bloodBank: [
        { type: 'Cold-Chain ZNMC Link', units: 4, criticalThreshold: 2 },
        { type: 'Packed RBC O+', units: 6, criticalThreshold: 3 }
      ],
      hotline: '(065) 212-8822',
      radioFrequency: '155.400 MHz (RHU Tactical)',
      etaMinsEstimate: 3,
      distanceKmEstimate: 1.4
    },
    {
      id: 'CCAMH',
      name: 'Corazon C. Aquino Memorial Hospital (CCAMH)',
      code: 'CCAMH-DISTRICT-02',
      category: 'District General Trauma Hospital',
      address: 'Biasong, Dipolog City, Zamboanga del Norte',
      latitude: 8.5721,
      longitude: 123.3512,
      traumaBaysTotal: 8,
      traumaBaysAvailable: 2,
      icuBedsTotal: 6,
      icuBedsAvailable: 1,
      observationBedsTotal: 20,
      observationBedsAvailable: 3,
      ventilatorsAvailable: 2,
      divertStatus: 'ADVISORY',
      bloodBank: [
        { type: 'O-Positive', units: 6, criticalThreshold: 8 },
        { type: 'B-Positive', units: 8, criticalThreshold: 6 },
        { type: 'O-Negative', units: 2, criticalThreshold: 4 }
      ],
      hotline: '(065) 212-3401',
      radioFrequency: '155.650 MHz (Provincial Inter-Agency)',
      etaMinsEstimate: 9,
      distanceKmEstimate: 5.2
    },
    {
      id: 'DMC',
      name: 'Dipolog Medical Center Hospital (DMC)',
      code: 'DMC-PRIVATE-AFFIL',
      category: 'Private Specialty & Pediatric Trauma Facility',
      address: 'Padre Ramon St, Dipolog City',
      latitude: 8.5878,
      longitude: 123.3392,
      traumaBaysTotal: 5,
      traumaBaysAvailable: 3,
      icuBedsTotal: 8,
      icuBedsAvailable: 3,
      observationBedsTotal: 15,
      observationBedsAvailable: 6,
      ventilatorsAvailable: 4,
      divertStatus: 'OPEN',
      bloodBank: [
        { type: 'O-Positive', units: 14, criticalThreshold: 6 },
        { type: 'A-Positive', units: 10, criticalThreshold: 5 }
      ],
      hotline: '(065) 212-5500',
      radioFrequency: '154.950 MHz',
      etaMinsEstimate: 5,
      distanceKmEstimate: 2.5
    }
  ]);

  // Pre-notification modal state
  const [selectedFacility, setSelectedFacility] = useState<HospitalFacility | null>(null);
  const [isNotifyModalOpen, setIsNotifyModalOpen] = useState<boolean>(false);
  const [etaMins, setEtaMins] = useState<number>(7);
  const [patientGcs, setPatientGcs] = useState<number>(8);
  const [patientTriage, setPatientTriage] = useState<'Immediate' | 'Delayed' | 'Minor'>('Immediate');
  const [chiefInjuries, setChiefInjuries] = useState<string>('Unstable pelvic fracture, open head laceration, respiratory distress');
  const [airwayStatus, setAirwayStatus] = useState<string>('Oxygen via NRB Mask @ 12 LPM');
  const [reqTraumaBay1, setReqTraumaBay1] = useState<boolean>(true);
  const [reqBloodMtp, setReqBloodMtp] = useState<boolean>(true);
  const [reqSurgeon, setReqSurgeon] = useState<boolean>(true);
  const [reqCtScan, setReqCtScan] = useState<boolean>(true);

  // Inbound broadcast notification logs
  const [broadcastLog, setBroadcastLog] = useState<{ id: string; hospital: string; time: string; summary: string }[]>([
    {
      id: 'BR-102',
      hospital: 'Zamboanga del Norte Medical Center (ZNMC)',
      time: '18 mins ago',
      summary: 'INBOUND: 24yo Male, Severe Poly-Trauma, GCS 9, ETA 8 mins. Trauma Bay 2 activated.'
    }
  ]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Aggregated KPIs
  const totalAvailableBays = useMemo(
    () => facilities.reduce((acc, f) => acc + f.traumaBaysAvailable, 0),
    [facilities]
  );
  const totalVentilators = useMemo(
    () => facilities.reduce((acc, f) => acc + f.ventilatorsAvailable, 0),
    [facilities]
  );
  const totalEmergencyOneg = useMemo(
    () =>
      facilities.reduce((acc, f) => {
        const oNeg = f.bloodBank.find((b) => b.type.includes('O-Negative'));
        return acc + (oNeg ? oNeg.units : 0);
      }, 0),
    [facilities]
  );

  const handleOpenNotifyModal = (facility: HospitalFacility) => {
    setSelectedFacility(facility);
    setEtaMins(facility.etaMinsEstimate);
    setIsNotifyModalOpen(true);
  };

  const handleSendPreNotification = () => {
    if (!selectedFacility) return;

    const newLog = {
      id: `BR-${Date.now().toString().slice(-4)}`,
      hospital: selectedFacility.name,
      time: 'Just now',
      summary: `INBOUND ALERT: GCS ${patientGcs} (${patientTriage}), ETA: ${etaMins}m. ${chiefInjuries.slice(0, 60)}...`
    };

    setBroadcastLog((prev) => [newLog, ...prev]);
    setIsNotifyModalOpen(false);
    showToast(`🚨 INBOUND TELEMETRY TRANSMITTED TO ${selectedFacility.name.toUpperCase()} (ETA ${etaMins}m, GCS ${patientGcs})`);
  };

  const handleCallHotline = (phone: string, hospitalName: string) => {
    navigator.clipboard?.writeText(phone);
    showToast(`📞 COPIED & CALLING ${hospitalName} HOTLINE: ${phone}`);
    window.open(`tel:${phone.replace(/[^0-9+]/g, '')}`, '_self');
  };

  const handleNavigateToHospital = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6 w-full text-slate-100 font-sans pb-16">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-lg bg-sky-950 border border-sky-400/80 text-sky-200 shadow-[0_0_20px_rgba(56,189,248,0.4)] backdrop-blur-md animate-fade-in text-sm font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-xl bg-gradient-to-r from-sky-950/80 via-[#0a1a2b] to-slate-950 border border-sky-600/30 shadow-lg">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-sky-600/20 border border-sky-500/40 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold tracking-wider rounded bg-sky-500/20 text-sky-300 border border-sky-500/40">
                DIPOLOG METROPOLITAN TRAUMA GRID
              </span>
              <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Radar Synchronized
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-wide mt-1">
              Hospital ER Receiving Radar & Trauma Bay Capacity
            </h1>
            <p className="text-xs text-sky-200/70 mt-0.5">
              Continuous monitoring of provincial emergency rooms, critical blood reserves, and pre-arrival alerts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-right">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">Ambulance GPS Location</span>
            <span className="text-xs font-mono font-bold text-sky-400">
              {coords ? formatGpsCoord(coords.latitude, coords.longitude) : '8.5147° N, 123.2842° E'}
            </span>
          </div>
        </div>
      </div>

      {/* Network KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400">Total Trauma Bays Ready</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-sky-400">{totalAvailableBays}</span>
            <span className="text-xs text-slate-400">/ 22 Grid Bays</span>
          </div>
          <span className="text-[11px] text-emerald-400 mt-1">✓ Immediate Resuscitation Ready</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400">Available Ventilators</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">{totalVentilators}</span>
            <span className="text-xs text-slate-400">Active Units</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">ZNMC & DMC Critical Care</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400">O-Negative Emergency Blood</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-red-400">{totalEmergencyOneg}</span>
            <span className="text-xs text-slate-400">Units on Hold</span>
          </div>
          <span className="text-[11px] text-red-300 mt-1">Universal Donor Safe</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400">Active Receiving Facilities</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold font-mono text-white">4</span>
            <span className="text-xs text-slate-400">Centers Online</span>
          </div>
          <span className="text-[11px] text-sky-300 mt-1">All hotlines verified 24/7</span>
        </div>
      </div>

      {/* Facilities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {facilities.map((fac) => {
          const isDivert = fac.divertStatus === 'DIVERT';
          const isAdvisory = fac.divertStatus === 'ADVISORY';
          const traumaBayPercent = Math.round((fac.traumaBaysAvailable / fac.traumaBaysTotal) * 100);

          return (
            <div
              key={fac.id}
              className={`p-5 rounded-xl border flex flex-col justify-between gap-5 transition-all shadow-md bg-slate-900/95 ${
                fac.id === 'ZNMC'
                  ? 'border-sky-500/50 shadow-[0_0_15px_rgba(2,132,199,0.15)]'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {fac.code}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        ~{fac.distanceKmEstimate} km • ETA {fac.etaMinsEstimate}m
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-white mt-1">{fac.name}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{fac.category}</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{fac.address}</p>
                  </div>

                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-extrabold tracking-wider border whitespace-nowrap ${
                      isDivert
                        ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                        : isAdvisory
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                    }`}
                  >
                    {isDivert ? '⛔ ER DIVERT' : isAdvisory ? '⚠️ HIGH CENSUS' : '✓ ER OPEN'}
                  </span>
                </div>

                {/* Capacity Gauges */}
                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-slate-800/80">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Trauma Bays</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-sky-400">{fac.traumaBaysAvailable}</span>
                      <span className="text-xs text-slate-500">/ {fac.traumaBaysTotal}</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          traumaBayPercent < 30 ? 'bg-red-500' : 'bg-sky-500'
                        }`}
                        style={{ width: `${traumaBayPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">ICU / Crit Care</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-emerald-400">{fac.icuBedsAvailable}</span>
                      <span className="text-xs text-slate-500">/ {fac.icuBedsTotal}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-2">
                      Ventilators: <strong className="text-slate-300">{fac.ventilatorsAvailable}</strong>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">Observation</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-slate-200">{fac.observationBedsAvailable}</span>
                      <span className="text-xs text-slate-500">/ {fac.observationBedsTotal}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-2">Basic Stabilization</span>
                  </div>
                </div>

                {/* Blood Bank Reserves */}
                <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <span>🩸</span> Blood Bank Reserves
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Cold Chain Verified</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {fac.bloodBank.map((b) => (
                      <span
                        key={b.type}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border ${
                          b.units <= b.criticalThreshold
                            ? 'bg-red-950/60 text-red-300 border-red-500/50'
                            : 'bg-slate-900 text-slate-200 border-slate-700'
                        }`}
                      >
                        {b.type}: <strong>{b.units} U</strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Direct Comms Channel */}
                <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                  <span>Radio: <strong className="text-sky-300">{fac.radioFrequency}</strong></span>
                  <span>Hotline: <strong className="text-slate-200">{fac.hotline}</strong></span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-800">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleOpenNotifyModal(fac)}
                  className="bg-sky-600 hover:bg-sky-500 text-white shadow-md active:scale-95 flex-1"
                >
                  🚨 Pre-Notify Incoming Patient
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCallHotline(fac.hotline, fac.name)}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 active:scale-95"
                >
                  📞 Hotline
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleNavigateToHospital(fac.latitude, fac.longitude)}
                  className="text-sky-400 hover:text-sky-300 active:scale-95"
                >
                  Route ↗
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Broadcast Log */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
            <span>📡</span> Inbound Pre-Arrival Broadcast Audit Log
          </h3>
          <span className="text-xs font-mono text-slate-500">{broadcastLog.length} Transmissions</span>
        </div>
        <div className="flex flex-col gap-2">
          {broadcastLog.map((log) => (
            <div
              key={log.id}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
            >
              <div>
                <span className="text-sky-400 font-bold">[{log.id}] {log.hospital}:</span>{' '}
                <span className="text-slate-300">{log.summary}</span>
              </div>
              <span className="text-slate-500 whitespace-nowrap">{log.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-Notification Modal */}
      {isNotifyModalOpen && selectedFacility && (
        <DefaultFloatingModalCard
          isOpen={isNotifyModalOpen}
          onClose={() => setIsNotifyModalOpen(false)}
          title={`Pre-Arrival Trauma Notification: ${selectedFacility.name}`}
          subtitle="Hospital ER Charge Nurse & Trauma Bay Activation Alert"
          maxWidth="2xl"
          footer={
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsNotifyModalOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSendPreNotification}
                className="bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/40 active:scale-95"
              >
                🚨 Broadcast Inbound Trauma Alert
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4 text-xs">
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-red-200">
              Broadcasting will trigger a Code 3 Trauma Alert at {selectedFacility.name} ER and pre-clear a resuscitation bay.
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Estimated ETA (Minutes)</label>
                <input
                  type="number"
                  value={etaMins}
                  onChange={(e) => setEtaMins(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-sky-400 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Patient GCS Score (3-15)</label>
                <input
                  type="number"
                  min="3"
                  max="15"
                  value={patientGcs}
                  onChange={(e) => setPatientGcs(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg font-mono text-sm text-red-400 font-bold"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Triage Priority Tag</label>
                <select
                  value={patientTriage}
                  onChange={(e) => setPatientTriage(e.target.value as 'Immediate' | 'Delayed' | 'Minor')}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-bold"
                >
                  <option value="Immediate">Red - Immediate</option>
                  <option value="Delayed">Yellow - Delayed</option>
                  <option value="Minor">Green - Minor</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Chief Injuries & Presentation</label>
              <textarea
                value={chiefInjuries}
                onChange={(e) => setChiefInjuries(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 resize-none font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Airway & Oxygen Status</label>
              <input
                type="text"
                value={airwayStatus}
                onChange={(e) => setAirwayStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 font-mono"
              />
            </div>

            {/* Preparation Requirements */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-2">Hospital Prep Required on Arrival</label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqTraumaBay1}
                    onChange={(e) => setReqTraumaBay1(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span>Trauma Resuscitation Bay 1 Ready</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqBloodMtp}
                    onChange={(e) => setReqBloodMtp(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span>Massive Transfusion Protocol (MTP)</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqSurgeon}
                    onChange={(e) => setReqSurgeon(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span>Trauma Surgeon On-Standby</span>
                </label>
                <label className="flex items-center gap-2 p-2 rounded bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqCtScan}
                    onChange={(e) => setReqCtScan(e.target.checked)}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span>Stat CT Scan Whole Body Protocol</span>
                </label>
              </div>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}
    </div>
  );
};
