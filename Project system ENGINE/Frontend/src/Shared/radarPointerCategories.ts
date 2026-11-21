// [Layer: Shared]
// radarPointerCategories.ts -- Deterministic 16-category tactical radar pointer registry,
// high-contrast vector SVG beacon/vehicle icon helpers, medic vs non-medic role permission filters,
// localStorage settings sync, and 5-minute verification countdown helpers.
// Universal lambda expressions (=>). 100% pure vector SVG / Lucide icons (zero emojis, zero 'any').

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

export interface TacticalBeaconVisual {
  bgColor: string;
  ringColor: string;
  svgMarkup: string;
  ariaLabel: string;
  kindLabel: string;
}

export interface ResponderBadgeVisual {
  bgColor: string;
  accentColor: string;
  svgMarkup: string;
  ariaLabel: string;
  agencyLabel: string;
  isAvailable: boolean;
}

export const MEDIC_POINTER_SETTINGS_STORAGE_KEY = 'resqtrack_medic_pointer_settings';
export const RESPONDED_GREEN_COLOR = '#10B981';
export const DEFAULT_VERIFICATION_CLOSE_SECONDS = 300; // 5 minutes (05:00 -> 00:00)

// Crisp high-contrast vector SVG silhouettes (24x24 viewBox)
export const SVG_CAR_CRASH =
  '<path d="M2 16v-3l2-3h4l2 2"/><path d="M22 16v-3l-2-3h-4l-2 2"/><circle cx="5.5" cy="17.5" r="1.5"/><circle cx="18.5" cy="17.5" r="1.5"/><path d="M12 3v4"/><path d="m9 5 3 3 3-3"/><path d="M3 16h6"/><path d="M15 16h6"/>';

export const SVG_BURNING_HOUSE =
  '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M12 19a3 3 0 0 0 3-3c0-1.5-1.2-2.6-2-3.7-.6 1-1.3 1.4-1.6 1.7-.4-.8-.6-1.5-.4-2.5C9.7 12.7 9 14.3 9 16a3 3 0 0 0 3 3z" fill="currentColor" stroke="none"/>';

export const SVG_WEAPON_DANGER =
  '<circle cx="12" cy="12" r="8"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m8.5 15.5 7-7"/><path d="m13 8 3 3"/>';

export const SVG_FLOOD_RESCUE =
  '<path d="M4 11 12 4l8 7"/><path d="M6 10v4"/><path d="M18 10v4"/><path d="M2 17c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/><path d="M2 21c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0"/>';

export const SVG_MEDICAL_TRAUMA =
  '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M12 8v5"/><path d="M9.5 10.5h5"/>';

export const SVG_FIRETRUCK =
  '<path d="M2 16V9a2 2 0 0 1 2-2h9v9"/><path d="M13 10h5l3 3.5V16h-2"/><path d="M4 7h7"/><path d="M4 4h7"/><path d="M5.5 4v3"/><path d="M9.5 4v3"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M8.5 16h7"/>';

export const SVG_AMBULANCE =
  '<path d="M10 10H6"/><path d="M8 8v4"/><path d="M19 17h2c.6 0 1-.4 1-1v-4a2 2 0 0 0-2-2h-3l-2.4-3.6A2 2 0 0 0 13 6H5a2 2 0 0 0-2 2v8c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>';

export const SVG_POLICE_CRUISER =
  '<path d="M10 5h4"/><path d="M3 13l2-4.5A2 2 0 0 1 6.8 7h10.4a2 2 0 0 1 1.8 1.5L21 13"/><rect x="2" y="13" width="20" height="4" rx="1"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/><path d="M10 13v2h4v-2"/>';

export const SVG_COMMAND_UNIT =
  '<path d="M12 2 4 5v6c0 5 3.5 9.2 8 10.8 4.5-1.6 8-5.8 8-10.8V5l-8-3z"/><circle cx="12" cy="11" r="2.5"/><path d="M12 6.5v2"/><path d="M12 13.5v2"/><path d="M7.5 11h2"/><path d="M14.5 11h2"/>';

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
    color: '#D97706',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'PNP / BFP',
    description: 'Heavy sedan, SUV, truck, or multi-axle commercial vehicle collision.',
    svgPathMarkup: SVG_CAR_CRASH
  },
  {
    index: 2,
    code: 'MOTOR_ACCIDENT',
    label: 'Motor Accident',
    shortLabel: 'Motor Accident',
    isMedicAllowed: false,
    icon: Bike,
    iconName: 'Bike',
    color: '#D97706',
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
    color: '#DC2626',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'LDRRMO / PNP / BFP',
    description: 'Multi-vehicle collision involving motorcycles and 4-wheel vehicles.',
    svgPathMarkup: SVG_CAR_CRASH
  },
  {
    index: 4,
    code: 'ROAD_RAGE',
    label: 'Road Rage',
    shortLabel: 'Road Rage',
    isMedicAllowed: false,
    icon: Flame,
    iconName: 'Flame',
    color: '#EA580C',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'PNP Patrol',
    description: 'Hostile altercation between motorists requiring police intervention.',
    svgPathMarkup: SVG_BURNING_HOUSE
  },
  {
    index: 5,
    code: 'CARNAPPING_MOTORNAPPING',
    label: 'Carnapping and Motornapping',
    shortLabel: 'Carnapping / Motornapping',
    isMedicAllowed: false,
    icon: KeyRound,
    iconName: 'KeyRound',
    color: '#7C3AED',
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
    color: '#1D4ED8',
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
    color: '#991B1B',
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
    shortLabel: 'Homicide / Armed Threat',
    isMedicAllowed: false,
    icon: Crosshair,
    iconName: 'Crosshair',
    color: '#991B1B',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'PNP SOCO',
    description: 'Armed threat or violent crime scene under police forensic perimeter lock.',
    svgPathMarkup: SVG_WEAPON_DANGER
  },
  {
    index: 9,
    code: 'GENOCIDE',
    label: 'Genocide',
    shortLabel: 'Mass Casualty / Armed Threat',
    isMedicAllowed: false,
    icon: Biohazard,
    iconName: 'Biohazard',
    color: '#991B1B',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'PNP / AFP / LDRRMO',
    description: 'Extreme mass-atrocity security threat requiring armed command lockdown.',
    svgPathMarkup: SVG_WEAPON_DANGER
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
    color: '#0284C7',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Low',
    agency: 'RHU MEDIC',
    description: 'Superficial abrasions, mild sprains, or non-life-threatening trauma.',
    svgPathMarkup: SVG_MEDICAL_TRAUMA
  },
  {
    index: 11,
    code: 'FIRST_AIDING',
    label: 'First Aiding',
    shortLabel: 'First Aiding',
    isMedicAllowed: true,
    icon: BriefcaseMedical,
    iconName: 'BriefcaseMedical',
    color: '#0891B2',
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
    color: '#EA580C',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'High',
    agency: 'RHU MEDIC',
    description: 'Urgent ambulance extraction and rapid hospital emergency room transport.',
    svgPathMarkup: SVG_AMBULANCE
  },
  {
    index: 13,
    code: 'CRITICAL_CONDITIONS',
    label: 'Critical Conditions',
    shortLabel: 'Critical Conditions',
    isMedicAllowed: true,
    icon: HeartPulse,
    iconName: 'HeartPulse',
    color: '#DC2626',
    respondedColor: RESPONDED_GREEN_COLOR,
    severityLevel: 'Critical',
    agency: 'RHU MEDIC',
    description: 'Life-threatening cardiac, respiratory, or severe hemorrhagic trauma.',
    svgPathMarkup: SVG_MEDICAL_TRAUMA
  },
  {
    index: 14,
    code: 'UNDER_MEDICAL_CARE',
    label: 'Under Medical Care',
    shortLabel: 'Under Medical Care',
    isMedicAllowed: true,
    icon: Stethoscope,
    iconName: 'Stethoscope',
    color: '#0284C7',
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
    color: '#670626',
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
  if (
    text.includes('4 wheel') ||
    text.includes('truck') ||
    text.includes('4w') ||
    text.includes('bus') ||
    text.includes('vehicular') ||
    text.includes('car accident') ||
    text.includes('collision') ||
    text.includes('road accident')
  ) {
    return RADAR_POINTER_CATEGORIES[0]; // VEHICLE_4W_PLUS
  }
  if (text.includes('motor accident') || text.includes('motorcycle') || text.includes('bike')) {
    return RADAR_POINTER_CATEGORIES[1]; // MOTOR_ACCIDENT
  }
  if (
    text.includes('fire') ||
    text.includes('burn') ||
    text.includes('flame') ||
    text.includes('arson') ||
    text.includes('smoke') ||
    text.includes('road rage') ||
    text.includes('altercation')
  ) {
    return RADAR_POINTER_CATEGORIES[3]; // ROAD_RAGE / Fire Alert fallback
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
  if (
    text.includes('homicide') ||
    text.includes('murder') ||
    text.includes('shooting') ||
    text.includes('armed') ||
    text.includes('knife') ||
    text.includes('pistol') ||
    text.includes('gun') ||
    text.includes('weapon') ||
    text.includes('violence') ||
    text.includes('assault')
  ) {
    return RADAR_POINTER_CATEGORIES[7]; // HOMICIDE / Armed threat
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
  if (
    text.includes('critical condition') ||
    text.includes('cardiac') ||
    text.includes('trauma') ||
    text.includes('medical') ||
    text.includes('flood')
  ) {
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

// Resolves crisp vector icon, semantic color, and accessible aria-label for any incident marker
export const resolveIncidentBeaconVisual = (
  input: {
    category?: string;
    pointerCategory?: string;
    type?: string;
    title?: string;
    description?: string;
    severity?: string;
  },
  meta: RadarPointerCategoryMeta,
  isResponded: boolean
): TacticalBeaconVisual => {
  const norm = `${input.category || ''} ${input.pointerCategory || ''} ${input.type || ''} ${
    input.title || ''
  } ${input.description || ''} ${meta.code || ''}`.toLowerCase();

  if (isResponded) {
    return {
      bgColor: RESPONDED_GREEN_COLOR,
      ringColor: '#34D399',
      svgMarkup: meta.svgPathMarkup,
      ariaLabel: `Responded incident: ${meta.label}`,
      kindLabel: 'Responded'
    };
  }

  // 1. Burning Home / Structure Fire
  if (
    norm.includes('fire') ||
    norm.includes('burn') ||
    norm.includes('arson') ||
    norm.includes('flame') ||
    norm.includes('bfp') ||
    norm.includes('explosion')
  ) {
    return {
      bgColor: '#EA580C',
      ringColor: '#FDBA74',
      svgMarkup: SVG_BURNING_HOUSE,
      ariaLabel: 'Structure Fire or Burning Home Beacon',
      kindLabel: 'Structure Fire'
    };
  }

  // 2. Homicide / Armed / Violence / Knife / Pistol Threat
  if (
    norm.includes('homicide') ||
    norm.includes('genocide') ||
    norm.includes('armed') ||
    norm.includes('knife') ||
    norm.includes('pistol') ||
    norm.includes('gun') ||
    norm.includes('weapon') ||
    norm.includes('violence') ||
    norm.includes('assault') ||
    norm.includes('shooting') ||
    norm.includes('crime')
  ) {
    return {
      bgColor: '#991B1B',
      ringColor: '#FCA5A5',
      svgMarkup: SVG_WEAPON_DANGER,
      ariaLabel: 'Armed Threat or Violent Incident Beacon',
      kindLabel: 'Armed Threat'
    };
  }

  // 3. Vehicular / Car Accident
  if (
    norm.includes('vehicle') ||
    norm.includes('vehicular') ||
    norm.includes('car') ||
    norm.includes('crash') ||
    norm.includes('collision') ||
    norm.includes('pileup') ||
    norm.includes('traffic') ||
    norm.includes('motor')
  ) {
    const isCritical = (input.severity || '').toLowerCase() === 'critical' || norm.includes('multi');
    return {
      bgColor: isCritical ? '#DC2626' : '#D97706',
      ringColor: isCritical ? '#FCA5A5' : '#FCD34D',
      svgMarkup: SVG_CAR_CRASH,
      ariaLabel: 'Vehicular Accident Beacon',
      kindLabel: 'Vehicular Crash'
    };
  }

  // 4. Flood / Typhoon / Water Disaster
  if (norm.includes('flood') || norm.includes('typhoon') || norm.includes('water') || norm.includes('landslide')) {
    return {
      bgColor: '#0284C7',
      ringColor: '#7DD3FC',
      svgMarkup: SVG_FLOOD_RESCUE,
      ariaLabel: 'Flood or Weather Hazard Beacon',
      kindLabel: 'Flood Hazard'
    };
  }

  // 5. Medical / Trauma
  if (
    meta.isMedicAllowed ||
    norm.includes('medical') ||
    norm.includes('trauma') ||
    norm.includes('cardiac') ||
    norm.includes('injur') ||
    norm.includes('hospital')
  ) {
    return {
      bgColor: meta.color || '#DC2626',
      ringColor: '#FCA5A5',
      svgMarkup: meta.svgPathMarkup || SVG_MEDICAL_TRAUMA,
      ariaLabel: `Medical Triage Beacon: ${meta.label}`,
      kindLabel: meta.shortLabel
    };
  }

  return {
    bgColor: meta.color || '#670626',
    ringColor: '#E9D9D0',
    svgMarkup: meta.svgPathMarkup,
    ariaLabel: `Incident Beacon: ${meta.label}`,
    kindLabel: meta.shortLabel
  };
};

// Resolves agency vehicle badge for responder units (FIRE, RHU, PNP, LDRRMO)
export const resolveResponderBadgeVisual = (
  agency?: string,
  name?: string,
  status?: string
): ResponderBadgeVisual => {
  const norm = `${agency || ''} ${name || ''}`.toLowerCase();
  const normStatus = (status || '').toLowerCase();
  const isAvailable =
    normStatus === 'onduty' ||
    normStatus === 'available' ||
    normStatus === 'standby' ||
    normStatus === '';

  if (norm.includes('fire') || norm.includes('bfp')) {
    return {
      bgColor: '#EA580C',
      accentColor: '#FED7AA',
      svgMarkup: SVG_FIRETRUCK,
      ariaLabel: `Fire Rescue Unit ${name || ''}`.trim(),
      agencyLabel: 'FIRE',
      isAvailable
    };
  }

  if (norm.includes('pnp') || norm.includes('police') || norm.includes('patrol')) {
    return {
      bgColor: '#1D4ED8',
      accentColor: '#BFDBFE',
      svgMarkup: SVG_POLICE_CRUISER,
      ariaLabel: `Police Cruiser Unit ${name || ''}`.trim(),
      agencyLabel: 'PNP',
      isAvailable
    };
  }

  if (norm.includes('ldrrmo') || norm.includes('command') || norm.includes('c2')) {
    return {
      bgColor: '#670626',
      accentColor: '#F7F1EA',
      svgMarkup: SVG_COMMAND_UNIT,
      ariaLabel: `LDRRMO Command Unit ${name || ''}`.trim(),
      agencyLabel: 'LDRRMO',
      isAvailable
    };
  }

  return {
    bgColor: '#0284C7',
    accentColor: '#BAE6FD',
    svgMarkup: SVG_AMBULANCE,
    ariaLabel: `RHU Medical Unit ${name || ''}`.trim(),
    agencyLabel: 'RHU',
    isAvailable
  };
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

export const NEW_INCIDENT_PULSE_WINDOW_MINUTES = 10;

export const parseIncidentTimestampMs = (
  dateInput?: string | number | Date | null
): number | null => {
  if (dateInput === null || dateInput === undefined || dateInput === '') {
    return null;
  }
  if (typeof dateInput === 'number') {
    return Number.isFinite(dateInput) ? dateInput : null;
  }
  if (dateInput instanceof Date) {
    const ms = dateInput.getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  const trimmed = dateInput.trim();
  if (!trimmed) return null;

  const directMs = Date.parse(trimmed);
  if (!Number.isNaN(directMs)) {
    return directMs;
  }

  // Fallback for "YYYY-MM-DD HH:MM:SS AM/PM" local format
  const ampmMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i
  );
  if (ampmMatch) {
    const year = Number(ampmMatch[1]);
    const month = Number(ampmMatch[2]) - 1;
    const day = Number(ampmMatch[3]);
    let hour = Number(ampmMatch[4]);
    const minute = Number(ampmMatch[5]);
    const second = Number(ampmMatch[6] || '0');
    const meridiem = ampmMatch[7].toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    const parsed = new Date(year, month, day, hour, minute, second).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

export const isRecentlyReportedIncident = (
  reportedAt?: string | number | Date | null,
  windowMinutes: number = NEW_INCIDENT_PULSE_WINDOW_MINUTES,
  nowMs: number = Date.now()
): boolean => {
  const parsedMs = parseIncidentTimestampMs(reportedAt);
  if (parsedMs === null) return false;
  const ageMs = nowMs - parsedMs;
  // Allow up to 2 minutes of client/server clock skew on freshly uploaded reports
  return ageMs >= -120000 && ageMs <= windowMinutes * 60 * 1000;
};

export interface IncidentPulseState {
  shouldPulse: boolean;
  isNewUpload: boolean;
  isRecentTimestamp: boolean;
}

export const shouldPulseIncidentBeacon = (
  params: {
    status?: string | null;
    verifiedAt?: string | number | null;
    reportedAt?: string | number | Date | null;
    isResponded?: boolean;
    isFixture?: boolean;
  },
  nowMs: number = Date.now()
): IncidentPulseState => {
  if (params.isFixture) {
    return {
      shouldPulse: false,
      isNewUpload: false,
      isRecentTimestamp: false
    };
  }

  const statusLower = (params.status || '').trim().toLowerCase();
  const isAlreadyHandled =
    Boolean(params.isResponded) ||
    statusLower === 'responded' ||
    statusLower === 'resolved' ||
    statusLower === 'closed' ||
    statusLower === 'rejected';

  if (isAlreadyHandled) {
    return {
      shouldPulse: false,
      isNewUpload: false,
      isRecentTimestamp: false
    };
  }

  const isRecentTimestamp = isRecentlyReportedIncident(
    params.reportedAt,
    NEW_INCIDENT_PULSE_WINDOW_MINUTES,
    nowMs
  );

  const isInitialOrUrgentStatus =
    !params.verifiedAt ||
    statusLower === 'reported' ||
    statusLower === 'submitted' ||
    statusLower === 'active' ||
    statusLower === 'critical';

  return {
    shouldPulse: true,
    isNewUpload: isRecentTimestamp || isInitialOrUrgentStatus,
    isRecentTimestamp
  };
};
