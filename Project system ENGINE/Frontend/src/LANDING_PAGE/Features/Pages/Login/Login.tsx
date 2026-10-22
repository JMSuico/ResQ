// [Layer: LANDING_PAGE/Features/Pages/Login]
// Responsibility: Multi-role presentation login form, Scrypt credential validation, and status rejection handling.
// DO NOT determine authorization role from frontend tabs; derive strictly from authenticated account payload.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '@/Endpoints/authApi';
import { Button } from '@/Shared/Button';

export const Login: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'admin' | 'responder' | 'civilian'>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();

  // Quick preset helper for development convenience
  const applyPreset = (presetRole: 'admin' | 'rhu' | 'fire' | 'pnp' | 'civilian') => {
    setErrorMessage(null);
    if (presetRole === 'admin') {
      setEmail('ldrrmo.admin@resqtrack.gov.ph');
      setPassword('LdrrmoCommand@2026!');
      setSelectedTab('admin');
    } else if (presetRole === 'rhu') {
      setEmail('rhu.medic@resqtrack.gov.ph');
      setPassword('RhuResponder@2026!');
      setSelectedTab('responder');
    } else if (presetRole === 'fire') {
      setEmail('bfp.fire@resqtrack.gov.ph');
      setPassword('BfpResponder@2026!');
      setSelectedTab('responder');
    } else if (presetRole === 'pnp') {
      setEmail('pnp.patrol@resqtrack.gov.ph');
      setPassword('PnpResponder@2026!');
      setSelectedTab('responder');
    } else {
      setEmail('resident.juan@resqtrack.gov.ph');
      setPassword('CivilianSafe@2026!');
      setSelectedTab('civilian');
    }
  };

  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const isAdminPort = currentPort === '5174';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const portalOrigin = isAdminPort ? 'Admin' : 'ResponderCivilian';
      const res = await loginUser({
        email,
        password,
        portalOrigin,
        selectedTabRole: selectedTab
      });

      // Role is determined strictly by the server response
      const sessionUser = (res as any)?.session;
      const detectedRole = sessionUser?.role || (res as any)?.role;

      if (detectedRole === 'LDRRMO_Admin' || detectedRole === 'admin') {
        if (!isAdminPort && window.location.hostname === '127.0.0.1') {
          window.location.href = 'http://127.0.0.1:5174/dashboard';
        } else {
          navigate('/admin/dashboard');
        }
      } else if (detectedRole === 'Civilian' || detectedRole === 'civilian') {
        navigate('/civilian');
      } else {
        navigate('/responder');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-6 bg-command-dark">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-600 mx-auto flex items-center justify-center text-white font-black text-xl shadow-lg shadow-rose-950/60 mb-3">
            R
          </div>
          <h2 className="text-xl font-bold text-white">ResQTrack Emergency Portal</h2>
          <p className="text-xs text-slate-400 mt-1">Multi-Role Deterministic Triage Gateway</p>
        </div>

        {/* Presentation-Only Role Tabs */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setSelectedTab('admin')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-all ${
              selectedTab === 'admin' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LDRRMO Admin
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('responder')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-all ${
              selectedTab === 'responder' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Responders
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('civilian')}
            className={`flex-1 py-1.5 rounded-md font-semibold transition-all ${
              selectedTab === 'civilian' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            UG Civilian
          </button>
        </div>

        {/* Status Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-600/50 text-xs text-rose-300 flex items-start gap-2.5">
            <svg className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ldrrmo.admin@resqtrack.gov.ph"
              required
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">Password</label>
              <span className="text-[11px] text-slate-500">Min. 12 Characters</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={12}
              className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" isLoading={isLoading} className="mt-2">
            Authenticate & Proceed
          </Button>
        </form>

        {/* Quick Demo Credential Fillers */}
        <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2 font-bold">Quick Demo Accounts:</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => applyPreset('admin')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-rose-300 font-mono">
              LDRRMO Admin
            </button>
            <button type="button" onClick={() => applyPreset('rhu')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-sky-300 font-mono">
              RHU Medic
            </button>
            <button type="button" onClick={() => applyPreset('fire')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-orange-300 font-mono">
              BFP Fire
            </button>
            <button type="button" onClick={() => applyPreset('pnp')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-blue-300 font-mono">
              PNP Patrol
            </button>
            <button type="button" onClick={() => applyPreset('civilian')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] text-emerald-300 font-mono">
              UG Civilian
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 border-t border-slate-800 pt-4">
          Don't have an emergency account?{' '}
          <Link to="/register" className="text-sky-400 hover:text-sky-300 font-semibold underline">
            Register with Biometrics
          </Link>
        </div>
      </div>
    </div>
  );
};
