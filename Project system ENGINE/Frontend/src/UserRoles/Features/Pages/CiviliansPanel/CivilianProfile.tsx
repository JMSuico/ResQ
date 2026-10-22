// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays citizen profile, verified resident badge, and registered barangay.
// DO NOT expose raw biometric capture files to unauthorized observers.

import React from 'react';
import { useSession } from '@/Hooks/useSession';

export const CivilianProfile: React.FC = () => {
  const { session } = useSession();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Resident Identity Profile</h2>
        <p className="text-xs text-slate-400 mt-0.5">Biometric verification status and municipal registration details</p>
      </div>

      <div className="tactical-card p-6 flex flex-col gap-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
            {session?.fullName?.charAt(0) || 'C'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{session?.fullName}</h3>
              {session?.faceVerified && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
                  ✓ BIOMETRICALLY VERIFIED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{session?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ACCOUNT STATUS</span>
            <span className="text-emerald-400 font-bold">{session?.status}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">RESIDENT / STUDENT ID</span>
            <span className="text-white font-bold">{session?.employeeOrResidentId || 'N/A'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 col-span-2">
            <span className="text-slate-500 block text-[10px]">REGISTERED BARANGAY / COMMUNITY</span>
            <span className="text-white font-bold">{session?.departmentOrBarangay || 'Urban Ground Community'}</span>
          </div>
        </div>

        <div className="p-4 bg-emerald-950/30 rounded-lg border border-emerald-800/40 text-xs text-emerald-200">
          <p className="font-bold">Citizen Safety Guarantee</p>
          <p className="mt-1 text-slate-300">
            Your identity and facial biometric captures are encrypted and stored in secure municipal vaults.
            Reports filed under your account are prioritized for rapid multi-agency dispatch.
          </p>
        </div>
      </div>
    </div>
  );
};
