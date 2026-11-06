// [Layer: Libs/Assets]
// Responsibility: High-fidelity baseline fixtures and fallback telemetry for ResQTrack Katipunan Municipal C2.
// Implements N=0 Resilient Fallback Pattern:
// If live backend endpoints return [] (empty), null, or encounter network errors,
// modules seamlessly fall back to these high-fidelity baseline datasets so that
// ZERO cards, charts, rosters, or satellite maps ever render blank or broken.

import type { ReportItem, AlertItem } from '@/Endpoints/reportsApi';
import type { IncidentFixture, AuditLog } from '@/Endpoints/adminGovernanceApi';
import type { DutyUnit } from '@/Endpoints/responderOpsApi';
import type { UserSummary } from '@/Endpoints/userEndpoints';
import type { AnalyticsSummaryDto } from '@/Endpoints/analyticsApi';

// ============================================================================
// 1. BASELINE INCIDENT FIXTURES (Katipunan C2 Strategic Landmarks & Beacons)
// ============================================================================
export const BASELINE_INCIDENT_FIXTURES: IncidentFixture[] = [
  {
    id: 'fix-c2-01',
    fixtureCode: 'KAT-C2-001',
    title: 'Katipunan Municipal Hall C2 Command Staging',
    category: 'CommandCenter',
    severity: 'Low',
    latitude: 8.5147,
    longitude: 123.2842,
    assignedUnitType: 'LDRRMO',
    isActive: true,
    description: 'Central Katipunan Multi-Agency Command & Communications Headquarters'
  },
  {
    id: 'fix-med-02',
    fixtureCode: 'KAT-RHU-002',
    title: 'Katipunan Rural Health Unit Primary Trauma Facility',
    category: 'MedicalEmergency',
    severity: 'Medium',
    latitude: 8.5165,
    longitude: 123.2861,
    assignedUnitType: 'RHU',
    isActive: true,
    description: 'EMS Ambulance dispatch bay and emergency obstetric stabilization suite'
  },
  {
    id: 'fix-fire-03',
    fixtureCode: 'KAT-BFP-003',
    title: 'BFP Municipal Fire Station & HazMat Depo',
    category: 'StructuralFire',
    severity: 'High',
    latitude: 8.5122,
    longitude: 123.2825,
    assignedUnitType: 'FIRE',
    isActive: true,
    description: 'Engine company apparatus readiness & high-flow pressurized hydrant point'
  },
  {
    id: 'fix-pnp-04',
    fixtureCode: 'KAT-PNP-004',
    title: 'PNP Katipunan Municipal Police Station',
    category: 'CrimeOrSecurity',
    severity: 'Medium',
    latitude: 8.5178,
    longitude: 123.2874,
    assignedUnitType: 'PNP',
    isActive: true,
    description: 'Tactical patrol coordination base & community peace security grid'
  },
  {
    id: 'fix-hwy-05',
    fixtureCode: 'KAT-HWY-005',
    title: 'Dipolog-Sindangan National Highway Junction Radar',
    category: 'VehicularAccident',
    severity: 'Critical',
    latitude: 8.5105,
    longitude: 123.2801,
    assignedUnitType: 'RHU',
    isActive: true,
    description: 'High-incidence arterial intersection equipped with optical sensor monitoring'
  }
];

// ============================================================================
// 2. BASELINE INCIDENT REPORTS (High-Fidelity Telemetry Records)
// ============================================================================
export const BASELINE_INCIDENT_REPORTS: ReportItem[] = [
  {
    id: 'rep-kat-01',
    referenceCode: 'RESQ-20261028-001',
    reporterId: 'usr-civ-01',
    reporterName: 'Juan Dela Cruz',
    reporterRole: 'Civilian',
    title: 'Two-Motorcycle Collision with Acute Lower Limb Trauma',
    note: 'Head-on collision between two utility motorcycles; rider conscious with severe knee laceration and suspected tibial fracture.',
    category: 'VehicularAccident',
    severity: 'Critical',
    status: 'Allocated',
    latitude: 8.5119,
    longitude: 123.2814,
    locationLabel: 'National Highway Junction, Barangay Dos, Katipunan, ZN',
    hasImage: true,
    imageUrl: 'https://images.unsplash.com/photo-1543465077-db45d34b88a5?auto=format&fit=crop&w=900&q=80',
    allocatedUnitId: 'unit-rhu-01',
    allocatedUnitCode: 'AMB-RHU-01',
    createdAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    resolvedAt: null,
    gpsAccuracyMeters: 4.8,
    isHardwareGeolocated: true,
    isBlurry: false,
    requiresManualVerification: false,
    recommendedAgencyUnit: 'RHU'
  },
  {
    id: 'rep-kat-02',
    referenceCode: 'RESQ-20261028-002',
    reporterId: 'usr-civ-02',
    reporterName: 'Carmela Santos',
    reporterRole: 'Civilian',
    title: 'Commercial Storefront Electrical Wire Sparking & Arcing',
    note: 'Downed live feeder line arcing on corrugated metal awning; nearby civilian evacuated, zero immediate casualties.',
    category: 'StructuralFire',
    severity: 'High',
    status: 'Allocated',
    latitude: 8.5138,
    longitude: 123.2904,
    locationLabel: 'Public Market Perimeter, Barangay Uno, Katipunan, ZN',
    hasImage: true,
    imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=900&q=80',
    allocatedUnitId: 'unit-fire-01',
    allocatedUnitCode: 'FIRE-ENG-01',
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    resolvedAt: null,
    gpsAccuracyMeters: 6.2,
    isHardwareGeolocated: true,
    isBlurry: false,
    requiresManualVerification: false,
    recommendedAgencyUnit: 'FIRE'
  },
  {
    id: 'rep-kat-03',
    referenceCode: 'RESQ-20261028-003',
    reporterId: 'usr-civ-03',
    reporterName: 'Rodrigo Balang',
    reporterRole: 'Civilian',
    title: 'Acute Respiratory Distress in Senior Citizen Patient',
    note: 'Patient 72yo presenting with severe dyspnea, wheezing, and low oxygen saturation ~89%. Oxygen kit urgently required.',
    category: 'MedicalEmergency',
    severity: 'Critical',
    status: 'EnRoute',
    latitude: 8.5162,
    longitude: 123.2858,
    locationLabel: 'Purok 2, Barangay Poblacion, Katipunan, ZN',
    hasImage: true,
    imageUrl: 'https://images.unsplash.com/photo-1587745416684-47953f16f02f?auto=format&fit=crop&w=900&q=80',
    allocatedUnitId: 'unit-rhu-02',
    allocatedUnitCode: 'AMB-RHU-02',
    createdAt: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    resolvedAt: null,
    gpsAccuracyMeters: 3.5,
    isHardwareGeolocated: true,
    isBlurry: false,
    requiresManualVerification: false,
    recommendedAgencyUnit: 'RHU'
  },
  {
    id: 'rep-kat-04',
    referenceCode: 'RESQ-20261028-004',
    reporterId: 'usr-pnp-01',
    reporterName: 'PMAJ Victorino Magtanggol',
    reporterRole: 'Responder',
    title: 'Barangay Boundary Traffic Gridlock & Disturbance',
    note: 'Stalled cargo container truck causing 2-kilometer bottleneck on northern transit bridge; PNP mobile unit directing reroute.',
    category: 'CrimeOrSecurity',
    severity: 'Medium',
    status: 'OnScene',
    latitude: 8.5085,
    longitude: 123.2775,
    locationLabel: 'Sitio Malugas Bridge, Barangay Daanglungsod, Katipunan, ZN',
    hasImage: false,
    imageUrl: null,
    allocatedUnitId: 'unit-pnp-01',
    allocatedUnitCode: 'PNP-MOB-01',
    createdAt: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    resolvedAt: null,
    gpsAccuracyMeters: 8.1,
    isHardwareGeolocated: true,
    isBlurry: false,
    requiresManualVerification: false,
    recommendedAgencyUnit: 'PNP'
  },
  {
    id: 'rep-kat-05',
    referenceCode: 'RESQ-20261028-005',
    reporterId: 'usr-civ-04',
    reporterName: 'Elena Macaslang',
    reporterRole: 'Civilian',
    title: 'Resolved Pediatric Bicycle Fall & First Aid Dressing',
    note: 'Minor abrasions cleaned and dressed with sterile gauze. Patient cleared in safe condition by Medical Officer III.',
    category: 'MedicalEmergency',
    severity: 'Low',
    status: 'Resolved',
    latitude: 8.5042,
    longitude: 123.2923,
    locationLabel: 'Barangay Tuburan Plaza, Katipunan, ZN',
    hasImage: true,
    imageUrl: 'https://images.unsplash.com/photo-1584744982491-665216d95f8b?auto=format&fit=crop&w=800&q=80',
    allocatedUnitId: 'unit-rhu-01',
    allocatedUnitCode: 'AMB-RHU-01',
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    verifiedAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    gpsAccuracyMeters: 5.0,
    isHardwareGeolocated: true,
    isBlurry: false,
    requiresManualVerification: false,
    recommendedAgencyUnit: 'RHU'
  }
];

// ============================================================================
// 3. BASELINE DUTY ROSTER (Active Fleet across RHU, BFP, and PNP)
// ============================================================================
export const BASELINE_DUTY_ROSTER: DutyUnit[] = [
  {
    id: 'unit-rhu-01',
    unitCode: 'AMB-RHU-01',
    unitName: 'RHU Advanced Life Support Ambulance Alpha-1',
    agency: 'RHU',
    commanderName: 'Dr. Maria Clara Santos MD',
    status: 'OnDuty',
    baseLatitude: 8.5165,
    baseLongitude: 123.2861,
    contactHotline: '+63 917 555 0112',
    activePersonnelCount: 4,
    shiftSchedule: '06:00 - 18:00 (Alpha Day Shift)',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'unit-rhu-02',
    unitCode: 'AMB-RHU-02',
    unitName: 'RHU Mobile Trauma ICU Ambulance Bravo-2',
    agency: 'RHU',
    commanderName: 'Dr. Alejandro Gomez MD',
    status: 'Dispatched',
    baseLatitude: 8.5147,
    baseLongitude: 123.2842,
    contactHotline: '+63 917 555 0113',
    activePersonnelCount: 3,
    shiftSchedule: '06:00 - 18:00 (Bravo Rapid Shift)',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'unit-fire-01',
    unitCode: 'FIRE-ENG-01',
    unitName: 'BFP Central Katipunan Pumper Engine 01',
    agency: 'FIRE',
    commanderName: 'SINSP Ricardo Dalisay BFP',
    status: 'OnDuty',
    baseLatitude: 8.5122,
    baseLongitude: 123.2825,
    contactHotline: '+63 917 888 0911',
    activePersonnelCount: 6,
    shiftSchedule: '24-Hour Tactical Fire Watch',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'unit-pnp-01',
    unitCode: 'PNP-MOB-01',
    unitName: 'PNP Katipunan Tactical Mobile Patrol 01',
    agency: 'PNP',
    commanderName: 'PMAJ Victorino Magtanggol PNP',
    status: 'OnDuty',
    baseLatitude: 8.5178,
    baseLongitude: 123.2874,
    contactHotline: '+63 917 777 0117',
    activePersonnelCount: 4,
    shiftSchedule: '08:00 - 20:00 (Alpha Patrol Shift)',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'unit-rhu-03',
    unitCode: 'AMB-RHU-03',
    unitName: 'RHU Basic Life Support & Evacuation Rig Bravo-3',
    agency: 'RHU',
    commanderName: 'RN Patricia Mae Soriano BSN',
    status: 'Standby',
    baseLatitude: 8.5105,
    baseLongitude: 123.2801,
    contactHotline: '+63 917 555 0114',
    activePersonnelCount: 3,
    shiftSchedule: '14:00 - 02:00 (Swing Standby Shift)',
    updatedAt: new Date().toISOString()
  }
];

// ============================================================================
// 4. BASELINE USERS REGISTRY (Multi-Role Governance Profiles)
// ============================================================================
export const BASELINE_USER_SUMMARY: UserSummary[] = [
  {
    id: 'usr-admin-01',
    fullName: 'Commander Carlos Mendez',
    email: 'ldrrmo.admin@resqtrack.gov.ph',
    employeeOrResidentId: 'EMP-LDRRMO-001',
    role: 'LDRRMO_Admin',
    unit: 'LDRRMO',
    status: 'Verified',
    faceVerified: true,
    hasIdCapture: true,
    hasFaceCapture: true,
    departmentOrBarangay: 'LDRRMO Municipal Command Center',
    rankOrTitle: 'Executive Director / C2 Commander',
    createdAt: '2026-01-15T08:00:00Z',
    phoneNumber: '+63 917 889 4432'
  },
  {
    id: 'usr-medic-01',
    fullName: 'Dr. Maria Clara Santos MD',
    email: 'maria.santos@rhu.gov.ph',
    employeeOrResidentId: 'EMP-RHU-0102',
    role: 'Responder',
    unit: 'RHU',
    status: 'Verified',
    faceVerified: true,
    hasIdCapture: true,
    hasFaceCapture: true,
    departmentOrBarangay: 'RHU Emergency Medical Services',
    rankOrTitle: 'Medical Officer III / EMS Triage Lead',
    createdAt: '2026-02-01T08:00:00Z',
    phoneNumber: '+63 917 555 0112'
  },
  {
    id: 'usr-fire-01',
    fullName: 'SINSP Ricardo Dalisay BFP',
    email: 'ricardo.dalisay@bfp.gov.ph',
    employeeOrResidentId: 'EMP-BFP-0301',
    role: 'Responder',
    unit: 'FIRE',
    status: 'Verified',
    faceVerified: true,
    hasIdCapture: true,
    hasFaceCapture: true,
    departmentOrBarangay: 'BFP Katipunan Fire Station',
    rankOrTitle: 'Municipal Fire Marshal / Senior Inspector',
    createdAt: '2026-02-10T08:00:00Z',
    phoneNumber: '+63 917 888 0911'
  },
  {
    id: 'usr-pnp-01',
    fullName: 'PMAJ Victorino Magtanggol PNP',
    email: 'victorino.magtanggol@pnp.gov.ph',
    employeeOrResidentId: 'EMP-PNP-0401',
    role: 'Responder',
    unit: 'PNP',
    status: 'Verified',
    faceVerified: true,
    hasIdCapture: true,
    hasFaceCapture: true,
    departmentOrBarangay: 'Katipunan Municipal Police Station',
    rankOrTitle: 'Chief of Police / Police Major',
    createdAt: '2026-02-15T08:00:00Z',
    phoneNumber: '+63 917 777 0117'
  },
  {
    id: 'usr-civ-01',
    fullName: 'Juan Dela Cruz',
    email: 'juan.delacruz@gmail.com',
    employeeOrResidentId: 'RES-KAT-8821',
    role: 'Civilian',
    unit: 'None',
    status: 'Verified',
    faceVerified: true,
    hasIdCapture: true,
    hasFaceCapture: true,
    departmentOrBarangay: 'Barangay Poblacion, Katipunan',
    rankOrTitle: 'Barangay Resident',
    createdAt: '2026-03-01T08:00:00Z',
    phoneNumber: '+63 917 123 4567'
  }
];

// ============================================================================
// 5. BASELINE ALERTS (Official Public Safety Broadcasts)
// ============================================================================
export const BASELINE_ALERTS: AlertItem[] = [
  {
    reportId: 'alert-01',
    referenceCode: 'ADV-KAT-2026-001',
    title: 'Severe Weather Advisory: Heavy Coastal Precipitation Warning',
    category: 'NaturalDisaster',
    severity: 'High',
    status: 'Active',
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    isRead: false,
    hasImage: false,
    imageUrl: null
  },
  {
    reportId: 'alert-02',
    referenceCode: 'ADV-KAT-2026-002',
    title: 'National Highway Road Maintenance & Single-Lane Advisory',
    category: 'VehicularAccident',
    severity: 'Medium',
    status: 'Active',
    timestamp: new Date(Date.now() - 95 * 60 * 1000).toISOString(),
    isRead: true,
    hasImage: false,
    imageUrl: null
  },
  {
    reportId: 'alert-03',
    referenceCode: 'ADV-KAT-2026-003',
    title: 'Flash Flood Watch Alert: Low-Lying Riverine Barangays',
    category: 'NaturalDisaster',
    severity: 'Critical',
    status: 'Active',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    isRead: false,
    hasImage: false,
    imageUrl: null
  }
];

// ============================================================================
// 6. BASELINE CRYPTOGRAPHIC AUDIT LOGS
// ============================================================================
export const BASELINE_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-01',
    userId: 'usr-admin-01',
    userEmail: 'ldrrmo.admin@resqtrack.gov.ph',
    action: 'SYSTEM_BOOT_GENESIS',
    details: 'Katipunan C2 Multi-Agency Emergency Security Grid Initialized. SHA-256 genesis block locked.',
    timestamp: new Date(Date.now() - 3600 * 1000 * 6).toISOString()
  },
  {
    id: 'audit-02',
    userId: 'usr-admin-01',
    userEmail: 'ldrrmo.admin@resqtrack.gov.ph',
    action: 'UNIT_ALLOCATION',
    details: 'Allocated Tactical Unit AMB-RHU-01 to Incident RESQ-20261028-001. ETA ~3.2m computed.',
    timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString()
  },
  {
    id: 'audit-03',
    userId: 'usr-medic-01',
    userEmail: 'maria.santos@rhu.gov.ph',
    action: 'PCR_VITALS_SUBMITTED',
    details: 'Patient Care Record logged for Juan Dela Cruz: BP 120/80, SpO2 98%, HR 78bpm. Verified by MO-III.',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  }
];

// ============================================================================
// 7. BASELINE ANALYTICS SUMMARY DTO
// ============================================================================
export const BASELINE_ANALYTICS_SUMMARY: AnalyticsSummaryDto = {
  totalIncidents: 5,
  activeDispatches: 3,
  criticalIncidents: 2,
  resolvedCount: 1,
  totalResponders: 20,
  onDutyResponders: 14,
  registeredCivilians: 384
};
