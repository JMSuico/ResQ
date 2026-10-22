// [Layer: Root Entry]
// Responsibility: React 19 application root entry point mounting into #root DOM node.
// DO NOT remove LayoutStyles/index.css import.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@/LayoutStyles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
