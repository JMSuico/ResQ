// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: Dedicated LDRRMO Executive Command & Control Login Portal for Port 1996.
// Strict UserRole.LDRRMO_Admin enforcement; non-admins receive HTTP 403 Forbidden.
// Mission-critical tactical HUD aesthetic with zero unit selector tabs/buttons.
// Katipuneros architecture with Universal Lambdas (=>), Shared primitives, and useFluidResposiveness.

import React, { useState, FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, Check, ArrowRight, Camera } from 'lucide-react';
import { loginUser, LoginResponse } from '@/Endpoints/authApi';
import { Button, Checkbox } from '@/Shared';
import { useFluidResposiveness } from '@/Hooks';
import { BiometricLoginModal } from './BiometricLoginModal';

export const AdminLoginPage: FC = () => {
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
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState<boolean>(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const validateEmail = (val: string): string => {
    if (!val.trim()) return 'Enter authorized LDRRMO email address.';
    return EMAIL_RE.test(val.trim()) ? '' : 'Enter a valid email address.';
  };

  const validatePassword = (val: string): string => {
    if (!val) return 'Security password is required.';
    return val.length >= 8 ? '' : 'Password must be at least 8 characters.';
  };

  const processAdminSession = (res: LoginResponse) => {
    if (res?.token) {
      const currentPort = typeof window !== 'undefined' ? (window.location.port || '1996') : '1996';
      sessionStorage.setItem('resqtrack_token', res.token);
      if (res.session) {
        sessionStorage.setItem('resqtrack_user', JSON.stringify(res.session));
        sessionStorage.setItem('resqtrack_session', JSON.stringify(res.session));
      }
      localStorage.setItem(`resqtrack_token_${currentPort}`, res.token);
      if (res.session) {
        localStorage.setItem(`resqtrack_user_${currentPort}`, JSON.stringify(res.session));
        localStorage.setItem(`resqtrack_session_${currentPort}`, JSON.stringify(res.session));
      }
      localStorage.setItem('resqtrack_token', res.token);
      if (res.session) {
        localStorage.setItem('resqtrack_user', JSON.stringify(res.session));
        localStorage.setItem('resqtrack_session', JSON.stringify(res.session));
      }
    }

    setIsLoading(false);
    setIsSuccess(true);
    setStatusMessage('LDRRMO Command Session Verified. Launching Tactical Command Center…');
    setStatusTone('ok');

    setTimeout(() => {
      navigate('/admin/dashboard');
    }, 900);
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

      processAdminSession(res);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication failed. Access denied to Port 1996.';
      setStatusMessage(msg);
      setStatusTone('bad');
    }
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-8 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #4A041A 0%, #670626 55%, #3B0315 100%)'
      }}
    >
      {/* Subtle Cherry Ambient Accents */}
      <div
        className="pointer-events-none absolute w-[560px] h-[560px] rounded-full blur-[120px] -top-40 -left-40 opacity-25"
        style={{ background: 'radial-gradient(circle, #A83B4D, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute w-[460px] h-[460px] rounded-full blur-[100px] -bottom-32 -right-32 opacity-20"
        style={{ background: 'radial-gradient(circle, #F7F1EA, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className={`relative w-full ${isMobile ? 'max-w-md' : 'max-w-[500px]'} my-auto z-10`}>
        {/* Admin Login Header */}
        <header className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-3 px-3.5 py-1.5 rounded-full bg-[#F7F1EA]/12 border border-[#F7F1EA]/25 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#F7F1EA] animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-wider text-[#F7F1EA] uppercase">
              Command Portal
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#F7F1EA] font-['Montserrat',sans-serif]">
            LDRRMO Admin Login
          </h1>
          <div
            className="w-32 h-1 mx-auto mt-3 rounded-full bg-[#A83B4D]"
            aria-hidden="true"
          />
        </header>

        {/* Elevated Warm Ivory Clay Admin Panel */}
        <section
          className="clay-surface relative w-full rounded-3xl bg-[#F7F1EA] border border-[#E9D9D0] shadow-[0_28px_64px_-12px_rgba(38,2,14,0.55),inset_0_2px_4px_rgba(255,255,255,0.85)] overflow-hidden text-[#670626]"
          aria-labelledby="admin-panel-title"
        >
          <h2 className="visually-hidden" id="admin-panel-title">LDRRMO Administrator Sign In</h2>

          <form className="p-6 sm:p-8 relative z-10 space-y-4" id="admin-login-form" onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className={emailError ? 'is-invalid' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold" htmlFor="admin-email">
                  Admin Email *
                </label>
              </div>
              <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3.5 min-h-[46px]">
                <Shield className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2.5" />
                <input
                  className="w-full py-2.5 bg-transparent font-sans text-[#670626] text-sm sm:text-base placeholder:text-[#A83B4D]/70 focus:outline-none"
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
                />
              </div>
              {emailError && (
                <p className="font-mono text-xs text-[#670626] font-semibold mt-1" id="admin-email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className={passwordError ? 'is-invalid' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold" htmlFor="admin-password">
                  Password *
                </label>
              </div>
              <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3.5 min-h-[46px]">
                <Lock className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2.5" />
                <input
                  className="w-full py-2.5 bg-transparent font-sans text-[#670626] text-sm sm:text-base placeholder:text-[#A83B4D]/70 focus:outline-none"
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter LDRRMO security password"
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
                />
                <button
                  className="text-[#A83B4D] hover:text-[#670626] ml-auto p-1 cursor-pointer"
                  type="button"
                  id="admin-pw-toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="admin-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {!showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="font-mono text-xs text-[#670626] font-semibold mt-1" id="admin-password-error" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Terms Row */}
            <div className="flex items-center justify-between pt-1" style={{ minHeight: '24px' }}>
              <Checkbox
                id="admin-consent"
                checked={consent}
                onChange={(val) => {
                  setConsent(val);
                  if (val) setConsentError('');
                }}
                label={
                  <span className="text-xs sm:text-sm text-[#670626] font-semibold select-none">
                    Acknowledge Security Protocol
                  </span>
                }
              />
            </div>
            {consentError && (
              <p className="font-mono text-xs text-[#670626] font-semibold -mt-1" id="admin-consent-error" role="alert">
                {consentError}
              </p>
            )}

            {/* Port 1997 Redirect Link if Responder/Civilian */}
            <div className="font-mono text-xs sm:text-sm text-center text-[#7D2B3D] border border-[#D5BEB3] bg-[#EFE4DD] py-2.5 px-3 rounded-xl">
              <a
                href="http://127.0.0.1:1997/login"
                className="text-[#670626] hover:text-[#A83B4D] underline font-bold tracking-wide"
              >
                Port 1997 Gateway -&gt;
              </a>
            </div>

            {/* Dynamic Status / Error Message */}
            {statusMessage && (
              <div
                role="status"
                aria-live="polite"
                className={`font-mono text-xs sm:text-sm font-semibold text-center p-2.5 rounded-xl border ${
                  statusTone === 'ok'
                    ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                    : statusTone === 'bad'
                    ? 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]'
                    : 'bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]'
                }`}
                style={{ wordBreak: 'break-word' }}
              >
                {statusMessage}
              </div>
            )}

            {/* Submit & Biometric Buttons */}
            <div className="space-y-2.5 pt-1">
              <Button
                type="submit"
                id="admin-submit"
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
                className="!h-[48px] !text-sm sm:!text-base !bg-[#670626] hover:!bg-[#4A041A] !text-[#F7F1EA] !font-black !tracking-widest !uppercase !shadow-lg !shadow-[#4A041A]/25 active:!scale-[0.99] transition-all rounded-xl group cursor-pointer !border !border-[#4A041A]"
              >
                {isLoading ? 'Signing in...' : isSuccess ? 'Access Granted' : 'Sign In'}
              </Button>

              <button
                type="button"
                id="admin-biometric-btn"
                onClick={() => setIsBiometricModalOpen(true)}
                className="w-full !h-[44px] rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <Camera className="w-4 h-4 text-[#A83B4D]" />
                <span>1:1 Biometric Login</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* 1:1 Biometric Authentication Modal for Admin Portal */}
      <BiometricLoginModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        initialEmail={email}
        portalOrigin="Admin"
        onLoginSuccess={(res) => {
          setIsBiometricModalOpen(false);
          processAdminSession(res);
        }}
      />
    </main>
  );
};

export default AdminLoginPage;
