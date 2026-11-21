// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Unit-scoped Responders directory, agency chain of command,
// and OnDuty & Dispatched leaderboard ranked by response speed and mission succession rate.
// Stitch Official Cherry (#670626) / Warm Ivory (#F7F1EA) / Soft Beige (#E9D9D0) / Muted Cherry (#A83B4D) Clay Design System.
// Strictly 100% arrow lambdas (=>), ZERO 'any', ZERO emojis, ZERO hotline/tel links.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  useSession,
  useValueRefreshAuto,
  useDebounce,
  usePagination
} from '@/Hooks';
import {
  SearchBar,
  TableCardToggle,
  useTableCardView,
  Dropdown
} from '@/Shared';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getAgencyReports } from '@/Endpoints/reportsApi';
import { formatGpsCoord } from '@/Libs/Assets/formatters';
import { ResponderButton } from './Shared/ResponderButton';
import { ResponderModalCard } from './Shared/ResponderModalCard';
import {
  Ambulance,
  Flame,
  Shield,
  Users,
  MapPin,
  Navigation,
  Award,
  Radio,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Filter,
  BadgeCheck,
  GitBranch,
  Trophy,
  Gauge,
  TrendingUp
} from 'lucide-react';

export type AgencyScope = 'RHU' | 'FIRE' | 'PNP';

export type ColleagueDutyStatus = 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty';

export type StatusFilterOption =
  | 'ALL_COLLEAGUES'
  | 'ACTIVE_AVAILABLE'
  | 'BEING_DISPATCHED'
  | 'STANDBY'
  | 'OFF_DUTY';

export type ColleagueSortOption = 'LEADERBOARD' | 'HIERARCHY' | 'AVAILABILITY';

export type HierarchyTier = 1 | 2 | 3 | 4;

export interface ColleagueResponder {
  id: string;
  fullName: string;
  callsign: string;
  unitCode: string;
  unitName: string;
  agency: AgencyScope;
  rankTitle: string;
  roleCategory: string;
  hierarchyTier: HierarchyTier;
  specialization: string;
  licenseOrBadge: string;
  status: ColleagueDutyStatus;
  resolvedMissions: number;
  activeDispatches: number;
  missionSuccessRate: number;
  avgResponseSeconds: number;
  avgResponseTime: string;
  sectorAssignment: string;
  shiftSchedule: string;
  radioChannel: string;
  baseLatitude: number;
  baseLongitude: number;
  certifications: string[];
  yearsOfService: number;
}

interface ActiveUnitSummary {
  id: string;
  unitCode: string;
  unitName: string;
  agency: AgencyScope;
  commanderName: string;
  status: ColleagueDutyStatus;
  baseLatitude: number;
  baseLongitude: number;
  activePersonnelCount: number;
  shiftSchedule: string;
}

const resolveActiveAgency = (rawUnit?: string | null): AgencyScope => {
  const normalized = (rawUnit || '').trim().toUpperCase();
  if (normalized === 'FIRE' || normalized === 'BFP') return 'FIRE';
  if (normalized === 'PNP' || normalized === 'POLICE') return 'PNP';
  return 'RHU';
};

const computePerformanceScore = (responder: ColleagueResponder): number =>
  responder.missionSuccessRate * 10 - responder.avgResponseSeconds * 0.25;

const INITIAL_COLLEAGUE_ROSTER: ColleagueResponder[] = [
  // ============================================================================
  // RHU MEDICAL / AMBULANCE RESPONDERS (Katipunan, Zamboanga del Norte)
  // ============================================================================
  {
    id: 'medic-col-01',
    fullName: 'Dr. Rafael Lorenzo Mendoza MD, MPH',
    callsign: 'RHU-CHIEF-01',
    unitCode: 'MED-HQ-01',
    unitName: 'RHU Katipunan Health Command Center',
    agency: 'RHU',
    rankTitle: 'HEAD CHIEF — Municipal Health Officer',
    roleCategory: 'RHU Medical Officer',
    hierarchyTier: 1,
    specialization: 'Municipal Disaster Medicine & Mass-Casualty Command',
    licenseOrBadge: 'PRC-MD-0084921',
    status: 'OnDuty',
    resolvedMissions: 342,
    activeDispatches: 1,
    missionSuccessRate: 99.8,
    avgResponseSeconds: 162,
    avgResponseTime: '2m 42s',
    sectorAssignment: 'Sector 0 — Poblacion Health Command, Katipunan, ZN',
    shiftSchedule: '06:00 - 18:00 (Alpha Command Shift)',
    radioChannel: 'MED-COM CH-1 (155.340 MHz)',
    baseLatitude: 8.5165,
    baseLongitude: 123.2861,
    certifications: ['ATLS Director', 'ACLS Master', 'FEMA ICS-400', 'Public Health Emergency Chief'],
    yearsOfService: 16
  },
  {
    id: 'medic-col-02',
    fullName: 'Dr. Maria Clara Santos MD',
    callsign: 'MEDIC-ALPHA-01',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    rankTitle: 'MEDICAL OFFICER III',
    roleCategory: 'RHU Medical Officer',
    hierarchyTier: 2,
    specialization: 'Emergency Trauma Resuscitation & Field Triage Command',
    licenseOrBadge: 'PRC-MD-0104382',
    status: 'OnDuty',
    resolvedMissions: 289,
    activeDispatches: 2,
    missionSuccessRate: 99.6,
    avgResponseSeconds: 170,
    avgResponseTime: '2m 50s',
    sectorAssignment: 'Sector 1 — Barangay Uno (Poblacion) Trauma Grid',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    baseLatitude: 8.5159,
    baseLongitude: 123.2848,
    certifications: ['ATLS Certified', 'ACLS Provider', 'PALS Certified', 'Pre-Hospital Trauma Lead'],
    yearsOfService: 9
  },
  {
    id: 'medic-col-03',
    fullName: 'Dr. Antonio Carlos Villanueva MD',
    callsign: 'MEDIC-BRAVO-01',
    unitCode: 'AMB-RHU-02',
    unitName: 'RHU Mobile Trauma ICU Ambulance Bravo-2',
    agency: 'RHU',
    rankTitle: 'MEDICAL OFFICER III',
    roleCategory: 'RHU Medical Officer',
    hierarchyTier: 2,
    specialization: 'Acute Cardiac Life Support & Highway Extraction Medicine',
    licenseOrBadge: 'PRC-MD-0109844',
    status: 'Dispatched',
    resolvedMissions: 254,
    activeDispatches: 2,
    missionSuccessRate: 98.9,
    avgResponseSeconds: 188,
    avgResponseTime: '3m 08s',
    sectorAssignment: 'Sector 2 — National Highway, Barangay Dos, Katipunan, ZN',
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    radioChannel: 'MED-TAC CH-2 (155.400 MHz)',
    baseLatitude: 8.5129,
    baseLongitude: 123.2819,
    certifications: ['ATLS Certified', 'ACLS Experienced', 'Airway Management Specialist'],
    yearsOfService: 8
  },
  {
    id: 'medic-col-04',
    fullName: 'RN Elena Gabriela Reyes, BSN, EMT-P',
    callsign: 'TRIAGE-LEAD-01',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    rankTitle: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
    roleCategory: 'Triage Nurse',
    hierarchyTier: 3,
    specialization: 'START Mass-Casualty Triage & Critical Care Nursing',
    licenseOrBadge: 'PRC-RN-0492811',
    status: 'OnDuty',
    resolvedMissions: 231,
    activeDispatches: 1,
    missionSuccessRate: 99.2,
    avgResponseSeconds: 181,
    avgResponseTime: '3m 01s',
    sectorAssignment: 'Sector 1 — Central Mass-Casualty Triage Hub, Katipunan',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    baseLatitude: 8.5153,
    baseLongitude: 123.2830,
    certifications: ['CEN Certified Emergency Nurse', 'EMT-Paramedic', 'BLS Instructor'],
    yearsOfService: 7
  },
  {
    id: 'medic-col-05',
    fullName: 'EMT-P Marco Aurelio Dizon',
    callsign: 'PARAMEDIC-LEAD-02',
    unitCode: 'AMB-RHU-02',
    unitName: 'RHU Mobile Trauma ICU Ambulance Bravo-2',
    agency: 'RHU',
    rankTitle: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
    roleCategory: 'EMT Paramedic',
    hierarchyTier: 3,
    specialization: 'Advanced Life Support (ALS) & Cardiac Defibrillation Lead',
    licenseOrBadge: 'DOH-EMTP-22910',
    status: 'Dispatched',
    resolvedMissions: 218,
    activeDispatches: 2,
    missionSuccessRate: 98.4,
    avgResponseSeconds: 196,
    avgResponseTime: '3m 16s',
    sectorAssignment: 'Sector 3 — Coastal Boulevard, Barangay Tambo, Katipunan',
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    radioChannel: 'MED-TAC CH-2 (155.400 MHz)',
    baseLatitude: 8.5182,
    baseLongitude: 123.2798,
    certifications: ['National EMT-Paramedic', 'ITLS Advanced', 'HazMat EMS Level II'],
    yearsOfService: 6
  },
  {
    id: 'medic-col-06',
    fullName: 'RN Patricia Mae Soriano, BSN',
    callsign: 'TRIAGE-LEAD-03',
    unitCode: 'AMB-RHU-03',
    unitName: 'RHU Bravo-3 Basic Life Support & Evacuation Rig',
    agency: 'RHU',
    rankTitle: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
    roleCategory: 'Triage Nurse',
    hierarchyTier: 3,
    specialization: 'Emergency Obstetric, Pediatric & Evacuation Triage Lead',
    licenseOrBadge: 'PRC-RN-0518390',
    status: 'Standby',
    resolvedMissions: 186,
    activeDispatches: 0,
    missionSuccessRate: 97.6,
    avgResponseSeconds: 215,
    avgResponseTime: '3m 35s',
    sectorAssignment: 'Sector 4 — Barangay Tuburan Evacuation Staging',
    shiftSchedule: '14:00 - 02:00 (Swing Standby Shift)',
    radioChannel: 'MED-TAC CH-3 (155.475 MHz)',
    baseLatitude: 8.5042,
    baseLongitude: 123.2923,
    certifications: ['NRP Neonatal Resuscitation', 'PALS Provider', 'Disaster Triage Lead'],
    yearsOfService: 5
  },
  {
    id: 'medic-col-07',
    fullName: 'Med-Op Jerome Kristoffer Navarro',
    callsign: 'AMB-DRIVER-01',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — Tactical EMS Driver',
    roleCategory: 'Ambulance Driver / Medic',
    hierarchyTier: 4,
    specialization: 'Emergency Vehicle Operations (EVOC) & Extrication Rigging',
    licenseOrBadge: 'LTO-EVOC-88319',
    status: 'OnDuty',
    resolvedMissions: 210,
    activeDispatches: 1,
    missionSuccessRate: 99.4,
    avgResponseSeconds: 175,
    avgResponseTime: '2m 55s',
    sectorAssignment: 'Sector 1 — Poblacion Central Extraction Corridor',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    baseLatitude: 8.5102,
    baseLongitude: 123.2851,
    certifications: ['EVOC Master Driver', 'EMT-Basic', 'Hydraulic Extrication Support'],
    yearsOfService: 7
  },
  {
    id: 'medic-col-08',
    fullName: 'EMT-B Carlo Miguel Bautista',
    callsign: 'CREW-MEDIC-04',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — EMT Paramedic Responder',
    roleCategory: 'EMT Paramedic',
    hierarchyTier: 4,
    specialization: 'Hemorrhage Control, Spinal Immobilization & Splinting',
    licenseOrBadge: 'DOH-EMTB-34012',
    status: 'OnDuty',
    resolvedMissions: 195,
    activeDispatches: 1,
    missionSuccessRate: 98.7,
    avgResponseSeconds: 190,
    avgResponseTime: '3m 10s',
    sectorAssignment: 'Sector 1 — Poblacion Central & Trauma Grid',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    baseLatitude: 8.5102,
    baseLongitude: 123.2866,
    certifications: ['EMT-Basic', 'Stop the Bleed Instructor', 'BLS Healthcare Provider'],
    yearsOfService: 4
  },
  {
    id: 'medic-col-09',
    fullName: 'Med-Op Dennis Paul Tolentino',
    callsign: 'AMB-DRIVER-03',
    unitCode: 'AMB-RHU-03',
    unitName: 'RHU Bravo-3 Basic Life Support & Evacuation Rig',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — Relief EMS Driver',
    roleCategory: 'Ambulance Driver / Medic',
    hierarchyTier: 4,
    specialization: 'Apparatus Preventive Maintenance & O2 Manifold Logistics',
    licenseOrBadge: 'LTO-EVOC-94108',
    status: 'OffDuty',
    resolvedMissions: 129,
    activeDispatches: 0,
    missionSuccessRate: 96.2,
    avgResponseSeconds: 245,
    avgResponseTime: '4m 05s',
    sectorAssignment: 'Sector 5 — RHU Base Motorpool Relief Reserve',
    shiftSchedule: '18:00 - 06:00 (Night Relief Shift)',
    radioChannel: 'MED-TAC CH-3 (155.475 MHz)',
    baseLatitude: 8.5085,
    baseLongitude: 123.2775,
    certifications: ['EVOC Certified', 'Apparatus Telemetry Tech', 'First Aid Responder'],
    yearsOfService: 2
  },

  // ============================================================================
  // BFP FIRE SUPPRESSION & RESCUE RESPONDERS (Katipunan, Zamboanga del Norte)
  // ============================================================================
  {
    id: 'fire-col-01',
    fullName: 'SINSP Ricardo Dalisay BFP',
    callsign: 'BFP-MARSHAL-01',
    unitCode: 'FIRE-HQ-01',
    unitName: 'BFP Katipunan Central Fire Command',
    agency: 'FIRE',
    rankTitle: 'MUNICIPAL FIRE MARSHAL / SENIOR INSPECTOR',
    roleCategory: 'BFP Fire Commander',
    hierarchyTier: 1,
    specialization: 'Structural Fire Suppression & HazMat Incident Command',
    licenseOrBadge: 'BFP-SINSP-11024',
    status: 'OnDuty',
    resolvedMissions: 264,
    activeDispatches: 1,
    missionSuccessRate: 99.6,
    avgResponseSeconds: 172,
    avgResponseTime: '2m 52s',
    sectorAssignment: 'Sector 0 — Katipunan Central Fire Station, Brgy. Uno',
    shiftSchedule: '24-Hour Tactical Fire Watch',
    radioChannel: 'BFP-COM CH-1 (154.280 MHz)',
    baseLatitude: 8.5122,
    baseLongitude: 123.2825,
    certifications: ['NFPA 1001 Fire Officer III', 'HazMat Operations', 'High-Angle Rescue'],
    yearsOfService: 14
  },
  {
    id: 'fire-col-02',
    fullName: 'SFO4 Arturo Pendelton BFP',
    callsign: 'BFP-ENGINE-01',
    unitCode: 'FIRE-ENG-01',
    unitName: 'BFP Katipunan Pumper Engine 01',
    agency: 'FIRE',
    rankTitle: 'SENIOR FIRE OFFICER IV — Engine Boss',
    roleCategory: 'BFP Fire Officer',
    hierarchyTier: 2,
    specialization: 'High-Rise Hose Deployment & Electrical Feeder Isolation',
    licenseOrBadge: 'BFP-SFO4-22190',
    status: 'OnDuty',
    resolvedMissions: 238,
    activeDispatches: 1,
    missionSuccessRate: 99.3,
    avgResponseSeconds: 184,
    avgResponseTime: '3m 04s',
    sectorAssignment: 'Sector 1 — Public Market & Poblacion Fire Grid',
    shiftSchedule: '06:00 - 18:00 (Alpha Suppression Shift)',
    radioChannel: 'BFP-TAC CH-1 (154.280 MHz)',
    baseLatitude: 8.5138,
    baseLongitude: 123.2904,
    certifications: ['Structural Fire Tactics', 'SCBA Master Instructor', 'Hydrant Ops'],
    yearsOfService: 11
  },
  {
    id: 'fire-col-03',
    fullName: 'SFO2 Ernesto Macapagal BFP',
    callsign: 'BFP-RESCUE-02',
    unitCode: 'FIRE-RSC-02',
    unitName: 'BFP Rapid Rescue & Extrication Unit 02',
    agency: 'FIRE',
    rankTitle: 'SENIOR FIRE OFFICER II — Rescue Lead',
    roleCategory: 'BFP Rescue Specialist',
    hierarchyTier: 2,
    specialization: 'Vehicular Hydraulic Extrication & Collapsed Structure SAR',
    licenseOrBadge: 'BFP-SFO2-30941',
    status: 'Dispatched',
    resolvedMissions: 215,
    activeDispatches: 2,
    missionSuccessRate: 98.8,
    avgResponseSeconds: 192,
    avgResponseTime: '3m 12s',
    sectorAssignment: 'Sector 2 — National Highway & Brgy. Dos Corridor',
    shiftSchedule: '06:00 - 18:00 (Bravo Rescue Shift)',
    radioChannel: 'BFP-TAC CH-2 (154.340 MHz)',
    baseLatitude: 8.5155,
    baseLongitude: 123.2829,
    certifications: ['USAR Collapse Rescue', 'Hydraulic Extrication Lead', 'Swiftwater SAR'],
    yearsOfService: 9
  },
  {
    id: 'fire-col-04',
    fullName: 'FO3 Ramon Magsaysay BFP',
    callsign: 'BFP-NOZZLE-03',
    unitCode: 'FIRE-ENG-01',
    unitName: 'BFP Katipunan Pumper Engine 01',
    agency: 'FIRE',
    rankTitle: 'FIRE OFFICER III — Attack Nozzle Lead',
    roleCategory: 'BFP Fire Officer',
    hierarchyTier: 3,
    specialization: 'Interior Fire Attack, Thermal Imaging & Ventilation',
    licenseOrBadge: 'BFP-FO3-41802',
    status: 'OnDuty',
    resolvedMissions: 184,
    activeDispatches: 1,
    missionSuccessRate: 99.1,
    avgResponseSeconds: 179,
    avgResponseTime: '2m 59s',
    sectorAssignment: 'Sector 1 — Commercial District & Rizal Ave, Katipunan',
    shiftSchedule: '06:00 - 18:00 (Alpha Suppression Shift)',
    radioChannel: 'BFP-TAC CH-1 (154.280 MHz)',
    baseLatitude: 8.5125,
    baseLongitude: 123.2840,
    certifications: ['Thermal Imaging Ops', 'RIT Rapid Intervention', 'NFPA 1001 FF-II'],
    yearsOfService: 7
  },
  {
    id: 'fire-col-05',
    fullName: 'FO2 Marisol Navarro BFP',
    callsign: 'BFP-HAZMAT-04',
    unitCode: 'FIRE-RSC-02',
    unitName: 'BFP Rapid Rescue & Extrication Unit 02',
    agency: 'FIRE',
    rankTitle: 'FIRE OFFICER II — HazMat & First Aid Tech',
    roleCategory: 'BFP Rescue Specialist',
    hierarchyTier: 3,
    specialization: 'LPG Tank Leak Containment & Decontamination Ops',
    licenseOrBadge: 'BFP-FO2-52714',
    status: 'Dispatched',
    resolvedMissions: 162,
    activeDispatches: 1,
    missionSuccessRate: 98.2,
    avgResponseSeconds: 204,
    avgResponseTime: '3m 24s',
    sectorAssignment: 'Sector 3 — Brgy. Daanglungsod Industrial Strip',
    shiftSchedule: '06:00 - 18:00 (Bravo Rescue Shift)',
    radioChannel: 'BFP-TAC CH-2 (154.340 MHz)',
    baseLatitude: 8.5085,
    baseLongitude: 123.2775,
    certifications: ['HazMat Technician', 'Firefighter First Responder', 'Confined Space'],
    yearsOfService: 5
  },
  {
    id: 'fire-col-06',
    fullName: 'FO1 Danilo Velasco BFP',
    callsign: 'BFP-PUMP-05',
    unitCode: 'FIRE-TNK-03',
    unitName: 'BFP Water Tanker Support 03',
    agency: 'FIRE',
    rankTitle: 'FIRE OFFICER I — Pump & Hydrant Operator',
    roleCategory: 'BFP Pump Operator',
    hierarchyTier: 4,
    specialization: 'High-Pressure Pump Relay & Municipal Hydrant Drafting',
    licenseOrBadge: 'BFP-FO1-66410',
    status: 'Standby',
    resolvedMissions: 135,
    activeDispatches: 0,
    missionSuccessRate: 97.4,
    avgResponseSeconds: 218,
    avgResponseTime: '3m 38s',
    sectorAssignment: 'Sector 4 — Brgy. Tuburan Hydrant Staging',
    shiftSchedule: '14:00 - 02:00 (Swing Water Support)',
    radioChannel: 'BFP-TAC CH-3 (154.410 MHz)',
    baseLatitude: 8.5042,
    baseLongitude: 123.2923,
    certifications: ['EVOC Heavy Apparatus', 'Pump Hydraulics Certified', 'SCBA Tech'],
    yearsOfService: 4
  },
  {
    id: 'fire-col-07',
    fullName: 'FO1 Cedric Villanueva BFP',
    callsign: 'BFP-CREW-06',
    unitCode: 'FIRE-TNK-03',
    unitName: 'BFP Water Tanker Support 03',
    agency: 'FIRE',
    rankTitle: 'FIRE OFFICER I — Relief Hoseman',
    roleCategory: 'BFP Fire Officer',
    hierarchyTier: 4,
    specialization: 'Brush Fire Containment & Salvage Operations',
    licenseOrBadge: 'BFP-FO1-68902',
    status: 'OffDuty',
    resolvedMissions: 98,
    activeDispatches: 0,
    missionSuccessRate: 96.0,
    avgResponseSeconds: 242,
    avgResponseTime: '4m 02s',
    sectorAssignment: 'Sector 5 — Central Fire Station Relief Reserve',
    shiftSchedule: '18:00 - 06:00 (Night Relief Shift)',
    radioChannel: 'BFP-TAC CH-3 (154.410 MHz)',
    baseLatitude: 8.5122,
    baseLongitude: 123.2825,
    certifications: ['Wildland Brush Suppression', 'BLS Responder'],
    yearsOfService: 2
  },

  // ============================================================================
  // PNP POLICE TACTICAL PATROL RESPONDERS (Katipunan, Zamboanga del Norte)
  // ============================================================================
  {
    id: 'pnp-col-01',
    fullName: 'PMAJ Victorino Magtanggol PNP',
    callsign: 'PNP-CHIEF-01',
    unitCode: 'PNP-HQ-01',
    unitName: 'PNP Katipunan Municipal Police Command',
    agency: 'PNP',
    rankTitle: 'CHIEF OF POLICE / POLICE MAJOR',
    roleCategory: 'PNP Command Officer',
    hierarchyTier: 1,
    specialization: 'Tactical Crowd Control, Crime Scene Lockdown & Escort',
    licenseOrBadge: 'PNP-PMAJ-77412',
    status: 'OnDuty',
    resolvedMissions: 275,
    activeDispatches: 1,
    missionSuccessRate: 99.7,
    avgResponseSeconds: 168,
    avgResponseTime: '2m 48s',
    sectorAssignment: 'Sector 0 — Katipunan Municipal Police HQ, Brgy. Uno',
    shiftSchedule: '06:00 - 18:00 (Alpha Command Watch)',
    radioChannel: 'PNP-COM CH-1 (156.100 MHz)',
    baseLatitude: 8.5178,
    baseLongitude: 123.2874,
    certifications: ['PNP SWAT Command', 'Crisis Negotiation', 'Tactical Perimeter Lead'],
    yearsOfService: 15
  },
  {
    id: 'pnp-col-02',
    fullName: 'PCPT Gregorio del Pilar PNP',
    callsign: 'PNP-PATROL-01',
    unitCode: 'PNP-MOB-01',
    unitName: 'PNP Katipunan Tactical Mobile Patrol 01',
    agency: 'PNP',
    rankTitle: 'POLICE CAPTAIN — Operations Lead',
    roleCategory: 'PNP Patrol Commander',
    hierarchyTier: 2,
    specialization: 'Highway Intercept, Checkpoint Security & Armed Response',
    licenseOrBadge: 'PNP-PCPT-81205',
    status: 'OnDuty',
    resolvedMissions: 249,
    activeDispatches: 1,
    missionSuccessRate: 99.4,
    avgResponseSeconds: 176,
    avgResponseTime: '2m 56s',
    sectorAssignment: 'Sector 1 — Bonifacio Commercial Strip & Poblacion',
    shiftSchedule: '06:00 - 18:00 (Alpha Patrol Watch)',
    radioChannel: 'PNP-TAC CH-1 (156.100 MHz)',
    baseLatitude: 8.5171,
    baseLongitude: 123.2849,
    certifications: ['Highway Interdiction', 'Active Threat Response', 'SOCO Coordination'],
    yearsOfService: 11
  },
  {
    id: 'pnp-col-03',
    fullName: 'PLT Clarissa Dimaculangan PNP',
    callsign: 'PNP-SOCO-02',
    unitCode: 'PNP-MOB-02',
    unitName: 'PNP Rapid Investigation & Traffic Unit 02',
    agency: 'PNP',
    rankTitle: 'POLICE LIEUTENANT — Investigation Lead',
    roleCategory: 'PNP Investigator',
    hierarchyTier: 2,
    specialization: 'Forensic Blotter Sealing, CCTV Trace & Missing Person SAR',
    licenseOrBadge: 'PNP-PLT-84930',
    status: 'Dispatched',
    resolvedMissions: 212,
    activeDispatches: 2,
    missionSuccessRate: 98.9,
    avgResponseSeconds: 191,
    avgResponseTime: '3m 11s',
    sectorAssignment: 'Sector 2 — Sitio Malugas Bridge, Brgy. Daanglungsod',
    shiftSchedule: '06:00 - 18:00 (Bravo Patrol Watch)',
    radioChannel: 'PNP-TAC CH-2 (156.180 MHz)',
    baseLatitude: 8.5085,
    baseLongitude: 123.2775,
    certifications: ['Crime Scene Investigation', 'Digital Forensics', 'Traffic Accident Recon'],
    yearsOfService: 8
  },
  {
    id: 'pnp-col-04',
    fullName: 'PSMS Mateo Bonifacio PNP',
    callsign: 'PNP-SWAT-03',
    unitCode: 'PNP-MOB-01',
    unitName: 'PNP Katipunan Tactical Mobile Patrol 01',
    agency: 'PNP',
    rankTitle: 'POLICE SENIOR MASTER SERGEANT — Tactical Team Lead',
    roleCategory: 'PNP Tactical Officer',
    hierarchyTier: 3,
    specialization: 'Perimeter Containment, Escort Protection & Checkpoint Ops',
    licenseOrBadge: 'PNP-PSMS-90124',
    status: 'OnDuty',
    resolvedMissions: 196,
    activeDispatches: 1,
    missionSuccessRate: 99.1,
    avgResponseSeconds: 182,
    avgResponseTime: '3m 02s',
    sectorAssignment: 'Sector 3 — Boundary Checkpoint, Brgy. Balok, Katipunan',
    shiftSchedule: '06:00 - 18:00 (Alpha Patrol Watch)',
    radioChannel: 'PNP-TAC CH-1 (156.100 MHz)',
    baseLatitude: 8.4935,
    baseLongitude: 123.2958,
    certifications: ['SWAT Operator', 'Defensive Tactics Instructor', 'Radio C2'],
    yearsOfService: 10
  },
  {
    id: 'pnp-col-05',
    fullName: 'PMSg Katrina Alcaraz PNP',
    callsign: 'PNP-MARITIME-04',
    unitCode: 'PNP-MOB-02',
    unitName: 'PNP Rapid Investigation & Traffic Unit 02',
    agency: 'PNP',
    rankTitle: 'POLICE MASTER SERGEANT — Coastal Patrol',
    roleCategory: 'PNP Maritime Officer',
    hierarchyTier: 3,
    specialization: 'Coastal Wharf Security & Bantay Dagat Joint Operations',
    licenseOrBadge: 'PNP-PMSG-92341',
    status: 'Dispatched',
    resolvedMissions: 171,
    activeDispatches: 1,
    missionSuccessRate: 98.5,
    avgResponseSeconds: 198,
    avgResponseTime: '3m 18s',
    sectorAssignment: 'Sector 4 — Fisherman Wharf, Brgy. Tambo, Katipunan',
    shiftSchedule: '06:00 - 18:00 (Bravo Patrol Watch)',
    radioChannel: 'PNP-TAC CH-2 (156.180 MHz)',
    baseLatitude: 8.5188,
    baseLongitude: 123.2835,
    certifications: ['Maritime Law Enforcement', 'Coastal SAR', 'Bantay Dagat Liaison'],
    yearsOfService: 7
  },
  {
    id: 'pnp-col-06',
    fullName: 'PCpl Lorenzo Aguinaldo PNP',
    callsign: 'PNP-UNIT-05',
    unitCode: 'PNP-PAT-03',
    unitName: 'PNP Plaza & Barangay Beat Patrol 03',
    agency: 'PNP',
    rankTitle: 'POLICE CORPORAL — Beat Patrol Responder',
    roleCategory: 'PNP Beat Officer',
    hierarchyTier: 4,
    specialization: 'Public Disturbance De-escalation & Barangay Tanod Liaison',
    licenseOrBadge: 'PNP-PCPL-95418',
    status: 'Standby',
    resolvedMissions: 148,
    activeDispatches: 0,
    missionSuccessRate: 97.8,
    avgResponseSeconds: 210,
    avgResponseTime: '3m 30s',
    sectorAssignment: 'Sector 1 — Plaza Covered Court, Brgy. Uno, Katipunan',
    shiftSchedule: '14:00 - 02:00 (Swing Beat Watch)',
    radioChannel: 'PNP-TAC CH-3 (156.250 MHz)',
    baseLatitude: 8.5103,
    baseLongitude: 123.2869,
    certifications: ['Conflict De-escalation', 'Community Policing', 'First Aid'],
    yearsOfService: 4
  },
  {
    id: 'pnp-col-07',
    fullName: 'Pat Rafael Ibarra PNP',
    callsign: 'PNP-UNIT-06',
    unitCode: 'PNP-PAT-03',
    unitName: 'PNP Plaza & Barangay Beat Patrol 03',
    agency: 'PNP',
    rankTitle: 'PATROLMAN — Night Relief Patrol',
    roleCategory: 'PNP Beat Officer',
    hierarchyTier: 4,
    specialization: 'Night Curfew Sweep & Motorpool Dispatch Readiness',
    licenseOrBadge: 'PNP-PAT-98112',
    status: 'OffDuty',
    resolvedMissions: 109,
    activeDispatches: 0,
    missionSuccessRate: 96.4,
    avgResponseSeconds: 236,
    avgResponseTime: '3m 56s',
    sectorAssignment: 'Sector 5 — Municipal Police Station Relief Reserve',
    shiftSchedule: '18:00 - 06:00 (Night Relief Watch)',
    radioChannel: 'PNP-TAC CH-3 (156.250 MHz)',
    baseLatitude: 8.5178,
    baseLongitude: 123.2874,
    certifications: ['EVOC Patrol Driver', 'Radio Communications'],
    yearsOfService: 2
  }
];

const AGENCY_THEME: Record<
  AgencyScope,
  {
    title: string;
    subtitle: string;
    badgeLabel: string;
    personnelNoun: string;
    tiers: Array<{ tier: HierarchyTier; code: string; title: string; subtitle: string }>;
  }
> = {
  RHU: {
    title: 'RHU Medical Responders',
    subtitle: 'Unit roster & response leaderboard',
    badgeLabel: 'RHU Ambulance Crew',
    personnelNoun: 'Medics',
    tiers: [
      { tier: 1, code: 'Tier 1', title: 'Head Chief', subtitle: 'Municipal Health Officer' },
      { tier: 2, code: 'Tier 2', title: 'Medical Officer III', subtitle: 'Field Trauma Command' },
      { tier: 3, code: 'Tier 3', title: 'Senior Paramedic / Triage Lead', subtitle: 'Triage & ALS Lead' },
      { tier: 4, code: 'Tier 4', title: 'Ambulance Crew', subtitle: 'EMTs, Nurses & Drivers' }
    ]
  },
  FIRE: {
    title: 'BFP Fire Responders',
    subtitle: 'Unit roster & response leaderboard',
    badgeLabel: 'BFP Fire Suppression',
    personnelNoun: 'Firefighters',
    tiers: [
      { tier: 1, code: 'Tier 1', title: 'Fire Marshal', subtitle: 'Municipal Fire Command' },
      { tier: 2, code: 'Tier 2', title: 'Engine & Rescue Boss', subtitle: 'Suppression & Extrication' },
      { tier: 3, code: 'Tier 3', title: 'Fire Attack & HazMat Lead', subtitle: 'Interior & Containment' },
      { tier: 4, code: 'Tier 4', title: 'Apparatus & Hose Crew', subtitle: 'Pump Operators & Crew' }
    ]
  },
  PNP: {
    title: 'PNP Police Responders',
    subtitle: 'Unit roster & response leaderboard',
    badgeLabel: 'PNP Tactical Patrol',
    personnelNoun: 'Officers',
    tiers: [
      { tier: 1, code: 'Tier 1', title: 'Chief of Police', subtitle: 'Municipal Police Command' },
      { tier: 2, code: 'Tier 2', title: 'Operations & SOCO Lead', subtitle: 'Patrol & Investigation' },
      { tier: 3, code: 'Tier 3', title: 'Tactical & Maritime Lead', subtitle: 'Perimeter & Coastal SAR' },
      { tier: 4, code: 'Tier 4', title: 'Beat Patrol Responders', subtitle: 'Mobile & Barangay Patrol' }
    ]
  }
};

export const DutyRosterView: React.FC = () => {
  const { session } = useSession();
  const activeAgency = useMemo<AgencyScope>(() => resolveActiveAgency(session?.unit), [session?.unit]);
  const agencyMeta = AGENCY_THEME[activeAgency];

  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueResponder[]>(INITIAL_COLLEAGUE_ROSTER);
  const [loading, setLoading] = useState<boolean>(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('ALL_COLLEAGUES');
  const [selectedTierFilter, setSelectedTierFilter] = useState<HierarchyTier | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<ColleagueSortOption>('LEADERBOARD');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const { viewMode, setViewMode } = useTableCardView('card');

  const [selectedColleague, setSelectedColleague] = useState<ColleagueResponder | null>(null);
  const [showFullLeaderboard, setShowFullLeaderboard] = useState<boolean>(false);

  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [activeDispatchesCount, setActiveDispatchesCount] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      const data = await getDutyRoster(activeAgency);
      setRoster(data);

      if (data && data.length > 0) {
        setColleagues((prev) =>
          prev.map((col) => {
            if (col.agency !== activeAgency) return col;
            const matchingUnit = data.find(
              (u) =>
                u.unitCode === col.unitCode ||
                (resolveActiveAgency(u.agency) === col.agency &&
                  u.commanderName.toLowerCase() === col.fullName.toLowerCase())
            );
            if (matchingUnit) {
              return {
                ...col,
                status: matchingUnit.status,
                baseLatitude: matchingUnit.baseLatitude || col.baseLatitude,
                baseLongitude: matchingUnit.baseLongitude || col.baseLongitude
              };
            }
            return col;
          })
        );
      }

      const reps = await getAgencyReports(activeAgency).catch(() => []);
      setActiveDispatchesCount(
        reps.filter((r) => r.status !== 'Resolved' && r.status !== 'Rejected').length
      );
    } catch (err) {
      console.error('Failed to load duty roster data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeAgency]);

  useValueRefreshAuto(loadData, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Strict agency-scoped responder list (FIRE sees only FIRE, RHU sees only RHU, PNP sees only PNP)
  const agencyScopedColleagues = useMemo(
    () => colleagues.filter((c) => c.agency === activeAgency),
    [colleagues, activeAgency]
  );

  // Active unit banner derived strictly from the signed-in agency
  const myUnit: ActiveUnitSummary = useMemo(() => {
    const found = roster.find((u) => resolveActiveAgency(u.agency) === activeAgency);
    const primaryResponder =
      agencyScopedColleagues.find((c) => c.hierarchyTier === 2) || agencyScopedColleagues[0];
    if (found) {
      return {
        id: found.id,
        unitCode: found.unitCode,
        unitName: found.unitName,
        agency: activeAgency,
        commanderName: found.commanderName,
        status: found.status,
        baseLatitude: found.baseLatitude,
        baseLongitude: found.baseLongitude,
        activePersonnelCount: found.activePersonnelCount,
        shiftSchedule: found.shiftSchedule
      };
    }
    return {
      id: `${activeAgency.toLowerCase()}-unit-01`,
      unitCode: primaryResponder.unitCode,
      unitName: primaryResponder.unitName,
      agency: activeAgency,
      commanderName: primaryResponder.fullName,
      status: primaryResponder.status,
      baseLatitude: primaryResponder.baseLatitude,
      baseLongitude: primaryResponder.baseLongitude,
      activePersonnelCount: agencyScopedColleagues.filter(
        (c) => c.status === 'OnDuty' || c.status === 'Dispatched'
      ).length,
      shiftSchedule: primaryResponder.shiftSchedule
    };
  }, [roster, activeAgency, agencyScopedColleagues]);

  const showToast = useCallback((msg: string) => {
    setStatusFeedback(msg);
    window.setTimeout(() => setStatusFeedback(null), 3200);
  }, []);

  const handleToggleDuty = useCallback(
    async (newStatus: ColleagueDutyStatus) => {
      const targetResponder =
        agencyScopedColleagues.find((c) => c.unitCode === myUnit.unitCode) ||
        agencyScopedColleagues[0];

      if (targetResponder) {
        setColleagues((prev) =>
          prev.map((c) => (c.id === targetResponder.id ? { ...c, status: newStatus } : c))
        );
      }
      setRoster((prev) =>
        prev.map((u) => (u.id === myUnit.id ? { ...u, status: newStatus } : u))
      );

      try {
        await updateUnitDutyStatus(myUnit.id, newStatus);
        showToast(`Status updated to ${newStatus}`);
        await loadData();
      } catch {
        showToast(`Status updated locally: ${newStatus}`);
      }
    },
    [agencyScopedColleagues, myUnit.id, myUnit.unitCode, loadData, showToast]
  );

  const handleQuickNavigate = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const copyCoordinates = useCallback(
    (lat: number, lng: number) => {
      const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      navigator.clipboard?.writeText(text);
      showToast(`Coordinates copied: ${text}`);
    },
    [showToast]
  );

  const statusCounts = useMemo(
    () => ({
      ALL_COLLEAGUES: agencyScopedColleagues.length,
      ACTIVE_AVAILABLE: agencyScopedColleagues.filter((c) => c.status === 'OnDuty').length,
      BEING_DISPATCHED: agencyScopedColleagues.filter((c) => c.status === 'Dispatched').length,
      STANDBY: agencyScopedColleagues.filter((c) => c.status === 'Standby').length,
      OFF_DUTY: agencyScopedColleagues.filter((c) => c.status === 'OffDuty').length
    }),
    [agencyScopedColleagues]
  );

  // Leaderboard: ONLY OnDuty & Dispatched personnel of the active agency,
  // ranked top-to-bottom by response speed & mission succession rate
  const activeLeaderboard = useMemo(
    () =>
      agencyScopedColleagues
        .filter((c) => c.status === 'OnDuty' || c.status === 'Dispatched')
        .sort((a, b) => {
          const scoreDiff = computePerformanceScore(b) - computePerformanceScore(a);
          if (Math.abs(scoreDiff) > 0.01) return scoreDiff;
          if (a.avgResponseSeconds !== b.avgResponseSeconds) {
            return a.avgResponseSeconds - b.avgResponseSeconds;
          }
          return b.missionSuccessRate - a.missionSuccessRate;
        }),
    [agencyScopedColleagues]
  );

  const leaderboardRankMap = useMemo(() => {
    const map = new Map<string, number>();
    activeLeaderboard.forEach((m, idx) => {
      map.set(m.id, idx + 1);
    });
    return map;
  }, [activeLeaderboard]);

  const processedColleagues = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const filtered = agencyScopedColleagues.filter((c) => {
      if (statusFilter === 'ACTIVE_AVAILABLE' && c.status !== 'OnDuty') return false;
      if (statusFilter === 'BEING_DISPATCHED' && c.status !== 'Dispatched') return false;
      if (statusFilter === 'STANDBY' && c.status !== 'Standby') return false;
      if (statusFilter === 'OFF_DUTY' && c.status !== 'OffDuty') return false;

      if (selectedTierFilter !== 'ALL' && c.hierarchyTier !== selectedTierFilter) return false;

      if (query) {
        const matchesName = c.fullName.toLowerCase().includes(query);
        const matchesCallsign = c.callsign.toLowerCase().includes(query);
        const matchesRank = c.rankTitle.toLowerCase().includes(query);
        const matchesRole = c.roleCategory.toLowerCase().includes(query);
        const matchesUnit =
          c.unitCode.toLowerCase().includes(query) || c.unitName.toLowerCase().includes(query);
        const matchesSector = c.sectorAssignment.toLowerCase().includes(query);
        if (
          !matchesName &&
          !matchesCallsign &&
          !matchesRank &&
          !matchesRole &&
          !matchesUnit &&
          !matchesSector
        ) {
          return false;
        }
      }

      return true;
    });

    const statusPriority: Record<ColleagueDutyStatus, number> = {
      OnDuty: 1,
      Dispatched: 2,
      Standby: 3,
      OffDuty: 4
    };

    return [...filtered].sort((a, b) => {
      if (sortBy === 'LEADERBOARD') {
        const aActive = a.status === 'OnDuty' || a.status === 'Dispatched';
        const bActive = b.status === 'OnDuty' || b.status === 'Dispatched';
        if (aActive !== bActive) return aActive ? -1 : 1;
        return computePerformanceScore(b) - computePerformanceScore(a);
      }
      if (sortBy === 'HIERARCHY') {
        if (a.hierarchyTier !== b.hierarchyTier) return a.hierarchyTier - b.hierarchyTier;
        return computePerformanceScore(b) - computePerformanceScore(a);
      }
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return computePerformanceScore(b) - computePerformanceScore(a);
    });
  }, [agencyScopedColleagues, statusFilter, selectedTierFilter, debouncedSearch, sortBy]);

  const {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems: paginatedColleagues,
    startIndex,
    endIndex,
    canNextPage,
    canPrevPage,
    goToPage,
    nextPage,
    prevPage,
    setPageSize,
    pageSizeOptions
  } = usePagination<ColleagueResponder>(processedColleagues, {
    initialPage: 1,
    initialPageSize: 6,
    pageSizeOptions: [6, 10, 25, 50]
  });

  const organizationTiers = useMemo(
    () =>
      agencyMeta.tiers.map((tierSpec) => ({
        ...tierSpec,
        members: agencyScopedColleagues.filter((c) => c.hierarchyTier === tierSpec.tier)
      })),
    [agencyMeta.tiers, agencyScopedColleagues]
  );

  const getStatusBadgeStyle = useCallback((status: ColleagueDutyStatus) => {
    switch (status) {
      case 'OnDuty':
        return {
          label: 'On Duty',
          pill: 'bg-emerald-100 text-emerald-900 border-emerald-700/30',
          dot: 'bg-emerald-600'
        };
      case 'Dispatched':
        return {
          label: 'Dispatched',
          pill: 'bg-amber-100 text-amber-900 border-amber-700/35',
          dot: 'bg-amber-600 animate-pulse'
        };
      case 'Standby':
        return {
          label: 'Standby',
          pill: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/40',
          dot: 'bg-[#A83B4D]'
        };
      default:
        return {
          label: 'Off Duty',
          pill: 'bg-stone-200 text-stone-700 border-stone-400/50',
          dot: 'bg-stone-500'
        };
    }
  }, []);

  const AgencyIcon = useMemo(() => {
    if (activeAgency === 'FIRE') return Flame;
    if (activeAgency === 'PNP') return Shield;
    return Ambulance;
  }, [activeAgency]);

  const getAgencySemanticBadge = useCallback((agency: AgencyScope) => {
    switch (agency) {
      case 'FIRE':
        return {
          label: 'BFP Fire Rescue',
          color: 'bg-amber-100 text-amber-900 border-amber-700/30',
          icon: Flame
        };
      case 'PNP':
        return {
          label: 'PNP Police',
          color: 'bg-sky-100 text-sky-900 border-sky-700/30',
          icon: Shield
        };
      default:
        return {
          label: 'RHU Medical',
          color: 'bg-[#E9D9D0] text-[#670626] border-[#A83B4D]/40',
          icon: Ambulance
        };
    }
  }, []);

  const sortOptions = useMemo(
    () => [
      { value: 'LEADERBOARD' as ColleagueSortOption, label: 'Sort: Performance' },
      { value: 'HIERARCHY' as ColleagueSortOption, label: 'Sort: Hierarchy' },
      { value: 'AVAILABILITY' as ColleagueSortOption, label: 'Sort: Availability' }
    ],
    []
  );

  const pageSizeDropdownOptions = useMemo(
    () =>
      pageSizeOptions.map((sz) => ({
        value: String(sz),
        label: `${sz} / page`
      })),
    [pageSizeOptions]
  );

  return (
    <div className="flex flex-col gap-6 text-[#F7F1EA] select-none pb-10 w-full">
      {/* Toast Feedback */}
      {statusFeedback && (
        <div className="fixed top-20 right-6 z-50 px-4 py-3 rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] text-[#670626] font-mono text-sm font-bold shadow-[0_14px_34px_rgba(74,4,26,0.35)] flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Header & Unit Scope Bar */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#E9D9D0] border border-[#A83B4D]/35 text-xs font-mono font-bold text-[#670626]">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>{agencyMeta.badgeLabel}</span>
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
              Katipunan, Zamboanga del Norte (7109)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-[#670626] tracking-tight flex items-center gap-2.5">
            <AgencyIcon className="w-7 h-7 text-[#670626]" />
            <span>Responders</span>
          </h1>
          <p className="text-sm text-[#6E3B46] font-medium mt-0.5">{agencyMeta.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="px-3.5 py-2 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 font-mono text-xs font-bold text-[#670626] flex items-center gap-2">
            <Users className="w-4 h-4 text-[#A83B4D]" />
            <span>
              {activeLeaderboard.length} Active {agencyMeta.personnelNoun}
            </span>
          </div>
        </div>
      </div>

      {/* Active Unit Readiness Banner */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-2">
              <span className="px-3 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold inline-flex items-center gap-1.5">
                <AgencyIcon className="w-3.5 h-3.5" />
                <span>{myUnit.unitCode}</span>
              </span>
              <span className="font-mono text-sm text-[#670626] font-bold">
                Lead: {myUnit.commanderName}
              </span>
            </div>

            <h2 className="text-xl md:text-2xl font-black text-[#2B010E] tracking-tight">
              {myUnit.unitName}
            </h2>

            <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs sm:text-sm font-mono text-[#5B2A35]">
              <span className="flex items-center gap-2">
                <span className="text-[#A83B4D] font-bold">Status:</span>
                <span
                  className={`font-bold px-2.5 py-0.5 rounded-lg border ${
                    getStatusBadgeStyle(myUnit.status).pill
                  }`}
                >
                  {getStatusBadgeStyle(myUnit.status).label}
                </span>
              </span>
              <span className="text-[#A83B4D]/50">|</span>
              <span>
                Shift: <strong className="text-[#2B010E]">{myUnit.shiftSchedule}</strong>
              </span>
              <span className="text-[#A83B4D]/50">|</span>
              <span>
                Unit Roster:{' '}
                <strong className="text-[#670626]">
                  {agencyScopedColleagues.length} {agencyMeta.personnelNoun}
                </strong>
              </span>
            </div>
          </div>

          <div className="clay-well px-4 py-3 bg-[#E9D9D0] border border-[#670626]/15 flex flex-col items-start lg:items-end font-mono">
            <span className="text-xs text-[#A83B4D] font-bold uppercase tracking-wider">
              Base Telemetry GPS
            </span>
            <span className="text-sm font-bold text-[#670626] tracking-wider mt-0.5">
              {formatGpsCoord(myUnit.baseLatitude, myUnit.baseLongitude)}
            </span>
            <span className="text-xs text-[#5B2A35] mt-0.5">
              {activeAgency} Scope
            </span>
          </div>
        </div>

        {/* Unit Duty Status Selector */}
        <div className="mt-5 pt-4 border-t border-[#670626]/15">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D] block mb-2.5">
            Unit Status
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(
              [
                { key: 'OnDuty', label: 'On Duty', activeClass: 'bg-emerald-700 text-[#F7F1EA] border-emerald-800 shadow-md' },
                { key: 'Dispatched', label: 'Dispatched', activeClass: 'bg-amber-600 text-[#F7F1EA] border-amber-700 shadow-md' },
                { key: 'Standby', label: 'Standby', activeClass: 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-md' },
                { key: 'OffDuty', label: 'Off Duty', activeClass: 'bg-stone-700 text-[#F7F1EA] border-stone-800 shadow-md' }
              ] as Array<{ key: ColleagueDutyStatus; label: string; activeClass: string }>
            ).map((btn) => {
              const isActive = myUnit.status === btn.key;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => handleToggleDuty(btn.key)}
                  className={`py-2.5 px-3 rounded-xl font-mono font-bold text-sm transition-all duration-150 border active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                    isActive
                      ? btn.activeClass
                      : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/20 hover:bg-[#DFC9BE]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-[#F7F1EA]' : getStatusBadgeStyle(btn.key).dot
                    }`}
                  />
                  <span>{btn.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Responders Leaderboard (OnDuty & Dispatched ranked by Response Speed & Mission Succession Rate) */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#670626]/15">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Trophy className="w-4 h-4 text-[#670626]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
                {activeAgency} Leaderboard
              </span>
              {activeDispatchesCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-xs font-bold">
                  {activeDispatchesCount} Active
                </span>
              )}
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#670626] tracking-tight mt-0.5">
              Top Responders
            </h2>
          </div>

          <ResponderButton
            variant="secondary"
            size="sm"
            onClick={() => setShowFullLeaderboard((prev) => !prev)}
          >
            {showFullLeaderboard
              ? 'Show Top 5'
              : `View All Active (${activeLeaderboard.length})`}
          </ResponderButton>
        </div>

        <div className="overflow-x-auto mt-4 rounded-xl border border-[#670626]/15 bg-[#FAF5EE]">
          <table className="w-full text-left text-sm font-mono">
            <thead className="bg-[#E9D9D0] text-[#670626] text-xs uppercase border-b border-[#670626]/15">
              <tr>
                <th className="p-3.5">Rank</th>
                <th className="p-3.5">Responder</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Response Speed</th>
                <th className="p-3.5">Succession Rate</th>
                <th className="p-3.5">Resolved</th>
                <th className="p-3.5">Sector</th>
                <th className="p-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#670626]/10">
              {(showFullLeaderboard ? activeLeaderboard : activeLeaderboard.slice(0, 5)).map(
                (member, idx) => {
                  const rank = idx + 1;
                  const statusBadge = getStatusBadgeStyle(member.status);
                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedColleague(member)}
                      className="hover:bg-[#E9D9D0]/55 transition-colors cursor-pointer group"
                    >
                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black text-xs border ${
                            rank === 1
                              ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-sm'
                              : rank === 2
                              ? 'bg-[#A83B4D] text-[#F7F1EA] border-[#670626]'
                              : rank === 3
                              ? 'bg-[#E9D9D0] text-[#670626] border-[#670626]/40'
                              : 'bg-[#FAF5EE] text-[#5B2A35] border-[#670626]/20'
                          }`}
                        >
                          #{rank}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-sans font-bold text-[#2B010E] group-hover:text-[#670626] flex items-center gap-1.5 text-sm">
                          <span>{member.fullName}</span>
                          {rank <= 3 && <Award className="w-4 h-4 text-[#A83B4D] flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-[#A83B4D] font-bold">
                          {member.callsign} · {member.unitCode}
                        </div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-[#E9D9D0] text-[#670626] border border-[#670626]/15 text-xs font-bold">
                          {member.roleCategory}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-sm font-black text-[#670626] tabular-nums">
                          <Gauge className="w-4 h-4 text-[#A83B4D]" />
                          <span>{member.avgResponseTime}</span>
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-800 tabular-nums">
                          <TrendingUp className="w-4 h-4 text-emerald-700" />
                          <span>{member.missionSuccessRate.toFixed(1)}%</span>
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-base font-black text-[#2B010E] tabular-nums">
                          {member.resolvedMissions}
                        </span>
                      </td>
                      <td
                        className="p-3.5 text-[#5B2A35] max-w-[220px] truncate text-xs"
                        title={member.sectorAssignment}
                      >
                        {member.sectorAssignment}
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge.pill}`}
                        >
                          {statusBadge.label}
                        </span>
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unit Chain of Command Hierarchy */}
      <div className="clay-surface p-5 sm:p-6 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#670626]/15">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-[#A83B4D]" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D]">
                {activeAgency} Chain of Command
              </span>
            </div>
            <h2 className="text-lg md:text-xl font-black text-[#670626] tracking-tight mt-0.5">
              Command Hierarchy
            </h2>
          </div>

          {selectedTierFilter !== 'ALL' && (
            <ResponderButton
              variant="secondary"
              size="sm"
              onClick={() => setSelectedTierFilter('ALL')}
            >
              Show All Tiers
            </ResponderButton>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-4">
          {organizationTiers.map((tierObj, index) => {
            const isTierSelected = selectedTierFilter === tierObj.tier;
            return (
              <div
                key={tierObj.tier}
                className={`clay-well rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                  isTierSelected
                    ? 'border-[#670626] bg-[#E9D9D0] ring-2 ring-[#670626]/25'
                    : 'bg-[#E9D9D0]/80 border-[#670626]/15 hover:border-[#A83B4D]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-black bg-[#670626] text-[#F7F1EA]">
                      {tierObj.code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTierFilter((prev) =>
                            prev === tierObj.tier ? 'ALL' : tierObj.tier
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-[#F7F1EA] hover:bg-white text-xs font-mono font-bold text-[#670626] border border-[#670626]/20 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isTierSelected ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Filtered</span>
                          </>
                        ) : (
                          <span>Filter ({tierObj.members.length})</span>
                        )}
                      </button>
                      {index < organizationTiers.length - 1 && (
                        <ChevronRight className="hidden lg:inline-block w-4 h-4 text-[#A83B4D]" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-black font-mono text-[#670626] leading-snug">
                    {tierObj.title}
                  </h3>
                  <p className="text-xs text-[#5B2A35] mt-0.5">{tierObj.subtitle}</p>

                  <div className="mt-3 pt-2.5 border-t border-[#670626]/15 flex flex-col gap-2">
                    {tierObj.members.map((member) => {
                      const statusStyle = getStatusBadgeStyle(member.status);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedColleague(member)}
                          className="w-full text-left p-2.5 rounded-xl bg-[#F7F1EA] hover:bg-white border border-[#670626]/15 hover:border-[#670626]/45 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[#2B010E] group-hover:text-[#670626] truncate">
                              {member.fullName}
                            </div>
                            <div className="text-xs font-mono text-[#A83B4D] truncate">
                              {member.callsign} · {member.avgResponseTime}
                            </div>
                          </div>
                          <span
                            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusStyle.dot}`}
                            title={statusStyle.label}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#670626]/15 flex items-center justify-between text-xs font-mono text-[#5B2A35]">
                  <span>Active Duty</span>
                  <span className="text-emerald-800 font-bold">
                    {
                      tierObj.members.filter(
                        (m) => m.status === 'OnDuty' || m.status === 'Dispatched'
                      ).length
                    }{' '}
                    / {tierObj.members.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Filter Buttons + Search, Sort, Toggle & Directory */}
      <div className="flex flex-col gap-4">
        <div className="clay-surface p-4 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A83B4D] flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#670626]" />
              <span>Filter by Status</span>
            </span>
            <span className="text-xs font-mono text-[#670626] font-bold">
              {processedColleagues.length} of {agencyScopedColleagues.length}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {(
              [
                { key: 'ALL_COLLEAGUES', label: 'All', count: statusCounts.ALL_COLLEAGUES },
                { key: 'ACTIVE_AVAILABLE', label: 'On Duty', count: statusCounts.ACTIVE_AVAILABLE },
                { key: 'BEING_DISPATCHED', label: 'Dispatched', count: statusCounts.BEING_DISPATCHED },
                { key: 'STANDBY', label: 'Standby', count: statusCounts.STANDBY },
                { key: 'OFF_DUTY', label: 'Off Duty', count: statusCounts.OFF_DUTY }
              ] as Array<{ key: StatusFilterOption; label: string; count: number }>
            ).map((btn) => {
              const isSelected = statusFilter === btn.key;
              return (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setStatusFilter(btn.key)}
                  className={`py-2.5 px-3.5 rounded-xl font-mono text-sm font-bold border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-md'
                      : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/15 hover:bg-[#DFC9BE]'
                  }`}
                >
                  <span>{btn.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-xs ${
                      isSelected
                        ? 'bg-[#F7F1EA]/20 text-[#F7F1EA]'
                        : 'bg-[#F7F1EA] text-[#670626]'
                    }`}
                  >
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Control Bar */}
        <div className="clay-surface p-4 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#670626]" />
            <h2 className="text-lg font-black text-[#670626] tracking-tight">
              {activeAgency} Roster
            </h2>
            <span className="px-3 py-0.5 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] font-mono text-sm font-bold">
              {processedColleagues.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search name, callsign, sector..."
              className="w-full sm:w-64"
            />

            <Dropdown<ColleagueSortOption>
              options={sortOptions}
              value={sortBy}
              onChange={setSortBy}
              menuWidth="w-60"
              align="right"
            />

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Directory Grid / Table */}
        {loading ? (
          <div className="clay-surface p-12 text-center text-[#670626] font-mono text-base animate-pulse bg-[#F7F1EA]">
            Loading {activeAgency} responder roster...
          </div>
        ) : paginatedColleagues.length === 0 ? (
          <div className="clay-surface p-12 text-center text-[#5B2A35] font-mono text-sm flex flex-col items-center gap-3 bg-[#F7F1EA]">
            <span>No matching {activeAgency} responders.</span>
            <ResponderButton
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('ALL_COLLEAGUES');
                setSelectedTierFilter('ALL');
                setSearchQuery('');
              }}
            >
              Reset Filters
            </ResponderButton>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedColleagues.map((colleague) => {
              const badge = getAgencySemanticBadge(colleague.agency);
              const statusStyle = getStatusBadgeStyle(colleague.status);
              const leaderboardRank = leaderboardRankMap.get(colleague.id);

              return (
                <div
                  key={colleague.id}
                  onClick={() => setSelectedColleague(colleague)}
                  className="clay-surface p-5 bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 hover:border-[#670626]/45 flex flex-col justify-between hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border inline-flex items-center gap-1.5 ${badge.color}`}
                        >
                          <badge.icon className="w-3.5 h-3.5" />
                          <span>{colleague.roleCategory}</span>
                        </span>
                        <span className="font-mono text-sm font-bold text-[#670626]">
                          {colleague.callsign}
                        </span>
                        {leaderboardRank !== undefined && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#670626] text-[#F7F1EA] font-mono text-xs font-black inline-flex items-center gap-1">
                            <Trophy className="w-3.5 h-3.5" />
                            <span>#{leaderboardRank}</span>
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1.5 ${statusStyle.pill}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                        <span>{statusStyle.label}</span>
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-[#2B010E] group-hover:text-[#670626] transition-colors">
                      {colleague.fullName}
                    </h3>
                    <p className="text-sm font-mono text-[#A83B4D] font-bold mt-0.5">
                      {colleague.rankTitle}
                    </p>
                    <p className="text-xs text-[#5B2A35] mt-1">
                      <strong className="text-[#2B010E]">{colleague.unitName}</strong> ·{' '}
                      {colleague.unitCode}
                    </p>

                    <div className="grid grid-cols-3 gap-2.5 mt-4 pt-3.5 border-t border-[#670626]/15 text-xs font-mono">
                      <div className="clay-well p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                        <span className="text-[#A83B4D] block text-xs">Avg Speed</span>
                        <span className="text-[#670626] font-black text-base tabular-nums">
                          {colleague.avgResponseTime}
                        </span>
                      </div>
                      <div className="clay-well p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                        <span className="text-[#A83B4D] block text-xs">Succession</span>
                        <span className="text-emerald-800 font-black text-base tabular-nums">
                          {colleague.missionSuccessRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="clay-well p-2.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                        <span className="text-[#A83B4D] block text-xs">Resolved</span>
                        <span className="text-[#2B010E] font-black text-base tabular-nums">
                          {colleague.resolvedMissions}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-col gap-1.5 text-xs font-mono text-[#5B2A35]">
                      <div className="truncate">
                        <span className="text-[#A83B4D] font-bold">Sector: </span>
                        <span className="text-[#2B010E] font-semibold">
                          {colleague.sectorAssignment}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[#670626] font-bold">
                          <Radio className="w-3.5 h-3.5 text-[#A83B4D]" />
                          <span>{colleague.radioChannel}</span>
                        </span>
                        <span className="text-xs font-bold text-[#A83B4D]">
                          Active Dispatches: {colleague.activeDispatches}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#670626]/15 flex items-center justify-between font-mono text-xs">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        copyCoordinates(colleague.baseLatitude, colleague.baseLongitude);
                      }}
                      className="text-[#5B2A35] hover:text-[#670626] cursor-pointer truncate max-w-[190px] inline-flex items-center gap-1"
                      title="Copy GPS coordinates"
                    >
                      <MapPin className="w-4 h-4 text-[#A83B4D]" />
                      <span>
                        {formatGpsCoord(colleague.baseLatitude, colleague.baseLongitude)}
                      </span>
                    </span>

                    <div className="flex items-center gap-2">
                      <ResponderButton
                        variant="secondary"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickNavigate(colleague.baseLatitude, colleague.baseLongitude);
                        }}
                        icon={<Navigation className="w-3.5 h-3.5" />}
                      >
                        GPS
                      </ResponderButton>
                      <ResponderButton
                        variant="primary"
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedColleague(colleague);
                        }}
                      >
                        Inspect
                      </ResponderButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="clay-surface overflow-x-auto rounded-2xl border border-[#670626]/15 bg-[#F7F1EA]">
            <table className="w-full text-left text-sm font-mono">
              <thead className="bg-[#E9D9D0] text-[#670626] text-xs uppercase border-b border-[#670626]/15">
                <tr>
                  <th className="p-4">Callsign</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Speed &amp; Success</th>
                  <th className="p-4">Sector</th>
                  <th className="p-4">Radio Channel</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#670626]/10 bg-[#FAF5EE]">
                {paginatedColleagues.map((colleague) => {
                  const statusStyle = getStatusBadgeStyle(colleague.status);
                  const leaderboardRank = leaderboardRankMap.get(colleague.id);
                  return (
                    <tr
                      key={colleague.id}
                      onClick={() => setSelectedColleague(colleague)}
                      className="hover:bg-[#E9D9D0]/55 transition-colors cursor-pointer"
                    >
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-[#670626] font-bold">{colleague.callsign}</div>
                        <div className="text-xs text-[#A83B4D]">{colleague.unitCode}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-[#2B010E] font-sans font-bold">
                          {colleague.fullName}
                        </div>
                        {leaderboardRank !== undefined && (
                          <span className="text-xs text-[#670626] font-bold">
                            Active Rank #{leaderboardRank}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-[#670626] font-bold text-xs">
                          {colleague.rankTitle}
                        </div>
                        <div className="text-xs text-[#5B2A35]">{colleague.roleCategory}</div>
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusStyle.pill}`}
                        >
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-4 whitespace-nowrap text-xs">
                        <span className="text-[#670626] font-bold">{colleague.avgResponseTime}</span>
                        <span className="text-[#A83B4D]"> · </span>
                        <span className="text-emerald-800 font-bold">
                          {colleague.missionSuccessRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-[#5B2A35] max-w-[200px] truncate text-xs">
                        {colleague.sectorAssignment}
                      </td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="text-[#670626] font-semibold text-xs">
                          {colleague.radioChannel}
                        </div>
                        <div className="text-xs text-[#A83B4D]">
                          {colleague.resolvedMissions} Resolved
                        </div>
                      </td>
                      <td className="p-4 text-right whitespace-nowrap">
                        <ResponderButton
                          variant="primary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedColleague(colleague);
                          }}
                        >
                          Inspect
                        </ResponderButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls Bar */}
        <div className="clay-surface p-4 rounded-2xl bg-[#F7F1EA] text-[#2B010E] border border-[#670626]/15 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-sm">
          <div className="flex items-center gap-3 text-[#5B2A35]">
            <span>
              <strong className="text-[#670626]">
                {totalItems === 0 ? 0 : startIndex + 1}
              </strong>
              –<strong className="text-[#670626]">{endIndex}</strong> of{' '}
              <strong className="text-[#670626]">{totalItems}</strong>
            </span>
            <Dropdown<string>
              variant="pagination"
              options={pageSizeDropdownOptions}
              value={String(pageSize)}
              onChange={(val) => setPageSize(Number(val))}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <ResponderButton
              variant="secondary"
              size="xs"
              disabled={!canPrevPage}
              onClick={prevPage}
              icon={<ChevronLeft className="w-4 h-4" />}
            >
              Prev
            </ResponderButton>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => goToPage(pageNum)}
                className={`w-9 h-9 rounded-xl font-bold text-sm border transition-colors cursor-pointer ${
                  pageNum === currentPage
                    ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] font-black'
                    : 'bg-[#E9D9D0] text-[#670626] border-[#670626]/15 hover:bg-[#DFC9BE]'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <ResponderButton
              variant="secondary"
              size="xs"
              disabled={!canNextPage}
              onClick={nextPage}
              icon={<ChevronRight className="w-4 h-4" />}
              iconPosition="right"
            >
              Next
            </ResponderButton>
          </div>
        </div>
      </div>

      {/* Responder Profile Modal */}
      {selectedColleague && (
        <ResponderModalCard
          isOpen={Boolean(selectedColleague)}
          onClose={() => setSelectedColleague(null)}
          title={selectedColleague.fullName}
          subtitle={`${selectedColleague.callsign} · ${selectedColleague.unitCode}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-[#2B010E] text-sm font-mono">
            <div className="clay-well p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-[#670626] text-[#F7F1EA] text-xs font-bold">
                    Tier {selectedColleague.hierarchyTier} · {selectedColleague.roleCategory}
                  </span>
                  <span className="text-[#5B2A35] text-xs">
                    ID: <strong className="text-[#2B010E]">{selectedColleague.licenseOrBadge}</strong>
                  </span>
                </div>
                <h3 className="text-xl font-black text-[#670626] font-sans">
                  {selectedColleague.fullName}
                </h3>
                <p className="text-[#A83B4D] text-sm font-bold mt-0.5">
                  {selectedColleague.specialization}
                </p>
              </div>

              <div className="flex flex-col sm:items-end gap-1.5">
                <span
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    getStatusBadgeStyle(selectedColleague.status).pill
                  }`}
                >
                  {getStatusBadgeStyle(selectedColleague.status).label}
                </span>
                {leaderboardRankMap.get(selectedColleague.id) && (
                  <span className="text-xs text-[#670626] font-bold">
                    Active Rank #{leaderboardRankMap.get(selectedColleague.id)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Resolved</span>
                <span className="text-xl font-black text-[#2B010E]">
                  {selectedColleague.resolvedMissions}
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Active</span>
                <span className="text-xl font-black text-amber-800">
                  {selectedColleague.activeDispatches}
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Success Rate</span>
                <span className="text-xl font-black text-emerald-800">
                  {selectedColleague.missionSuccessRate.toFixed(1)}%
                </span>
              </div>
              <div className="clay-well p-3.5 rounded-xl bg-[#E9D9D0] border border-[#670626]/10">
                <span className="text-xs text-[#A83B4D] block">Avg Speed</span>
                <span className="text-xl font-black text-[#670626]">
                  {selectedColleague.avgResponseTime}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-[#E9D9D0] border border-[#670626]/15">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#A83B4D] font-bold">Unit</span>
                <span className="text-[#2B010E] font-bold">
                  {selectedColleague.unitName} ({selectedColleague.unitCode})
                </span>
                <span className="text-xs text-[#5B2A35]">
                  Shift: {selectedColleague.shiftSchedule}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-[#A83B4D] font-bold">Sector</span>
                <span className="text-[#670626] font-bold">
                  {selectedColleague.sectorAssignment}
                </span>
                <span className="text-xs text-[#5B2A35]">
                  Tenure: {selectedColleague.yearsOfService} yrs
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-2 border-t border-[#670626]/15 sm:col-span-2">
                <span className="text-xs text-[#A83B4D] font-bold">Radio Dispatch Channel</span>
                <span className="text-[#670626] font-bold inline-flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-[#A83B4D]" />
                  <span>{selectedColleague.radioChannel}</span>
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs text-[#A83B4D] font-bold block mb-2">
                Certifications
              </span>
              <div className="flex flex-wrap gap-2">
                {selectedColleague.certifications.map((cert) => (
                  <span
                    key={cert}
                    className="px-3 py-1 rounded-lg bg-[#E9D9D0] border border-[#670626]/20 text-[#670626] text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <BadgeCheck className="w-4 h-4 text-emerald-700" />
                    <span>{cert}</span>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#670626]/15">
              <ResponderButton
                variant="primary"
                size="sm"
                onClick={() => {
                  showToast(`Radio ping sent to ${selectedColleague.callsign}`);
                }}
                icon={<Radio className="w-4 h-4" />}
              >
                Ping Radio
              </ResponderButton>

              <ResponderButton
                variant="outline"
                size="sm"
                onClick={() => setSelectedColleague(null)}
              >
                Close
              </ResponderButton>
            </div>
          </div>
        </ResponderModalCard>
      )}

    </div>
  );
};

export default DutyRosterView;
