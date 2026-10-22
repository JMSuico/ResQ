// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Feed of dispatches allocated to the active responder agency with status progression controls.
// DO NOT permit resolution of incidents assigned to external agencies.

import React, { useState, useEffect } from 'react';
import { useSession } from '@/Hooks/useSession';
import { getAgencyReports } from '@/Endpoints/reportsApi';
import { verifyReport } from '@/Endpoints/adminGovernanceApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatGpsCoord } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS, STATUS_COLORS } from '@/Libs/Assets/data';

export const UnitIncidentsFeed: React.FC = () => {
  const { session } = useSession();
  const [incidents, setIncidents] = useState<any[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const loadIncidents = async () => {
    if (!session || session.unit === 'None') return;
    try {
      const data = await getAgencyReports(session.unit);
      setIncidents(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, [session]);

  const handleStatusProgression = async (reportId: string, nextStatus: string) => {
    try {
      await verifyReport(reportId, nextStatus, `Status updated to ${nextStatus} by responder ${session?.fullName}`);
      await loadIncidents();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Agency Unit Incident Dispatches</h2>
        <p className="text-xs text-slate-400 mt-0.5">Active field assignments allocated to {session?.unit} tactical response force</p>
      </div>

      <div className="flex flex-col gap-4">
        {incidents.length === 0 ? (
          <div className="tactical-card p-8 text-center text-slate-500">
            No active dispatches currently assigned to {session?.unit}.
          </div>
        ) : (
          incidents.map((inc) => {
            const sev = SEVERITY_COLORS[inc.severity] || SEVERITY_COLORS.Medium;
            const stat = STATUS_COLORS[inc.status] || STATUS_COLORS.Allocated;

            return (
              <div key={inc.id} className="tactical-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  {inc.hasImage ? (
                    <img
                      src={inc.imageUrl}
                      alt={inc.title}
                      onClick={() => setLightboxImageUrl(inc.imageUrl)}
                      className="w-20 h-20 rounded-lg object-cover border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 flex-shrink-0">
                      🚨
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-sky-400">{inc.referenceCode}</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                        {inc.severity}
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-semibold ${stat.bg} ${stat.text}`}>
                        {inc.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">{inc.title}</h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl">{inc.note}</p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] font-mono text-slate-400">
                      <span>📍 {inc.locationLabel || formatGpsCoord(inc.latitude, inc.longitude)}</span>
                      <span>👤 Reporter: {inc.reporterName}</span>
                      <span>🕒 Time: {formatIsoTimestamp(inc.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Progression Actions */}
                <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
                  {inc.status === 'Allocated' && (
                    <Button variant="warning" size="sm" onClick={() => handleStatusProgression(inc.id, 'EnRoute')}>
                      Mark En Route
                    </Button>
                  )}
                  {inc.status === 'EnRoute' && (
                    <Button variant="primary" size="sm" onClick={() => handleStatusProgression(inc.id, 'OnScene')}>
                      Arrived on Scene
                    </Button>
                  )}
                  {inc.status === 'OnScene' && (
                    <Button variant="success" size="sm" onClick={() => handleStatusProgression(inc.id, 'Resolved')}>
                      Mark Resolved
                    </Button>
                  )}
                  {inc.hasImage && (
                    <Button variant="outline" size="sm" onClick={() => setLightboxImageUrl(inc.imageUrl)}>
                      Evidence
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Incident Evidence Inspection"
      />
    </div>
  );
};
