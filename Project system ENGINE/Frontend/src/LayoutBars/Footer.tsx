import React from 'react';

export const Footer: React.FC = () => (
  <footer className="footer" style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted)' }}>
    <p>&copy; {new Date().getFullYear()} ResQtrack &mdash; Katipunan Emergency Response System</p>
  </footer>
);
