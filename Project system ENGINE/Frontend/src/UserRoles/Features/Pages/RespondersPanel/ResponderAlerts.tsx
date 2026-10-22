// [Layer: UserRoles/Features/Pages/RespondersPanel]
// Responsibility: Agency-filtered emergency alerts feed for field responders.
// DO NOT hide critical severity alerts from tactical units.

import React, { useState, useEffect } from 'react';
import { getAlerts, markAlertRead } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';

export const ResponderAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      const data = await getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const handleMarkRead = async (reportId: string) => {
    try {
      await markAlertRead(reportId);
      setAlerts((prev) =>
        prev.map((a) => (a.reportId === reportId ? { ...a, isRead: true } : a))
      );
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-white">Responder Tactical Alerts</h2>
        <p className="text-xs text-slate-400 mt-0.5">Real-time incident dispatches and hazard warnings</p>
      </div>

      <div className="flex flex-col gap-3">
        {alerts.map((a) => {
          const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.Medium;

          return (
            <div
              key={a.reportId}
              className={`tactical-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                !a.isRead ? 'border-sky-500/70 bg-slate-900/90' : 'bg-slate-950/60 border-slate-800'
              }`}
            >
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
                    🚨
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

              <div className="flex items-center gap-2 self-end md:self-center">
                {!a.isRead && (
                  <Button variant="ghost" size="sm" onClick={() => handleMarkRead(a.reportId)}>
                    Mark Read
                  </Button>
                )}
                {a.hasImage && (
                  <Button variant="outline" size="sm" onClick={() => setLightboxImageUrl(a.imageUrl)}>
                    Photo
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ImageLightboxModal
        isOpen={lightboxImageUrl !== null}
        onClose={() => setLightboxImageUrl(null)}
        imageUrl={lightboxImageUrl}
        title="Alert Image Evidence"
      />
    </div>
  );
};
