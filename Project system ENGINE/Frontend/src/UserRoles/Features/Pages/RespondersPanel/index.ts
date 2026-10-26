// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Dynamic agency sub-routing, domain page resolvers, and barrel re-exports
// for RHU Medic, BFP Fire Rescue, and PNP Police Force.

import React from 'react';
import { useSession } from '@/Hooks/useSession';

// ============================================================================
// Specialized Domain Module Re-Exports
// ============================================================================
export * from './Medic';
export * from './Fire';
export * from './Police';

// Explicit re-exports from Shared to prevent TS2308 ambiguity
export {
  ResponderButton,
  ResponderModalCard,
  TacticalFieldStatusBar,
  CivilianEvidenceModal,
  OfficerDistressModal
} from './Shared';

export type {
  CivilianEvidenceModalProps,
  TacticalFieldStatusBarProps
} from './Shared';

// ============================================================================
// Baseline / Fallback Pages Re-Exports
// ============================================================================
export * from './ResponderDashboard';
export * from './UnitIncidentsFeed';
export * from './DutyRosterView';
export * from './MyReportsPage';
export * from './ResponderAlerts';
export * from './ResponderProfile';

// Import domain pages for resolver mounting
import {
  EmsTraumaDashboard,
  PatientCareRecordPage,
  MedicCrewRosterPage,
  MedicProfilePage
} from './Medic';

import {
  FireCommandDashboard,
  FireAarReportsPage,
  FireApparatusRosterPage
} from './Fire';

import {
  PolicePatrolDashboard,
  PoliceBlotterPage,
  PolicePatrolRosterPage,
  OfficerArmoryProfilePage
} from './Police';

import { ResponderDashboard } from './ResponderDashboard';
import { UnitIncidentsFeed } from './UnitIncidentsFeed';
import { DutyRosterView } from './DutyRosterView';
import { MyReportsPage } from './MyReportsPage';
import { ResponderProfile } from './ResponderProfile';

/**
 * Resolves normalized agency unit from active session or localStorage fallback.
 */
const resolveUnit = (sessionUnit?: string): string => {
  if (sessionUnit && sessionUnit !== 'None') {
    return sessionUnit.toUpperCase();
  }
  try {
    const raw = typeof window !== 'undefined'
      ? (localStorage.getItem('resqtrack_session') || localStorage.getItem('resqtrack_user'))
      : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.unit && parsed.unit !== 'None') {
        return String(parsed.unit).toUpperCase();
      }
    }
  } catch {
    // fallback
  }
  return 'RHU';
};

// ============================================================================
// Dynamic Agency Resolvers
// ============================================================================

/**
 * Dynamically resolves and mounts the role-specific operational dashboard:
 * - RHU -> EmsTraumaDashboard (Pre-Hospital Trauma & Triage Console)
 * - FIRE -> FireCommandDashboard (Fire Ground Command & 2-Alarm Hub)
 * - PNP -> PolicePatrolDashboard (Law Enforcement Sector Command & Crime Intercept)
 */
export const DynamicResponderDashboard: React.FC = () => {
  const { session } = useSession();
  const unit = resolveUnit(session?.unit);

  if (unit === 'RHU') {
    return React.createElement(EmsTraumaDashboard);
  }
  if (unit === 'FIRE') {
    return React.createElement(FireCommandDashboard);
  }
  if (unit === 'PNP' || unit === 'SECURITY') {
    return React.createElement(PolicePatrolDashboard);
  }
  return React.createElement(ResponderDashboard);
};

/**
 * Dynamically resolves and mounts the unit dispatches feed with agency filtering:
 * Adapts between Casualty Dispatches (RHU), Fire Ground Dispatches (FIRE),
 * and Crime & Disturbance Feed (PNP).
 */
export const DynamicResponderIncidents: React.FC = () => {
  return React.createElement(UnitIncidentsFeed);
};

/**
 * Dynamically resolves and mounts the branch-specific personnel and unit roster:
 * - RHU -> MedicCrewRosterPage (Ambulance Crew & EMT Cadre)
 * - FIRE -> FireApparatusRosterPage (Engine Company Roster & Apparatus Cadre)
 * - PNP -> PolicePatrolRosterPage (Patrol Beat Roster & Officer Shifts)
 */
export const DynamicResponderRoster: React.FC = () => {
  const { session } = useSession();
  const unit = resolveUnit(session?.unit);

  if (unit === 'RHU') {
    return React.createElement(MedicCrewRosterPage);
  }
  if (unit === 'FIRE') {
    return React.createElement(FireApparatusRosterPage);
  }
  if (unit === 'PNP' || unit === 'SECURITY') {
    return React.createElement(PolicePatrolRosterPage);
  }
  return React.createElement(DutyRosterView);
};

/**
 * Dynamically resolves and mounts the branch-specific action documentation:
 * - RHU -> PatientCareRecordPage (Electronic PCR & Clinical Vitals Logger)
 * - FIRE -> FireAarReportsPage (After-Action Reports & Investigation Ledger)
 * - PNP -> PoliceBlotterPage (Digital Police Blotter & Incident Ledger)
 */
export const DynamicResponderReports: React.FC = () => {
  const { session } = useSession();
  const unit = resolveUnit(session?.unit);

  if (unit === 'RHU') {
    return React.createElement(PatientCareRecordPage);
  }
  if (unit === 'FIRE') {
    return React.createElement(FireAarReportsPage);
  }
  if (unit === 'PNP' || unit === 'SECURITY') {
    return React.createElement(PoliceBlotterPage);
  }
  return React.createElement(MyReportsPage);
};

/**
 * Dynamically resolves and mounts the branch-specific profile & credentials:
 * - RHU -> MedicProfilePage (Medic Credentials & PRC License)
 * - FIRE -> ResponderProfile
 * - PNP -> OfficerArmoryProfilePage (Officer Credentials & Armory Record)
 */
export const DynamicResponderProfile: React.FC = () => {
  const { session } = useSession();
  const unit = resolveUnit(session?.unit);

  if (unit === 'RHU') {
    return React.createElement(MedicProfilePage);
  }
  if (unit === 'PNP' || unit === 'SECURITY') {
    return React.createElement(OfficerArmoryProfilePage);
  }
  return React.createElement(ResponderProfile);
};
