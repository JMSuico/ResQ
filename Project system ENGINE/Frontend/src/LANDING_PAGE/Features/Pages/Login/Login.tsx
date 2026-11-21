// [Layer: LANDING_PAGE/Features/Pages/Login]
// Responsibility: Multi-role presentation login form, Scrypt credential validation, and status rejection handling.
// DO NOT determine authorization role from frontend tabs; derive strictly from authenticated account payload.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
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
  const isAdminPort = currentPort === '1996';

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
      const sessionUser = res.session;
      const detectedRole: string = String(sessionUser?.role || '');

      if (detectedRole === 'LDRRMO_Admin' || detectedRole === 'admin') {
        if (!isAdminPort && (currentPort === '1997' || currentPort === '1998')) {
          const host = window.location.hostname || '127.0.0.1';
          window.location.href = `http://${host}:1996/admin/dashboard`;
        } else {
          navigate('/admin/dashboard');
        }
      } else if (detectedRole === 'Civilian' || detectedRole === 'civilian') {
        navigate('/civilian');
      } else {
        navigate('/responder');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'linear-gradient(145deg, #4A041A 0%, #670626 55%, #3B0315 100%)' }}
    >
      <div className="clay-surface w-full max-w-md bg-[#F7F1EA] border border-[#E9D9D0] rounded-3xl shadow-[0_28px_64px_-12px_rgba(38,2,14,0.55),inset_0_2px_4px_rgba(255,255,255,0.85)] p-8 flex flex-col gap-6 text-[#670626]">
        {/* Header */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#670626] mx-auto flex items-center justify-center text-[#F7F1EA] font-black text-xl shadow-md shadow-[#4A041A]/30 mb-3">
            R
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-[#670626] tracking-tight font-['Montserrat',sans-serif]">
            ResQTrack Emergency Portal
          </h2>
        </div>

        {/* Presentation-Only Role Tabs */}
        <div className="flex rounded-2xl bg-[#E9D9D0] p-1 border border-[#D5BEB3] text-sm">
          <button
            type="button"
            onClick={() => setSelectedTab('admin')}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
              selectedTab === 'admin' ? 'bg-[#670626] text-[#F7F1EA] shadow-sm' : 'text-[#7D2B3D] hover:text-[#670626]'
            }`}
          >
            LDRRMO Admin
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('responder')}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
              selectedTab === 'responder' ? 'bg-[#670626] text-[#F7F1EA] shadow-sm' : 'text-[#7D2B3D] hover:text-[#670626]'
            }`}
          >
            Responders
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab('civilian')}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all cursor-pointer ${
              selectedTab === 'civilian' ? 'bg-[#670626] text-[#F7F1EA] shadow-sm' : 'text-[#7D2B3D] hover:text-[#670626]'
            }`}
          >
            UG Civilian
          </button>
        </div>

        {/* Status Error Alert */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-[#670626] border border-[#4A041A] text-sm text-[#F7F1EA] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#F7F1EA] shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-mono uppercase tracking-wider font-bold text-[#670626]">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. ldrrmo.admin@resqtrack.gov.ph"
              required
              className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl text-base text-[#670626] placeholder:text-[#A83B4D]/70 focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#670626]/30 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider font-bold text-[#670626]">
                Password
              </label>
              <span className="text-xs text-[#A83B4D] font-mono">Min. 12 Characters</span>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              minLength={12}
              className="px-3.5 py-2.5 bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl text-base text-[#670626] placeholder:text-[#A83B4D]/70 focus:outline-none focus:border-[#670626] focus:ring-2 focus:ring-[#670626]/30 transition-colors"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isLoading}
            className="mt-2 text-base !bg-[#670626] hover:!bg-[#4A041A] !text-[#F7F1EA] !border-[#4A041A] !rounded-xl !shadow-md"
          >
            Sign In
          </Button>
        </form>

        {/* Quick Demo Credential Fillers */}
        <div className="p-3.5 bg-[#EFE4DD] rounded-2xl border border-[#D5BEB3]">
          <p className="text-xs font-mono text-[#A83B4D] uppercase tracking-wider mb-2 font-bold">Demo:</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => applyPreset('admin')} className="px-2.5 py-1.5 bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D5BEB3] rounded-lg text-xs text-[#670626] font-mono font-semibold cursor-pointer">
              LDRRMO Admin
            </button>
            <button type="button" onClick={() => applyPreset('rhu')} className="px-2.5 py-1.5 bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D5BEB3] rounded-lg text-xs text-[#670626] font-mono font-semibold cursor-pointer">
              RHU Medic
            </button>
            <button type="button" onClick={() => applyPreset('fire')} className="px-2.5 py-1.5 bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D5BEB3] rounded-lg text-xs text-[#670626] font-mono font-semibold cursor-pointer">
              BFP Fire
            </button>
            <button type="button" onClick={() => applyPreset('pnp')} className="px-2.5 py-1.5 bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D5BEB3] rounded-lg text-xs text-[#670626] font-mono font-semibold cursor-pointer">
              PNP Patrol
            </button>
            <button type="button" onClick={() => applyPreset('civilian')} className="px-2.5 py-1.5 bg-[#E9D9D0] hover:bg-[#DFC9BE] border border-[#D5BEB3] rounded-lg text-xs text-[#670626] font-mono font-semibold cursor-pointer">
              UG Civilian
            </button>
          </div>
        </div>

        <div className="text-center text-sm text-[#7D2B3D] border-t border-[#D5BEB3] pt-4">
          No account?{' '}
          <Link to="/register" className="text-[#670626] hover:text-[#A83B4D] font-bold underline">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
};
