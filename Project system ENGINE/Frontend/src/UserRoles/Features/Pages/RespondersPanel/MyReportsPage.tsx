// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Displays reports filed by the active responder with lightbox evidence preview.
// DO NOT mix personal filed reports with municipal-wide triage queues.

import React, { useState, useEffect } from 'react';
import { getMyReports } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatGpsCoord } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS, STATUS_COLORS } from '@/Libs/Assets/data';

export const MyReportsPage: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  useEffect(() => {
    getMyReports().then(setReports).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">My Submitted Situation Reports</h2>
        <p className="text-xs text-slate-400 mt-0.5">Emergency incidents logged from this unit terminal</p>
      </div>

      <div className="flex flex-col gap-4">
        {reports.length === 0 ? (
          <div className="tactical-card p-8 text-center text-slate-500">
            You have not submitted any situation reports yet. Tap the red camera button to log an incident.
          </div>
        ) : (
          reports.map((r) => {
            const sev = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.Medium;
            const stat = STATUS_COLORS[r.status] || STATUS_COLORS.Reported;

            return (
              <div key={r.id} className="tactical-card p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
                      📋
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
                    <h3 className="text-sm font-bold text-slate-100">{r.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{r.note}</p>
                    <p className="text-[10px] font-mono text-slate-500 mt-2">
                      {formatGpsCoord(r.latitude, r.longitude)} // Filed: {formatIsoTimestamp(r.createdAt)}
                    </p>
                  </div>
                </div>

                {r.hasImage && (
                  <Button variant="outline" size="sm" onClick={() => setLightboxImageUrl(r.imageUrl)}>
                    View Photo
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
        title="Situation Report Photo"
      />
    </div>
  );
};
