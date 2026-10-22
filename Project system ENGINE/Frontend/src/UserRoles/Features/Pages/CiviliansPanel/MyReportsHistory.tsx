// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Displays real-time status progression of the citizen's filed reports with photo lightbox.
// DO NOT expose private notes from other civilian reporters.

import React, { useState, useEffect } from 'react';
import { getMyReports } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatGpsCoord } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS, STATUS_COLORS } from '@/Libs/Assets/data';
import { useReportEventBus } from '@/Hooks/useReportEventBus';

export const MyReportsHistory: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const loadReports = async () => {
    try {
      const data = await getMyReports();
      setReports(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  useReportEventBus(() => {
    loadReports();
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">My Emergency Reports History</h2>
        <p className="text-xs text-slate-400 mt-0.5">Track real-time verification and agency response status</p>
      </div>

      <div className="flex flex-col gap-4">
        {reports.length === 0 ? (
          <div className="tactical-card p-8 text-center text-slate-500">
            You haven't filed any accident reports yet. If you witness an incident, use the Report Accident button.
          </div>
        ) : (
          reports.map((r) => {
            const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Medium;
            const stat = STATUS_COLORS[r.status] || STATUS_COLORS.Reported;

            return (
              <div key={r.id} className="tactical-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  {r.hasImage ? (
                    <img
                      src={r.imageUrl}
                      alt={r.title}
                      onClick={() => setLightboxImageUrl(r.imageUrl)}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-700 cursor-pointer flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 flex-shrink-0">
                      🚨
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-sky-400">{r.referenceCode}</span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                        {r.severity}
                      </span>
                      <span className={`px-2 py-0.2 rounded text-[10px] font-mono font-semibold ${stat.bg} ${stat.text}`}>
                        {r.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">{r.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{r.note}</p>

                    <div className="flex flex-wrap items-center gap-4 mt-2 text-[11px] font-mono text-slate-400">
                      <span>📍 {r.locationLabel || formatGpsCoord(r.latitude, r.longitude)}</span>
                      <span>🕒 {formatIsoTimestamp(r.createdAt)}</span>
                      {r.allocatedUnitCode && (
                        <span className="text-sky-300">🚒 Dispatched Unit: {r.allocatedUnitCode}</span>
                      )}
                    </div>
                  </div>
                </div>

                {r.hasImage && (
                  <Button variant="outline" size="sm" onClick={() => setLightboxImageUrl(r.imageUrl)}>
                    View Evidence Photo
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Submitted Emergency Evidence Photo"
      />
    </div>
  );
};
