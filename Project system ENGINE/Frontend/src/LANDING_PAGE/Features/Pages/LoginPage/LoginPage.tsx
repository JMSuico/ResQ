// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: 100% pixel-faithful React 19 conversion adhering to the exact aesthetic of Screenshot 2026-10-21 064110.png.
// Role-Based Access Control (RBAC): 100% elimination of legacy unit selector tabs / buttons / labels.
// Automatically routes Civilians, Responders (RHU/FIRE/PNP), and LDRRMO Admins based on verified credentials.
// Katipuneros architecture with Universal Lambdas (=>), Shared primitives, and useFluidResposiveness.

import React, { useState, FC } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '@/Endpoints/authApi';
import { Button, Checkbox } from '@/Shared';
import { useFluidResposiveness } from '@/Hooks';

export const LoginPage: FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const isDedicatedAdminPort = currentPort === '5174';

  const { isMobile } = useFluidResposiveness();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('rhu.medic@resqtrack.gov.ph');
  const [password, setPassword] = useState<string>('RhuResponder@2026!');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [consent, setConsent] = useState<boolean>(true);
  const [emailError, setEmailError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [consentError, setConsentError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusTone, setStatusTone] = useState<'ok' | 'bad' | ''>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const applyPreset = (preset: 'admin' | 'rhu' | 'fire' | 'pnp' | 'civilian') => {
    setStatusMessage('');
    setStatusTone('');
    setEmailError('');
    setPasswordError('');
    setConsentError('');

    if (preset === 'admin') {
      setEmail('ldrrmo.admin@resqtrack.gov.ph');
      setPassword('LdrrmoCommand@2026!');
    } else if (preset === 'rhu') {
      setEmail('rhu.medic@resqtrack.gov.ph');
      setPassword('RhuResponder@2026!');
    } else if (preset === 'fire') {
      setEmail('bfp.fire@resqtrack.gov.ph');
      setPassword('BfpResponder@2026!');
    } else if (preset === 'pnp') {
      setEmail('pnp.patrol@resqtrack.gov.ph');
      setPassword('PnpResponder@2026!');
    } else {
      setEmail('resident.juan@resqtrack.gov.ph');
      setPassword('CivilianSafe@2026!');
    }
  };

  const handleTogglePassword = () => {
    setShowPassword((prev) => !prev);
  };

  const validateEmail = (val: string): string => {
    if (!val.trim()) return 'Enter a valid email address.';
    return EMAIL_RE.test(val.trim()) ? '' : 'Enter a valid email address.';
  };

  const validatePassword = (val: string): string => {
    if (!val) return 'Password is required.';
    return val.length >= 8 ? '' : 'Password must be at least 8 characters.';
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    setStatusMessage('Password reset is governed via local terminal CLI: .\\start.ps1 createsuperadmin');
    setStatusTone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = consent ? '' : 'Confirm access terms to continue.';

    setEmailError(eErr);
    setPasswordError(pErr);
    setConsentError(cErr);

    if (eErr || pErr || cErr) {
      setStatusMessage('Check highlighted fields.');
      setStatusTone('bad');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Authenticating credentials with Dynamic Role Detection (RBAC)…');
    setStatusTone('');

    try {
      const portalOrigin = isDedicatedAdminPort ? 'Admin' : 'ResponderCivilian';
      const res = await loginUser({
        email: email.trim(),
        password,
        portalOrigin
      });

      if (res?.token) {
        localStorage.setItem('resqtrack_token', res.token);
        if (res.session) localStorage.setItem('resqtrack_user', JSON.stringify(res.session));
      }

      setIsLoading(false);
      setIsSuccess(true);

      const sessionUser = res.session;
      const rawRole = (sessionUser?.role ?? '').toString().toLowerCase();
      const rawUnit = (sessionUser?.unit ?? '').toString();

      const isLdrrmo = rawRole.includes('admin') || rawRole.includes('ldrrmo') || rawRole === '0';
      const isResp = rawRole.includes('responder') || rawRole === '1';
      const isCiv = rawRole.includes('civilian') || rawRole === '2';

      const okMsg = isLdrrmo
        ? 'LDRRMO Executive Command clearance verified. Redirecting to Command Console…'
        : isResp
        ? `Verified ${rawUnit || 'Emergency'} Responder. Redirecting to Operations Hub…`
        : 'Verified Citizen Resident. Redirecting to Emergency SOS Portal…';

      setStatusMessage(okMsg);
      setStatusTone('ok');

      setTimeout(() => {
        if (isLdrrmo) {
          const host = window.location.hostname || '127.0.0.1';
          if (currentPort === '5173') {
            window.location.href = `http://${host}:5174/admin/dashboard`;
          } else {
            navigate('/admin/dashboard');
          }
        } else if (isCiv) {
          navigate('/civilian/dashboard');
        } else {
          navigate('/responder/dashboard');
        }
      }, 900);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setStatusMessage(msg);
      setStatusTone('bad');
    }
  };

  return (
    <main className="scene">
      <div className="stage">
        {/* Stylized Giant 'R' Platinum/Silver Background Elements */}
        <div className="bg" aria-hidden="true">
          <span className="bg__strip"></span>
          <span className="bg__disc"></span>
          <span className="bg__wedge"></span>
        </div>

        {/* ResQTrack Brand Header with Decorative Crimson Accent Bar */}
        <header className="brand">
          <h1 className="brand__mark">RESQTRACK</h1>
          <p className="brand__lead">Smart Emergency Response</p>
          <p className="brand__sub">System with Image Processing and Real-Time Tracking</p>
          <div className="brand__bar" aria-hidden="true" />
        </header>

        {/* Responders Team Cutout Visual */}
        <div className="responders" aria-hidden="true">
          <span className="responder responder--group">
            <img
              src="/img/responders.png"
              alt="Emergency Responders Cutout"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('/responders.png')) {
                  target.src = '/responders.png';
                }
              }}
            />
            <i>responders.png</i>
          </span>
        </div>

        {/* Dedicated RBAC Login Panel with Military HUD Styling (Zero Unit Selector Tabs) */}
        <section
          className="panel relative"
          aria-labelledby="panel-title"
          style={{
            height: 'auto',
            minHeight: 'calc(455 * var(--u))',
            paddingBottom: '20px',
            border: '1px solid rgba(255, 92, 116, 0.22)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.65), 0 0 20px rgba(232,17,76,0.15)'
          }}
        >
          {/* Military HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#ff5c74]/70 pointer-events-none rounded-tl-[3px]" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#ff5c74]/70 pointer-events-none rounded-tr-[3px]" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#ff5c74]/70 pointer-events-none rounded-bl-[3px]" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#ff5c74]/70 pointer-events-none rounded-br-[3px]" aria-hidden="true" />

          {/* Top Subtle Tactical Scanline Accent */}
          <span className="panel__rule" aria-hidden="true" />
          <h2 className="visually-hidden" id="panel-title">Responder and Civilian Sign In</h2>

          <form className="panel__body" id="login-form" onSubmit={handleSubmit} noValidate>
            {/* Live Telemetry HUD Status Row */}
            <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-rose-300/80 border-b border-rose-500/20 pb-2 mb-3">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                AUTH ENGINE // SYS.ONLINE
              </span>
              <span className="text-slate-400 tracking-widest hidden sm:inline">GATEWAY :5173 // 256-BIT</span>
            </div>

            {/* Dynamic RBAC Notice Banner */}
            <div
              className="notice"
              id="notice"
              role="region"
              aria-label="Role-Based Access Control Notice"
              style={{
                marginTop: '0',
                marginBottom: '14px',
                background: 'linear-gradient(135deg, rgba(52, 3, 19, 0.95), rgba(20, 2, 10, 0.95))',
                border: '1px solid rgba(255, 92, 116, 0.25)',
                borderRadius: '8px'
              }}
            >
              <div className="notice__head">
                <span className="notice__dot" aria-hidden="true" style={{ background: '#ff5c74', boxShadow: '0 0 8px #ff5c74' }} />
                <p className="notice__title" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, letterSpacing: '0.04em' }}>
                  DYNAMIC ROLE DETECTION (RBAC) ACTIVE (:5173)
                </p>
                <span className="notice__badge" style={{ background: '#340313', color: '#ff5c74', border: '1px solid rgba(255,92,116,0.4)', borderRadius: '4px' }}>
                  MULTI-AGENCY RBAC
                </span>
              </div>
              <p className="notice__text" style={{ color: '#d1d5db', fontSize: '11.5px', lineHeight: 1.5 }}>
                Emergency Responders (RHU, FIRE, PNP) and Civilians share this login. The backend automatically determines your operational dashboard from your account role.
              </p>
            </div>

            {/* Email Address Field */}
            <div className={`field ${emailError ? 'is-invalid' : ''}`} style={{ marginTop: '8px' }}>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[10.5px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="email">
                  Email Address
                </label>
                <span className="font-mono text-[9px] text-rose-400/90 tracking-widest">[AUTH.IDENTIFIER]</span>
              </div>
              <div
                className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all"
                style={{
                  background: 'rgba(46, 10, 22, 0.85)',
                  border: '1px solid rgba(255, 92, 116, 0.22)',
                  borderRadius: '6px'
                }}
              >
                <svg className="field__icon" aria-hidden="true" style={{ stroke: '#ff5c74' }}>
                  <use href="#i-user" />
                </svg>
                <input
                  className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="rhu.medic@resqtrack.gov.ph"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(validateEmail(e.target.value));
                  }}
                  onBlur={() => {
                    if (email) setEmailError(validateEmail(email));
                  }}
                  autoComplete="email"
                  spellCheck={false}
                  aria-describedby="email-error"
                  aria-invalid={!!emailError}
                />
              </div>
              {emailError && (
                <p className="field__error font-mono text-[10.5px]" id="email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className={`field field--password ${passwordError ? 'is-invalid' : ''}`} style={{ marginTop: '10px' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="font-mono text-[10.5px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="password">
                    Clearance Key
                  </label>
                  <span className="font-mono text-[9px] text-rose-400/90 tracking-widest">[ARGON2.KEY]</span>
                </div>
                <a
                  className="link link--quiet font-mono text-[10px] text-rose-400 hover:text-rose-300 font-semibold transition-colors"
                  href="#"
                  onClick={handleForgotPassword}
                >
                  Forgot key?
                </a>
              </div>
              <div
                className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all"
                style={{
                  background: 'rgba(46, 10, 22, 0.85)',
                  border: '1px solid rgba(255, 92, 116, 0.22)',
                  borderRadius: '6px'
                }}
              >
                <svg className="field__icon" aria-hidden="true" style={{ stroke: '#ff5c74' }}>
                  <use href="#i-lock" />
                </svg>
                <input
                  className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError(validatePassword(e.target.value));
                  }}
                  onBlur={() => {
                    if (password) setPasswordError(validatePassword(password));
                  }}
                  autoComplete="current-password"
                  aria-describedby="password-error"
                  aria-invalid={!!passwordError}
                />
                <button
                  className="field__toggle hover:text-rose-300"
                  type="button"
                  id="pw-toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="password"
                  onClick={handleTogglePassword}
                >
                  {!showPassword ? (
                    <svg className="field__toggle-on" aria-hidden="true">
                      <use href="#i-eye" />
                    </svg>
                  ) : (
                    <svg className="field__toggle-off" aria-hidden="true">
                      <use href="#i-eye-off" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="field__error font-mono text-[10.5px]" id="password-error" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Terms Row & Registration Link */}
            <div
              className="flex items-center justify-between mt-3 mb-2"
              style={{ minHeight: '24px' }}
            >
              <Checkbox
                id="consent"
                checked={consent}
                onChange={(val) => {
                  setConsent(val);
                  if (val) setConsentError('');
                }}
                label={
                  <span className="text-[11px] text-slate-300 font-medium select-none">
                    Confirm operational access terms
                  </span>
                }
              />
              <Link
                className="text-[#ff5c74] hover:text-[#ff8ea1] hover:underline text-[11px] font-semibold whitespace-nowrap transition-colors"
                id="register-link"
                to="/register"
              >
                Register emergency account &rarr;
              </Link>
            </div>
            {consentError && (
              <p className="font-mono text-[11px] text-[#ff5c74] font-medium -mt-1 mb-2" id="consent-error" role="alert">
                {consentError}
              </p>
            )}

            {/* Quick Test Credentials - Authentic Tactical Authorization Tokens */}
            <div className="mt-2 mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Tactical Authorization Tokens (RBAC Presets)
                </span>
                <span className="font-mono text-[8.5px] text-slate-400 tracking-widest hidden sm:inline">QUICK CLEARANCE</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {/* LDRRMO Admin Token */}
                <button
                  type="button"
                  onClick={() => applyPreset('admin')}
                  className={`text-left p-1.5 rounded border transition-all duration-150 flex items-center justify-between group ${
                    email === 'ldrrmo.admin@resqtrack.gov.ph'
                      ? 'border-rose-400 bg-rose-950/80 shadow-[0_0_8px_rgba(232,17,76,0.35)]'
                      : 'border-rose-500/30 bg-[#2b0816]/70 hover:border-rose-400 hover:bg-[#340313]'
                  }`}
                  title="Switch to LDRRMO Admin clearance"
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] font-bold text-rose-300 truncate">LDRRMO Command</div>
                    <div className="font-mono text-[8px] text-rose-400/80">L4 ADMIN</div>
                  </div>
                  <span className="font-mono text-[8px] px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold shrink-0">
                    C2
                  </span>
                </button>

                {/* RHU Medic Token */}
                <button
                  type="button"
                  onClick={() => applyPreset('rhu')}
                  className={`text-left p-1.5 rounded border transition-all duration-150 flex items-center justify-between group ${
                    email === 'rhu.medic@resqtrack.gov.ph'
                      ? 'border-sky-400 bg-sky-950/80 shadow-[0_0_8px_rgba(14,165,233,0.35)]'
                      : 'border-sky-500/30 bg-[#071927]/70 hover:border-sky-400 hover:bg-[#0c243a]'
                  }`}
                  title="Switch to Rural Health Unit responder"
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] font-bold text-sky-300 truncate">RHU Medical</div>
                    <div className="font-mono text-[8px] text-sky-400/80">EMS AMBULANCE</div>
                  </div>
                  <span className="font-mono text-[8px] px-1 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold shrink-0">
                    MED
                  </span>
                </button>

                {/* FIRE BFP Token */}
                <button
                  type="button"
                  onClick={() => applyPreset('fire')}
                  className={`text-left p-1.5 rounded border transition-all duration-150 flex items-center justify-between group ${
                    email === 'bfp.fire@resqtrack.gov.ph'
                      ? 'border-orange-400 bg-orange-950/80 shadow-[0_0_8px_rgba(249,115,22,0.35)]'
                      : 'border-orange-500/30 bg-[#250d06]/70 hover:border-orange-400 hover:bg-[#34130a]'
                  }`}
                  title="Switch to Bureau of Fire Protection responder"
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] font-bold text-orange-300 truncate">FIRE BFP</div>
                    <div className="font-mono text-[8px] text-orange-400/80">STATION CHIEF</div>
                  </div>
                  <span className="font-mono text-[8px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold shrink-0">
                    BFP
                  </span>
                </button>

                {/* PNP Police Token */}
                <button
                  type="button"
                  onClick={() => applyPreset('pnp')}
                  className={`text-left p-1.5 rounded border transition-all duration-150 flex items-center justify-between group ${
                    email === 'pnp.patrol@resqtrack.gov.ph'
                      ? 'border-indigo-400 bg-indigo-950/80 shadow-[0_0_8px_rgba(99,102,241,0.35)]'
                      : 'border-indigo-500/30 bg-[#0c142b]/70 hover:border-indigo-400 hover:bg-[#152145]'
                  }`}
                  title="Switch to Philippine National Police responder"
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] font-bold text-indigo-300 truncate">PNP Police</div>
                    <div className="font-mono text-[8px] text-indigo-400/80">PATROL DISPATCH</div>
                  </div>
                  <span className="font-mono text-[8px] px-1 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold shrink-0">
                    PNP
                  </span>
                </button>

                {/* Civilian SOS Token */}
                <button
                  type="button"
                  onClick={() => applyPreset('civilian')}
                  className={`text-left p-1.5 rounded border transition-all duration-150 flex items-center justify-between group col-span-2 sm:col-span-1 ${
                    email === 'resident.juan@resqtrack.gov.ph'
                      ? 'border-emerald-400 bg-emerald-950/80 shadow-[0_0_8px_rgba(16,185,129,0.35)]'
                      : 'border-emerald-500/30 bg-[#062015]/70 hover:border-emerald-400 hover:bg-[#0c3322]'
                  }`}
                  title="Switch to Citizen Resident SOS user"
                >
                  <div className="min-w-0 pr-1">
                    <div className="text-[10px] font-bold text-emerald-300 truncate">Civilian SOS</div>
                    <div className="font-mono text-[8px] text-emerald-400/80">COMMUNITY RESIDENT</div>
                  </div>
                  <span className="font-mono text-[8px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                    CIV
                  </span>
                </button>
              </div>
            </div>

            {/* Dynamic Status / Error Message */}
            {statusMessage && (
              <div
                role="status"
                aria-live="polite"
                className="font-mono text-[11px] font-semibold text-center my-2 p-2 rounded border"
                style={{
                  background: statusTone === 'ok' ? 'rgba(6, 32, 21, 0.85)' : statusTone === 'bad' ? 'rgba(52, 3, 19, 0.85)' : 'rgba(30, 41, 59, 0.85)',
                  borderColor: statusTone === 'ok' ? 'rgba(52, 211, 153, 0.4)' : statusTone === 'bad' ? 'rgba(255, 92, 116, 0.5)' : 'rgba(148, 163, 184, 0.3)',
                  color: statusTone === 'ok' ? '#34d399' : statusTone === 'bad' ? '#ff5c74' : '#e2e8f0',
                  letterSpacing: '0.02em',
                  wordBreak: 'break-word'
                }}
              >
                {statusMessage}
              </div>
            )}

            {/* Submit Action Button using Atomic Shared Primitive */}
            <div style={{ marginTop: statusMessage ? '0' : '4px' }}>
              <Button
                type="submit"
                id="submit"
                fullWidth
                isLoading={isLoading}
                iconPosition="right"
                icon={
                  isSuccess ? (
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )
                }
                className="!h-[46px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-black !tracking-widest !uppercase !shadow-lg !shadow-[#e8114c]/40 active:!scale-[0.99] transition-all rounded-lg group cursor-pointer border border-[#ff5c74]/50"
              >
                {isLoading ? 'Authenticating...' : isSuccess ? 'Access Granted' : 'AUTHENTICATE & ENTER'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
