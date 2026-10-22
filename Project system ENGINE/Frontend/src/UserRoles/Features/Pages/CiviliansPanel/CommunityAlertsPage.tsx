// [Layer: UserRoles/Features/Pages/CiviliansPanel]
// Responsibility: Public community safety alerts and official advisories stream for residents.
// DO NOT hide severe weather or evacuation advisories from residents.

import React, { useState, useEffect } from 'react';
import { getPublicAlerts } from '@/Endpoints/civilianPortalApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';

export const CommunityAlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  useEffect(() => {
    getPublicAlerts().then(setAlerts).catch(console.error);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Community Emergency Advisories</h2>
        <p className="text-xs text-slate-400 mt-0.5">Verified public safety notices from LDRRMO Municipal Command</p>
      </div>

      <div className="flex flex-col gap-3">
        {alerts.map((a) => {
          const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.Medium;

          return (
            <div key={a.reportId} className="tactical-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {a.hasImage ? (
                  <img
                    src={a.imageUrl}
                    alt={a.title}
                    onClick={() => setLightboxImageUrl(a.imageUrl)}
                    className="w-14 h-14 rounded-lg object-cover border border-slate-700 cursor-pointer flex-shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 flex-shrink-0">
                    📢
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-sky-400">{a.referenceCode}</span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-bold border ${sev.bg} ${sev.text} ${sev.border}`}>
                      {a.severity}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">{formatRelativeTime(a.timestamp)}</span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100">{a.title}</h3>
                </div>
              </div>

              {a.hasImage && (
                <Button variant="outline" size="sm" onClick={() => setLightboxImageUrl(a.imageUrl)}>
                  View Photo
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Community Advisory Photo Evidence"
      />
    </div>
  );
};
