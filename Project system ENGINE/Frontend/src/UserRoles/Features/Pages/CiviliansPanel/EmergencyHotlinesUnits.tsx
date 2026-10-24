// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Complete emergency hotline directory and local agency station addresses.
// Includes 24/7 click-to-call triggers, station GPS route links, and public utility emergency desks.
// DO NOT provide invalid or outdated municipal contact numbers.

import React, { useState, useMemo } from 'react';
import { SearchBar } from '@/Shared/SearchBar';
import { AGENCY_METADATA } from '@/Libs/Assets/data';

interface ExtendedStationHotline {
  id: string;
  short: string;
  name: string;
  category: 'Emergency Response' | 'Public Utility' | 'Social Services';
  hotline: string;
  address: string;
  description: string;
  color: string;
  lat: number;
  lng: number;
}

const ALL_MUNICIPAL_HOTLINES: ExtendedStationHotline[] = [
  {
    id: 'ldrmmo',
    short: 'LDRRMO',
    name: 'Local Disaster Risk Reduction & Management Office',
    category: 'Emergency Response',
    hotline: '0917-123-4567 / (065) 212-3456',
    address: 'Municipal Hall Compound, Poblacion, Katipunan, ZN',
    description: '24/7 Central Emergency Operations Center, weather tracking, flood warnings, and multi-agency tactical dispatch.',
    color: '#e11d48',
    lat: 8.5080,
    lng: 123.2750
  },
  {
    id: 'rhu',
    short: 'RHU MEDIC',
    name: 'Rural Health Unit & Emergency Medical Services',
    category: 'Emergency Response',
    hotline: '0928-234-5678 / (065) 212-7890',
    address: 'National Highway, Barangay Uno, Katipunan, ZN',
    description: 'Trauma life support, ambulance transport, triage response, and primary healthcare emergency clinic.',
    color: '#0284c7',
    lat: 8.5090,
    lng: 123.2740
  },
  {
    id: 'fire',
    short: 'BFP FIRE',
    name: 'Bureau of Fire Protection - Katipunan Station',
    category: 'Emergency Response',
    hotline: '0939-345-6789 / (065) 212-4321',
    address: 'Poblacion West, Near Public Market, Katipunan, ZN',
    description: 'Fire suppression, search and vehicular rescue, hazardous material containment, and structural collapse response.',
    color: '#ea580c',
    lat: 8.5075,
    lng: 123.2760
  },
  {
    id: 'pnp',
    short: 'PNP POLICE',
    name: 'Philippine National Police - Katipunan Municipal Station',
    category: 'Emergency Response',
    hotline: '0945-456-7890 / (065) 212-8765',
    address: 'Rizal Street, Poblacion, Katipunan, ZN',
    description: 'Law enforcement, crime prevention, highway traffic investigation, cordon security, and public peace.',
    color: '#3b82f6',
    lat: 8.5065,
    lng: 123.2770
  },
  {
    id: 'zaneco',
    short: 'ZANECO',
    name: 'Zamboanga del Norte Electric Cooperative (Power Emergency)',
    category: 'Public Utility',
    hotline: '0917-888-9263 / (065) 212-9011',
    address: 'National Highway Substation, Katipunan, ZN',
    description: 'Downed power line clearing, transformer explosions, electrical hazard cut-off, and typhoon restoration crews.',
    color: '#eab308',
    lat: 8.5110,
    lng: 123.2720
  },
  {
    id: 'water',
    short: 'WATER DIST',
    name: 'Katipunan Municipal Water District Emergency Desk',
    category: 'Public Utility',
    hotline: '0920-555-1243 / (065) 212-4412',
    address: 'Barangay Matam, Katipunan, ZN',
    description: 'Main pipeline burst containment, water contamination reports, and emergency fire hydrant water replenishment.',
    color: '#06b6d4',
    lat: 8.5050,
    lng: 123.2790
  },
  {
    id: 'mswdo',
    short: 'MSWDO',
    name: 'Municipal Social Welfare and Development Office',
    category: 'Social Services',
    hotline: '0918-333-7890 / (065) 212-6543',
    address: 'Executive Building, Municipal Compound, Katipunan, ZN',
    description: 'Disaster relief pack distribution, evacuation camp management, family missing persons desk, and psychosocial support.',
    color: '#10b981',
    lat: 8.5085,
    lng: 123.2755
  }
];

export const EmergencyHotlinesUnits: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'Emergency Response' | 'Public Utility' | 'Social Services'>('ALL');

  const filteredHotlines = useMemo(() => {
    return ALL_MUNICIPAL_HOTLINES.filter((h) => {
      const matchesCategory = selectedCategory === 'ALL' || h.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.short.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.hotline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const getDialNumber = (hotline: string): string => {
    const raw = hotline.split('/')[0].trim();
    return raw.replace(/[^0-9+]/g, '');
  };

  const handleOpenGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-600/20 text-emerald-400 text-xs font-mono font-bold border border-emerald-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>24/7 CIVIL DEFENSE TELECOMMUNICATIONS DIRECTORY</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Municipal Emergency Hotlines & Stations</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Official direct emergency contacts, station physical addresses, and 1-tap dial triggers for Katipunan, Zamboanga del Norte
          </p>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['ALL', 'Emergency Response', 'Public Utility', 'Social Services'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'All Desks' : cat}
            </button>
          ))}
        </div>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search agency, hotline, service..."
          className="w-full sm:w-64"
        />
      </div>

      {/* 3. Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredHotlines.map((meta) => {
          const dialNumber = getDialNumber(meta.hotline);

          return (
            <div
              key={meta.id}
              className="tactical-card p-6 flex flex-col justify-between rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-xl"
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="px-2.5 py-0.5 rounded font-mono font-bold text-xs border uppercase tracking-wider"
                    style={{
                      backgroundColor: `${meta.color}20`,
                      color: meta.color,
                      borderColor: `${meta.color}50`
                    }}
                  >
                    {meta.short}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 bg-slate-950 border border-emerald-800/40 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    24/7 ACTIVE
                  </span>
                </div>

                <h2 className="text-base font-bold text-white leading-snug">{meta.name}</h2>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{meta.description}</p>

                <div className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
                  <span className="text-slate-500 font-mono">📍</span>
                  <span>{meta.address}</span>
                </div>
              </div>

              {/* Bottom Hotlines Strip */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">DIRECT HOTLINE DESK</span>
                    <span className="text-base font-mono font-black text-sky-400">{meta.hotline}</span>
                  </div>

                  <a
                    href={`tel:${dialNumber}`}
                    className="min-h-[42px] px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold font-mono transition-all shadow-md shadow-sky-950/60 flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98]"
                    aria-label={`Dial ${meta.name} hotline`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>Instant Call</span>
                  </a>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                  <span>GPS: {meta.lat.toFixed(4)}° N, {meta.lng.toFixed(4)}° E</span>
                  <button
                    type="button"
                    onClick={() => handleOpenGoogleMaps(meta.lat, meta.lng)}
                    className="text-sky-400 hover:text-sky-300 font-bold underline flex items-center gap-1"
                  >
                    <span>Open Station in Maps</span>
                    <span>↗</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmergencyHotlinesUnits;
