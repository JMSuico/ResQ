// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical duty roster check-in, RHU Ambulance Crew organizational hierarchy,
// colleague performance leaderboard, and shift schedule inspection for responders.
// DO NOT mutate shift assignments without recording operational timestamp.

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
  DefaultFloatingModalCard,
  Button,
  Dropdown
} from '@/Shared';
import { getDutyRoster, updateUnitDutyStatus, DutyUnit } from '@/Endpoints/responderOpsApi';
import { getAgencyReports } from '@/Endpoints/reportsApi';
import { formatGpsCoord } from '@/Libs/Assets/formatters';
import {
  Ambulance,
  Flame,
  Shield,
  AlertTriangle,
  ClipboardList,
  Phone,
  Users,
  MapPin,
  Navigation,
  Award,
  Radio,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  HeartPulse,
  Filter,
  BadgeCheck,
  GitBranch,
  Trophy
} from 'lucide-react';

export type ColleagueDutyStatus = 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty';

export type StatusFilterOption =
  | 'ALL_COLLEAGUES'
  | 'ACTIVE_AVAILABLE'
  | 'BEING_DISPATCHED'
  | 'STANDBY'
  | 'OFF_DUTY';

export type ColleagueSortOption = 'HIERARCHY' | 'LEADERBOARD' | 'AVAILABILITY';

export type MedicHierarchyTier = 1 | 2 | 3 | 4;

export interface ColleagueResponder {
  id: string;
  fullName: string;
  callsign: string;
  unitCode: string;
  unitName: string;
  agency: 'RHU' | 'FIRE' | 'PNP';
  rankTitle: string;
  roleCategory:
    | 'RHU Medical Officer'
    | 'Triage Nurse'
    | 'EMT Paramedic'
    | 'Ambulance Driver / Medic'
    | 'BFP Fire Officer'
    | 'PNP Police Officer';
  hierarchyTier: MedicHierarchyTier;
  hierarchyTierLabel:
    | 'HEAD CHIEF (Municipal Health Officer / RHU Chief)'
    | 'MEDICAL OFFICER III'
    | 'SENIOR EMS PARAMEDIC / TRIAGE LEAD'
    | 'AMBULANCE CREW MEMBERS';
  specialization: string;
  licenseOrBadge: string;
  status: ColleagueDutyStatus;
  resolvedMissions: number;
  activeDispatches: number;
  responseReadiness: number;
  avgResponseTime: string;
  sectorAssignment: string;
  shiftSchedule: string;
  radioChannel: string;
  contactHotline: string;
  baseLatitude: number;
  baseLongitude: number;
  certifications: string[];
  yearsOfService: number;
}

const INITIAL_COLLEAGUE_ROSTER: ColleagueResponder[] = [
  // TIER 1: HEAD CHIEF (Municipal Health Officer / RHU Chief)
  {
    id: 'medic-col-01',
    fullName: 'Dr. Rafael Lorenzo Mendoza MD, MPH',
    callsign: 'RHU-CHIEF-01',
    unitCode: 'MED-HQ-01',
    unitName: 'RHU Municipal Health Command Center',
    agency: 'RHU',
    rankTitle: 'HEAD CHIEF (Municipal Health Officer / RHU Chief)',
    roleCategory: 'RHU Medical Officer',
    hierarchyTier: 1,
    hierarchyTierLabel: 'HEAD CHIEF (Municipal Health Officer / RHU Chief)',
    specialization: 'Municipal Disaster Medicine & Mass-Casualty Command',
    licenseOrBadge: 'PRC-MD-0084921',
    status: 'OnDuty',
    resolvedMissions: 342,
    activeDispatches: 1,
    responseReadiness: 99.8,
    avgResponseTime: '2m 45s',
    sectorAssignment: 'Sector 0 - Municipal Health Command & All-Sector Oversight',
    shiftSchedule: '06:00 - 18:00 (Alpha Command Shift)',
    radioChannel: 'MED-COM CH-1 (155.340 MHz)',
    contactHotline: '+63 917 800 1101',
    baseLatitude: 14.5995,
    baseLongitude: 120.9842,
    certifications: ['ATLS Director', 'ACLS Master', 'FEMA ICS-400', 'Public Health Emergency Chief'],
    yearsOfService: 16
  },

  // TIER 2: MEDICAL OFFICER III (Dr. Maria Clara Santos MD & Peer MO III)
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
    hierarchyTierLabel: 'MEDICAL OFFICER III',
    specialization: 'Emergency Trauma Resuscitation & Field Triage Command',
    licenseOrBadge: 'PRC-MD-0104382',
    status: 'OnDuty',
    resolvedMissions: 289,
    activeDispatches: 2,
    responseReadiness: 99.5,
    avgResponseTime: '3m 05s',
    sectorAssignment: 'Sector 1 - Poblacion Central & Primary Trauma Grid',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    contactHotline: '+63 917 555 0142',
    baseLatitude: 14.6012,
    baseLongitude: 120.9865,
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
    hierarchyTierLabel: 'MEDICAL OFFICER III',
    specialization: 'Acute Cardiac Life Support & Highway Extraction Medicine',
    licenseOrBadge: 'PRC-MD-0109844',
    status: 'Dispatched',
    resolvedMissions: 254,
    activeDispatches: 3,
    responseReadiness: 98.4,
    avgResponseTime: '3m 18s',
    sectorAssignment: 'Sector 2 - North Highway Arterial & Viaduct Corridor',
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    radioChannel: 'MED-TAC CH-2 (155.400 MHz)',
    contactHotline: '+63 917 555 0148',
    baseLatitude: 14.6088,
    baseLongitude: 120.9912,
    certifications: ['ATLS Certified', 'ACLS Experienced', 'Airway Management Specialist'],
    yearsOfService: 8
  },

  // TIER 3: SENIOR EMS PARAMEDIC / TRIAGE LEAD
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
    hierarchyTierLabel: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
    specialization: 'START Mass-Casualty Triage & Critical Care Nursing',
    licenseOrBadge: 'PRC-RN-0492811',
    status: 'OnDuty',
    resolvedMissions: 231,
    activeDispatches: 1,
    responseReadiness: 99.1,
    avgResponseTime: '3m 12s',
    sectorAssignment: 'Sector 1 - Central Mass-Casualty Triage Hub',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    contactHotline: '+63 917 555 0163',
    baseLatitude: 14.6012,
    baseLongitude: 120.9865,
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
    hierarchyTierLabel: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
    specialization: 'Advanced Life Support (ALS) & Cardiac Defibrillation Lead',
    licenseOrBadge: 'DOH-EMTP-22910',
    status: 'Dispatched',
    resolvedMissions: 218,
    activeDispatches: 2,
    responseReadiness: 97.9,
    avgResponseTime: '3m 29s',
    sectorAssignment: 'Sector 3 - Coastal & Industrial Trauma Zone',
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    radioChannel: 'MED-TAC CH-2 (155.400 MHz)',
    contactHotline: '+63 917 555 0177',
    baseLatitude: 14.6088,
    baseLongitude: 120.9912,
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
    hierarchyTierLabel: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
    specialization: 'Emergency Obstetric, Pediatric & Evacuation Triage Lead',
    licenseOrBadge: 'PRC-RN-0518390',
    status: 'Standby',
    resolvedMissions: 186,
    activeDispatches: 0,
    responseReadiness: 96.8,
    avgResponseTime: '3m 40s',
    sectorAssignment: 'Sector 4 - East Barangay Evacuation Staging',
    shiftSchedule: '14:00 - 02:00 (Swing Standby Shift)',
    radioChannel: 'MED-TAC CH-3 (155.475 MHz)',
    contactHotline: '+63 917 555 0184',
    baseLatitude: 14.5941,
    baseLongitude: 120.9934,
    certifications: ['NRP Neonatal Resuscitation', 'PALS Provider', 'Disaster Triage Lead'],
    yearsOfService: 5
  },

  // TIER 4: AMBULANCE CREW MEMBERS (EMT Paramedics, Triage Nurses, Ambulance Drivers/Medics)
  {
    id: 'medic-col-07',
    fullName: 'Med-Op Jerome Kristoffer Navarro',
    callsign: 'AMB-DRIVER-01',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — TACTICAL EMS DRIVER / MEDIC',
    roleCategory: 'Ambulance Driver / Medic',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Emergency Vehicle Operations (EVOC) & Extrication Rigging',
    licenseOrBadge: 'LTO-EVOC-88319',
    status: 'OnDuty',
    resolvedMissions: 210,
    activeDispatches: 1,
    responseReadiness: 99.2,
    avgResponseTime: '2m 55s',
    sectorAssignment: 'Sector 1 - Poblacion Central High-Speed Extraction',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    contactHotline: '+63 917 555 0219',
    baseLatitude: 14.6012,
    baseLongitude: 120.9865,
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
    rankTitle: 'AMBULANCE CREW — EMT PARAMEDIC RESPONDER',
    roleCategory: 'EMT Paramedic',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Hemorrhage Control, Spinal Immobilization & Splinting',
    licenseOrBadge: 'DOH-EMTB-34012',
    status: 'OnDuty',
    resolvedMissions: 195,
    activeDispatches: 1,
    responseReadiness: 98.7,
    avgResponseTime: '3m 10s',
    sectorAssignment: 'Sector 1 - Poblacion Central & Trauma Grid',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    contactHotline: '+63 917 555 0191',
    baseLatitude: 14.6012,
    baseLongitude: 120.9865,
    certifications: ['EMT-Basic', 'Stop the Bleed Instructor', 'BLS Healthcare Provider'],
    yearsOfService: 4
  },
  {
    id: 'medic-col-09',
    fullName: 'RN Sofia Isabel Mercado, BSN',
    callsign: 'CREW-NURSE-05',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — FIELD TRIAGE NURSE',
    roleCategory: 'Triage Nurse',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Pre-Hospital IV Therapy, Vitals Telemetry & PCR Documentation',
    licenseOrBadge: 'PRC-RN-0602145',
    status: 'OnDuty',
    resolvedMissions: 174,
    activeDispatches: 1,
    responseReadiness: 98.4,
    avgResponseTime: '3m 15s',
    sectorAssignment: 'Sector 1 - Poblacion Central & Trauma Grid',
    shiftSchedule: '06:00 - 18:00 (Alpha Field Shift)',
    radioChannel: 'MED-TAC CH-1 (155.340 MHz)',
    contactHotline: '+63 917 555 0205',
    baseLatitude: 14.6012,
    baseLongitude: 120.9865,
    certifications: ['Registered Nurse', 'IV Therapy Certified', 'ACLS Provider'],
    yearsOfService: 4
  },
  {
    id: 'medic-col-10',
    fullName: 'EMT-P Hannah Grace Lim',
    callsign: 'CREW-MEDIC-06',
    unitCode: 'AMB-RHU-02',
    unitName: 'RHU Mobile Trauma ICU Ambulance Bravo-2',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — EMT PARAMEDIC RESPONDER',
    roleCategory: 'EMT Paramedic',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Airway Intubation, Capnography & Vehicular Trauma Care',
    licenseOrBadge: 'DOH-EMTP-38920',
    status: 'Dispatched',
    resolvedMissions: 162,
    activeDispatches: 2,
    responseReadiness: 97.5,
    avgResponseTime: '3m 32s',
    sectorAssignment: 'Sector 2 - North Highway Arterial Corridor',
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    radioChannel: 'MED-TAC CH-2 (155.400 MHz)',
    contactHotline: '+63 917 555 0233',
    baseLatitude: 14.6088,
    baseLongitude: 120.9912,
    certifications: ['EMT-Paramedic', 'PHTLS Provider', 'Advanced Airway Tech'],
    yearsOfService: 3
  },
  {
    id: 'medic-col-11',
    fullName: 'Med-Op Noel Christian Aquino',
    callsign: 'AMB-DRIVER-02',
    unitCode: 'AMB-RHU-02',
    unitName: 'RHU Mobile Trauma ICU Ambulance Bravo-2',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — TACTICAL EMS DRIVER / MEDIC',
    roleCategory: 'Ambulance Driver / Medic',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Night Navigation, Siren Corridor Clearing & Oxygen Manifold Ops',
    licenseOrBadge: 'LTO-EVOC-90412',
    status: 'Dispatched',
    resolvedMissions: 158,
    activeDispatches: 2,
    responseReadiness: 97.1,
    avgResponseTime: '3m 20s',
    sectorAssignment: 'Sector 2 - North Highway Arterial Corridor',
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    radioChannel: 'MED-TAC CH-2 (155.400 MHz)',
    contactHotline: '+63 917 555 0247',
    baseLatitude: 14.6088,
    baseLongitude: 120.9912,
    certifications: ['EVOC Certified', 'BLS Responder', 'Tactical Radio Operator'],
    yearsOfService: 5
  },
  {
    id: 'medic-col-12',
    fullName: 'EMT-B Bea Katrina Ocampo',
    callsign: 'CREW-MEDIC-07',
    unitCode: 'AMB-RHU-03',
    unitName: 'RHU Bravo-3 Basic Life Support & Evacuation Rig',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — EMT PARAMEDIC RESPONDER',
    roleCategory: 'EMT Paramedic',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Thermal Burn Dressing, Fracture Stabilization & Rehab Triage',
    licenseOrBadge: 'DOH-EMTB-41205',
    status: 'Standby',
    resolvedMissions: 143,
    activeDispatches: 0,
    responseReadiness: 96.0,
    avgResponseTime: '3m 48s',
    sectorAssignment: 'Sector 4 - East Barangay Evacuation Staging',
    shiftSchedule: '14:00 - 02:00 (Swing Standby Shift)',
    radioChannel: 'MED-TAC CH-3 (155.475 MHz)',
    contactHotline: '+63 917 555 0260',
    baseLatitude: 14.5941,
    baseLongitude: 120.9934,
    certifications: ['EMT-Basic', 'Burn Trauma Care', 'BLS Provider'],
    yearsOfService: 3
  },
  {
    id: 'medic-col-13',
    fullName: 'Med-Op Dennis Paul Tolentino',
    callsign: 'AMB-DRIVER-03',
    unitCode: 'AMB-RHU-03',
    unitName: 'RHU Bravo-3 Basic Life Support & Evacuation Rig',
    agency: 'RHU',
    rankTitle: 'AMBULANCE CREW — TACTICAL EMS DRIVER / MEDIC',
    roleCategory: 'Ambulance Driver / Medic',
    hierarchyTier: 4,
    hierarchyTierLabel: 'AMBULANCE CREW MEMBERS',
    specialization: 'Apparatus Preventive Maintenance, Defibrillator & O2 Logistics',
    licenseOrBadge: 'LTO-EVOC-94108',
    status: 'OffDuty',
    resolvedMissions: 129,
    activeDispatches: 0,
    responseReadiness: 94.5,
    avgResponseTime: '4m 05s',
    sectorAssignment: 'Sector 5 - RHU Base Motorpool / Relief Reserve',
    shiftSchedule: '18:00 - 06:00 (Night Relief Shift)',
    radioChannel: 'MED-TAC CH-3 (155.475 MHz)',
    contactHotline: '+63 917 555 0278',
    baseLatitude: 14.5941,
    baseLongitude: 120.9934,
    certifications: ['EVOC Certified', 'Apparatus Telemetry Tech', 'First Aid Responder'],
    yearsOfService: 2
  },

  // BFP FIRE & PNP POLICE COLLEAGUES (Retained for Fire/Police role support when non-RHU role logs in)
  {
    id: 'fire-col-01',
    fullName: 'SINSP Ricardo Dalisay BFP',
    callsign: 'BFP-ENGINE-01',
    unitCode: 'FIRE-ENG-01',
    unitName: 'BFP Central Fire Station Pumper Truck 01',
    agency: 'FIRE',
    rankTitle: 'MUNICIPAL FIRE MARSHAL / SENIOR INSPECTOR',
    roleCategory: 'BFP Fire Officer',
    hierarchyTier: 1,
    hierarchyTierLabel: 'HEAD CHIEF (Municipal Health Officer / RHU Chief)',
    specialization: 'Structural Fire Suppression & HazMat Incident Command',
    licenseOrBadge: 'BFP-SINSP-11024',
    status: 'OnDuty',
    resolvedMissions: 198,
    activeDispatches: 1,
    responseReadiness: 98.9,
    avgResponseTime: '3m 40s',
    sectorAssignment: 'Sector 1 - Central Commercial Fire Grid',
    shiftSchedule: '24-Hour Tactical Fire Shift',
    radioChannel: 'BFP-TAC CH-1 (154.280 MHz)',
    contactHotline: '+63 917 888 0911',
    baseLatitude: 14.6025,
    baseLongitude: 120.9821,
    certifications: ['NFPA 1001 Fire Officer III', 'HazMat Operations', 'High-Angle Rescue'],
    yearsOfService: 12
  },
  {
    id: 'pnp-col-01',
    fullName: 'PMAJ Victorino Magtanggol PNP',
    callsign: 'PNP-PATROL-01',
    unitCode: 'PNP-MOB-01',
    unitName: 'PNP Municipal Tactical Patrol Unit 01',
    agency: 'PNP',
    rankTitle: 'CHIEF OF POLICE / POLICE MAJOR',
    roleCategory: 'PNP Police Officer',
    hierarchyTier: 1,
    hierarchyTierLabel: 'HEAD CHIEF (Municipal Health Officer / RHU Chief)',
    specialization: 'Tactical Crowd Control, Crime Scene Lockdown & Escort',
    licenseOrBadge: 'PNP-PMAJ-77412',
    status: 'OnDuty',
    resolvedMissions: 245,
    activeDispatches: 1,
    responseReadiness: 99.0,
    avgResponseTime: '3m 15s',
    sectorAssignment: 'Sector 1 - Municipal Peace & Security Grid',
    shiftSchedule: '08:00 - 20:00 (Alpha Patrol Watch)',
    radioChannel: 'PNP-TAC CH-1 (156.100 MHz)',
    contactHotline: '+63 917 777 0117',
    baseLatitude: 14.6001,
    baseLongitude: 120.9855,
    certifications: ['PNP SWAT Command', 'Crisis Negotiation', 'Tactical Perimeter Lead'],
    yearsOfService: 14
  }
];

export const DutyRosterView: React.FC = () => {
  const { session } = useSession();
  const [roster, setRoster] = useState<DutyUnit[]>([]);
  const [colleagues, setColleagues] = useState<ColleagueResponder[]>(INITIAL_COLLEAGUE_ROSTER);
  const [loading, setLoading] = useState<boolean>(true);

  // Determine if operator is RHU Medic / Ambulance Crew (default true unless explicitly FIRE or PNP)
  const isFireOrPoliceSession = session?.unit === 'FIRE' || session?.unit === 'PNP';
  const [agencyFilter, setAgencyFilter] = useState<'ALL' | 'RHU' | 'FIRE' | 'PNP'>(() =>
    isFireOrPoliceSession ? (session?.unit as 'FIRE' | 'PNP') : 'RHU'
  );
  const [isAmbulanceCrewOnly, setIsAmbulanceCrewOnly] = useState<boolean>(() => !isFireOrPoliceSession);

  // Colleague Status Filter Buttons (Requirement 4)
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('ALL_COLLEAGUES');
  // Hierarchy Tier Filter (Requirement 2 interactive org chart)
  const [selectedTierFilter, setSelectedTierFilter] = useState<MedicHierarchyTier | 'ALL'>('ALL');
  // Sort Selector (Requirement 5)
  const [sortBy, setSortBy] = useState<ColleagueSortOption>('HIERARCHY');

  // Search with useDebounce (Requirement 5)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 250);

  // Table/Card view toggle (Requirement 5)
  const { viewMode, setViewMode } = useTableCardView('card');

  // Selected Colleague for DefaultFloatingModalCard inspection (Requirement 5)
  const [selectedColleague, setSelectedColleague] = useState<ColleagueResponder | null>(null);

  // Leaderboard display toggle (Requirement 3)
  const [showFullLeaderboard, setShowFullLeaderboard] = useState<boolean>(false);

  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [activeDispatchesCount, setActiveDispatchesCount] = useState<number>(0);
  const [isHandoverOpen, setIsHandoverOpen] = useState<boolean>(false);
  const [handoverEquipment, setHandoverEquipment] = useState({
    fuelLevel: 'Full (100%)',
    radioComm: 'Channel 1 Tested OK',
    medicalKit: 'Inspected & Sealed (ALS Trauma & O2 Full)',
    notes: 'All RHU ambulance apparatus & defibrillators operational.'
  });

  // Sync agency filter if session loads RHU
  useEffect(() => {
    if (session?.unit === 'RHU') {
      setAgencyFilter('RHU');
      setIsAmbulanceCrewOnly(true);
    } else if (session?.unit === 'FIRE' || session?.unit === 'PNP') {
      setAgencyFilter(session.unit);
      setIsAmbulanceCrewOnly(false);
    }
  }, [session?.unit]);

  const loadData = useCallback(async () => {
    try {
      const data = await getDutyRoster();
      setRoster(data);

      // Sync live unit statuses into colleague records when matching unitCode exists
      if (data && data.length > 0) {
        setColleagues((prev) =>
          prev.map((col) => {
            const matchingUnit = data.find(
              (u) =>
                u.unitCode === col.unitCode ||
                (u.agency === col.agency && u.commanderName.toLowerCase() === col.fullName.toLowerCase())
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

      const targetUnit = session?.unit && session.unit !== 'None' ? session.unit : 'RHU';
      const reps = await getAgencyReports(targetUnit).catch(() => []);
      setActiveDispatchesCount(reps.filter((r) => r.status !== 'Resolved').length);
    } catch (err) {
      console.error('Failed to load duty roster data:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useValueRefreshAuto(loadData, {
    intervalMs: 8000,
    enabled: true
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Identify active unit for the top readiness banner (fallback to RHU Alpha-1 for RHU Medic)
  const myUnit: DutyUnit = useMemo(() => {
    const targetAgency = session?.unit && session.unit !== 'None' ? session.unit : 'RHU';
    const found = roster.find((u) => u.agency === targetAgency);
    if (found) return found;
    const primaryMedic = colleagues.find((c) => c.id === 'medic-col-02') || colleagues[0];
    return {
      id: 'rhu-unit-alpha-01',
      unitCode: primaryMedic.unitCode,
      unitName: primaryMedic.unitName,
      agency: 'RHU',
      commanderName: primaryMedic.fullName,
      status: primaryMedic.status,
      baseLatitude: primaryMedic.baseLatitude,
      baseLongitude: primaryMedic.baseLongitude,
      contactHotline: primaryMedic.contactHotline,
      activePersonnelCount: colleagues.filter((c) => c.agency === 'RHU' && c.status !== 'OffDuty').length,
      shiftSchedule: primaryMedic.shiftSchedule,
      updatedAt: new Date().toISOString()
    };
  }, [roster, session?.unit, colleagues]);

  const showToast = useCallback((msg: string) => {
    setStatusFeedback(msg);
    setTimeout(() => setStatusFeedback(null), 3200);
  }, []);

  const handleToggleDuty = useCallback(
    async (newStatus: ColleagueDutyStatus) => {
      // Optimistically update local colleague commander & unit status immediately
      setColleagues((prev) =>
        prev.map((c) => (c.id === 'medic-col-02' ? { ...c, status: newStatus } : c))
      );
      setRoster((prev) =>
        prev.map((u) => (u.id === myUnit.id ? { ...u, status: newStatus } : u))
      );

      try {
        await updateUnitDutyStatus(myUnit.id, newStatus);
        showToast(`DUTY STATUS UPDATED TO: ${newStatus.toUpperCase()}`);
        await loadData();
      } catch {
        showToast(`TACTICAL STATUS LOCKED: ${newStatus.toUpperCase()}`);
      }
    },
    [myUnit.id, loadData, showToast]
  );

  const handleQuickNavigate = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const copyCoordinates = useCallback(
    (lat: number, lng: number) => {
      const text = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      navigator.clipboard?.writeText(text);
      showToast(`BASE COORDINATES COPIED: ${text}`);
    },
    [showToast]
  );

  // 1. MEDIC-ONLY COLLEAGUES FILTER (Requirement 1)
  // When logged in as an RHU Medic or viewing AMBULANCE CREW, strictly filter to RHU Medic colleagues only
  const agencyScopedColleagues = useMemo(() => {
    if (session?.unit === 'RHU' || isAmbulanceCrewOnly || agencyFilter === 'RHU') {
      return colleagues.filter((c) => c.agency === 'RHU');
    }
    if (agencyFilter === 'ALL') {
      return colleagues;
    }
    return colleagues.filter((c) => c.agency === agencyFilter);
  }, [colleagues, session?.unit, isAmbulanceCrewOnly, agencyFilter]);

  // Pure RHU Medics list for the RHU Org Structure & Medic Leaderboard
  const rhuMedicColleagues = useMemo(
    () => colleagues.filter((c) => c.agency === 'RHU'),
    [colleagues]
  );

  // Status counts for the 5 exact Status Toggle Filter Buttons (Requirement 4)
  const statusCounts = useMemo(() => {
    const base = agencyScopedColleagues;
    return {
      ALL_COLLEAGUES: base.length,
      ACTIVE_AVAILABLE: base.filter((c) => c.status === 'OnDuty').length,
      BEING_DISPATCHED: base.filter((c) => c.status === 'Dispatched').length,
      STANDBY: base.filter((c) => c.status === 'Standby').length,
      OFF_DUTY: base.filter((c) => c.status === 'OffDuty').length
    };
  }, [agencyScopedColleagues]);

  // 3. LEADERBOARD RANKING VIEW (Requirement 3)
  // Ranks duty colleague medics by Resolved Missions, Active Dispatches, Response Readiness, and Sector Assignment
  const medicLeaderboard = useMemo(() => {
    return [...rhuMedicColleagues].sort((a, b) => {
      if (b.resolvedMissions !== a.resolvedMissions) {
        return b.resolvedMissions - a.resolvedMissions;
      }
      if (b.responseReadiness !== a.responseReadiness) {
        return b.responseReadiness - a.responseReadiness;
      }
      return b.activeDispatches - a.activeDispatches;
    });
  }, [rhuMedicColleagues]);

  // Map each colleague ID to their 1-based leaderboard rank
  const leaderboardRankMap = useMemo(() => {
    const map = new Map<string, number>();
    medicLeaderboard.forEach((m, idx) => {
      map.set(m.id, idx + 1);
    });
    return map;
  }, [medicLeaderboard]);

  // Filtered + Debounced Search + Sorted Colleagues (Requirements 1, 2, 4, 5)
  const processedColleagues = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();

    const filtered = agencyScopedColleagues.filter((c) => {
      // Status toggle filter (Requirement 4)
      if (statusFilter === 'ACTIVE_AVAILABLE' && c.status !== 'OnDuty') return false;
      if (statusFilter === 'BEING_DISPATCHED' && c.status !== 'Dispatched') return false;
      if (statusFilter === 'STANDBY' && c.status !== 'Standby') return false;
      if (statusFilter === 'OFF_DUTY' && c.status !== 'OffDuty') return false;

      // Org structure tier filter (Requirement 2)
      if (selectedTierFilter !== 'ALL' && c.hierarchyTier !== selectedTierFilter) return false;

      // Debounced search query (Requirement 5)
      if (query) {
        const matchesName = c.fullName.toLowerCase().includes(query);
        const matchesCallsign = c.callsign.toLowerCase().includes(query);
        const matchesRank = c.rankTitle.toLowerCase().includes(query);
        const matchesRole = c.roleCategory.toLowerCase().includes(query);
        const matchesUnit = c.unitCode.toLowerCase().includes(query) || c.unitName.toLowerCase().includes(query);
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

    // Sort selector (Requirement 5)
    const statusPriority: Record<ColleagueDutyStatus, number> = {
      OnDuty: 1,
      Dispatched: 2,
      Standby: 3,
      OffDuty: 4
    };

    return [...filtered].sort((a, b) => {
      if (sortBy === 'HIERARCHY') {
        if (a.hierarchyTier !== b.hierarchyTier) return a.hierarchyTier - b.hierarchyTier;
        return b.resolvedMissions - a.resolvedMissions;
      }
      if (sortBy === 'LEADERBOARD') {
        if (b.resolvedMissions !== a.resolvedMissions) return b.resolvedMissions - a.resolvedMissions;
        return b.responseReadiness - a.responseReadiness;
      }
      // AVAILABILITY
      if (statusPriority[a.status] !== statusPriority[b.status]) {
        return statusPriority[a.status] - statusPriority[b.status];
      }
      return a.hierarchyTier - b.hierarchyTier;
    });
  }, [agencyScopedColleagues, statusFilter, selectedTierFilter, debouncedSearch, sortBy]);

  // Pagination integration (Requirement 5)
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

  // Hierarchy Tiers summary for Section 2 (From Head Chief to Member)
  const organizationTiers = useMemo(
    () => [
      {
        tier: 1 as MedicHierarchyTier,
        code: 'TIER 01 • COMMAND',
        title: 'HEAD CHIEF (Municipal Health Officer / RHU Chief)',
        subtitle: 'Overall Municipal EMS Medical Direction & Mass-Casualty Authority',
        accent: 'border-emerald-500/80 bg-emerald-950/30 text-emerald-300',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
        members: rhuMedicColleagues.filter((c) => c.hierarchyTier === 1)
      },
      {
        tier: 2 as MedicHierarchyTier,
        code: 'TIER 02 • MEDICAL OFFICER',
        title: 'MEDICAL OFFICER III (Dr. Maria Clara Santos MD)',
        subtitle: 'Field Trauma Command, Advanced Resuscitation & ALS Unit Physicians',
        accent: 'border-sky-500/80 bg-sky-950/30 text-sky-300',
        badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-400/50',
        members: rhuMedicColleagues.filter((c) => c.hierarchyTier === 2)
      },
      {
        tier: 3 as MedicHierarchyTier,
        code: 'TIER 03 • TRIAGE & ALS LEAD',
        title: 'SENIOR EMS PARAMEDIC / TRIAGE LEAD',
        subtitle: 'START Triage Supervision, Critical Care Nursing & ALS Squad Leaders',
        accent: 'border-cyan-500/80 bg-cyan-950/30 text-cyan-300',
        badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50',
        members: rhuMedicColleagues.filter((c) => c.hierarchyTier === 3)
      },
      {
        tier: 4 as MedicHierarchyTier,
        code: 'TIER 04 • FIELD CREW',
        title: 'AMBULANCE CREW MEMBERS',
        subtitle: 'EMT Paramedics, Field Triage Nurses & EVOC Tactical Ambulance Drivers/Medics',
        accent: 'border-indigo-500/80 bg-indigo-950/30 text-indigo-300',
        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/50',
        members: rhuMedicColleagues.filter((c) => c.hierarchyTier === 4)
      }
    ],
    [rhuMedicColleagues]
  );

  const getStatusBadgeStyle = useCallback((status: ColleagueDutyStatus) => {
    switch (status) {
      case 'OnDuty':
        return {
          label: 'ACTIVE / AVAILABLE',
          pill: 'bg-emerald-950 text-emerald-300 border-emerald-500/80',
          dot: 'bg-emerald-400 animate-ping'
        };
      case 'Dispatched':
        return {
          label: 'BEING DISPATCHED',
          pill: 'bg-amber-950 text-amber-300 border-amber-500/80 animate-pulse',
          dot: 'bg-amber-400 animate-ping'
        };
      case 'Standby':
        return {
          label: 'STANDBY',
          pill: 'bg-sky-950 text-sky-300 border-sky-500/80',
          dot: 'bg-sky-400'
        };
      default:
        return {
          label: 'OFF DUTY',
          pill: 'bg-slate-900 text-slate-400 border-slate-700',
          dot: 'bg-slate-500'
        };
    }
  }, []);

  const getAgencyBadge = useCallback((agency: string) => {
    switch (agency) {
      case 'RHU':
        return {
          label: 'RHU AMBULANCE CREW',
          color: 'bg-sky-500/20 text-sky-300 border-sky-500/50',
          icon: Ambulance
        };
      case 'FIRE':
        return {
          label: 'BFP FIRE RESCUE',
          color: 'bg-orange-500/20 text-orange-300 border-orange-500/50',
          icon: Flame
        };
      case 'PNP':
        return {
          label: 'PNP TACTICAL POLICE',
          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50',
          icon: Shield
        };
      default:
        return {
          label: 'LDRRMO COMMAND',
          color: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
          icon: AlertTriangle
        };
    }
  }, []);

  const sortOptions = useMemo(
    () => [
      { value: 'HIERARCHY' as ColleagueSortOption, label: 'Sort: Rank Hierarchy (Chief → Crew)' },
      { value: 'LEADERBOARD' as ColleagueSortOption, label: 'Sort: Resolved Missions Leaderboard' },
      { value: 'AVAILABILITY' as ColleagueSortOption, label: 'Sort: Availability Status' }
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
    <div className="flex flex-col gap-6 text-slate-100 select-none pb-10 w-full">
      {/* Toast Feedback */}
      {statusFeedback && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-slate-900 border-2 border-emerald-400 text-emerald-300 font-mono text-xs font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{statusFeedback}</span>
        </div>
      )}

      {/* Header & Role Scope Control */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-sky-400">
              RHU AMBULANCE CREW &amp; COLLEAGUE ROSTER COMMAND
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-xs font-mono text-emerald-300 font-semibold">
              MEDIC-ONLY COLLEAGUES FILTER ACTIVE
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <Ambulance className="w-6 h-6 text-sky-400" />
            <span>Ambulance Crew Hierarchy, Leaderboard &amp; Colleague Duty Roster</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Chain of command from RHU Head Chief to Ambulance Crew Members, live mission leaderboard, and colleague availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Scope Lock Toggle: Ambulance Crew Medics Only vs Multi-Agency (for Fire/PNP compatibility) */}
          <button
            type="button"
            onClick={() => {
              setIsAmbulanceCrewOnly(true);
              setAgencyFilter('RHU');
              showToast('FILTER LOCKED: DISPLAYING RHU MEDIC COLLEAGUES ONLY');
            }}
            className={`px-3.5 py-2 rounded-lg font-mono text-xs font-bold border transition-all inline-flex items-center gap-2 cursor-pointer ${
              isAmbulanceCrewOnly || agencyFilter === 'RHU'
                ? 'bg-sky-500 text-slate-950 border-white shadow-[0_0_15px_rgba(14,165,233,0.5)]'
                : 'bg-slate-900 text-sky-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span>AMBULANCE CREW (RHU MEDICS ONLY)</span>
          </button>

          {isFireOrPoliceSession && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <button
                type="button"
                onClick={() => {
                  setIsAmbulanceCrewOnly(false);
                  setAgencyFilter('FIRE');
                }}
                className={`px-3 py-2 rounded-lg border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                  !isAmbulanceCrewOnly && agencyFilter === 'FIRE'
                    ? 'bg-orange-600 text-white border-orange-400 font-bold'
                    : 'bg-slate-900 text-orange-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>FIRE</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAmbulanceCrewOnly(false);
                  setAgencyFilter('PNP');
                }}
                className={`px-3 py-2 rounded-lg border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                  !isAmbulanceCrewOnly && agencyFilter === 'PNP'
                    ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                    : 'bg-slate-900 text-indigo-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>PNP</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsHandoverOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-emerald-950 border border-emerald-500/70 text-emerald-300 font-mono text-xs font-bold hover:bg-emerald-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ClipboardList className="w-4 h-4" />
            <span>LOG SHIFT HANDOVER</span>
          </button>
        </div>
      </div>

      {/* 1. HIGH-CONTRAST FIELD STATUS BANNER WITH TACTILE TOGGLE BUTTONS */}
      <div
        className={`tactical-card p-6 rounded-xl border-2 transition-all duration-300 shadow-2xl ${
          myUnit.status === 'OnDuty'
            ? 'bg-slate-900/95 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
            : myUnit.status === 'Dispatched'
            ? 'bg-slate-900/95 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.25)]'
            : myUnit.status === 'Standby'
            ? 'bg-slate-900/95 border-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.25)]'
            : 'bg-slate-950/95 border-slate-700'
        }`}
      >
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded bg-sky-950 text-sky-400 font-mono text-xs font-extrabold border border-sky-700 inline-flex items-center gap-1.5">
                <HeartPulse className="w-3.5 h-3.5 text-sky-400" />
                <span>MY ACTIVE AMBULANCE CREW CALLSIGN</span>
              </span>
              <span className="font-mono text-xs text-slate-300 font-bold">[{myUnit.unitCode}]</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-xs text-emerald-300 font-bold">
                MEDICAL OFFICER LEAD: {myUnit.commanderName}
              </span>
            </div>

            <h2 className="text-2xl font-black text-white tracking-wide">{myUnit.unitName}</h2>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="text-slate-400">CURRENT STATUS:</span>
                <span
                  className={`font-black px-2 py-0.5 rounded uppercase border ${
                    myUnit.status === 'OnDuty'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
                      : myUnit.status === 'Dispatched'
                      ? 'bg-amber-950 text-amber-400 border-amber-500 animate-pulse'
                      : myUnit.status === 'Standby'
                      ? 'bg-sky-950 text-sky-400 border-sky-500'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {myUnit.status === 'OnDuty'
                    ? 'ACTIVE / AVAILABLE'
                    : myUnit.status === 'Dispatched'
                    ? 'BEING DISPATCHED'
                    : myUnit.status === 'Standby'
                    ? 'STANDBY / STAGING'
                    : 'OFF DUTY'}
                </span>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                SHIFT: <strong className="text-white">{myUnit.shiftSchedule}</strong>
              </span>
              <span className="text-slate-600">|</span>
              <span>
                MEDIC COLLEAGUES ON ROSTER:{' '}
                <strong className="text-emerald-400">{rhuMedicColleagues.length} RHU MEDICS</strong>
              </span>
            </div>
          </div>

          {/* Quick Station Base Telemetry */}
          <div className="px-4 py-2.5 bg-slate-950 rounded-lg border border-slate-800 flex flex-col items-end font-mono">
            <span className="text-[10px] text-slate-400 font-bold">RHU BASE STATION GPS</span>
            <span className="text-xs font-bold text-sky-400 tracking-wider">
              {formatGpsCoord(myUnit.baseLatitude, myUnit.baseLongitude)}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">EMS HOTLINE: {myUnit.contactHotline}</span>
          </div>
        </div>

        {/* My Unit Tactile Readiness Toggle Buttons */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider block mb-2">
            MY UNIT TACTILE READINESS CHECK-IN:
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => handleToggleDuty('OnDuty')}
              className={`py-2.5 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                myUnit.status === 'OnDuty'
                  ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_18px_rgba(16,185,129,0.7)] scale-[1.01]'
                  : 'bg-slate-900/90 text-emerald-400 border-emerald-600/40 hover:bg-emerald-950/40 hover:border-emerald-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  myUnit.status === 'OnDuty' ? 'bg-slate-950' : 'bg-emerald-400'
                }`}
              />
              <span>1. ON DUTY (AVAILABLE)</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleDuty('Dispatched')}
              className={`py-2.5 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                myUnit.status === 'Dispatched'
                  ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_18px_rgba(245,158,11,0.7)] scale-[1.01]'
                  : 'bg-slate-900/90 text-amber-400 border-amber-600/40 hover:bg-amber-950/40 hover:border-amber-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  myUnit.status === 'Dispatched' ? 'bg-slate-950 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span>2. DISPATCHED (EN ROUTE)</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleDuty('Standby')}
              className={`py-2.5 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                myUnit.status === 'Standby'
                  ? 'bg-sky-400 text-slate-950 border-white shadow-[0_0_18px_rgba(56,189,248,0.7)] scale-[1.01]'
                  : 'bg-slate-900/90 text-sky-400 border-sky-600/40 hover:bg-sky-950/40 hover:border-sky-500'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  myUnit.status === 'Standby' ? 'bg-slate-950' : 'bg-sky-400'
                }`}
              />
              <span>3. STANDBY (ON SCENE)</span>
            </button>

            <button
              type="button"
              onClick={() => handleToggleDuty('OffDuty')}
              className={`py-2.5 px-3 rounded-lg font-mono font-black text-xs uppercase tracking-wider transition-all duration-150 border-2 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                myUnit.status === 'OffDuty'
                  ? 'bg-rose-600 text-white border-white shadow-[0_0_18px_rgba(225,29,72,0.7)] scale-[1.01]'
                  : 'bg-slate-900/90 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  myUnit.status === 'OffDuty' ? 'bg-white' : 'bg-slate-500'
                }`}
              />
              <span>4. OFF DUTY (RELIEF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. RHU MEDICAL ORGANIZATION STRUCTURE HIERARCHY (From Head Chief to Member - Requirement 2) */}
      <div className="tactical-card p-5 rounded-xl bg-slate-900/95 border border-sky-500/40 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-sky-400" />
              <span className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider">
                CHAIN OF COMMAND • HEAD CHIEF TO AMBULANCE CREW MEMBER
              </span>
            </div>
            <h2 className="text-base md:text-lg font-black text-white tracking-wide mt-0.5">
              RHU Medical Organization Structure Hierarchy
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {selectedTierFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedTierFilter('ALL')}
                className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400 text-sky-300 font-mono text-xs font-bold hover:bg-sky-500/30 transition-colors cursor-pointer"
              >
                SHOW ALL 4 HIERARCHY TIERS
              </button>
            )}
            <span className="text-[11px] font-mono text-slate-400">
              Click any tier to filter roster or click an officer to inspect profile
            </span>
          </div>
        </div>

        {/* Interactive 4-Tier Chain of Command Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5 mt-4">
          {organizationTiers.map((tierObj, index) => {
            const isTierSelected = selectedTierFilter === tierObj.tier;
            return (
              <div
                key={tierObj.tier}
                className={`relative rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${
                  isTierSelected
                    ? 'border-sky-400 bg-sky-950/40 shadow-[0_0_18px_rgba(56,189,248,0.25)]'
                    : `${tierObj.accent} hover:border-sky-400/70`
                }`}
              >
                <div>
                  {/* Tier Header & Chain Arrow */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase ${tierObj.badgeClass}`}
                    >
                      {tierObj.code}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedTierFilter((prev) => (prev === tierObj.tier ? 'ALL' : tierObj.tier))
                        }
                        className="px-2 py-0.5 rounded bg-slate-900/90 hover:bg-slate-800 text-[10px] font-mono font-bold text-slate-200 border border-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {isTierSelected ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>FILTERED</span>
                          </>
                        ) : (
                          <span>FILTER ({tierObj.members.length})</span>
                        )}
                      </button>
                      {index < organizationTiers.length - 1 && (
                        <ChevronRight className="hidden lg:inline-block w-4 h-4 text-sky-400" />
                      )}
                    </div>
                  </div>

                  {/* Tier Title */}
                  <h3 className="text-xs font-black font-mono text-white uppercase tracking-wide leading-snug">
                    {tierObj.title}
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{tierObj.subtitle}</p>

                  {/* Assigned Officers in this Tier */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-col gap-1.5">
                    {tierObj.members.map((member) => {
                      const statusStyle = getStatusBadgeStyle(member.status);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedColleague(member)}
                          className="w-full text-left p-2 rounded-lg bg-slate-950/85 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/60 transition-all flex items-center justify-between gap-2 group cursor-pointer"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white group-hover:text-sky-300 truncate flex items-center gap-1">
                              <span>{member.fullName}</span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              [{member.callsign}] • {member.roleCategory}
                            </div>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${statusStyle.dot}`}
                            title={statusStyle.label}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>ACTIVE IN TIER:</span>
                  <span className="text-emerald-400 font-bold">
                    {tierObj.members.filter((m) => m.status === 'OnDuty' || m.status === 'Dispatched').length} /{' '}
                    {tierObj.members.length} ONLINE
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. MEDIC PERFORMANCE LEADERBOARD RANKING VIEW (Requirement 3) */}
      <div className="tactical-card p-5 rounded-xl bg-slate-900/95 border border-amber-500/40 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                COLLEAGUE MEDIC PERFORMANCE LEADERBOARD
              </span>
              {activeDispatchesCount > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
                  {activeDispatchesCount} LIVE AGENCY DISPATCHES
                </span>
              )}
            </div>
            <h2 className="text-base md:text-lg font-black text-white tracking-wide mt-0.5">
              RHU Duty Medic Ranking — Resolved Missions, Dispatches, Readiness &amp; Sector
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullLeaderboard((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-mono text-xs font-bold transition-colors cursor-pointer"
            >
              {showFullLeaderboard
                ? 'SHOW TOP 5 LEADERS'
                : `VIEW ALL ${medicLeaderboard.length} RANKED MEDICS`}
            </button>
          </div>
        </div>

        {/* Leaderboard Table / Cards */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">Colleague Medic &amp; Callsign</th>
                <th className="p-3">Hierarchy Role</th>
                <th className="p-3">Resolved Missions</th>
                <th className="p-3">Active Dispatches</th>
                <th className="p-3">Response Readiness</th>
                <th className="p-3">Sector Assignment</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(showFullLeaderboard ? medicLeaderboard : medicLeaderboard.slice(0, 5)).map((medic, idx) => {
                const rank = idx + 1;
                const statusBadge = getStatusBadgeStyle(medic.status);
                return (
                  <tr
                    key={medic.id}
                    onClick={() => setSelectedColleague(medic)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-xs border ${
                          rank === 1
                            ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_12px_rgba(251,191,36,0.5)]'
                            : rank === 2
                            ? 'bg-slate-300 text-slate-950 border-white'
                            : rank === 3
                            ? 'bg-amber-700 text-white border-amber-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700'
                        }`}
                      >
                        #{rank}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-sans font-bold text-white group-hover:text-sky-300 flex items-center gap-1.5">
                        <span>{medic.fullName}</span>
                        {rank <= 3 && <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                      </div>
                      <div className="text-[10px] text-sky-400 font-bold">
                        [{medic.callsign}] • Unit {medic.unitCode}
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 text-[10px] font-bold">
                        {medic.roleCategory}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-emerald-400">{medic.resolvedMissions}</span>
                        <span className="text-[10px] text-slate-400">MISSIONS</span>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          medic.activeDispatches > 0
                            ? 'bg-amber-950/90 text-amber-300 border-amber-500/60'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {medic.activeDispatches} ACTIVE
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sky-300 font-black">{medic.responseReadiness.toFixed(1)}%</span>
                        <span className="text-[10px] text-slate-400">({medic.avgResponseTime})</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-300 max-w-[230px] truncate" title={medic.sectorAssignment}>
                      {medic.sectorAssignment}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge.pill}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4 & 5. STATUS TOGGLE FILTER BUTTONS + SEARCH, SORT, TABLE/CARD TOGGLE & PAGINATION */}
      <div className="flex flex-col gap-4">
        {/* Exact 5 Status Toggle Filter Buttons (Requirement 4) */}
        <div className="tactical-card p-4 rounded-xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-sky-400" />
              <span>COLLEAGUE AVAILABILITY STATUS FILTER TOGGLES:</span>
            </span>
            <span className="text-[11px] font-mono text-sky-400 font-bold">
              SHOWING {processedColleagues.length} OF {agencyScopedColleagues.length} COLLEAGUE MEDICS
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL_COLLEAGUES')}
              className={`py-2.5 px-3 rounded-lg font-mono text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                statusFilter === 'ALL_COLLEAGUES'
                  ? 'bg-sky-500 text-slate-950 border-white shadow-[0_0_14px_rgba(14,165,233,0.5)]'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-sky-500/60'
              }`}
            >
              <span>ALL COLLEAGUES</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-sky-300 text-[10px]">
                {statusCounts.ALL_COLLEAGUES}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE_AVAILABLE')}
              className={`py-2.5 px-3 rounded-lg font-mono text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                statusFilter === 'ACTIVE_AVAILABLE'
                  ? 'bg-emerald-500 text-slate-950 border-white shadow-[0_0_14px_rgba(16,185,129,0.5)]'
                  : 'bg-slate-950 text-emerald-400 border-emerald-600/40 hover:border-emerald-500'
              }`}
            >
              <span>ACTIVE / AVAILABLE</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-emerald-300 text-[10px]">
                {statusCounts.ACTIVE_AVAILABLE}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('BEING_DISPATCHED')}
              className={`py-2.5 px-3 rounded-lg font-mono text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                statusFilter === 'BEING_DISPATCHED'
                  ? 'bg-amber-400 text-slate-950 border-white shadow-[0_0_14px_rgba(245,158,11,0.5)]'
                  : 'bg-slate-950 text-amber-400 border-amber-600/40 hover:border-amber-500'
              }`}
            >
              <span>BEING DISPATCHED</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-amber-300 text-[10px]">
                {statusCounts.BEING_DISPATCHED}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('STANDBY')}
              className={`py-2.5 px-3 rounded-lg font-mono text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                statusFilter === 'STANDBY'
                  ? 'bg-sky-400 text-slate-950 border-white shadow-[0_0_14px_rgba(56,189,248,0.5)]'
                  : 'bg-slate-950 text-sky-400 border-sky-600/40 hover:border-sky-500'
              }`}
            >
              <span>STANDBY</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-sky-300 text-[10px]">
                {statusCounts.STANDBY}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('OFF_DUTY')}
              className={`py-2.5 px-3 rounded-lg font-mono text-xs font-black uppercase tracking-wider border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                statusFilter === 'OFF_DUTY'
                  ? 'bg-rose-600 text-white border-white shadow-[0_0_14px_rgba(225,29,72,0.5)]'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              <span>OFF DUTY</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/80 text-slate-300 text-[10px]">
                {statusCounts.OFF_DUTY}
              </span>
            </button>
          </div>
        </div>

        {/* Control Bar: SearchBar (with useDebounce), Sort Dropdown, TableCardToggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-black text-white tracking-wide uppercase">
              {isAmbulanceCrewOnly || agencyFilter === 'RHU'
                ? 'RHU AMBULANCE CREW & MEDIC COLLEAGUES ROSTER'
                : `${agencyFilter} RESPONDER COLLEAGUES ROSTER`}
            </h2>
            <span className="px-2.5 py-0.5 rounded bg-sky-500/20 border border-sky-500/40 text-sky-300 font-mono text-xs font-bold">
              {processedColleagues.length} MEDICS
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search medic name, callsign, rank, sector..."
              className="w-full sm:w-64"
            />

            <Dropdown<ColleagueSortOption>
              options={sortOptions}
              value={sortBy}
              onChange={setSortBy}
              menuWidth="w-64"
              align="right"
            />

            <TableCardToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {/* Colleagues Roster Grid (Card View) or Table View */}
        {loading ? (
          <div className="tactical-card p-12 text-center text-sky-400 font-mono text-sm animate-pulse">
            SYNCHRONIZING RHU AMBULANCE CREW COLLEAGUE TELEMETRY...
          </div>
        ) : paginatedColleagues.length === 0 ? (
          <div className="tactical-card p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
            <span>
              NO COLLEAGUE RESPONDERS MATCH FILTER [{statusFilter}] OR SEARCH &apos;{debouncedSearch}&apos;.
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('ALL_COLLEAGUES');
                setSelectedTierFilter('ALL');
                setSearchQuery('');
              }}
            >
              Reset Colleague Filters
            </Button>
          </div>
        ) : viewMode === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedColleagues.map((colleague) => {
              const badge = getAgencyBadge(colleague.agency);
              const statusStyle = getStatusBadgeStyle(colleague.status);
              const leaderboardRank = leaderboardRankMap.get(colleague.id);

              return (
                <div
                  key={colleague.id}
                  onClick={() => setSelectedColleague(colleague)}
                  className={`tactical-card p-5 border rounded-xl shadow-lg flex flex-col justify-between transition-all cursor-pointer group ${
                    colleague.status === 'OnDuty'
                      ? 'border-emerald-600/60 bg-slate-900/90 hover:border-emerald-400'
                      : colleague.status === 'Dispatched'
                      ? 'border-amber-600/60 bg-slate-900/90 hover:border-amber-400'
                      : colleague.status === 'Standby'
                      ? 'border-sky-600/60 bg-slate-900/90 hover:border-sky-400'
                      : 'border-slate-800 bg-slate-950/85 hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Top Badges Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-black border uppercase tracking-wider inline-flex items-center gap-1 ${badge.color}`}
                        >
                          <badge.icon className="w-3 h-3" />
                          <span>{colleague.roleCategory}</span>
                        </span>
                        <span className="font-mono text-xs font-bold text-sky-400">[{colleague.callsign}]</span>
                        {leaderboardRank !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-black inline-flex items-center gap-1">
                            <Trophy className="w-3 h-3 text-amber-400" />
                            <span>RANK #{leaderboardRank}</span>
                          </span>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border flex items-center gap-1.5 ${statusStyle.pill}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                        <span>{statusStyle.label}</span>
                      </span>
                    </div>

                    {/* Medic Name & Official Hierarchy Rank */}
                    <h3 className="text-base font-black text-white group-hover:text-sky-300 transition-colors">
                      {colleague.fullName}
                    </h3>
                    <p className="text-xs font-mono text-emerald-300 font-bold mt-0.5">{colleague.rankTitle}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Unit: <strong className="text-slate-200">{colleague.unitName}</strong> ({colleague.unitCode})
                    </p>

                    {/* Telemetry & Leaderboard Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-3.5 pt-3 border-t border-slate-800/80 text-[11px] font-mono">
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                        <span className="text-slate-500 block text-[9px] uppercase">RESOLVED MISSIONS</span>
                        <span className="text-emerald-400 font-black text-sm">{colleague.resolvedMissions}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                        <span className="text-slate-500 block text-[9px] uppercase">ACTIVE DISPATCH</span>
                        <span className="text-amber-400 font-black text-sm">{colleague.activeDispatches}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80">
                        <span className="text-slate-500 block text-[9px] uppercase">READINESS</span>
                        <span className="text-sky-400 font-black text-sm">
                          {colleague.responseReadiness.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Sector & Radio Channel */}
                    <div className="mt-3 flex flex-col gap-1 text-[11px] font-mono text-slate-300">
                      <div className="truncate">
                        <span className="text-slate-500">SECTOR: </span>
                        <span className="text-slate-200 font-semibold">{colleague.sectorAssignment}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 text-sky-400">
                          <Radio className="w-3 h-3" />
                          <span>{colleague.radioChannel}</span>
                        </span>
                        <a
                          href={`tel:${colleague.contactHotline}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-emerald-400 hover:underline font-bold"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{colleague.contactHotline}</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Coordinates & Inspect Profile CTA */}
                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between font-mono text-xs">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        copyCoordinates(colleague.baseLatitude, colleague.baseLongitude);
                      }}
                      className="text-slate-400 hover:text-sky-300 cursor-pointer truncate max-w-[190px] inline-flex items-center gap-1"
                      title="Click to copy colleague GPS coordinates"
                    >
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatGpsCoord(colleague.baseLatitude, colleague.baseLongitude)}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickNavigate(colleague.baseLatitude, colleague.baseLongitude);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 text-[10px] font-mono font-bold cursor-pointer"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>GPS</span>
                      </button>
                      <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-mono font-bold group-hover:bg-sky-500 group-hover:text-slate-950 transition-colors">
                        INSPECT MEDIC
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-2xl">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3.5">Callsign &amp; Unit</th>
                  <th className="p-3.5">Colleague Medic Name</th>
                  <th className="p-3.5">Hierarchy Rank / Role</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Missions / Dispatches</th>
                  <th className="p-3.5">Sector Assignment</th>
                  <th className="p-3.5">Radio / Hotline</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {paginatedColleagues.map((colleague) => {
                  const statusStyle = getStatusBadgeStyle(colleague.status);
                  const leaderboardRank = leaderboardRankMap.get(colleague.id);
                  return (
                    <tr
                      key={colleague.id}
                      onClick={() => setSelectedColleague(colleague)}
                      className="hover:bg-slate-900/80 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="text-sky-400 font-bold">[{colleague.callsign}]</div>
                        <div className="text-[10px] text-slate-400">{colleague.unitCode}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-white font-sans font-bold">{colleague.fullName}</div>
                        {leaderboardRank !== undefined && (
                          <span className="text-[10px] text-amber-400 font-bold">
                            Leaderboard Rank #{leaderboardRank}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="text-emerald-300 font-bold text-[11px]">{colleague.rankTitle}</div>
                        <div className="text-[10px] text-slate-400">{colleague.roleCategory}</div>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusStyle.pill}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="text-emerald-400 font-bold">{colleague.resolvedMissions} Resolved</span>
                        <span className="text-slate-600"> • </span>
                        <span className="text-amber-300 font-bold">{colleague.activeDispatches} Active</span>
                      </td>
                      <td className="p-3.5 text-slate-300 max-w-[200px] truncate">{colleague.sectorAssignment}</td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="text-sky-400 text-[10px]">{colleague.radioChannel}</div>
                        <a
                          href={`tel:${colleague.contactHotline}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-emerald-400 hover:underline text-[11px] inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{colleague.contactHotline}</span>
                        </a>
                      </td>
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedColleague(colleague);
                          }}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] transition-colors cursor-pointer"
                        >
                          Inspect Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls Bar (Requirement 5) */}
        <div className="tactical-card p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-3 text-slate-400">
            <span>
              Showing <strong className="text-white">{totalItems === 0 ? 0 : startIndex + 1}</strong> to{' '}
              <strong className="text-white">{endIndex}</strong> of{' '}
              <strong className="text-sky-400">{totalItems}</strong> Colleague Medics
            </span>
            <Dropdown<string>
              variant="pagination"
              options={pageSizeDropdownOptions}
              value={String(pageSize)}
              onChange={(val) => setPageSize(Number(val))}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!canPrevPage}
              onClick={prevPage}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 disabled:opacity-40 hover:border-sky-500 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => goToPage(pageNum)}
                className={`w-8 h-8 rounded-lg font-bold text-xs border transition-colors cursor-pointer ${
                  pageNum === currentPage
                    ? 'bg-sky-500 text-slate-950 border-white font-black'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                }`}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={!canNextPage}
              onClick={nextPage}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 disabled:opacity-40 hover:border-sky-500 transition-colors inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. COLLEAGUE MEDIC PROFILE MODAL (DefaultFloatingModalCard - Requirement 5) */}
      {selectedColleague && (
        <DefaultFloatingModalCard
          isOpen={Boolean(selectedColleague)}
          onClose={() => setSelectedColleague(null)}
          title={`MEDIC COLLEAGUE PROFILE — [${selectedColleague.callsign}]`}
          subtitle={`${selectedColleague.rankTitle} • ${selectedColleague.unitName}`}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col gap-4 text-slate-200 text-xs font-mono">
            {/* Top Identity Banner */}
            <div className="p-4 rounded-xl bg-slate-950 border border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-black">
                    TIER {selectedColleague.hierarchyTier} • {selectedColleague.roleCategory.toUpperCase()}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    LICENSE/BADGE: <strong className="text-white">{selectedColleague.licenseOrBadge}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-black text-white font-sans">{selectedColleague.fullName}</h3>
                <p className="text-emerald-300 text-xs font-bold mt-0.5">{selectedColleague.specialization}</p>
              </div>

              <div className="flex flex-col sm:items-end gap-1">
                <span
                  className={`px-3 py-1 rounded text-xs font-black uppercase border ${
                    getStatusBadgeStyle(selectedColleague.status).pill
                  }`}
                >
                  {getStatusBadgeStyle(selectedColleague.status).label}
                </span>
                {leaderboardRankMap.get(selectedColleague.id) && (
                  <span className="text-[11px] text-amber-400 font-bold">
                    RHU Leaderboard Rank #{leaderboardRankMap.get(selectedColleague.id)}
                  </span>
                )}
              </div>
            </div>

            {/* Operational Telemetry Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">RESOLVED MISSIONS</span>
                <span className="text-lg font-black text-emerald-400">{selectedColleague.resolvedMissions}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">ACTIVE DISPATCHES</span>
                <span className="text-lg font-black text-amber-400">{selectedColleague.activeDispatches}</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">READINESS SCORE</span>
                <span className="text-lg font-black text-sky-400">
                  {selectedColleague.responseReadiness.toFixed(1)}%
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">AVG RESPONSE TIME</span>
                <span className="text-lg font-black text-white">{selectedColleague.avgResponseTime}</span>
              </div>
            </div>

            {/* Unit Assignment, Sector & Direct Radio/Contact Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-bold">ASSIGNED AMBULANCE / UNIT</span>
                <span className="text-white font-bold">
                  {selectedColleague.unitName} ({selectedColleague.unitCode})
                </span>
                <span className="text-[11px] text-slate-400">Shift: {selectedColleague.shiftSchedule}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-bold">PRIMARY SECTOR ASSIGNMENT</span>
                <span className="text-sky-300 font-bold">{selectedColleague.sectorAssignment}</span>
                <span className="text-[11px] text-slate-400">
                  Service Tenure: {selectedColleague.yearsOfService} Years
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold">TACTICAL RADIO FREQUENCY</span>
                <span className="text-emerald-400 font-bold inline-flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  <span>{selectedColleague.radioChannel}</span>
                </span>
              </div>
              <div className="flex flex-col gap-1 pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 font-bold">DIRECT HOTLINE / RADIO LINK</span>
                <a
                  href={`tel:${selectedColleague.contactHotline}`}
                  className="text-sky-400 hover:underline font-bold inline-flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{selectedColleague.contactHotline}</span>
                </a>
              </div>
            </div>

            {/* Clinical & Tactical Certifications */}
            <div>
              <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
                VERIFIED MEDICAL &amp; TACTICAL CERTIFICATIONS:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedColleague.certifications.map((cert) => (
                  <span
                    key={cert}
                    className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold inline-flex items-center gap-1"
                  >
                    <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{cert}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <a
                  href={`tel:${selectedColleague.contactHotline}`}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Direct Hotline</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    showToast(`RADIO HAIL TRANSMITTED TO ${selectedColleague.callsign} ON ${selectedColleague.radioChannel}`);
                  }}
                  className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Ping Tactical Radio</span>
                </button>
              </div>

              <Button variant="outline" size="sm" onClick={() => setSelectedColleague(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}

      {/* Shift Handover Equipment Verification Modal */}
      {isHandoverOpen && (
        <DefaultFloatingModalCard
          isOpen={isHandoverOpen}
          onClose={() => setIsHandoverOpen(false)}
          title="TACTICAL SHIFT HANDOVER &amp; APPARATUS READINESS LOG"
          maxWidth="max-w-xl"
        >
          <div className="flex flex-col gap-4 text-slate-200 text-xs font-mono">
            <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/50">
              <span className="font-bold text-emerald-300 block mb-1">Active Unit Check-In Checklist:</span>
              <p className="text-slate-300 text-[11px] font-sans">
                Complete ambulance &amp; trauma equipment readiness inspection before assuming field patrol or handing off shift.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 text-[10px] font-bold">APPARATUS FUEL LEVEL</label>
                <select
                  value={handoverEquipment.fuelLevel}
                  onChange={(e) => setHandoverEquipment({ ...handoverEquipment, fuelLevel: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Full (100%)">Full (100%)</option>
                  <option value="3/4 Tank (75%)">3/4 Tank (75%)</option>
                  <option value="Half Tank (50%)">Half Tank (50%)</option>
                  <option value="Low (<25%)">Low (&lt;25%) - Needs Fuel</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 text-[10px] font-bold">RADIO COMMUNICATIONS</label>
                <select
                  value={handoverEquipment.radioComm}
                  onChange={(e) => setHandoverEquipment({ ...handoverEquipment, radioComm: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                >
                  <option value="Channel 1 Tested OK">Channel 1 Tested OK</option>
                  <option value="Channel 2 Primary Backup">Channel 2 Primary Backup</option>
                  <option value="Degraded Signal">Degraded Signal</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-[10px] font-bold">EQUIPMENT / ALS TRAUMA &amp; FIRST AID KIT STATUS</label>
              <input
                type="text"
                value={handoverEquipment.medicalKit}
                onChange={(e) => setHandoverEquipment({ ...handoverEquipment, medicalKit: e.target.value })}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                placeholder="Oxygen tanks full, defibrillator tested, trauma pack sealed..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 text-[10px] font-bold">SHIFT NOTES FOR RELIEVING OFFICER</label>
              <textarea
                value={handoverEquipment.notes}
                onChange={(e) => setHandoverEquipment({ ...handoverEquipment, notes: e.target.value })}
                rows={2}
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                placeholder="Specify ongoing incidents, road repairs in sector..."
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <Button variant="outline" size="sm" onClick={() => setIsHandoverOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  showToast('SHIFT HANDOVER LOG RECORDED & BROADCAST TO RHU / LDRRMO COMMAND');
                  setIsHandoverOpen(false);
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sign &amp; Transmit Handover Log</span>
                </span>
              </Button>
            </div>
          </div>
        </DefaultFloatingModalCard>
      )}
    </div>
  );
};

export default DutyRosterView;
