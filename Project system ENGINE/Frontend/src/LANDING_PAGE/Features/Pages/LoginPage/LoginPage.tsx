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

        {/* Dedicated RBAC Login Panel (Zero Unit Selector Tabs) */}
        <section className="panel" aria-labelledby="panel-title">
          <span className="panel__rule" aria-hidden="true"></span>
          <h2 className="visually-hidden" id="panel-title">Responder and Civilian Sign In</h2>

          <form className="panel__body" id="login-form" onSubmit={handleSubmit} noValidate>
            {/* Dynamic RBAC Notice Banner */}
            <div
              className="notice"
              id="notice"
              role="region"
              aria-label="Role-Based Access Control Notice"
              style={{ marginTop: '0', marginBottom: '14px' }}
            >
              <div className="notice__head">
                <span className="notice__dot" aria-hidden="true"></span>
                <p className="notice__title">
                  DYNAMIC ROLE DETECTION (RBAC) ACTIVE (:5173)
                </p>
                <span className="notice__badge">
                  MULTI-AGENCY RBAC
                </span>
              </div>
              <p className="notice__text">
                Emergency Responders (RHU, FIRE, PNP) and Civilians share this login. The backend automatically determines your operational dashboard from your account role.
              </p>
            </div>

            {/* Email Address Field */}
            <div className={`field ${emailError ? 'is-invalid' : ''}`} style={{ marginTop: '12px' }}>
              <label className="field__label" htmlFor="email">Email address</label>
              <div className="field__box">
                <svg className="field__icon" aria-hidden="true">
                  <use href="#i-user" />
                </svg>
                <input
                  className="field__input"
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
                <p className="field__error" id="email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className={`field field--password ${passwordError ? 'is-invalid' : ''}`} style={{ marginTop: '12px' }}>
              <div className="field__row">
                <label className="field__label" htmlFor="password">Password</label>
                <a
                  className="link link--quiet"
                  href="#"
                  onClick={handleForgotPassword}
                  style={{ fontSize: '11px', color: '#ff5c74', fontWeight: 600 }}
                >
                  Forgot password?
                </a>
              </div>
              <div className="field__box">
                <svg className="field__icon" aria-hidden="true">
                  <use href="#i-lock" />
                </svg>
                <input
                  className="field__input"
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
                  className="field__toggle"
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
                <p className="field__error" id="password-error" role="alert">
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
                    Confirm access terms
                  </span>
                }
              />
              <Link
                className="text-[#ff5c74] hover:text-[#ff8ea1] hover:underline text-[11px] font-semibold whitespace-nowrap transition-colors"
                id="register-link"
                to="/register"
              >
                Don't have an account? Register
              </Link>
            </div>
            {consentError && (
              <p className="text-[11px] text-[#ff5c74] font-medium -mt-1 mb-2" id="consent-error" role="alert">
                {consentError}
              </p>
            )}

            {/* Quick Test Credentials (RBAC Presets) */}
            <div style={{ marginTop: '6px', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#8fa2b6', width: '100%', display: 'block', marginBottom: '5px', fontWeight: 600, letterSpacing: '0.04em' }}>
                Quick Test Credentials (RBAC Presets):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => applyPreset('admin')}
                  style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '4px', border: '1px solid rgba(232,17,76,0.5)', background: '#340313', color: '#ff5c74', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s ease' }}
                  title="Switch to LDRRMO Admin clearance"
                >
                  LDRRMO Admin
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('rhu')}
                  style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '4px', border: '1px solid rgba(14,165,233,0.5)', background: '#071522', color: '#38bdf8', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s ease' }}
                  title="Switch to Rural Health Unit responder"
                >
                  RHU Medic
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('fire')}
                  style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '4px', border: '1px solid rgba(249,115,22,0.5)', background: '#260510', color: '#fb923c', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s ease' }}
                  title="Switch to Bureau of Fire Protection responder"
                >
                  FIRE BFP
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('pnp')}
                  style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '4px', border: '1px solid rgba(99,102,241,0.5)', background: '#0a1a2b', color: '#818cf8', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s ease' }}
                  title="Switch to Philippine National Police responder"
                >
                  PNP Police
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('civilian')}
                  style={{ fontSize: '10px', padding: '4px 9px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.5)', background: '#062015', color: '#34d399', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s ease' }}
                  title="Switch to Citizen Resident SOS user"
                >
                  Civilian SOS
                </button>
              </div>
            </div>

            {/* Dynamic Status / Error Message */}
            {statusMessage && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  textAlign: 'center',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  marginTop: '4px',
                  marginBottom: '10px',
                  color: statusTone === 'ok' ? '#34d399' : statusTone === 'bad' ? '#ff5c74' : '#c9c3ca',
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
                className="!h-[44px] !bg-gradient-to-r !from-[#a5002e] !to-[#f20540] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase !shadow-lg !shadow-[#e8114c]/30 active:!scale-[0.99] transition-all rounded-lg group cursor-pointer"
              >
                {isLoading ? 'Signing in' : isSuccess ? 'Access granted' : 'LOGIN'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
