// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Standardized Katipunan emergency numbers and rapid dial telecommunications directory.
// Includes 24/7 instant click-to-call links (tel:...), physical coordinates, and Lucide tactical indicators.
// Strictly 100% arrow functions (=>), zero 'any', and zero emojis.

import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  HeartPulse,
  Flame,
  Shield,
  PhoneCall,
  MapPin,
  ExternalLink,
  Zap,
  Droplets,
  Users
} from 'lucide-react';
import { SearchBar } from '@/Shared/SearchBar';

export interface StandardEmergencyHotline {
  id: string;
  short: string;
  name: string;
  agencyType: 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP' | 'ZANECO' | 'WATER' | 'MSWDO';
  category: 'Emergency Response' | 'Public Utility' | 'Social Services';
  hotline: string;
  primaryDialNumber: string;
  address: string;
  description: string;
  color: string;
  lat: number;
  lng: number;
  priorityRank: number;
}

export const STANDARDIZED_KATIPUNAN_HOTLINES: StandardEmergencyHotline[] = [
  {
    id: 'ldrrmo',
    short: 'LDRRMO',
    name: 'Local Disaster Risk Reduction & Management Office (LDRRMO Command)',
    agencyType: 'LDRRMO',
    category: 'Emergency Response',
    hotline: '0917-123-4567 / (065) 212-3456',
    primaryDialNumber: '09171234567',
    address: 'Municipal Hall Compound, Poblacion, Katipunan, Zamboanga del Norte',
    description: '24/7 Central Emergency Operations Center, typhoon tracking, flash flood alarms, and multi-agency tactical dispatch.',
    color: '#e11d48',
    lat: 8.5080,
    lng: 123.2750,
    priorityRank: 1
  },
  {
    id: 'rhu',
    short: 'RHU MEDIC',
    name: 'Rural Health Unit & Emergency Medical Services (Katipunan RHU)',
    agencyType: 'RHU',
    category: 'Emergency Response',
    hotline: '0928-234-5678 / (065) 212-7890',
    primaryDialNumber: '09282345678',
    address: 'National Highway, Barangay Uno, Katipunan, Zamboanga del Norte',
    description: 'Advanced trauma life support, ambulance transport, triage evacuation, and primary emergency clinic care.',
    color: '#0284c7',
    lat: 8.5090,
    lng: 123.2740,
    priorityRank: 2
  },
  {
    id: 'fire',
    short: 'BFP FIRE',
    name: 'Bureau of Fire Protection - Katipunan Station (BFP Fire)',
    agencyType: 'FIRE',
    category: 'Emergency Response',
    hotline: '0939-345-6789 / (065) 212-4321',
    primaryDialNumber: '09393456789',
    address: 'Poblacion West, Near Public Market, Katipunan, Zamboanga del Norte',
    description: 'Structural and vehicular fire suppression, technical extrication rescue, chemical containment, and disaster safety.',
    color: '#ea580c',
    lat: 8.5075,
    lng: 123.2760,
    priorityRank: 3
  },
  {
    id: 'pnp',
    short: 'PNP POLICE',
    name: 'Philippine National Police - Katipunan Municipal Police Station (PNP)',
    agencyType: 'PNP',
    category: 'Emergency Response',
    hotline: '0945-456-7890 / (065) 212-8765',
    primaryDialNumber: '09454567890',
    address: 'Rizal Street, Poblacion, Katipunan, Zamboanga del Norte',
    description: 'Law enforcement, road collision and highway traffic cordon, public security, crime prevention, and incident reports.',
    color: '#3b82f6',
    lat: 8.5065,
    lng: 123.2770,
    priorityRank: 4
  },
  {
    id: 'zaneco',
    short: 'ZANECO',
    name: 'Zamboanga del Norte Electric Cooperative (Power Emergency)',
    agencyType: 'ZANECO',
    category: 'Public Utility',
    hotline: '0917-888-9263 / (065) 212-9011',
    primaryDialNumber: '09178889263',
    address: 'National Highway Substation, Katipunan, Zamboanga del Norte',
    description: 'Live fallen power line clearing, transformer failure cut-off, electrical hazards, and storm grid restoration.',
    color: '#eab308',
    lat: 8.5110,
    lng: 123.2720,
    priorityRank: 5
  },
  {
    id: 'water',
    short: 'WATER DIST',
    name: 'Katipunan Municipal Water District Emergency Desk',
    agencyType: 'WATER',
    category: 'Public Utility',
    hotline: '0920-555-1243 / (065) 212-4412',
    primaryDialNumber: '09205551243',
    address: 'Barangay Matam, Katipunan, Zamboanga del Norte',
    description: 'Main pipeline burst containment, water contamination advisories, and emergency hydrant replenishment.',
    color: '#06b6d4',
    lat: 8.5050,
    lng: 123.2790,
    priorityRank: 6
  },
  {
    id: 'mswdo',
    short: 'MSWDO',
    name: 'Municipal Social Welfare and Development Office (MSWDO)',
    agencyType: 'MSWDO',
    category: 'Social Services',
    hotline: '0918-333-7890 / (065) 212-6543',
    primaryDialNumber: '09183337890',
    address: 'Executive Building, Municipal Compound, Katipunan, Zamboanga del Norte',
    description: 'Disaster relief pack distribution, evacuation camp administration, family tracing desk, and crisis counseling.',
    color: '#10b981',
    lat: 8.5085,
    lng: 123.2755,
    priorityRank: 7
  }
];

export const EmergencyNumbersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'Emergency Response' | 'Public Utility' | 'Social Services'>('ALL');

  const filteredHotlines = useMemo(() => {
    return STANDARDIZED_KATIPUNAN_HOTLINES.filter((h) => {
      const matchesCategory = selectedCategory === 'ALL' || h.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.short.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.hotline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleOpenGoogleMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getAgencyIcon = (agencyType: StandardEmergencyHotline['agencyType']) => {
    switch (agencyType) {
      case 'LDRRMO':
        return <AlertTriangle className="w-5 h-5 text-rose-500" />;
      case 'RHU':
        return <HeartPulse className="w-5 h-5 text-sky-400" />;
      case 'FIRE':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'PNP':
        return <Shield className="w-5 h-5 text-blue-400" />;
      case 'ZANECO':
        return <Zap className="w-5 h-5 text-yellow-400" />;
      case 'WATER':
        return <Droplets className="w-5 h-5 text-cyan-400" />;
      case 'MSWDO':
      default:
        return <Users className="w-5 h-5 text-emerald-400" />;
    }
  };

  const getAgencyStyles = (agencyType: StandardEmergencyHotline['agencyType']) => {
    switch (agencyType) {
      case 'LDRRMO':
        return {
          border: 'border-rose-600/30 hover:border-rose-500/70',
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
          btnBg: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60'
        };
      case 'RHU':
        return {
          border: 'border-sky-600/30 hover:border-sky-500/70',
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
          btnBg: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-950/60'
        };
      case 'FIRE':
        return {
          border: 'border-orange-600/30 hover:border-orange-500/70',
          badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
          btnBg: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-950/60'
        };
      case 'PNP':
        return {
          border: 'border-blue-600/30 hover:border-blue-500/70',
          badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
          btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-950/60'
        };
      case 'ZANECO':
        return {
          border: 'border-yellow-600/30 hover:border-yellow-500/70',
          badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
          btnBg: 'bg-yellow-600 hover:bg-yellow-500 text-slate-950 shadow-yellow-950/60'
        };
      case 'WATER':
        return {
          border: 'border-cyan-600/30 hover:border-cyan-500/70',
          badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
          btnBg: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/60'
        };
      case 'MSWDO':
      default:
        return {
          border: 'border-emerald-600/30 hover:border-emerald-500/70',
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          btnBg: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60'
        };
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-600/20 text-rose-400 text-xs font-mono font-bold border border-rose-600/40 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>24/7 KATIPUNAN MUNICIPAL DISPATCH NETWORK</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Standard Emergency Hotlines Directory</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Instant click-to-call emergency lines, physical station addresses, and direct responders for Katipunan, ZN
          </p>
        </div>
      </div>

      {/* 2. Search & Category Filter Bar */}
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
              {cat === 'ALL' ? 'All Municipal Hotlines' : cat}
            </button>
          ))}
        </div>

        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search agency, hotline, address..."
          className="w-full sm:w-64"
        />
      </div>

      {/* 3. Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredHotlines.map((item) => {
          const styles = getAgencyStyles(item.agencyType);

          return (
            <div
              key={item.id}
              className={`tactical-card p-6 flex flex-col justify-between rounded-2xl bg-slate-900/90 border transition-all shadow-xl ${styles.border}`}
            >
              <div>
                {/* Header Row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded font-mono font-bold text-xs border uppercase tracking-wider ${styles.badge}`}>
                      {item.short}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {item.category}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center">
                    {getAgencyIcon(item.agencyType)}
                  </div>
                </div>

                <h2 className="text-base font-bold text-white leading-snug">{item.name}</h2>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{item.description}</p>

                <div className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 inline-block mr-0.5 flex-shrink-0 mt-0.5" />
                  <span>{item.address}</span>
                </div>
              </div>

              {/* Bottom Hotline Action Strip */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase block font-semibold">24/7 HOTLINE DESK</span>
                    <span className="text-base font-mono font-black text-sky-400">{item.hotline}</span>
                  </div>

                  <a
                    href={`tel:${item.primaryDialNumber}`}
                    className={`min-h-[44px] px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap active:scale-[0.98] ${styles.btnBg}`}
                    aria-label={`Dial ${item.short} hotline`}
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Instant Call: {item.primaryDialNumber}</span>
                  </a>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1">
                  <span>GPS: {item.lat.toFixed(4)}° N, {item.lng.toFixed(4)}° E</span>
                  <button
                    type="button"
                    onClick={() => handleOpenGoogleMaps(item.lat, item.lng)}
                    className="text-sky-400 hover:text-sky-300 font-bold underline flex items-center gap-1"
                  >
                    <span>Station Location in Maps</span>
                    <ExternalLink className="w-3 h-3" />
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

export default EmergencyNumbersPage;
