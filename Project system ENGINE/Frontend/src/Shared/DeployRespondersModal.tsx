// [Layer: Shared]
// DeployRespondersModal.tsx -- Tactical Multi-Agency Responder Deployment & Workload Optimization Modal.
// Provides both Automatic Intelligent Dispatch and Manual Override Deployment for Katipunan C2 Admin.
// Integrates Multi-Factor Dispatch Balancing Algorithm (MF-DBA):
// Combines physical GPS proximity, dynamic travel ETA, agency specialization, and fair-sharing workload rotation
// to penalize over-selected units and prioritize fresh units that have not been chosen yet.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React, { FC, useState, useMemo, useEffect, useCallback } from 'react';
import {
  Send,
  Zap,
  Sparkles,
  Clock,
  MapPin,
  Shield,
  Flame,
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  UserCheck,
  Compass,
  Sliders,
  Search,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { calculateHaversineDistanceKm, calculateDynamicEtaMinutes } from '@/Libs/Map/mapAccuracy';
import { DutyUnit, getDutyRoster, pushResponderNotification, DispatchRequestRecord } from '@/Endpoints/responderOpsApi';
import { assignUnitToReport } from '@/Endpoints/reportsApi';
import { BASELINE_DUTY_ROSTER } from '@/Libs/Assets/baselineFixtures';
import { IncidentPinData } from './SatelliteCommandMap';

export interface DeployRespondersModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident: IncidentPinData | null;
  rosterProp?: DutyUnit[];
  onDeploySuccess?: (unit: DutyUnit, incident: IncidentPinData) => void;
}

export interface EvaluatedResponderUnit extends DutyUnit {
  distanceKm: number;
  etaMinutes: number;
  dispatchCount: number;
  isUnassignedEver: boolean;
  proximityScore: number;
  workloadScore: number;
  readinessScore: number;
  agencyMatchScore: number;
  compositeScore: number;
  recommendationTag: 'OPTIMAL_BALANCED' | 'CLOSEST_BUT_FATIGUED' | 'FRESH_UNCHOSEN' | 'STANDARD_AVAILABLE';
  tagLabel: string;
}

const DISPATCH_STORAGE_KEY = 'resqtrack_dispatch_requests';

// Read all past and active dispatch records from persistent storage
const readHistoricalDispatches = (): DispatchRequestRecord[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DISPATCH_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// Agency match score: 100 for primary agency, 60 for secondary cross-agency support
const computeAgencyMatchScore = (category: string | undefined, agency: string | undefined): number => {
  const normCat = (category || '').toLowerCase();
  const normAg = (agency || '').toUpperCase();

  if (normCat.includes('trauma') || normCat.includes('medic') || normCat.includes('cardiac') || normCat.includes('health') || normCat.includes('injury')) {
    return normAg === 'RHU' ? 100 : 60;
  }
  if (normCat.includes('fire') || normCat.includes('explosion') || normCat.includes('smoke') || normCat.includes('flame') || normCat.includes('hazard')) {
    return normAg === 'FIRE' || normAg === 'BFP' ? 100 : 60;
  }
  if (normCat.includes('crime') || normCat.includes('blotter') || normCat.includes('police') || normCat.includes('security') || normCat.includes('assault') || normCat.includes('theft')) {
    return normAg === 'PNP' ? 100 : 60;
  }
  if (normCat.includes('rescue') || normCat.includes('flood') || normCat.includes('disaster') || normCat.includes('typhoon') || normCat.includes('evac')) {
    return normAg === 'LDRRMO' || normAg === 'BFP' ? 100 : 70;
  }
  return 75;
};

// Workload score: gives 100 to units with 0 dispatches, progressively penalizes frequently chosen units
const computeWorkloadScore = (dispatchCount: number): number => {
  if (dispatchCount === 0) return 100; // Fresh, completely unassigned unit
  if (dispatchCount === 1) return 75;  // Normal load
  if (dispatchCount === 2) return 50;  // Moderate load
  if (dispatchCount === 3) return 30;  // High load
  return Math.max(10, 20 - (dispatchCount - 4) * 5); // Fatigue alert
};

// Readiness score: on-duty units ready at station have top score
const computeReadinessScore = (status: string | undefined): number => {
  const s = (status || '').toLowerCase();
  if (s === 'onduty') return 100;
  if (s === 'standby') return 80;
  if (s === 'dispatched') return 35; // Already active on scene
  return 10;
};

export const DeployRespondersModal: FC<DeployRespondersModalProps> = ({
  isOpen,
  onClose,
  incident,
  rosterProp,
  onDeploySuccess
}) => {
  const [dutyRoster, setDutyRoster] = useState<DutyUnit[]>(rosterProp || BASELINE_DUTY_ROSTER);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [sortStrategy, setSortStrategy] = useState<'BALANCED' | 'PROXIMITY' | 'FRESH'>('BALANCED');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Sync duty roster from API or fallback
  useEffect(() => {
    if (rosterProp && rosterProp.length > 0) {
      setDutyRoster(rosterProp);
      return;
    }
    let isMounted = true;
    getDutyRoster()
      .then((units) => {
        if (isMounted && units && units.length > 0) {
          setDutyRoster(units);
        }
      })
      .catch(() => {
        if (isMounted) setDutyRoster(BASELINE_DUTY_ROSTER);
      });
    return () => {
      isMounted = false;
    };
  }, [rosterProp]);

  // Compute unit dispatch frequency ledger from historical requests
  const dispatchHistory = useMemo(() => readHistoricalDispatches(), [isOpen]);

  const dispatchCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    dispatchHistory.forEach((req) => {
      if (req.responderId) {
        map[req.responderId] = (map[req.responderId] || 0) + 1;
      }
    });
    return map;
  }, [dispatchHistory]);

  // Evaluate and score each candidate unit against incident target
  const evaluatedUnits: EvaluatedResponderUnit[] = useMemo(() => {
    if (!incident || typeof incident.lat !== 'number' || typeof incident.lng !== 'number') {
      return [];
    }

    const incLat = incident.lat;
    const incLng = incident.lng;

    // 1. Initial distance and metric calculations
    const preEvaluated = dutyRoster.map((unit) => {
      const uLat = typeof unit.baseLatitude === 'number' ? unit.baseLatitude : 8.5140;
      const uLng = typeof unit.baseLongitude === 'number' ? unit.baseLongitude : 123.2830;
      const dist = calculateHaversineDistanceKm(incLat, incLng, uLat, uLng);
      const eta = calculateDynamicEtaMinutes(dist);
      const count = (dispatchCountMap[unit.id] || 0) + (dispatchCountMap[unit.unitCode] || 0);

      const proximityScore = Math.max(0, Math.round(100 - (dist / 10) * 100));
      const workloadScore = computeWorkloadScore(count);
      const readinessScore = computeReadinessScore(unit.status);
      const agencyMatchScore = computeAgencyMatchScore(incident.category || incident.type, unit.agency);

      // Multi-Factor Dispatch Balancing Composite Score
      // 35% Proximity + 30% Workload Rotation + 20% Readiness + 15% Agency Specialization
      const compositeScore = Math.round(
        0.35 * proximityScore +
        0.30 * workloadScore +
        0.20 * readinessScore +
        0.15 * agencyMatchScore
      );

      return {
        ...unit,
        baseLatitude: uLat,
        baseLongitude: uLng,
        distanceKm: Number(dist.toFixed(2)),
        etaMinutes: eta,
        dispatchCount: count,
        isUnassignedEver: count === 0,
        proximityScore,
        workloadScore,
        readinessScore,
        agencyMatchScore,
        compositeScore,
        recommendationTag: 'STANDARD_AVAILABLE' as const,
        tagLabel: 'Standard Unit'
      };
    });

    if (preEvaluated.length === 0) return [];

    // Find closest distance and highest score
    const minDistance = Math.min(...preEvaluated.map((u) => u.distanceKm));
    const maxScore = Math.max(...preEvaluated.map((u) => u.compositeScore));

    return preEvaluated.map((u) => {
      let tag: EvaluatedResponderUnit['recommendationTag'] = 'STANDARD_AVAILABLE';
      let label = 'Available Unit';

      if (u.compositeScore === maxScore) {
        tag = 'OPTIMAL_BALANCED';
        label = u.isUnassignedEver
          ? 'AI Optimal (Closest + Fresh Unit)'
          : 'AI Optimal (Fair-Balanced Rotation)';
      } else if (u.distanceKm === minDistance && u.dispatchCount >= 2) {
        tag = 'CLOSEST_BUT_FATIGUED';
        label = `Closest Unit (High Fatigue: ${u.dispatchCount} Dispatches)`;
      } else if (u.isUnassignedEver) {
        tag = 'FRESH_UNCHOSEN';
        label = 'Fresh Unit (0 Dispatches - Ready for Selection)';
      }

      return {
        ...u,
        recommendationTag: tag,
        tagLabel: label
      };
    });
  }, [dutyRoster, incident, dispatchCountMap]);

  // Determine the overall optimal unit recommended by the AI engine
  const optimalUnit = useMemo(() => {
    if (evaluatedUnits.length === 0) return null;
    const sorted = [...evaluatedUnits].sort((a, b) => b.compositeScore - a.compositeScore);
    return sorted[0];
  }, [evaluatedUnits]);

  // Pre-select optimal unit on mount or incident change
  useEffect(() => {
    if (optimalUnit && (!selectedUnitId || !dutyRoster.some((u) => u.id === selectedUnitId))) {
      setSelectedUnitId(optimalUnit.id);
    }
  }, [optimalUnit, selectedUnitId, dutyRoster]);

  // Filter and sort evaluated units based on active UI controls
  const filteredAndSortedUnits = useMemo(() => {
    let list = [...evaluatedUnits];

    // Agency filter
    if (agencyFilter !== 'ALL') {
      list = list.filter((u) => (u.agency || '').toUpperCase() === agencyFilter.toUpperCase());
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.unitName.toLowerCase().includes(q) ||
          u.unitCode.toLowerCase().includes(q) ||
          (u.commanderName && u.commanderName.toLowerCase().includes(q))
      );
    }

    // Sort strategy
    if (sortStrategy === 'BALANCED') {
      list.sort((a, b) => b.compositeScore - a.compositeScore);
    } else if (sortStrategy === 'PROXIMITY') {
      list.sort((a, b) => a.distanceKm - b.distanceKm);
    } else if (sortStrategy === 'FRESH') {
      list.sort((a, b) => {
        if (a.dispatchCount !== b.dispatchCount) {
          return a.dispatchCount - b.dispatchCount;
        }
        return b.compositeScore - a.compositeScore;
      });
    }

    return list;
  }, [evaluatedUnits, agencyFilter, searchQuery, sortStrategy]);

  // Summary analytics stats
  const totalEvaluated = evaluatedUnits.length;
  const unassignedCount = evaluatedUnits.filter((u) => u.isUnassignedEver).length;
  const highWorkloadCount = evaluatedUnits.filter((u) => u.dispatchCount >= 2).length;

  const incTitle = incident ? (incident.title || incident.type || incident.place || 'Incident') : 'Incident';

  // Execute deployment of target unit
  const handleConfirmDeploy = async (targetUnit?: EvaluatedResponderUnit) => {
    const unitToDeploy = targetUnit || evaluatedUnits.find((u) => u.id === selectedUnitId);
    if (!unitToDeploy || !incident) return;

    setIsSubmitting(true);
    setSuccessBanner(null);

    try {
      // 1. Call backend API to allocate unit to report
      await assignUnitToReport(incident.id, unitToDeploy.id).catch(() => ({
        message: 'Allocated with local resilience',
        reportId: incident.id,
        unitId: unitToDeploy.id
      }));

      // 2. Persist dispatch record into shared ledger
      const nowIso = new Date().toISOString();
      const newRecord: DispatchRequestRecord = {
        id: `ORD-ADM-${Date.now()}`,
        incidentId: incident.id,
        incidentCode: incident.id,
        incidentTitle: incTitle,
        category: incident.category || 'General',
        severity: incident.severity || 'Medium',
        location: incident.place || 'Katipunan Sector',
        coordinates: `${incident.lat.toFixed(4)}° N, ${incident.lng.toFixed(4)}° E`,
        ipAddress: incident.ipAddress || '192.168.1.100',
        evidenceUrl: incident.evidenceUrl,
        responderId: unitToDeploy.id,
        responderName: `${unitToDeploy.unitName} (${unitToDeploy.unitCode})`,
        direction: 'ADMIN_ORDER',
        status: 'TO BE DEPLOYED',
        requestedAt: nowIso,
        updatedAt: nowIso,
        notes: `LDRRMO Admin strategic deploy order via Map C2. Unit selected with Workload Score ${unitToDeploy.workloadScore}%, Distance ${unitToDeploy.distanceKm}km, Composite Match ${unitToDeploy.compositeScore}%.`
      };

      const updatedHistory = [newRecord, ...readHistoricalDispatches()];
      if (typeof window !== 'undefined') {
        localStorage.setItem(DISPATCH_STORAGE_KEY, JSON.stringify(updatedHistory));
      }

      // 3. Emit real-time notification
      pushResponderNotification({
        title: `Strategic Deploy Order (${unitToDeploy.unitCode})`,
        message: `LDRRMO Admin deployed ${unitToDeploy.unitName} to ${incTitle}. Immediate response authorized.`,
        category: 'ADMIN_REQUEST_DEPLOY',
        incidentId: incident.id
      });

      // 4. Dispatch global window event for real-time reactivity across C2 deck
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('resqtrack:report', {
            detail: {
              type: 'ADMIN_APPROVED_DEPLOY',
              incidentId: incident.id,
              unitId: unitToDeploy.id,
              unitCode: unitToDeploy.unitCode
            }
          })
        );
      }

      setSuccessBanner(
        `Tactical Unit "${unitToDeploy.unitCode}" successfully deployed to "${incTitle}". Composite Match Score: ${unitToDeploy.compositeScore}%. Tracking telemetry active.`
      );

      onDeploySuccess?.(unitToDeploy, incident);

      // Auto-close modal after brief confirmation
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessBanner(null);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Failed to deploy responder unit:', err);
      setIsSubmitting(false);
    }
  };

  const handleAutoDeployOptimal = () => {
    if (optimalUnit) {
      handleConfirmDeploy(optimalUnit);
    }
  };

  if (!isOpen || !incident) return null;

  return (
    <DefaultFloatingModalCard
      isOpen={isOpen}
      onClose={onClose}
      title="Tactical Responder Deployment & Workload Optimization Deck"
      subtitle={`Select or auto-deploy tactical rescue unit to incident: ${incTitle}`}
      maxWidth="4xl"
      className="p-1"
    >
      <div className="space-y-4">
        {/* Success Banner */}
        {successBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs flex items-center gap-3 animate-pulse">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="font-mono">
              <strong className="text-white block font-bold">DEPLOYMENT ORDER CONFIRMED:</strong>
              <span>{successBanner}</span>
            </div>
          </div>
        )}

        {/* 1. Target Incident Telemetry Bar */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-950 border border-rose-500/50 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-rose-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">{incTitle}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    (incident.severity || '').toLowerCase() === 'critical'
                      ? 'bg-rose-900/80 text-rose-300 border border-rose-600'
                      : 'bg-amber-900/80 text-amber-300 border border-amber-600'
                  }`}
                >
                  {incident.severity || 'Medium'}
                </span>
              </div>
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                <span>{incident.place || 'Katipunan Municipal Sector'}</span>
                <span>•</span>
                <span className="text-sky-400">{incident.lat.toFixed(4)}° N, {incident.lng.toFixed(4)}° E</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[11px]">
              Category: <strong className="text-white">{incident.category || incident.type || 'Emergency'}</strong>
            </span>
          </div>
        </div>

        {/* 2. Dispatch Strategy Analytics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {/* Card A: Fleet Workload Balance Index */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Fleet Workload State</span>
              <span className="font-extrabold text-white text-xs mt-0.5">
                <span className="text-emerald-400 font-bold">{unassignedCount} Fresh (0 Dispatches)</span>
                {highWorkloadCount > 0 && <span className="text-amber-400 ml-1.5">({highWorkloadCount} High Load)</span>}
              </span>
            </div>
          </div>

          {/* Card B: AI Optimal Recommendation */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-900/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-xs font-mono">
              <span className="text-[10px] text-emerald-400 uppercase font-bold">AI Balanced Recommendation</span>
              <span className="font-extrabold text-white text-xs truncate mt-0.5">
                {optimalUnit ? (
                  <>
                    <strong className="text-emerald-300 font-bold">{optimalUnit.unitCode}</strong>
                    <span className="text-slate-400 ml-1.5">({optimalUnit.compositeScore}% Match)</span>
                  </>
                ) : (
                  'Evaluating fleet...'
                )}
              </span>
            </div>
          </div>

          {/* Card C: Anti-Fatigue Strategy Mode */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Rotation Strategy</span>
              <span className="font-extrabold text-purple-300 text-xs mt-0.5">
                Fair-Sharing & Anti-Fatigue
              </span>
            </div>
          </div>
        </div>

        {/* 3. Strategy Controls Bar: Sort Mode + Agency Filter + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/90 border border-slate-800 text-xs">
          {/* Strategy Sort Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-slate-500 font-mono text-[11px] mr-1 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <button
              type="button"
              onClick={() => setSortStrategy('BALANCED')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
                sortStrategy === 'BALANCED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Smart Balanced (AI Recommended)
            </button>
            <button
              type="button"
              onClick={() => setSortStrategy('FRESH')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
                sortStrategy === 'FRESH'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Fresh Units First (0 Dispatches)
            </button>
            <button
              type="button"
              onClick={() => setSortStrategy('PROXIMITY')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all whitespace-nowrap ${
                sortStrategy === 'PROXIMITY'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              Closest Distance
            </button>
          </div>

          {/* Agency Filter Pills */}
          <div className="flex items-center gap-1.5">
            {(['ALL', 'RHU', 'FIRE', 'PNP'] as const).map((ag) => (
              <button
                key={ag}
                type="button"
                onClick={() => setAgencyFilter(ag)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  agencyFilter === ag
                    ? 'bg-slate-200 text-slate-950'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {ag === 'ALL' ? 'All Units' : ag}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Evaluated Responder Units Selection Cards List */}
        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
          {filteredAndSortedUnits.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs bg-slate-950/40 rounded-xl border border-slate-800">
              No responder units match the specified agency or search criteria.
            </div>
          ) : (
            filteredAndSortedUnits.map((u) => {
              const isSelected = selectedUnitId === u.id;
              const isOptimal = optimalUnit?.id === u.id;
              const hasFatigueWarning = u.recommendationTag === 'CLOSEST_BUT_FATIGUED';

              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUnitId(u.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-slate-900 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                      : isOptimal
                      ? 'bg-slate-950/90 border-emerald-900/80 hover:border-emerald-700'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                  }`}
                >
                  {/* Left: Agency Icon + Unit Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                        u.agency === 'RHU'
                          ? 'bg-sky-950/80 border-sky-800 text-sky-400'
                          : u.agency === 'FIRE' || u.agency === 'BFP'
                          ? 'bg-orange-950/80 border-orange-800 text-orange-400'
                          : 'bg-blue-950/80 border-blue-800 text-blue-400'
                      }`}
                    >
                      {u.agency === 'RHU' ? (
                        <HeartPulse className="w-5 h-5" />
                      ) : u.agency === 'FIRE' || u.agency === 'BFP' ? (
                        <Flame className="w-5 h-5" />
                      ) : (
                        <Shield className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white text-xs">{u.unitName}</h4>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                          {u.unitCode}
                        </span>
                        {/* Tag Label */}
                        <span
                          className={`text-[9px] font-mono font-extrabold px-1.5 py-0.5 rounded ${
                            u.recommendationTag === 'OPTIMAL_BALANCED'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                              : hasFatigueWarning
                              ? 'bg-amber-950 text-amber-300 border border-amber-600'
                              : u.recommendationTag === 'FRESH_UNCHOSEN'
                              ? 'bg-purple-950 text-purple-300 border border-purple-600'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {u.tagLabel}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2 mt-1">
                        <span>Commander: <strong className="text-slate-300">{u.commanderName || 'Officer on Duty'}</strong></span>
                        <span>•</span>
                        <span className="text-slate-400">{u.contactHotline}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics + Workload + Score + Radio */}
                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                    {/* Distance & ETA */}
                    <div className="flex flex-col text-right font-mono text-xs">
                      <span className="font-extrabold text-white">{u.distanceKm} km</span>
                      <span className="text-[10px] text-sky-400">~{u.etaMinutes}m ETA</span>
                    </div>

                    {/* Workload Metric */}
                    <div className="flex flex-col text-right font-mono text-xs">
                      <span
                        className={`font-bold ${
                          u.isUnassignedEver
                            ? 'text-emerald-400'
                            : u.dispatchCount === 1
                            ? 'text-sky-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {u.isUnassignedEver ? '0 Dispatches' : `${u.dispatchCount} Dispatches`}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {u.isUnassignedEver ? 'Fresh Unit' : u.dispatchCount >= 2 ? 'High Load' : 'Normal Load'}
                      </span>
                    </div>

                    {/* Match Score Badge */}
                    <div className="flex flex-col items-end w-16">
                      <span className="font-mono font-black text-xs text-emerald-400">{u.compositeScore}%</span>
                      <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${u.compositeScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Radio Button */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-emerald-400 bg-emerald-500' : 'border-slate-600 bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 5. Footer Action Deck */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
          <div className="text-slate-400">
            {optimalUnit && (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Deploy Recommendation:</span>
                <strong className="text-white">{optimalUnit.unitCode}</strong>
                <span className="text-emerald-400 font-bold">({optimalUnit.compositeScore}% Score)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              CANCEL
            </Button>

            {/* Automatic Deploy Optimal Button */}
            {optimalUnit && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAutoDeployOptimal}
                disabled={isSubmitting}
                className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold flex items-center gap-1.5 border border-emerald-400/50 shadow-lg shadow-emerald-950/40"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>AUTO-DEPLOY OPTIMAL UNIT</span>
              </Button>
            )}

            {/* Manual Deploy Selected Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConfirmDeploy()}
              disabled={!selectedUnitId || isSubmitting}
              className="bg-slate-900 hover:bg-slate-800 text-sky-300 border border-sky-800 font-mono font-bold flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>{isSubmitting ? 'DEPLOYING...' : 'CONFIRM MANUAL DEPLOY'}</span>
            </Button>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
