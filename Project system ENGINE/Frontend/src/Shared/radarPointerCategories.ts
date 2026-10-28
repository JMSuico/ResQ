// [Layer: Shared]
// radarPointerCategories.ts -- Deterministic 16-category tactical radar pointer registry,
// medic vs non-medic role permission filters, localStorage settings sync, and 5-minute verification countdown helpers.
// Universal lambda expressions (=>). 100% pure Lucide icons (zero emojis).

import {
  Truck,
  Bike,
  CarFront,
  Flame,
  KeyRound,
  ShieldCheck,
  AlertOctagon,
  Crosshair,
  Biohazard,
  HeartHandshake,
  BriefcaseMedical,
  Ambulance,
  HeartPulse,
  Stethoscope,
  Skull,
  ShieldPlus,
  LucideIcon
} from 'lucide-react';

export type RadarPointerCategoryCode =
  | 'VEHICLE_4W_PLUS'
  | 'MOTOR_ACCIDENT'
  | 'MULTI_VEHICLE_ACCIDENT'
  | 'ROAD_RAGE'
  | 'CARNAPPING_MOTORNAPPING'
  | 'ROAD_CHECKPOINTS'
  | 'SUICIDE'
  | 'HOMICIDE'
  | 'GENOCIDE'
  | 'MINOR_INJURIES'
  | 'FIRST_AIDING'
  | 'HOSPITAL_EMERGENCY'
  | 'CRITICAL_CONDITIONS'
  | 'UNDER_MEDICAL_CARE'
  | 'DEAD_BODY'
  | 'ON_SAFE_HEALING';

export interface RadarPointerCategoryMeta {
  index: number;
  code: RadarPointerCategoryCode;
  label: string;
  shortLabel: string;
  isMedicAllowed: boolean;
  icon: LucideIcon;
  iconName: string;
  color: string;
  respondedColor: string;
  severityLevel: 'Critical' | 'High' | 'Moderate' | 'Low';
  agency: string;
  description: string;
  svgPathMarkup: string;
}

export interface MedicPointerSettings {
  paleNonMedicEnabled: boolean;
  hideNonMedicOnSort: boolean;
}

export const MEDIC_POINTER_SETTINGS_STORAGE_KEY = 'resqtrack_medic_pointer_settings';
export const RESPONDED_GREEN_COLOR = '#10B981';
export const DEFAULT_VERIFICATION_CLOSE_SECONDS = 300; // 5 minutes (05:00 -> 00:00)

export const RADAR_POINTER_CATEGORIES: RadarPointerCategoryMeta[] = [
  // ============================================================================
  // 1-9: VIEW-ONLY NON-MEDIC CATEGORIES (isMedicAllowed: false)
  // ============================================================================
  {
    index: 1,
    code: 'VEHICLE_4W_PLUS',
    label: 'Vehicle 4 Wheel or More Wheels Accident',
    shortLabel: '4W+ Vehicle Accident',
    isMedicAllowed: false,
    icon: Truck,
    iconName: 'Truck',
    color: '#F59E0B',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'PNP / BFP',
    description: 'Heavy sedan, SUV, truck, or multi-axle commercial vehicle collision.',
    svgPathMarkup: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
  },
  {
    index: 2,
    code: 'MOTOR_ACCIDENT',
    label: 'Motor Accident',
    shortLabel: 'Motor Accident',
    isMedicAllowed: false,
    icon: Bike,
    iconName: 'Bike',
    color: '#F59E0B',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Moderate',
    agency: 'PNP / Traffic',
    description: 'Two-wheel motorcycle or scooter road collision or slide.',
    svgPathMarkup: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>'
  },
  {
    index: 3,
    code: 'MULTI_VEHICLE_ACCIDENT',
    label: 'Vehicular Accidents Involve Many Vehicle Like Motor and 4 Wheels',
    shortLabel: 'Multi-Vehicle Pileup',
    isMedicAllowed: false,
    icon: CarFront,
    iconName: 'CarFront',
    color: '#F97316',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'LDRRMO / PNP / BFP',
    description: 'Multi-vehicle collision involving motorcycles and 4-wheel vehicles.',
    svgPathMarkup: '<path d="m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8"/><path d="M7 14h.01"/><path d="M17 14h.01"/><rect width="18" height="8" x="3" y="10" rx="2"/><path d="M5 18v2"/><path d="M19 18v2"/>'
  },
  {
    index: 4,
    code: 'ROAD_RAGE',
    label: 'Road Rage',
    shortLabel: 'Road Rage',
    isMedicAllowed: false,
    icon: Flame,
    iconName: 'Flame',
    color: '#F43F5E',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'PNP Patrol',
    description: 'Hostile altercation between motorists requiring police intervention.',
    svgPathMarkup: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'
  },
  {
    index: 5,
    code: 'CARNAPPING_MOTORNAPPING',
    label: 'Carnapping and Motornapping',
    shortLabel: 'Carnapping / Motornapping',
    isMedicAllowed: false,
    icon: KeyRound,
    iconName: 'KeyRound',
    color: '#A855F7',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'PNP HPG',
    description: 'Unlawful taking of a motor vehicle or motorcycle reported on radar.',
    svgPathMarkup: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>'
  },
  {
    index: 6,
    code: 'ROAD_CHECKPOINTS',
    label: 'Road Checkpoints',
    shortLabel: 'Road Checkpoint',
    isMedicAllowed: false,
    icon: ShieldCheck,
    iconName: 'ShieldCheck',
    color: '#6366F1',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Low',
    agency: 'PNP / AFP',
    description: 'Authorized tactical security checkpoint and highway inspection post.',
    svgPathMarkup: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>'
  },
  {
    index: 7,
    code: 'SUICIDE',
    label: 'Suicide',
    shortLabel: 'Suicide Alert',
    isMedicAllowed: false,
    icon: AlertOctagon,
    iconName: 'AlertOctagon',
    color: '#DC2626',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'PNP / Crisis Unit',
    description: 'High-priority self-harm crisis incident requiring immediate containment.',
    svgPathMarkup: '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>'
  },
  {
    index: 8,
    code: 'HOMICIDE',
    label: 'Homicide',
    shortLabel: 'Homicide Scene',
    isMedicAllowed: false,
    icon: Crosshair,
    iconName: 'Crosshair',
    color: '#EF4444',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'PNP SOCO',
    description: 'Lethal violent crime scene under police forensic perimeter lock.',
    svgPathMarkup: '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/><line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/><line x1="12" x2="12" y1="22" y2="18"/>'
  },
  {
    index: 9,
    code: 'GENOCIDE',
    label: 'Genocide',
    shortLabel: 'Mass Casualty / Genocide',
    isMedicAllowed: false,
    icon: Biohazard,
    iconName: 'Biohazard',
    color: '#991B1B',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'PNP / AFP / LDRRMO',
    description: 'Extreme mass-atrocity security threat requiring armed command lockdown.',
    svgPathMarkup: '<circle cx="12" cy="11.9" r="2"/><path d="M6.7 3.4c-.9 2.5 0 5.2 2.2 6.7-1.4-1.2-2.2-3.1-1.9-5 .3-1.9 1.7-3.4 3.5-4C9 1.5 7.5 2.2 6.7 3.4z"/><path d="M17.3 3.4c.9 2.5 0 5.2-2.2 6.7 1.4-1.2 2.2-3.1 1.9-5-.3-1.9-1.7-3.4-3.5-4 1.5.4 3 1.1 3.8 2.3z"/><path d="M12 22c-2.7 0-5-1.8-5.7-4.4.8 1.6 2.5 2.6 4.3 2.5 1.8-.1 3.4-1.3 4-3 .6 2.3-.6 4.9-2.6 4.9z"/>'
  },

  // ============================================================================
  // 10-16: MEDIC-ALLOWED CATEGORIES (isMedicAllowed: true)
  // ============================================================================
  {
    index: 10,
    code: 'MINOR_INJURIES',
    label: 'Minor Injuries',
    shortLabel: 'Minor Injuries',
    isMedicAllowed: true,
    icon: HeartHandshake,
    iconName: 'HeartHandshake',
    color: '#06B6D4',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Low',
    agency: 'RHU MEDIC',
    description: 'Superficial abrasions, mild sprains, or non-life-threatening trauma.',
    svgPathMarkup: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 5 9.04 7.96a2.17 2.17 0 0 0 0 3.08c.82.82 2.13.85 3 .07l2.07-1.9a2.82 2.82 0 0 1 3.79 0l2.96 2.66"/><path d="m18 15-2-2"/><path d="m15 18-2-2"/>'
  },
  {
    index: 11,
    code: 'FIRST_AIDING',
    label: 'First Aiding',
    shortLabel: 'First Aiding',
    isMedicAllowed: true,
    icon: BriefcaseMedical,
    iconName: 'BriefcaseMedical',
    color: '#14B8A6',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Moderate',
    agency: 'RHU MEDIC',
    description: 'Active field wound dressing, splinting, and primary trauma stabilization.',
    svgPathMarkup: '<path d="M12 11v4"/><path d="M14 13h-4"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M18 6v14"/><path d="M6 6v14"/><rect width="20" height="14" x="2" y="6" rx="2"/>'
  },
  {
    index: 12,
    code: 'HOSPITAL_EMERGENCY',
    label: 'Hospital Emergency',
    shortLabel: 'Hospital Emergency',
    isMedicAllowed: true,
    icon: Ambulance,
    iconName: 'Ambulance',
    color: '#F97316',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'RHU MEDIC',
    description: 'Urgent ambulance extraction and rapid hospital emergency room transport.',
    svgPathMarkup: '<path d="M10 10H6"/><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.28a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 16.382 8H14"/><path d="M8 8v4"/><path d="M9 18h6"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>'
  },
  {
    index: 13,
    code: 'CRITICAL_CONDITIONS',
    label: 'Critical Conditions',
    shortLabel: 'Critical Conditions',
    isMedicAllowed: true,
    icon: HeartPulse,
    iconName: 'HeartPulse',
    color: '#EF4444',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'RHU MEDIC',
    description: 'Life-threatening cardiac, respiratory, or severe hemorrhagic trauma.',
    svgPathMarkup: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>'
  },
  {
    index: 14,
    code: 'UNDER_MEDICAL_CARE',
    label: 'Under Medical Care',
    shortLabel: 'Under Medical Care',
    isMedicAllowed: true,
    icon: Stethoscope,
    iconName: 'Stethoscope',
    color: '#3B82F6',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Moderate',
    agency: 'RHU MEDIC',
    description: 'Patient actively receiving paramedic monitoring and IV stabilization.',
    svgPathMarkup: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>'
  },
  {
    index: 15,
    code: 'DEAD_BODY',
    label: 'Dead Body',
    shortLabel: 'Dead Body / Pronouncement',
    isMedicAllowed: true,
    icon: Skull,
    iconName: 'Skull',
    color: '#BE123C',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'RHU MEDIC / PNP',
    description: 'Deceased casualty requiring clinical pronouncement and forensic turnover.',
    svgPathMarkup: '<circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M8 20v2h8v-2"/><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"/>'
  },
  {
    index: 16,
    code: 'ON_SAFE_HEALING',
    label: 'On Safe Healing',
    shortLabel: 'On Safe Healing',
    isMedicAllowed: true,
    icon: ShieldPlus,
    iconName: 'ShieldPlus',
    color: '#10B981',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Low',
    agency: 'RHU MEDIC',
    description: 'Patient stabilized and cleared in safe recovery condition.',
    svgPathMarkup: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M9 12h6"/><path d="M12 9v6"/>'
  }
];

export const NON_MEDIC_POINTER_CATEGORIES: RadarPointerCategoryMeta[] = RADAR_POINTER_CATEGORIES.filter(
  (c) => !c.isMedicAllowed
);

export const MEDIC_ALLOWED_POINTER_CATEGORIES: RadarPointerCategoryMeta[] = RADAR_POINTER_CATEGORIES.filter(
  (c) => c.isMedicAllowed
);

export const getPointerCategoryByCode = (code?: string | null): RadarPointerCategoryMeta | undefined => {
  if (!code) return undefined;
  const normalized = code.trim().toUpperCase();
  return RADAR_POINTER_CATEGORIES.find(
    (c) => c.code === normalized || c.label.toUpperCase() === normalized || c.shortLabel.toUpperCase() === normalized
  );
};

export const resolvePointerCategory = (
  input?:
    | {
        category?: string;
        pointerCategory?: string;
        type?: string;
        title?: string;
        severity?: string;
        id?: string;
      }
    | string
    | null
): RadarPointerCategoryMeta => {
  if (!input) {
    return RADAR_POINTER_CATEGORIES[12]; // CRITICAL_CONDITIONS default
  }

  if (typeof input === 'string') {
    const direct = getPointerCategoryByCode(input);
    if (direct) return direct;
    return matchCategoryText(input);
  }

  const directCode =
    getPointerCategoryByCode(input.pointerCategory) ||
    getPointerCategoryByCode(input.category) ||
    getPointerCategoryByCode(input.type) ||
    getPointerCategoryByCode(input.title);

  if (directCode) return directCode;

  const combinedText = `${input.pointerCategory || ''} ${input.category || ''} ${input.type || ''} ${
    input.title || ''
  } ${input.severity || ''}`.trim();

  if (combinedText) {
    return matchCategoryText(combinedText, input.id);
  }

  return RADAR_POINTER_CATEGORIES[12];
};

const matchCategoryText = (rawText: string, seedId?: string): RadarPointerCategoryMeta => {
  const text = rawText.toLowerCase();

  if (text.includes('many vehicle') || text.includes('multi') || text.includes('pileup')) {
    return RADAR_POINTER_CATEGORIES[2]; // MULTI_VEHICLE_ACCIDENT
  }
  if (text.includes('4 wheel') || text.includes('truck') || text.includes('4w') || text.includes('bus')) {
    return RADAR_POINTER_CATEGORIES[0]; // VEHICLE_4W_PLUS
  }
  if (text.includes('motor accident') || text.includes('motorcycle') || text.includes('bike')) {
    return RADAR_POINTER_CATEGORIES[1]; // MOTOR_ACCIDENT
  }
  if (text.includes('road rage') || text.includes('altercation')) {
    return RADAR_POINTER_CATEGORIES[3]; // ROAD_RAGE
  }
  if (text.includes('carnap') || text.includes('motornap') || text.includes('stolen')) {
    return RADAR_POINTER_CATEGORIES[4]; // CARNAPPING_MOTORNAPPING
  }
  if (text.includes('checkpoint') || text.includes('blockade')) {
    return RADAR_POINTER_CATEGORIES[5]; // ROAD_CHECKPOINTS
  }
  if (text.includes('suicide') || text.includes('self-harm')) {
    return RADAR_POINTER_CATEGORIES[6]; // SUICIDE
  }
  if (text.includes('homicide') || text.includes('murder') || text.includes('shooting')) {
    return RADAR_POINTER_CATEGORIES[7]; // HOMICIDE
  }
  if (text.includes('genocide') || text.includes('massacre')) {
    return RADAR_POINTER_CATEGORIES[8]; // GENOCIDE
  }
  if (text.includes('minor injur') || text.includes('abrasion') || text.includes('sprain')) {
    return RADAR_POINTER_CATEGORIES[9]; // MINOR_INJURIES
  }
  if (text.includes('first aid') || text.includes('bandag') || text.includes('splint')) {
    return RADAR_POINTER_CATEGORIES[10]; // FIRST_AIDING
  }
  if (text.includes('hospital emergency') || text.includes('ambulance') || text.includes('transport')) {
    return RADAR_POINTER_CATEGORIES[11]; // HOSPITAL_EMERGENCY
  }
  if (text.includes('critical condition') || text.includes('cardiac') || text.includes('trauma') || text.includes('medical')) {
    return RADAR_POINTER_CATEGORIES[12]; // CRITICAL_CONDITIONS
  }
  if (text.includes('under medical care') || text.includes('monitoring') || text.includes('triage')) {
    return RADAR_POINTER_CATEGORIES[13]; // UNDER_MEDICAL_CARE
  }
  if (text.includes('dead body') || text.includes('deceased') || text.includes('fatality') || text.includes('cadaver')) {
    return RADAR_POINTER_CATEGORIES[14]; // DEAD_BODY
  }
  if (text.includes('safe healing') || text.includes('recovered') || text.includes('cleared')) {
    return RADAR_POINTER_CATEGORIES[15]; // ON_SAFE_HEALING
  }

  if (seedId) {
    let hash = 0;
    for (let i = 0; i < seedId.length; i += 1) {
      hash = (hash * 31 + seedId.charCodeAt(i)) % RADAR_POINTER_CATEGORIES.length;
    }
    return RADAR_POINTER_CATEGORIES[Math.abs(hash) % RADAR_POINTER_CATEGORIES.length];
  }

  return RADAR_POINTER_CATEGORIES[12];
};

export const isMedicAllowedCategory = (
  input?:
    | {
        category?: string;
        pointerCategory?: string;
        type?: string;
        title?: string;
        severity?: string;
        id?: string;
      }
    | string
    | null
): boolean => resolvePointerCategory(input).isMedicAllowed;

export const getMedicPointerSettings = (): MedicPointerSettings => {
  const fallback: MedicPointerSettings = {
    paleNonMedicEnabled: true,
    hideNonMedicOnSort: false
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(MEDIC_POINTER_SETTINGS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MedicPointerSettings>;
    return {
      paleNonMedicEnabled:
        typeof parsed.paleNonMedicEnabled === 'boolean' ? parsed.paleNonMedicEnabled : fallback.paleNonMedicEnabled,
      hideNonMedicOnSort:
        typeof parsed.hideNonMedicOnSort === 'boolean' ? parsed.hideNonMedicOnSort : fallback.hideNonMedicOnSort
    };
  } catch {
    return fallback;
  }
};

export const saveMedicPointerSettings = (
  patch: Partial<MedicPointerSettings>
): MedicPointerSettings => {
  const current = getMedicPointerSettings();
  const next: MedicPointerSettings = {
    ...current,
    ...patch
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(MEDIC_POINTER_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('resqtrack:medic-pointer-settings', { detail: next }));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
};

export const getRemainingCloseSeconds = (
  verifiedAt?: string | number | null,
  totalDurationSeconds: number = DEFAULT_VERIFICATION_CLOSE_SECONDS
): number => {
  if (!verifiedAt) return totalDurationSeconds;
  const parsedMs = typeof verifiedAt === 'number' ? verifiedAt : Date.parse(verifiedAt);
  if (Number.isNaN(parsedMs)) return totalDurationSeconds;
  const elapsedSeconds = Math.floor((Date.now() - parsedMs) / 1000);
  return Math.max(0, Math.min(totalDurationSeconds, totalDurationSeconds - elapsedSeconds));
};

export const formatCountdownMmSs = (seconds: number): string => {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const formatDateTimeWithSecondsAmPm = (dateInput?: string | number | Date | null): string => {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = Number.isNaN(d.getTime()) ? new Date() : d;

  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');

  let hours = validDate.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const hh = String(hours).padStart(2, '0');
  const mm = String(validDate.getMinutes()).padStart(2, '0');
  const ss = String(validDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hh}:${mm}:${ss} ${ampm}`;
};
