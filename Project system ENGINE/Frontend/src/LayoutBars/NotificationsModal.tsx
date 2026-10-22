import React, { useState, useEffect } from 'react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose }) => {
  const [reports, setReports] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('resqtrack.alerts.read');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (isOpen) {
      fetch('/api/reports')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.reports) {
            setReports(data.reports);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const markAllRead = () => {
    const allIds = reports.map((r) => r.id);
    const combined = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(combined);
    try {
      window.localStorage.setItem('resqtrack.alerts.read', JSON.stringify(combined));
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <section className="alerts__panel" id="alerts-panel" aria-label="Notifications">
      <header className="alerts__head">
        <h2 className="alerts__title">Alerts</h2>
        <button type="button" onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem' }}>
          Mark all read
        </button>
        <button type="button" onClick={onClose} aria-label="Close alerts" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', marginLeft: 'auto' }}>
          &times;
        </button>
      </header>
      <ul className="alerts__list" id="alerts-list">
        {reports.length === 0 ? (
          <li style={{ padding: '1rem', textAlign: 'center', color: 'var(--muted)' }}>No recent reports or alerts</li>
        ) : (
          reports.map((report) => {
            const isRead = readIds.includes(report.id);
            return (
              <li key={report.id} className={`alert alert--report ${!isRead ? 'is-unread' : ''}`} tabIndex={0} role="button">
                <img className="alert__thumb" src={report.imageUrl} alt="report preview" />
                <div className="alert__body">
                  <p className="alert__title">{report.type}</p>
                  <p className="alert__meta">REPORT &middot; {report.id} &middot; {report.reporterName}</p>
                </div>
                {!isRead && <span className="alert__dot" aria-hidden="true" />}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
};
