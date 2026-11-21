// [Layer: UserRoles/Features/Pages/AdminsPanel/Shared]
// Responsibility: Shared Stitch Clay style tokens, Katipunan barangay list, status badge formatter,
// and getStandbyAutoDispatch helper wired to ClaudeAutoDispatchResponderStrategy (/api/standby-ai/auto-dispatch-responder)
// with deterministic Haversine nearest-unit ranking fallback.
// Strictly 100% arrow functions (=>), ZERO 'any', ZERO emojis.

import { requestJson } from '@/Endpoints/apiClient';
import { DutyUnit } from '@/Endpoints/responderOpsApi';
import {
  calculateHaversineDistanceKm,
  calculateDynamicEtaMinutes,
  KATIPUNAN_BASE_COORDS
} from '@/Libs/Map/mapAccuracy';

export const KATIPUNAN_BARANGAYS_LIST: readonly string[] = [
  'Barangay Uno (Poblacion)',
  'Barangay Dos (Poblacion)',
  'Barangay Daanglungsod',
  'Barangay San Antonio',
  'Barangay Tuburan',
  'Barangay Balok',
  'Barangay Basagan',
  'Barangay Biniray',
  'Barangay Bulawan',
  'Barangay Carupay',
  'Barangay Dabiak',
  'Barangay Dr. Jose Rizal',
  'Barangay Fimagas',
  'Barangay Loyuran',
  'Barangay Malasay',
  'Barangay Malugas',
  'Barangay Matam',
  'Barangay Mias',
  'Barangay Miatan',
  'Barangay Nanginan',
  'Barangay New Tambo',
  'Barangay Patagan',
  'Barangay San Vicente',
  'Barangay Sanao',
  'Barangay Santo Tomas',
  'Barangay Seres',
  'Barangay Seroan',
  'Barangay Sinuyak',
  'Barangay Sitog'
];

export const CLAY_SURFACE =
  'clay-surface rounded-2xl bg-[#F7F1EA] text-[#670626] border border-[#670626]/15 shadow-[0_16px_38px_rgba(74,4,26,0.24),inset_0_1px_0_rgba(255,255,255,0.85)]';

export const CLAY_WELL =
  'clay-well rounded-xl bg-[#E9D9D0] text-[#670626] border border-[#670626]/15 shadow-inner';

export const CLAY_BUTTON_CHERRY =
  'clay-button-cherry bg-[#670626] hover:bg-[#4A041A] active:bg-[#4A041A] text-[#F7F1EA] border border-[#670626] shadow-[0_6px_18px_rgba(74,4,26,0.32)]';

export const CLAY_INPUT =
  'w-full bg-[#E9D9D0]/75 border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#670626] placeholder-[#A83B4D]/75 focus:outline-none focus:border-[#670626] focus:bg-[#F7F1EA] transition-colors';

export const CLAY_SELECT =
  'w-full bg-[#E9D9D0]/75 border border-[#670626]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#670626] font-semibold focus:outline-none focus:border-[#670626] focus:bg-[#F7F1EA] transition-colors';

export interface IncidentStatusDisplay {
  label: 'Submitted' | 'Pending' | 'Verified' | 'Dispatched' | 'Resolved' | 'Rejected';
  pillClass: string;
}

export const formatIncidentStatusBadge = (
  status?: string | null,
  allocatedUnitCode?: string | null,
  verifiedAt?: string | null,
  resolvedAt?: string | null
): IncidentStatusDisplay => {
  const raw = (status || 'Reported').trim().toUpperCase();

  if (raw === 'REJECTED' || raw === 'DECLINED') {
    return {
      label: 'Rejected',
      pillClass: 'bg-[#670626] text-[#F7F1EA] border border-[#670626]'
    };
  }
  if (raw === 'RESOLVED' || raw === 'CLOSED' || raw === 'COMPLETED' || Boolean(resolvedAt)) {
    return {
      label: 'Resolved',
      pillClass: 'bg-emerald-100 text-emerald-900 border border-emerald-700/30'
    };
  }
  if (
    raw === 'ALLOCATED' ||
    raw === 'ENROUTE' ||
    raw === 'ONSCENE' ||
    raw === 'DISPATCHED' ||
    Boolean(allocatedUnitCode)
  ) {
    return {
      label: 'Dispatched',
      pillClass: 'bg-[#A83B4D] text-[#F7F1EA] border border-[#A83B4D]'
    };
  }
  if (raw === 'VERIFIED' || raw === 'RESPONDED' || Boolean(verifiedAt)) {
    return {
      label: 'Verified',
      pillClass: 'bg-[#670626]/15 text-[#670626] border border-[#670626]/35'
    };
  }
  if (raw === 'PENDING') {
    return {
      label: 'Pending',
      pillClass: 'bg-amber-100 text-amber-900 border border-amber-700/30'
    };
  }
  return {
    label: 'Submitted',
    pillClass: 'bg-[#E9D9D0] text-[#670626] border border-[#A83B4D]/45'
  };
};

export interface StandbyAutoDispatchRequest {
  incidentId?: number;
  incidentLat: number;
  incidentLng: number;
  incidentType?: string;
  severity?: string;
  requiredAgencyType?: string;
  applyDispatch?: boolean;
}

export interface StandbyCandidateScore {
  responderUnitId: number;
  unitCode: string;
  unitName: string;
  agencyType: string;
  distanceKm: number;
  historicalDispatchCount: number;
  neverChosenBefore: boolean;
  proximityScore: number;
  fairnessRotationScore: number;
  workloadScore: number;
  compositeScore: number;
  selectionReason: string;
}

export interface StandbyAutoDispatchApiResponse {
  success: boolean;
  strategyName: string;
  providerUsed: string;
  incidentId: number;
  selectedUnit: StandbyCandidateScore | null;
  rankedCandidates: StandbyCandidateScore[];
  tacticalAiReasoning: string;
  evaluatedAtUtc: string;
}

export interface RankedAvailableUnit {
  unit: DutyUnit;
  distanceKm: number;
  etaMinutes: number;
  compositeScore: number;
  neverChosenBefore: boolean;
  selectionReason: string;
}

export interface StandbyAutoDispatchOutput {
  providerUsed: string;
  tacticalAiReasoning: string;
  rankedUnits: RankedAvailableUnit[];
  selectedUnit: RankedAvailableUnit | null;
}

const buildLocalHaversineRanking = (
  lat: number,
  lng: number,
  roster: DutyUnit[],
  requiredAgencyType?: string
): RankedAvailableUnit[] => {
  const safeLat = typeof lat === 'number' && !isNaN(lat) && lat !== 0 ? lat : KATIPUNAN_BASE_COORDS.latitude;
  const safeLng = typeof lng === 'number' && !isNaN(lng) && lng !== 0 ? lng : KATIPUNAN_BASE_COORDS.longitude;

  const activePool = roster.filter(
    (u) =>
      u.status !== 'OffDuty' &&
      typeof u.baseLatitude === 'number' &&
      typeof u.baseLongitude === 'number'
  );
  const pool = activePool.length > 0 ? activePool : roster;

  const agencyUpper = (requiredAgencyType || '').toUpperCase();
  const ranked = pool.map((unit) => {
    const distanceKm = calculateHaversineDistanceKm(safeLat, safeLng, unit.baseLatitude, unit.baseLongitude);
    const etaMinutes = calculateDynamicEtaMinutes(distanceKm);
    const agencyMatch = agencyUpper && (unit.agency || '').toUpperCase().includes(agencyUpper) ? 15 : 0;
    const statusBoost = unit.status === 'OnDuty' || unit.status === 'Standby' ? 20 : 5;
    const compositeScore = Number((Math.max(0, 100 - distanceKm * 6) + agencyMatch + statusBoost).toFixed(2));
    return {
      unit,
      distanceKm,
      etaMinutes,
      compositeScore,
      neverChosenBefore: unit.status === 'Standby',
      selectionReason: `${unit.unitCode} (${unit.agency}) · ${distanceKm} km away (~${etaMinutes}m ETA)`
    };
  });

  ranked.sort((a, b) => a.distanceKm - b.distanceKm);
  return ranked;
};

export const getStandbyAutoDispatch = async (
  req: StandbyAutoDispatchRequest,
  roster: DutyUnit[]
): Promise<StandbyAutoDispatchOutput> => {
  const localRanked = buildLocalHaversineRanking(
    req.incidentLat,
    req.incidentLng,
    roster,
    req.requiredAgencyType
  );

  try {
    const apiRes = await requestJson<StandbyAutoDispatchApiResponse>(
      '/api/standby-ai/auto-dispatch-responder',
      {
        method: 'POST',
        body: JSON.stringify({
          incidentId: req.incidentId ?? 0,
          incidentLat: req.incidentLat,
          incidentLng: req.incidentLng,
          incidentType: req.incidentType,
          severity: req.severity,
          requiredAgencyType: req.requiredAgencyType,
          applyDispatch: Boolean(req.applyDispatch)
        })
      }
    );

    if (apiRes && Array.isArray(apiRes.rankedCandidates) && apiRes.rankedCandidates.length > 0) {
      const merged: RankedAvailableUnit[] = apiRes.rankedCandidates.map((cand) => {
        const matchedRoster = roster.find(
          (u) => u.unitCode.toLowerCase() === cand.unitCode.toLowerCase()
        );
        const fallbackUnit: DutyUnit = matchedRoster || {
          id: String(cand.responderUnitId),
          unitCode: cand.unitCode,
          unitName: cand.unitName,
          agency: cand.agencyType,
          commanderName: 'Duty Commander',
          status: 'OnDuty',
          baseLatitude: req.incidentLat,
          baseLongitude: req.incidentLng,
          contactHotline: '',
          activePersonnelCount: 4,
          shiftSchedule: '24h Standard',
          updatedAt: apiRes.evaluatedAtUtc || new Date().toISOString()
        };
        const dist = Number(cand.distanceKm.toFixed(2));
        return {
          unit: fallbackUnit,
          distanceKm: dist,
          etaMinutes: calculateDynamicEtaMinutes(dist),
          compositeScore: cand.compositeScore,
          neverChosenBefore: cand.neverChosenBefore,
          selectionReason: cand.selectionReason
        };
      });

      // Ensure list is sorted by distance (km) ascending for Nearby Available Units display
      merged.sort((a, b) => a.distanceKm - b.distanceKm);

      return {
        providerUsed: apiRes.providerUsed || 'ClaudeAutoDispatchResponderStrategy',
        tacticalAiReasoning: apiRes.tacticalAiReasoning || 'Ranked by Haversine distance and readiness.',
        rankedUnits: merged,
        selectedUnit: merged[0] || null
      };
    }
  } catch {
    // Graceful Haversine fallback when offline or wire server does not mount standby-ai
  }

  return {
    providerUsed: 'HaversineProximityRanker',
    tacticalAiReasoning: 'Ranked active units by great-circle Haversine distance (km) from incident.',
    rankedUnits: localRanked,
    selectedUnit: localRanked[0] || null
  };
};
