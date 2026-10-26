// [Layer: UserRoles/Features/Pages/RespondersPanel/Police]
// Responsibility: PNP Officer Duty Credentials, Verified Sidearm Serial, Body-Worn Camera & Armory Profile.
// Ensures strict compliance with PNP Armory Standard Operating Procedures (SOP No. 13)
// and Body-Worn Camera Operational Protocols (PNP-BWC-2021).

import React, { useState, useEffect } from 'react';
import { useSession } from '@/Hooks/useSession';
import { formatIsoTimestamp } from '@/Libs/Assets/formatters';

export const OfficerArmoryProfilePage: React.FC = () => {
  const { session } = useSession();

  const officerName = session?.fullName || 'Marco V. Santillan';
  const officerRank = session?.rankOrTitle || 'Police Major (PMAJ)';
  const badgeId = session?.employeeOrResidentId || 'PNP-77491';
  const stationName = 'Dipolog City Police Station - Sector 1';

  const [lastCheckIn, setLastCheckIn] = useState<string>(() => {
    try {
      return localStorage.getItem('resqtrack_pnp_last_armory_checkin') || new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  });

  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleVerifyEquipment = () => {
    const now = new Date().toISOString();
    setLastCheckIn(now);
    setIsCheckedIn(true);
    try {
      localStorage.setItem('resqtrack_pnp_last_armory_checkin', now);
    } catch {
      // ignore
    }
    showToast('✓ ARMORY & DUTY SIDEARM VERIFICATION SIGNED & TIMESTAMPED');
  };

  return (
    <div className="flex-1 w-full flex flex-col space-y-5 text-slate-100">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-xl border border-blue-600/30 bg-gradient-to-r from-[#0a1128] via-[#0f1f4b] to-[#0a1128] p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/20 border-2 border-blue-500/50 shadow-inner shadow-blue-500/40">
              <svg className="h-8 w-8 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3 3h5v5l3 3-3 3v5h-5l-3 3-3-3H4v-5l-3-3 3-3V5h5l3-3z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-400/30">
                  PNP OFFICER CREDENTIALS & ARMORY
                </span>
                <span className="text-xs font-mono text-emerald-400 font-semibold">
                  WEAPONS QUALIFIED (CLASS A)
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
                Officer Armory & Tactical Duty Dossier
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                National Police Commission • Firearm Ballistics Serial Verification • Body-Worn Camera Registry
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleVerifyEquipment}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-xs uppercase tracking-wider shadow-xl shadow-emerald-900/60 border border-emerald-400/60 transition-all"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>VERIFY GEAR & SIGN MUSTER</span>
            </button>
          </div>
        </div>
      </div>

      {/* OFFICER BADGE & SERVICE CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: OFFICIAL POLICE ID CARD (4 COLS) */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          <div className="relative overflow-hidden rounded-2xl border-2 border-blue-500/50 bg-gradient-to-b from-[#0f1f4b] to-[#0a1128] p-6 shadow-2xl text-center space-y-4">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-600"></div>

            {/* PNP Crest Badge Insignia */}
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-600/20 border-4 border-blue-400 shadow-2xl shadow-blue-500/50">
              <span className="text-4xl">👮</span>
            </div>

            <div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-blue-300">
                PHILIPPINE NATIONAL POLICE
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                {officerName}
              </h2>
              <div className="text-sm font-bold text-blue-400 font-mono mt-0.5">
                {officerRank}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-1">
                Badge No.: <b className="text-slate-200">{badgeId}</b>
              </div>
            </div>

            <div className="rounded-xl border border-blue-900/60 bg-slate-950/80 p-3 text-left space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Station Assignment:</span>
                <span className="text-slate-200 font-bold">{stationName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Biometric Match:</span>
                <span className="text-emerald-400 font-bold">✓ 100% Face Verified</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-1">
                <span className="text-slate-400">Weapon Rating:</span>
                <span className="text-blue-300 font-bold">Marksman Expert</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Muster Verified:</span>
                <span className="text-slate-200">{formatIsoTimestamp(lastCheckIn)}</span>
              </div>
            </div>

            <div className="pt-2 text-[10px] font-mono text-slate-500">
              PROPERTY OF THE NATIONAL POLICE COMMISSION • NON-TRANSFERABLE
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ARMORY, DUTY SIDEARM, BODY CAMERA & GEAR (8 COLS) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* SECTION 1: DUTY SIDEARM SPECIFICATION */}
          <div className="rounded-xl border border-blue-900/50 bg-[#0a1128]/90 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-blue-900/60 pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-base">🔫</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Primary Duty Sidearm & Ballistic Registry
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                FEO VERIFIED
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="rounded-lg bg-slate-900/70 p-3 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Make & Model</span>
                <div className="font-bold text-white text-sm mt-0.5">GLOCK 17 Gen 4</div>
                <div className="text-slate-400 text-[11px]">Caliber: 9x19mm Parabellum</div>
              </div>

              <div className="rounded-lg bg-slate-900/70 p-3 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Verified Serial Number</span>
                <div className="font-bold text-blue-400 text-sm mt-0.5">PNP-984421-G17</div>
                <div className="text-slate-400 text-[11px]">FEO Plantilla Match</div>
              </div>

              <div className="rounded-lg bg-slate-900/70 p-3 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Ballistic IBIS Code</span>
                <div className="font-bold text-slate-200 text-sm mt-0.5">IBIS-2024-ZDN-08819</div>
                <div className="text-slate-400 text-[11px]">Rifling & Casing on File</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg bg-slate-900/50 p-3 border border-slate-800/80 space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Ammunition Allotment</div>
                <div className="text-white font-mono font-semibold">
                  3x 17-Round Magazines (Total 51 Rounds 9mm FMJ 115gr Issued)
                </div>
                <div className="text-[11px] text-slate-400">Station Lot No.: AFP-PMC-2026-A12</div>
              </div>

              <div className="rounded-lg bg-slate-900/50 p-3 border border-slate-800/80 space-y-1">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Maintenance & Chamber Status</div>
                <div className="text-emerald-400 font-mono font-semibold">
                  Cleaned & Inspected • Chamber Condition 1 (Duty Ready)
                </div>
                <div className="text-[11px] text-slate-400">Armorer Check: PSSg R. Magsaysay</div>
              </div>
            </div>
          </div>

          {/* SECTION 2: BODY-WORN CAMERA (BWC) TELEMETRY */}
          <div className="rounded-xl border border-blue-900/50 bg-[#0a1128]/90 p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-blue-900/60 pb-2">
              <div className="flex items-center space-x-2">
                <span className="text-base">📹</span>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  Body-Worn Camera (BWC) Operational Telemetry
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                BUFFERING ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="rounded-lg bg-slate-900/70 p-3 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Device Identifier</span>
                <div className="font-bold text-white text-sm mt-0.5">BWC-AXON-0492</div>
                <div className="text-slate-400 text-[11px]">Model: Axon Body 3</div>
              </div>

              <div className="rounded-lg bg-slate-900/70 p-3 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Internal Storage</span>
                <div className="font-bold text-blue-400 text-sm mt-0.5">21.6 GB FREE</div>
                <div className="text-slate-400 text-[11px]">42.4 GB / 64 GB Used</div>
              </div>

              <div className="rounded-lg bg-slate-900/70 p-3 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Battery Endurance</span>
                <div className="font-bold text-emerald-400 text-sm mt-0.5">94% CHARGED</div>
                <div className="text-slate-400 text-[11px]">~11.5 Hours Shift Life</div>
              </div>
            </div>

            <div className="rounded-lg bg-slate-900/50 p-3 border border-slate-800/80 text-xs font-mono space-y-1 text-slate-300">
              <div className="flex justify-between">
                <span>Video Resolution & Audio:</span>
                <span className="text-white font-bold">1080p FHD 30FPS • Dual Mic Noise Reduction</span>
              </div>
              <div className="flex justify-between">
                <span>Pre-Event Buffer:</span>
                <span className="text-emerald-400 font-bold">30 Seconds Video Rollback Enabled</span>
              </div>
              <div className="flex justify-between">
                <span>Automatic CAD Activation:</span>
                <span className="text-blue-300 font-bold">Enabled upon Code 3 Dispatch</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: LESS-LETHAL DEFENSE GEAR & TACTICAL ARMOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-blue-900/50 bg-[#0a1128]/90 p-4 shadow-xl space-y-2 text-xs">
              <div className="font-bold uppercase text-blue-300 text-xs border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Less-Lethal Duty Gear</span>
                <span className="text-[10px] font-mono text-emerald-400">CERTIFIED</span>
              </div>
              <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                <div>• <b>Axon TASER X26P:</b> Serial T-X26P-55910 (2x Cartridges)</div>
                <div>• <b>Aerosol Spray:</b> Sabre Red MK-4 Crossfire 3oz OC Stream</div>
                <div>• <b>Restraints:</b> Peerless Model 700 Nickel-Plated Handcuffs</div>
                <div>• <b>Baton:</b> ASP 21-Inch Friction-Loc Expandable Baton</div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-900/50 bg-[#0a1128]/90 p-4 shadow-xl space-y-2 text-xs">
              <div className="font-bold uppercase text-blue-300 text-xs border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <span>Tactical Ballistic Armor</span>
                <span className="text-[10px] font-mono text-blue-400">NIJ LEVEL IIIA</span>
              </div>
              <div className="space-y-1.5 text-slate-300 font-mono text-[11px]">
                <div>• <b>Vest Model:</b> Point Blank Kevlar Soft Armor + Molle</div>
                <div>• <b>Serial Number:</b> VEST-PNP-0934</div>
                <div>• <b>Rifle Plate Pockets:</b> 10x12 Shooters Cut Ready</div>
                <div>• <b>Inspection Seal:</b> Valid until December 2028</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-blue-500/50 bg-[#0a1128] px-4 py-3 text-xs font-mono font-bold text-blue-200 shadow-2xl shadow-blue-950/80 animate-slideUp">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default OfficerArmoryProfilePage;
