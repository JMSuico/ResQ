// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Tactical duty roster check-in and shift schedule inspection for responders.
// DO NOT mutate shift assignments without recording operational timestamp.

import React, { useState, useEffect } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getDutyRoster, updateUnitDutyStatus } from '@/Endpoints/responderOpsApi';
import { Button } from '@/Shared/Button';

export const DutyRosterView: React.FC = () => {
  const { session } = useSession();
  const [roster, setRoster] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const data = await getDutyRoster();
      setRoster(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const myUnit = roster.find((u) => u.agency === session?.unit);

  const handleToggleDuty = async (newStatus: any) => {
    if (!myUnit) return;
    try {
      await updateUnitDutyStatus(myUnit.id, newStatus);
      await loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Unit Duty Roster & Shift Check-In</h2>
        <p className="text-xs text-slate-400 mt-0.5">Manage tactical readiness and verify agency shift schedules</p>
      </div>

      {myUnit && (
        <div className="tactical-card p-6 bg-gradient-to-r from-slate-900 to-sky-950/60 border-sky-500/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded bg-sky-950 text-sky-400 font-mono text-xs font-bold border border-sky-800">
              MY ACTIVE UNIT
            </span>
            <h3 className="text-xl font-bold text-white mt-2">{myUnit.unitName}</h3>
            <p className="text-xs text-slate-300 mt-1 font-mono">
              Status: <span className="font-bold text-emerald-400">{myUnit.status}</span> // Shift: {myUnit.shiftSchedule}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={myUnit.status === 'OnDuty' ? 'success' : 'outline'}
              size="md"
              onClick={() => handleToggleDuty('OnDuty')}
            >
              Check In (On Duty)
            </Button>
            <Button
              variant={myUnit.status === 'Standby' ? 'warning' : 'outline'}
              size="md"
              onClick={() => handleToggleDuty('Standby')}
            >
              Set Standby
            </Button>
            <Button
              variant={myUnit.status === 'OffDuty' ? 'danger' : 'outline'}
              size="md"
              onClick={() => handleToggleDuty('OffDuty')}
            >
              Check Out (Off Duty)
            </Button>
          </div>
        </div>
      )}

      <h3 className="text-base font-bold text-white mt-2">All Municipal Response Agency Units</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roster.map((u) => (
          <div key={u.id} className="tactical-card p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-sky-400">{u.unitCode}</span>
                <span className="text-xs font-bold text-white">{u.unitName}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Commander: {u.commanderName} // Hotline: {u.contactHotline}</p>
            </div>
            <span className="px-2 py-1 rounded text-[10px] font-mono bg-slate-950 text-slate-200 border border-slate-800">
              {u.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
