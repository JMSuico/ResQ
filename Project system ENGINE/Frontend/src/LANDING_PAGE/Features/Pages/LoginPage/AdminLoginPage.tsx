// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: Dedicated LDRRMO Executive Command & Control Login Portal for Port 5174.
// Strict UserRole.LDRRMO_Admin enforcement; non-admins receive HTTP 403 Forbidden.
// Mission-critical tactical HUD aesthetic with zero unit selector tabs/buttons.
// Katipuneros architecture with Universal Lambdas (=>), Shared primitives, and useFluidResposiveness.

import React, { useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '@/Endpoints/authApi';
import { Button, Checkbox } from '@/Shared';
import { useFluidResposiveness } from '@/Hooks';

export const AdminLoginPage: FC = () => {
  const { isMobile } = useFluidResposiveness();
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('ldrrmo.admin@resqtrack.gov.ph');
  const [password, setPassword] = useState<string>('LdrrmoCommand@2026!');
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

  const fillAdminCredentials = () => {
    setEmail('ldrrmo.admin@resqtrack.gov.ph');
    setPassword('LdrrmoCommand@2026!');
    setStatusMessage('');
    setStatusTone('');
    setEmailError('');
    setPasswordError('');
    setConsentError('');
  };

  const validateEmail = (val: string): string => {
    if (!val.trim()) return 'Enter authorized LDRRMO email address.';
    return EMAIL_RE.test(val.trim()) ? '' : 'Enter a valid email address.';
  };

  const validatePassword = (val: string): string => {
    if (!val) return 'Security password is required.';
    return val.length >= 8 ? '' : 'Password must be at least 8 characters.';
  };

  const handleCliPasswordReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setStatusMessage('Emergency admin credentials reset must be performed via local terminal CLI: .\\start.ps1 createsuperadmin');
    setStatusTone('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = consent ? '' : 'Acknowledge LDRRMO operational protocol to proceed.';

    setEmailError(eErr);
    setPasswordError(pErr);
    setConsentError(cErr);

    if (eErr || pErr || cErr) {
      setStatusMessage('Check highlighted fields.');
      setStatusTone('bad');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Verifying LDRRMO Executive Command clearance…');
    setStatusTone('');

    try {
      const res = await loginUser({
        email: email.trim(),
        password,
        portalOrigin: 'Admin'
      });

      if (res?.token) {
        localStorage.setItem('resqtrack_token', res.token);
        if (res.session) localStorage.setItem('resqtrack_user', JSON.stringify(res.session));
      }

      setIsLoading(false);
      setIsSuccess(true);
      setStatusMessage('LDRRMO Command Session Verified. Launching Tactical Command Center…');
      setStatusTone('ok');

      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 900);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication failed. Access denied to Port 5174.';
      setStatusMessage(msg);
      setStatusTone('bad');
    }
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8"
      style={{
        background: 'radial-gradient(circle at 50% 20%, #15060f 0%, #060e18 55%, #02070c 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Tactical Glow & Grid Background (Zero rotated wedge collision) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(rgba(232, 17, 76, 0.25) 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute w-[600px] h-[600px] rounded-full blur-[120px] -top-40 -left-40"
        style={{ background: 'radial-gradient(circle, rgba(232,17,76,0.18), transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute w-[500px] h-[500px] rounded-full blur-[100px] -bottom-32 -right-32"
        style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.15), transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[500px] my-auto z-10">
        {/* Executive Clearance Header */}
        <header className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-[#1a0510] border border-[#e8114c]/40">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#e8114c] shadow-[0_0_8px_#e8114c]" />
            <span className="text-[10.5px] font-extrabold tracking-[0.14em] text-[#ff5c74] uppercase">
              PORT 5174 EXCLUSIVE EXECUTIVE GATEWAY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-wide text-white font-['Montserrat',sans-serif]">
            LDRRMO COMMAND & CONTROL
          </h1>
          <p className="text-sky-400 font-semibold text-xs sm:text-sm mt-1">
            Local Disaster Risk Reduction & Management Office
          </p>
          <p className="text-slate-400 text-xs mt-1">
            Restricted Tactical Administration & Multi-Agency Dispatch System
          </p>
          <div
            className="w-44 h-[3px] mx-auto mt-3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #e8114c, #38bdf8, transparent)',
              boxShadow: '0 0 8px rgba(232, 17, 76, 0.5)'
            }}
            aria-hidden="true"
          />
        </header>

        {/* High Security Panel (Zero Unit Selector Tabs) */}
        <section
          className="relative w-full rounded-2xl bg-[#091522]/95 border border-[#e8114c]/30 shadow-2xl shadow-black/80 backdrop-blur-md overflow-hidden"
          aria-labelledby="admin-panel-title"
        >
          <div
            className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, #e8114c, #38bdf8)' }}
            aria-hidden="true"
          />
          <h2 className="visually-hidden" id="admin-panel-title">LDRRMO Administrator Sign In</h2>

          <form className="p-5 sm:p-7" id="admin-login-form" onSubmit={handleSubmit} noValidate>
            {/* High Security Notice */}
            <div className="notice" id="admin-notice" style={{ background: '#071522', borderColor: 'rgba(232, 17, 76, 0.4)', marginTop: '0', marginBottom: '18px' }}>
              <div className="notice__head">
                <span className="notice__dot" aria-hidden="true" style={{ background: '#e8114c' }}></span>
                <p className="notice__title" style={{ color: '#ffffff', fontWeight: 700 }}>
                  RESTRICTED ACCESS CONSOLE
                </p>
                <span className="notice__badge" style={{ background: '#340313', color: '#ff5c74', border: '1px solid rgba(232,17,76,0.5)' }}>
                  LDRRMO_ADMIN ONLY
                </span>
              </div>
              <p className="notice__text" style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px' }}>
                Only authorized LDRRMO Executive Directors and System Administrators are permitted. Responders (RHU, FIRE, PNP) and Civilians must sign in via Port 5173.
              </p>
            </div>

            {/* Email Field */}
            <div className={`field ${emailError ? 'is-invalid' : ''}`} style={{ marginTop: '12px' }}>
              <label className="field__label" htmlFor="admin-email" style={{ color: '#cbd5e1' }}>Admin Official Email</label>
              <div className="field__box" style={{ background: '#0e243a', borderColor: 'rgba(255,255,255,0.1)' }}>
                <svg className="field__icon" aria-hidden="true"><use href="#i-shield"/></svg>
                <input
                  className="field__input"
                  id="admin-email"
                  name="email"
                  type="email"
                  placeholder="admin.director@resqtrack.gov.ph"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError(validateEmail(e.target.value));
                  }}
                  onBlur={() => {
                    if (email) setEmailError(validateEmail(email));
                  }}
                  autoComplete="username"
                  spellCheck={false}
                  aria-describedby="admin-email-error"
                  aria-invalid={!!emailError}
                  style={{ color: '#ffffff' }}
                />
              </div>
              {emailError && (
                <p className="field__error" id="admin-email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className={`field field--password ${passwordError ? 'is-invalid' : ''}`} style={{ marginTop: '12px' }}>
              <div className="field__row">
                <label className="field__label" htmlFor="admin-password" style={{ color: '#cbd5e1' }}>Admin Clearance Password</label>
                <a
                  className="link link--quiet"
                  href="#"
                  onClick={handleCliPasswordReset}
                  style={{ color: '#38bdf8', fontSize: '11px', fontWeight: 600 }}
                >
                  CLI Password Reset
                </a>
              </div>
              <div className="field__box" style={{ background: '#0e243a', borderColor: 'rgba(255,255,255,0.1)' }}>
                <svg className="field__icon" aria-hidden="true"><use href="#i-lock"/></svg>
                <input
                  className="field__input"
                  id="admin-password"
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
                  aria-describedby="admin-password-error"
                  aria-invalid={!!passwordError}
                  style={{ color: '#ffffff' }}
                />
                <button
                  className="field__toggle"
                  type="button"
                  id="admin-pw-toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="admin-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {!showPassword ? (
                    <svg className="field__toggle-on" aria-hidden="true"><use href="#i-eye"/></svg>
                  ) : (
                    <svg className="field__toggle-off" aria-hidden="true"><use href="#i-eye-off"/></svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="field__error" id="admin-password-error" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Terms Row & Auto-fill Helper */}
            <div className="flex items-center justify-between mt-3 mb-2" style={{ minHeight: '24px' }}>
              <Checkbox
                id="admin-consent"
                checked={consent}
                onChange={(val) => {
                  setConsent(val);
                  if (val) setConsentError('');
                }}
                label={
                  <span className="text-[11px] text-slate-300 font-medium select-none">
                    Acknowledge LDRRMO Security Protocol
                  </span>
                }
              />
              <button
                type="button"
                onClick={fillAdminCredentials}
                style={{
                  fontSize: '11px',
                  padding: '3px 9px',
                  borderRadius: '4px',
                  border: '1px solid rgba(14,165,233,0.4)',
                  background: '#071522',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'all 0.15s ease'
                }}
                className="hover:bg-[#0c243a] hover:border-[#38bdf8]"
              >
                Auto-fill Admin Demo
              </button>
            </div>
            {consentError && (
              <p className="text-[11px] text-[#ff5c74] font-medium -mt-1 mb-2" id="admin-consent-error" role="alert">
                {consentError}
              </p>
            )}

            {/* Port 5173 Redirect Link if Responder/Civilian */}
            <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '12px', fontSize: '11.5px', color: '#64748b' }}>
              Are you an Emergency Responder or Citizen Resident?{' '}
              <a
                href="http://127.0.0.1:5173/login"
                style={{ color: '#ff5c74', textDecoration: 'underline', fontWeight: 600 }}
              >
                Go to Port 5173 Portal &rarr;
              </a>
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

            {/* Submit Button using Shared Atomic Primitive */}
            <div style={{ marginTop: statusMessage ? '0' : '4px' }}>
              <Button
                type="submit"
                id="admin-submit"
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
                className="!h-[46px] !bg-gradient-to-r !from-[#e8114c] !to-[#c50337] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase !shadow-lg !shadow-[#e8114c]/30 active:!scale-[0.99] transition-all rounded-lg group cursor-pointer"
              >
                {isLoading ? 'Verifying clearance…' : isSuccess ? 'Clearance Granted' : 'ACCESS COMMAND CONSOLE'}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

export default AdminLoginPage;
