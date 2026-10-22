// [Layer: UserRoles/Features/Pages/AdminsPanel]
// Responsibility: Real-time emergency alerts stream with thumbnail previews and read state tracking.
// DO NOT mutate reports from the alert read controller.

import React, { useState, useEffect } from 'react';
import { getAlerts, markAlertRead } from '@/Endpoints/reportsApi';
import { Button } from '@/Shared/Button';
import { ImageLightboxModal } from '@/Shared/ImageLightboxModal';
import { formatIsoTimestamp, formatRelativeTime } from '@/Libs/Assets/formatters';
import { SEVERITY_COLORS } from '@/Libs/Assets/data';
import { useReportEventBus } from '@/Hooks/useReportEventBus';

export const AlertsCenter: React.FC = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      setIsLoading(true);
      const data = await getAlerts();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  useReportEventBus(() => {
    loadAlerts();
  });

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Emergency Alerts Command Center</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live emergency alert feed with image evidence thumbnails</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAlerts}>
          Refresh Stream
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {alerts.length === 0 ? (
          <div className="tactical-card p-8 text-center text-slate-500">
            No active emergency alerts recorded.
          </div>
        ) : (
          alerts.map((a) => {
            const sev = SEVERITY_COLORS[a.severity] || SEVERITY_COLORS.Medium;

            return (
              <div
                key={a.reportId}
                className={`tactical-card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                  !a.isRead ? 'border-sky-500/60 bg-slate-900/90' : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex items-center gap-4">
                  {a.hasImage ? (
                    <img
                      src={a.imageUrl}
                      alt={a.title}
                      onClick={() => setLightboxImageUrl(a.imageUrl)}
                      className="w-16 h-16 rounded-lg object-cover border border-slate-700 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 flex-shrink-0">
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
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">Status: {a.status} // Category: {a.category}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center">
                  {!a.isRead && (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkRead(a.reportId)}>
                      Mark as Read
                    </Button>
                  )}
                  {a.hasImage && (
                    <Button variant="outline" size="sm" onClick={() => setLightboxImageUrl(a.imageUrl)}>
                      Inspect Evidence
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
        title="Alert Image Evidence"
      />
    </div>
  );
};
