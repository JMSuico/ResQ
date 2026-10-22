// [Layer: Libs/Assets]
// Responsibility: Static incident fixture seeds and mock coordinate overlays.
// DO NOT mutate static fixture coordinate points at runtime.

export interface StaticFixture {
  id: string;
  code: string;
  title: string;
  lat: number;
  lng: number;
  type: 'hydrant' | 'evacuation' | 'flood';
  agency: 'FIRE' | 'LDRRMO';
  desc: string;
}

export const STATIC_FIXTURES: StaticFixture[] = [
  {
    id: 'f1',
    code: 'HYD-001',
    title: 'High-Pressure Fire Hydrant - Main Ave',
    lat: 14.6010,
    lng: 120.9855,
    type: 'hydrant',
    agency: 'FIRE',
    desc: 'Inspected monthly. Flow rate: 1200 GPM.'
  },
  {
    id: 'f2',
    code: 'EVAC-001',
    title: 'Sports Complex Evacuation Center',
    lat: 14.6080,
    lng: 120.9890,
    type: 'evacuation',
    agency: 'LDRRMO',
    desc: 'Capacity: 1,500 families with backup solar power.'
  },
  {
    id: 'f3',
    code: 'FLOOD-ZONE-A',
    title: 'Low-Lying Drainage Flood Monitor Zone',
    lat: 14.5930,
    lng: 120.9800,
    type: 'flood',
    agency: 'LDRRMO',
    desc: 'Critical flash-flood area during heavy monsoon rains.'
  }
];
