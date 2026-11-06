// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: 100% pixel-faithful React 19 conversion adhering to the exact aesthetic of Screenshot 2026-10-21 064110.png.
// Role-Based Access Control (RBAC): Clean, authentic login form with automatic operational routing based on account credentials.
// Katipuneros architecture with Universal Lambdas (=>), Shared primitives, and useFluidResposiveness.

import React, { useState, FC } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Check, ArrowRight } from 'lucide-react';
import { loginUser } from '@/Endpoints/authApi';
import { Button, Checkbox } from '@/Shared';
import { useFluidResposiveness } from '@/Hooks';

export const LoginPage: FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const isDedicatedAdminPort = currentPort === '5174';

  const { isMobile } = useFluidResposiveness();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
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
    setStatusMessage('Authenticating credentials…');
    setStatusTone('');

    try {
      const portalOrigin = isDedicatedAdminPort ? 'Admin' : 'ResponderCivilian';
      const res = await loginUser({
        email: email.trim(),
        password,
        portalOrigin
      });

      if (res?.token) {
        const portKey = currentPort || '5173';
        const normUnit = (res.session?.unit || 'none').toLowerCase().trim();
        const normRole = (res.session?.role || '').toLowerCase().trim();
        const isAdminUser = normRole.includes('admin') || normRole.includes('ldrrmo');

        // 1. Tab-isolated session storage (Guarantees Tab 1 Medic never turns into Tab 2 Fire)
        sessionStorage.setItem('resqtrack_token', res.token);
        sessionStorage.setItem('resqtrack_unit', normUnit);
        if (res.session) {
          sessionStorage.setItem('resqtrack_user', JSON.stringify(res.session));
          sessionStorage.setItem('resqtrack_session', JSON.stringify(res.session));
        }

        // 2. Unit-scoped local storage (Guarantees RHU, FIRE, and PNP co-exist without collision)
        if (normUnit && normUnit !== 'none') {
          localStorage.setItem(`resqtrack_token_${normUnit}`, res.token);
          if (res.session) {
            localStorage.setItem(`resqtrack_user_${normUnit}`, JSON.stringify(res.session));
            localStorage.setItem(`resqtrack_session_${normUnit}`, JSON.stringify(res.session));
          }
        }

        // 3. Port-scoped storage
        if (isAdminUser || portKey === '5174') {
          localStorage.setItem('resqtrack_token_5174', res.token);
          if (res.session) {
            localStorage.setItem('resqtrack_user_5174', JSON.stringify(res.session));
            localStorage.setItem('resqtrack_session_5174', JSON.stringify(res.session));
          }
        } else {
          localStorage.setItem(`resqtrack_token_${portKey}`, res.token);
          if (res.session) {
            localStorage.setItem(`resqtrack_user_${portKey}`, JSON.stringify(res.session));
            localStorage.setItem(`resqtrack_session_${portKey}`, JSON.stringify(res.session));
          }
        }
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
            window.location.href = `http://${host}:5174/admin/dashboard?session_token=${encodeURIComponent(res.token)}`;
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

        {/* Dedicated Login Panel with Military HUD Styling */}
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
          <h2 className="visually-hidden" id="panel-title">Sign In</h2>

          <form className="panel__body" id="login-form" onSubmit={handleSubmit} noValidate>
            {/* Live Telemetry HUD Status Row */}
            <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-rose-300/80 border-b border-rose-500/20 pb-2 mb-3">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                AUTH ENGINE // SYS.ONLINE
              </span>
              <span className="text-slate-400 tracking-widest hidden sm:inline">GATEWAY // 256-BIT</span>
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
                className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                style={{
                  background: 'rgba(46, 10, 22, 0.85)',
                  border: '1px solid rgba(255, 92, 116, 0.22)',
                  borderRadius: '6px'
                }}
              >
                <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                <input
                  className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                  id="email"
                  name="email"
                  type="email"
                  placeholder="officer@resqtrack.gov.ph"
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
                className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                style={{
                  background: 'rgba(46, 10, 22, 0.85)',
                  border: '1px solid rgba(255, 92, 116, 0.22)',
                  borderRadius: '6px'
                }}
              >
                <Lock className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
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
                  className="field__toggle hover:text-rose-300 ml-auto p-1"
                  type="button"
                  id="pw-toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="password"
                  onClick={handleTogglePassword}
                >
                  {!showPassword ? (
                    <Eye className="w-4 h-4 text-slate-400" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="field__error font-mono text-[10.5px]" id="password-error" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Terms Row */}
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
            </div>
            {consentError && (
              <p className="font-mono text-[11px] text-[#ff5c74] font-medium -mt-1 mb-2" id="consent-error" role="alert">
                {consentError}
              </p>
            )}

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
            <div style={{ marginTop: statusMessage ? '0' : '10px' }}>
              <Button
                type="submit"
                id="submit"
                fullWidth
                isLoading={isLoading}
                iconPosition="right"
                icon={
                  isSuccess ? (
                    <Check className="w-4 h-4 ml-1" />
                  ) : (
                    <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                  )
                }
                className="!h-[46px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-black !tracking-widest !uppercase !shadow-lg !shadow-[#e8114c]/40 active:!scale-[0.99] transition-all rounded-lg group cursor-pointer border border-[#ff5c74]/50"
              >
                {isLoading ? 'Authenticating...' : isSuccess ? 'Access Granted' : 'AUTHENTICATE & ENTER'}
              </Button>
            </div>

            {/* Civilian & Responder Registration Redirection */}
            <div className="mt-4 text-center">
              <span className="text-xs text-slate-400 font-mono">Don't have an account? </span>
              <Link
                to="/register"
                id="register-link"
                className="text-xs font-mono font-bold text-rose-400 hover:text-rose-300 underline underline-offset-4 transition-colors"
              >
                Sign up here
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
