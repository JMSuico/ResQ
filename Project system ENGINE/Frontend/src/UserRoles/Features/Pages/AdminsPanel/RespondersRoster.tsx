// [Layer: UserRoles/Features/Pages/AdminsPanel]
// Responsibility: Displays multi-agency responder duty roster and allows admins to toggle duty status.
// DO NOT mutate commander assignment without recording audit logs.

import React, { useState, useEffect } from 'react';
import { getDutyRoster, updateUnitDutyStatus } from '@/Endpoints/responderOpsApi';
import { Button } from '@/Shared/Button';
import { formatIsoTimestamp } from '@/Libs/Assets/formatters';

export const RespondersRoster: React.FC = () => {
  const [roster, setRoster] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoster = async () => {
    try {
      setIsLoading(true);
      const data = await getDutyRoster();
      setRoster(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRoster();
  }, []);

  const handleStatusChange = async (unitId: string, status: 'OnDuty' | 'Dispatched' | 'Standby' | 'OffDuty') => {
    try {
      await updateUnitDutyStatus(unitId, status);
      await loadRoster();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Multi-Agency Responders Roster</h2>
        <p className="text-xs text-slate-400 mt-0.5">Real-time status management for RHU Medical, BFP Fire, PNP Police, and LDRRMO</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roster.map((unit) => {
          const agencyColor = {
            RHU: 'text-sky-400 border-sky-800 bg-sky-950/60',
            FIRE: 'text-orange-400 border-orange-800 bg-orange-950/60',
            PNP: 'text-blue-400 border-blue-800 bg-blue-950/60',
            LDRRMO: 'text-rose-400 border-rose-800 bg-rose-950/60'
          }[unit.agency] || 'text-slate-300 border-slate-700 bg-slate-900';

          return (
            <div key={unit.id} className="tactical-card p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${agencyColor}`}>
                    {unit.agency} // {unit.unitCode}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950 text-emerald-400 border border-slate-800">
                    {unit.status}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white">{unit.unitName}</h3>
                <p className="text-xs text-slate-400 mt-1">Commander: {unit.commanderName || 'Unassigned'}</p>

                <div className="grid grid-cols-2 gap-2 mt-4 text-[11px] font-mono text-slate-400 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div>Hotline: <span className="text-slate-200">{unit.contactHotline}</span></div>
                  <div>Personnel: <span className="text-slate-200">{unit.activePersonnelCount} Officers</span></div>
                  <div>Shift: <span className="text-slate-200">{unit.shiftSchedule}</span></div>
                  <div>Base: <span className="text-slate-200">{unit.baseLatitude.toFixed(2)}, {unit.baseLongitude.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono">
                  Updated: {formatIsoTimestamp(unit.updatedAt)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant={unit.status === 'OnDuty' ? 'success' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(unit.id, 'OnDuty')}
                  >
                    On Duty
                  </Button>
                  <Button
                    variant={unit.status === 'Dispatched' ? 'danger' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(unit.id, 'Dispatched')}
                  >
                    Dispatched
                  </Button>
                  <Button
                    variant={unit.status === 'Standby' ? 'warning' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(unit.id, 'Standby')}
                  >
                    Standby
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
