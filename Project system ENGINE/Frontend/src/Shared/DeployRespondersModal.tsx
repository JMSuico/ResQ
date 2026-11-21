// [Layer: Shared]
// DeployRespondersModal.tsx -- Tactical Multi-Agency Responder Deployment & Workload Optimization Modal.
// Provides both Automatic Intelligent Dispatch and Manual Override Deployment for Katipunan C2 Admin.
// Integrates Multi-Factor Dispatch Balancing Algorithm (MF-DBA):
// Combines physical GPS proximity, dynamic travel ETA, agency specialization, and fair-sharing workload rotation
// to penalize over-selected units and prioritize fresh units that have not been chosen yet.
// Strictly 100% arrow functions (=>), ZERO 'any', and ZERO emojis.

import React, { FC, useState, useMemo, useEffect } from 'react';
import {
  Send,
  Zap,
  Sparkles,
  MapPin,
  Shield,
  Flame,
  HeartPulse,
  Activity,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Check
} from 'lucide-react';
import { DefaultFloatingModalCard } from './DefaultFloatingModalCard';
import { Button } from './Button';
import { calculateHaversineDistanceKm, calculateDynamicEtaMinutes } from '@/Libs/Map/mapAccuracy';
import {
  DutyUnit,
  getDutyRoster,
  getDispatchRequests,
  createMedicDispatchRequest,
  DispatchRequestRecord
} from '@/Endpoints/responderOpsApi';
import { assignUnitToReport } from '@/Endpoints/reportsApi';
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
  const [dutyRoster, setDutyRoster] = useState<DutyUnit[]>(rosterProp || []);
  const [dispatchHistory, setDispatchHistory] = useState<DispatchRequestRecord[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [sortStrategy, setSortStrategy] = useState<'BALANCED' | 'PROXIMITY' | 'FRESH'>('BALANCED');
  const [agencyFilter, setAgencyFilter] = useState<string>('ALL');
  const [searchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Sync duty roster and dispatch history from real PostgreSQL APIs
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setErrorBanner(null);

    if (rosterProp && rosterProp.length > 0) {
      setDutyRoster(rosterProp);
    } else {
      getDutyRoster()
        .then((units) => {
          if (isMounted) setDutyRoster(Array.isArray(units) ? units : []);
        })
        .catch((err: unknown) => {
          if (isMounted) {
            setDutyRoster([]);
            setErrorBanner(err instanceof Error ? err.message : 'Failed to load responder duty roster.');
          }
        });
    }

    getDispatchRequests()
      .then((records) => {
        if (isMounted) setDispatchHistory(Array.isArray(records) ? records : []);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setDispatchHistory([]);
          setErrorBanner((prev) => prev || (err instanceof Error ? err.message : 'Failed to load dispatch telemetry.'));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, rosterProp]);

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
        tagLabel: 'Available'
      };
    });

    if (preEvaluated.length === 0) return [];

    // Find closest distance and highest score
    const minDistance = Math.min(...preEvaluated.map((u) => u.distanceKm));
    const maxScore = Math.max(...preEvaluated.map((u) => u.compositeScore));

    return preEvaluated.map((u) => {
      let tag: EvaluatedResponderUnit['recommendationTag'] = 'STANDARD_AVAILABLE';
      let label = 'Available';

      if (u.compositeScore === maxScore) {
        tag = 'OPTIMAL_BALANCED';
        label = 'Optimal';
      } else if (u.distanceKm === minDistance && u.dispatchCount >= 2) {
        tag = 'CLOSEST_BUT_FATIGUED';
        label = 'High Load';
      } else if (u.isUnassignedEver) {
        tag = 'FRESH_UNCHOSEN';
        label = 'Fresh';
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
    setErrorBanner(null);

    try {
      // 1. Call backend API to allocate unit to report
      await assignUnitToReport(incident.id, unitToDeploy.id);

      // 2. Persist dispatch order into PostgreSQL via POST /api/dispatch-requests
      const createdOrder = await createMedicDispatchRequest({
        incidentId: incident.id,
        incidentCode: incident.id,
        incidentTitle: incTitle,
        category: incident.category || 'General',
        severity: incident.severity || 'Medium',
        location: incident.place || 'Katipunan Sector',
        coordinates: `${incident.lat.toFixed(4)}° N, ${incident.lng.toFixed(4)}° E`,
        latitude: incident.lat,
        longitude: incident.lng,
        ipAddress: incident.ipAddress,
        evidenceUrl: incident.evidenceUrl,
        responderId: unitToDeploy.id,
        targetUnit: unitToDeploy.unitCode,
        originUnit: 'LDRRMO',
        responderName: `${unitToDeploy.unitName} (${unitToDeploy.unitCode})`,
        direction: 'ADMIN_ORDER',
        status: 'TO BE DEPLOYED',
        notes: `Dispatched via Map C2. Match: ${unitToDeploy.compositeScore}%, Dist: ${unitToDeploy.distanceKm}km.`
      });

      setDispatchHistory((prev) => [createdOrder, ...prev]);

      // 3. Dispatch global window event for real-time reactivity across C2 deck
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
        `${unitToDeploy.unitCode} deployed to ${incTitle} (${unitToDeploy.compositeScore}% match).`
      );

      onDeploySuccess?.(unitToDeploy, incident);

      // Auto-close modal after brief confirmation
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessBanner(null);
        onClose();
      }, 1400);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to deploy responder unit.');
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
      subtitle={`Deploy unit to ${incTitle}`}
      maxWidth="4xl"
      className="p-1"
    >
      <div className="space-y-4">
        {/* Error Banner */}
        {errorBanner && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-[#991B1B] text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-[#991B1B] shrink-0" />
            <span className="font-mono font-semibold">{errorBanner}</span>
          </div>
        )}

        {/* Success Banner */}
        {successBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-emerald-900 text-sm flex items-center gap-3 animate-pulse">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            <div className="font-mono">
              <strong className="text-emerald-950 block font-bold">DEPLOYMENT ORDER CONFIRMED:</strong>
              <span>{successBanner}</span>
            </div>
          </div>
        )}

        {/* 1. Target Incident Telemetry Bar */}
        <div className="p-3.5 rounded-xl bg-[#E9D9D0]/65 border border-[#D8C1B5] flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm font-mono">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#670626]/12 border border-[#A83B4D]/40 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-[#670626]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#3B1722] text-base">{incTitle}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-bold uppercase ${
                    (incident.severity || '').toLowerCase() === 'critical'
                      ? 'bg-rose-100 text-[#991B1B] border border-rose-300'
                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                  }`}
                >
                  {incident.severity || 'Medium'}
                </span>
              </div>
              <span className="text-[#7A4E59] text-xs flex items-center gap-1.5 mt-0.5">
                <span>{incident.place || 'Katipunan Municipal Sector'}</span>
                <span>•</span>
                <span className="text-[#670626] font-bold">{incident.lat.toFixed(4)}° N, {incident.lng.toFixed(4)}° E</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-[#F7F1EA] border border-[#D4B8AA] text-[#5C313E] text-xs">
              Category: <strong className="text-[#670626]">{incident.category || incident.type || 'Emergency'}</strong>
            </span>
          </div>
        </div>

        {/* 2. Dispatch Strategy Analytics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Card A: Fleet Workload Balance Index */}
          <div className="p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F7F1EA] border border-[#D4B8AA] flex items-center justify-center text-[#670626] shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-sm font-mono">
              <span className="text-xs text-[#7A4E59] uppercase font-bold">Fleet Workload State</span>
              <span className="font-extrabold text-[#3B1722] text-sm mt-0.5">
                <span className="text-emerald-700 font-bold">{unassignedCount} Fresh</span>
                {highWorkloadCount > 0 && <span className="text-amber-800 ml-1.5">({highWorkloadCount} High Load)</span>}
              </span>
            </div>
          </div>

          {/* Card B: AI Optimal Recommendation */}
          <div className="p-3 rounded-xl bg-emerald-50/90 border border-emerald-300 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700 shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="flex flex-col text-sm font-mono min-w-0">
              <span className="text-xs text-emerald-800 uppercase font-bold">AI Balanced Recommendation</span>
              <span className="font-extrabold text-[#3B1722] text-sm truncate mt-0.5">
                {optimalUnit ? (
                  <>
                    <strong className="text-emerald-800 font-bold">{optimalUnit.unitCode}</strong>
                    <span className="text-[#5C313E] ml-1.5">({optimalUnit.compositeScore}% · {optimalUnit.distanceKm} km)</span>
                  </>
                ) : (
                  'Evaluating...'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Strategy Controls Bar: Sort Mode + Agency Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl bg-[#E9D9D0]/60 border border-[#D8C1B5] text-sm">
          {/* Strategy Sort Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <span className="text-[#7A4E59] font-mono text-xs mr-1 flex items-center gap-1 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>Sort:</span>
            </span>
            <button
              type="button"
              onClick={() => setSortStrategy('BALANCED')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                sortStrategy === 'BALANCED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-[#F7F1EA] text-[#5C313E] hover:text-[#670626] border border-[#D4B8AA]'
              }`}
            >
              Smart Balanced
            </button>
            <button
              type="button"
              onClick={() => setSortStrategy('FRESH')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                sortStrategy === 'FRESH'
                  ? 'bg-[#A83B4D] text-white shadow-sm'
                  : 'bg-[#F7F1EA] text-[#5C313E] hover:text-[#670626] border border-[#D4B8AA]'
              }`}
            >
              Fresh First
            </button>
            <button
              type="button"
              onClick={() => setSortStrategy('PROXIMITY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap cursor-pointer ${
                sortStrategy === 'PROXIMITY'
                  ? 'bg-[#670626] text-[#F7F1EA] shadow-sm'
                  : 'bg-[#F7F1EA] text-[#5C313E] hover:text-[#670626] border border-[#D4B8AA]'
              }`}
            >
              Closest
            </button>
          </div>

          {/* Agency Filter Pills */}
          <div className="flex items-center gap-1.5">
            {(['ALL', 'RHU', 'FIRE', 'PNP'] as const).map((ag) => (
              <button
                key={ag}
                type="button"
                onClick={() => setAgencyFilter(ag)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  agencyFilter === ag
                    ? 'bg-[#670626] text-[#F7F1EA]'
                    : 'bg-[#F7F1EA] text-[#5C313E] hover:text-[#670626] border border-[#D4B8AA]'
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
            <div className="p-8 text-center text-[#7A4E59] font-mono text-sm bg-[#E9D9D0]/45 rounded-xl border border-[#D8C1B5]">
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
                      ? 'bg-[#FFFBF7] border-emerald-600 shadow-[0_6px_18px_-4px_rgba(5,150,105,0.25)] ring-1 ring-emerald-500/40'
                      : isOptimal
                      ? 'bg-emerald-50/70 border-emerald-400 hover:border-emerald-600'
                      : 'bg-[#E9D9D0]/50 border-[#D8C1B5] hover:border-[#A83B4D] hover:bg-[#E9D9D0]/75'
                  }`}
                >
                  {/* Left: Agency Icon + Unit Info */}
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                        u.agency === 'RHU'
                          ? 'bg-sky-100 border-sky-300 text-sky-700'
                          : u.agency === 'FIRE' || u.agency === 'BFP'
                          ? 'bg-orange-100 border-orange-300 text-orange-700'
                          : 'bg-blue-100 border-blue-300 text-blue-700'
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
                        <h4 className="font-bold text-[#3B1722] text-sm">{u.unitName}</h4>
                        <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#F7F1EA] border border-[#D4B8AA] text-[#670626] font-bold">
                          {u.unitCode}
                        </span>
                        {/* Tag Label */}
                        <span
                          className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded ${
                            u.recommendationTag === 'OPTIMAL_BALANCED'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : hasFatigueWarning
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : u.recommendationTag === 'FRESH_UNCHOSEN'
                              ? 'bg-[#F3E4E7] text-[#670626] border border-[#A83B4D]/40'
                              : 'bg-[#F7F1EA] text-[#5C313E] border border-[#D4B8AA]'
                          }`}
                        >
                          {u.tagLabel}
                        </span>
                      </div>

                      <div className="text-xs font-mono text-[#7A4E59] flex items-center gap-2 mt-1 flex-wrap">
                        <span>Commander: <strong className="text-[#3B1722]">{u.commanderName || 'Officer on Duty'}</strong></span>
                        <span>•</span>
                        <span>Status: <strong className="text-emerald-800">{u.status || 'OnDuty'}</strong></span>
                        <span>•</span>
                        <span className="text-[#670626] font-bold">{u.distanceKm} km away</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Metrics + Workload + Score + Radio */}
                  <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end">
                    {/* Distance & ETA */}
                    <div className="flex flex-col text-right font-mono text-sm">
                      <span className="font-extrabold text-[#3B1722]">{u.distanceKm} km</span>
                      <span className="text-xs text-[#A83B4D] font-bold">~{u.etaMinutes}m ETA</span>
                    </div>

                    {/* Workload Metric */}
                    <div className="flex flex-col text-right font-mono text-sm">
                      <span
                        className={`font-bold ${
                          u.isUnassignedEver
                            ? 'text-emerald-700'
                            : u.dispatchCount === 1
                            ? 'text-[#670626]'
                            : 'text-amber-800'
                        }`}
                      >
                        {u.isUnassignedEver ? '0 Dispatches' : `${u.dispatchCount} Dispatches`}
                      </span>
                      <span className="text-xs text-[#7A4E59]">
                        {u.isUnassignedEver ? 'Fresh' : u.dispatchCount >= 2 ? 'High Load' : 'Normal'}
                      </span>
                    </div>

                    {/* Match Score Badge */}
                    <div className="flex flex-col items-end w-16">
                      <span className="font-mono font-black text-sm text-emerald-700">{u.compositeScore}%</span>
                      <div className="w-full bg-[#D8C1B5] h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className="bg-emerald-600 h-full rounded-full transition-all"
                          style={{ width: `${u.compositeScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Radio Button */}
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-[#A83B4D]/50 bg-[#FFFBF7]'
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E9D9D0] text-sm font-mono">
          <div className="text-[#5C313E]">
            {optimalUnit && (
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                <span>Recommended: <strong className="text-[#3B1722]">{optimalUnit.unitCode}</strong></span>
                <span className="text-emerald-700 font-bold">({optimalUnit.compositeScore}%)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>

            {/* Automatic Deploy Optimal Button */}
            {optimalUnit && (
              <Button
                variant="action-green"
                size="sm"
                onClick={handleAutoDeployOptimal}
                disabled={isSubmitting}
                className="font-mono font-bold flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>AUTO-DEPLOY OPTIMAL UNIT</span>
              </Button>
            )}

            {/* Manual Deploy Selected Button */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleConfirmDeploy()}
              disabled={!selectedUnitId || isSubmitting}
              className="font-mono font-bold flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5 text-[#F7F1EA]" />
              <span>{isSubmitting ? 'Deploying...' : 'Deploy Selected'}</span>
            </Button>
          </div>
        </div>
      </div>
    </DefaultFloatingModalCard>
  );
};
