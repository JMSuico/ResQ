// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: View and update responder operational profile and biometric verification badge.
// DO NOT permit alteration of official agency unit without administrative reassignment.

import React from 'react';
import { useSession } from '@/Hooks/useSession';
import { Button } from '@/Shared/Button';

export const ResponderProfile: React.FC = () => {
  const { session } = useSession();

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-bold text-white">Responder Identity & Operational Profile</h2>
        <p className="text-xs text-slate-400 mt-0.5">Biometric verification record and tactical credentials</p>
      </div>

      <div className="tactical-card p-6 flex flex-col gap-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-2xl font-black text-white shadow-lg">
            {session?.fullName?.charAt(0) || 'R'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{session?.fullName}</h3>
              {session?.faceVerified && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
                  ✓ FACE VERIFIED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">{session?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">OPERATIONAL ROLE</span>
            <span className="text-white font-bold">{session?.role}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ASSIGNED UNIT AGENCY</span>
            <span className="text-sky-400 font-bold">{session?.unit}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">BADGE / EMPLOYEE ID</span>
            <span className="text-white font-bold">{session?.employeeOrResidentId || 'N/A'}</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-500 block text-[10px]">RANK / TITLE</span>
            <span className="text-white font-bold">{session?.rankOrTitle || 'Field Responder'}</span>
          </div>
        </div>

        <div className="p-4 bg-sky-950/40 rounded-lg border border-sky-800/60 text-xs text-sky-200">
          <p className="font-bold">Security Note</p>
          <p className="mt-1 text-slate-300">
            Your account is cryptographically verified and guarded per-request by LDRRMO Security Policy.
            Duty unit assignments and permissions can only be altered by an authorized LDRRMO administrator.
          </p>
        </div>
      </div>
    </div>
  );
};
