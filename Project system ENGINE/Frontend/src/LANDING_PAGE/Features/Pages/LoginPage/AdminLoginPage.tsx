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
        background: 'radial-gradient(circle at 50% 12%, #340313 0%, #1f030c 35%, #0d0107 70%, #030002 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Tactical Glow & Grid Background */}
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
        style={{ background: 'radial-gradient(circle, rgba(232,17,76,0.22), transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute w-[500px] h-[500px] rounded-full blur-[100px] -bottom-32 -right-32"
        style={{ background: 'radial-gradient(circle, rgba(255,92,116,0.15), transparent 70%)' }}
        aria-hidden="true"
      />

      {/* Military Telemetry Coordinate Markers */}
      <div className="absolute top-4 left-6 hidden md:block font-mono text-[9px] text-rose-300/40 tracking-widest pointer-events-none">
        C2-ISOLATE // SEC-GRID: KAT-01 // 8.5074°N, 123.3414°E
      </div>
      <div className="absolute top-4 right-6 hidden md:block font-mono text-[9px] text-rose-300/40 tracking-widest pointer-events-none">
        HSM-ENCRYPT: AES-256-GCM // PORT: 5174
      </div>

      <div className="relative w-full max-w-[520px] my-auto z-10">
        {/* Executive Clearance Header */}
        <header className="text-center mb-5">
          {/* Executive Command Level-4 Isolation Badge */}
          <div className="inline-flex items-center gap-2.5 mb-2.5 px-3.5 py-1.5 rounded-full bg-[#20050e]/90 border border-[#e8114c]/70 shadow-[0_0_16px_rgba(232,17,76,0.35)] backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e8114c] shadow-[0_0_8px_#e8114c]"></span>
            </span>
            <span className="font-mono text-[10px] font-extrabold tracking-[0.16em] text-[#ff5c74] uppercase">
              LEVEL-4 EXECUTIVE ISOLATION // PORT 5174 EXCLUSIVE
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-white font-['Montserrat',sans-serif]">
            LDRRMO EXECUTIVE COMMAND
          </h1>
          <p className="font-mono text-xs text-rose-300 font-semibold tracking-wide mt-1 uppercase">
            Local Disaster Risk Reduction & Management Office &bull; Region IX
          </p>
          <p className="font-mono text-[11px] text-slate-400 mt-1">
            Restricted C4I Tactical Administration & Multi-Agency Dispatch Architecture
          </p>
          <div
            className="w-48 h-[2px] mx-auto mt-3 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #e8114c 30%, #ff5c74 50%, #e8114c 70%, transparent)',
              boxShadow: '0 0 10px rgba(232, 17, 76, 0.6)'
            }}
            aria-hidden="true"
          />
        </header>

        {/* High Security Panel with Tactical Military HUD Corner Brackets */}
        <section
          className="relative w-full rounded-2xl bg-gradient-to-b from-[#18030d]/95 via-[#0f0208]/95 to-[#070104]/98 border border-[#e8114c]/40 shadow-2xl shadow-black/90 backdrop-blur-md overflow-hidden"
          aria-labelledby="admin-panel-title"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.8), 0 0 25px rgba(232,17,76,0.18)' }}
        >
          {/* Military HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#e8114c] pointer-events-none rounded-tl-sm z-20" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#e8114c] pointer-events-none rounded-tr-sm z-20" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#e8114c] pointer-events-none rounded-bl-sm z-20" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#e8114c] pointer-events-none rounded-br-sm z-20" aria-hidden="true" />

          {/* Top Subtle Scanner Line */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] z-10"
            style={{ background: 'linear-gradient(90deg, transparent, #e8114c, #ff5c74, #e8114c, transparent)' }}
            aria-hidden="true"
          />
          <h2 className="visually-hidden" id="admin-panel-title">LDRRMO Administrator Sign In</h2>

          <form className="p-5 sm:p-7 relative z-10" id="admin-login-form" onSubmit={handleSubmit} noValidate>
            {/* Live Telemetry Status Bar */}
            <div className="flex items-center justify-between font-mono text-[9.5px] tracking-wider text-rose-300/80 border-b border-rose-500/20 pb-2 mb-3">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                C4I SYSTEM: ACTIVE // CLEARANCE: LEVEL-4
              </span>
              <span className="text-slate-400 tracking-widest">ISOLATION MODE: AIR-GAPPED</span>
            </div>

            {/* Dual-Port Air-Gap Security Notice */}
            <div
              className="rounded-xl border border-rose-500/40 bg-gradient-to-b from-[#2a0614]/90 to-[#14020a]/95 p-3.5 mb-4 relative overflow-hidden backdrop-blur-md"
              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 12px rgba(0,0,0,0.4)' }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#e8114c] shadow-[0_0_8px_#e8114c]" />
                  <p className="font-mono text-[11px] font-bold tracking-wider text-white uppercase">
                    DUAL-PORT AIR-GAP SECURITY NOTICE
                  </p>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 font-extrabold uppercase">
                  ISOLATED :5174
                </span>
              </div>
              <p className="text-slate-300 text-[11.5px] leading-relaxed">
                Port 5174 is cryptographically isolated exclusively for LDRRMO Executive Directors and C2 Commanders. Emergency Field Responders (RHU, FIRE, PNP) and Citizen Residents are restricted to Port 5173. Non-executive logins trigger automated Level-4 lockout.
              </p>
            </div>

            {/* Email Field */}
            <div className={`field ${emailError ? 'is-invalid' : ''}`} style={{ marginTop: '8px' }}>
              <div className="flex items-center justify-between mb-1">
                <label className="font-mono text-[11px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="admin-email">
                  Admin Command Email
                </label>
                <span className="font-mono text-[9px] text-rose-400 font-bold">[LEVEL-4 CLEARANCE ID]</span>
              </div>
              <div
                className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all"
                style={{
                  background: 'rgba(32, 6, 15, 0.85)',
                  border: '1px solid rgba(255, 92, 116, 0.28)',
                  borderRadius: '6px'
                }}
              >
                <svg className="field__icon" aria-hidden="true" style={{ stroke: '#ff5c74' }}><use href="#i-shield"/></svg>
                <input
                  className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                <p className="field__error font-mono text-[10.5px]" id="admin-email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className={`field field--password ${passwordError ? 'is-invalid' : ''}`} style={{ marginTop: '10px' }}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="admin-password">
                    Executive Security Passphrase
                  </label>
                  <span className="font-mono text-[9px] text-rose-400 font-bold">[ARGON2.KEY]</span>
                </div>
                <a
                  className="font-mono text-[10px] text-rose-400 hover:text-rose-300 font-semibold transition-colors"
                  href="#"
                  onClick={handleCliPasswordReset}
                >
                  CLI Reset (.ps1)
                </a>
              </div>
              <div
                className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all"
                style={{
                  background: 'rgba(32, 6, 15, 0.85)',
                  border: '1px solid rgba(255, 92, 116, 0.28)',
                  borderRadius: '6px'
                }}
              >
                <svg className="field__icon" aria-hidden="true" style={{ stroke: '#ff5c74' }}><use href="#i-lock"/></svg>
                <input
                  className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                  className="field__toggle hover:text-rose-300"
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
                <p className="field__error font-mono text-[10.5px]" id="admin-password-error" role="alert">
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
                className="font-mono text-[10px] px-2.5 py-1 rounded border border-rose-500/40 bg-rose-950/70 text-rose-300 hover:border-rose-400 hover:bg-rose-900/80 font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="Populate test executive credentials"
              >
                <span>EXEC DEMO KEY</span>
                <span className="text-xs">🔑</span>
              </button>
            </div>
            {consentError && (
              <p className="font-mono text-[11px] text-[#ff5c74] font-medium -mt-1 mb-2" id="admin-consent-error" role="alert">
                {consentError}
              </p>
            )}

            {/* Port 5173 Redirect Link if Responder/Civilian */}
            <div className="font-mono text-[11px] text-center my-3 text-slate-400 border border-slate-700/40 bg-slate-900/40 py-1.5 px-2 rounded">
              Emergency Responder or Citizen Resident?{' '}
              <a
                href="http://127.0.0.1:5173/login"
                className="text-rose-400 hover:text-rose-300 underline font-bold tracking-wide"
              >
                Go to Port 5173 Gateway &rarr;
              </a>
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
                className="!h-[48px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-black !tracking-widest !uppercase !shadow-lg !shadow-[#e8114c]/40 active:!scale-[0.99] transition-all rounded-lg group cursor-pointer border border-[#ff5c74]/50"
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
