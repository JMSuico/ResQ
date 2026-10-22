// [Layer: Libs/Assets]
// Responsibility: Static agency registries, hotlines, categories, and severity color mappings.
// DO NOT hardcode disparate agency metadata across individual page components.

export const AGENCY_METADATA = {
  LDRRMO: {
    name: 'Local Disaster Risk Reduction & Management Office',
    short: 'LDRRMO',
    color: '#dc2626',
    hotline: '911 / (02) 8888-0001',
    description: 'Central Command & Multi-Agency Emergency Operations'
  },
  RHU: {
    name: 'Rural Health Unit - Emergency Medical Services',
    short: 'RHU',
    color: '#0284c7',
    hotline: '(02) 8888-0112',
    description: 'Ambulance dispatch, paramedical response, triage'
  },
  FIRE: {
    name: 'Bureau of Fire Protection (BFP)',
    short: 'FIRE',
    color: '#ea580c',
    hotline: '160 / (02) 8888-0160',
    description: 'Fire suppression, search & rescue, hazardous materials'
  },
  PNP: {
    name: 'Philippine National Police (PNP)',
    short: 'PNP',
    color: '#3b82f6',
    hotline: '117 / (02) 8888-0117',
    description: 'Law enforcement, perimeter security, traffic control'
  }
};

export const CATEGORY_LABELS: Record<string, string> = {
  VehicularAccident: 'Vehicular Accident',
  MedicalEmergency: 'Medical Emergency',
  StructuralFire: 'Structural Fire',
  CrimeOrSecurity: 'Crime / Security Incident',
  NaturalDisaster: 'Natural Disaster',
  HazardFixture: 'Infrastructure Hazard'
};

export const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Low: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-600/40' },
  Medium: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-600/40' },
  High: { bg: 'bg-orange-950/60', text: 'text-orange-400', border: 'border-orange-600/40' },
  Critical: { bg: 'bg-rose-950/70', text: 'text-rose-400', border: 'border-rose-600/50' }
};

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Reported: { bg: 'bg-blue-950/50', text: 'text-blue-400' },
  Verified: { bg: 'bg-indigo-950/50', text: 'text-indigo-400' },
  Allocated: { bg: 'bg-amber-950/50', text: 'text-amber-400' },
  EnRoute: { bg: 'bg-purple-950/50', text: 'text-purple-400' },
  OnScene: { bg: 'bg-cyan-950/50', text: 'text-cyan-400' },
  Resolved: { bg: 'bg-emerald-950/50', text: 'text-emerald-400' },
  Rejected: { bg: 'bg-rose-950/50', text: 'text-rose-400' }
};
