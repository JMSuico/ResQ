// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: 100% pixel-faithful React 19 conversion adhering to the exact aesthetic of Screenshot 2026-10-21 064110.png.
// Role-Based Access Control (RBAC): Clean, authentic login form with automatic operational routing based on account credentials.
// Katipuneros architecture with Universal Lambdas (=>), Shared primitives, and useFluidResposiveness.

import React, { useState, useEffect, FC } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Check, ArrowRight, Camera, Cpu, X } from 'lucide-react';
import { loginUser, LoginResponse } from '@/Endpoints/authApi';
import { Button, Checkbox } from '@/Shared';
import { useFluidResposiveness } from '@/Hooks';
import { BiometricLoginModal } from './BiometricLoginModal';

const POST_REGISTER_LEARNING_STORAGE_KEY = 'resqtrack_post_register_learning_notice';

export const LoginPage: FC = () => {
  const currentPort = typeof window !== 'undefined' ? window.location.port : '';
  const isDedicatedAdminPort = currentPort === '1996';

  const { isMobile } = useFluidResposiveness();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [postRegisterNotice, setPostRegisterNotice] = useState<string>('');

  useEffect(() => {
    const navState = location.state as { postRegisterLearningNotice?: string } | null;
    const fromState =
      typeof navState?.postRegisterLearningNotice === 'string'
        ? navState.postRegisterLearningNotice.trim()
        : '';
    let fromStorage = '';
    try {
      fromStorage = (sessionStorage.getItem(POST_REGISTER_LEARNING_STORAGE_KEY) || '').trim();
    } catch {
      fromStorage = '';
    }
    const resolved = fromState || fromStorage;
    if (resolved) {
      setPostRegisterNotice(resolved);
    }
  }, [location.state]);

  const dismissPostRegisterNotice = () => {
    setPostRegisterNotice('');
    try {
      sessionStorage.removeItem(POST_REGISTER_LEARNING_STORAGE_KEY);
    } catch {
      // Storage safeguard
    }
  };

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

  const processSuccessfulSession = (res: LoginResponse) => {
    if (res?.token) {
      const portKey = currentPort || '1997';
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

      // 3. Port-scoped storage (:1996 Admin / :1997 Responder / :1998 Civilian)
      if (isAdminUser || portKey === '1996') {
        localStorage.setItem('resqtrack_token_1996', res.token);
        if (res.session) {
          localStorage.setItem('resqtrack_user_1996', JSON.stringify(res.session));
          localStorage.setItem('resqtrack_session_1996', JSON.stringify(res.session));
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
        if (currentPort === '1997' || currentPort === '1998') {
          window.location.href = `http://${host}:1996/admin/dashboard?session_token=${encodeURIComponent(res.token)}`;
        } else {
          navigate('/admin/dashboard');
        }
      } else if (isCiv) {
        navigate('/civilian/dashboard');
      } else {
        navigate('/responder/dashboard');
      }
    }, 900);
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

      processSuccessfulSession(res);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication failed. Please verify credentials.';
      setStatusMessage(msg);
      setStatusTone('bad');
    }
  };

  return (
    <main
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-10 relative overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, #4A041A 0%, #670626 55%, #3B0315 100%)'
      }}
    >
      {/* Subtle Cherry Ambient Accents */}
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[460px] h-[460px] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #A83B4D, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #F7F1EA, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className={`relative z-10 w-full ${isMobile ? 'max-w-md' : 'max-w-5xl'} mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12`}>
        {/* Left Brand & Responders Showcase */}
        <div className="w-full lg:w-5/12 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F7F1EA]/12 border border-[#F7F1EA]/25 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#F7F1EA] animate-pulse" />
            <span className="font-mono text-xs font-bold tracking-widest text-[#F7F1EA] uppercase">
              Katipunan Emergency Grid
            </span>
          </div>

          <header className="mb-4">
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-[#F7F1EA] font-['Montserrat',sans-serif]">
              RESQTRACK
            </h1>
            <p className="text-lg sm:text-xl font-bold text-[#E9D9D0] mt-1 tracking-wide">
              Emergency Portal
            </p>
            <div className="w-28 h-1 rounded-full bg-[#A83B4D] mt-3 mx-auto lg:mx-0" aria-hidden="true" />
          </header>

          <div className="hidden lg:block w-full max-w-sm mt-2">
            <img
              src="/img/responders.png"
              alt="Emergency Responders Cutout"
              className="w-full h-auto object-contain drop-shadow-[0_18px_36px_rgba(20,2,10,0.55)]"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('/responders.png')) {
                  target.src = '/responders.png';
                }
              }}
            />
          </div>
        </div>

        {/* Elevated Warm Ivory Clay Sign-In Panel */}
        <section
          className="clay-surface relative w-full max-w-[460px] rounded-3xl bg-[#F7F1EA] border border-[#E9D9D0] p-6 sm:p-8 text-[#670626] shadow-[0_28px_64px_-12px_rgba(38,2,14,0.55),inset_0_2px_4px_rgba(255,255,255,0.85)]"
          aria-labelledby="panel-title"
        >
          <div className="mb-5 border-b border-[#D5BEB3] pb-3.5">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#670626] font-['Montserrat',sans-serif]" id="panel-title">
              Sign In
            </h2>
            <p className="font-mono text-xs text-[#A83B4D] uppercase tracking-wider mt-1 font-semibold">
              Responder &amp; Civilian Command Access
            </p>
          </div>

          {postRegisterNotice && (
            <div
              id="login-post-register-learning-banner"
              role="alert"
              className="mb-4 p-3 rounded-2xl bg-[#E9D9D0] border border-[#A83B4D]/50 text-[#670626] font-sans text-xs sm:text-sm flex items-start gap-2.5 shadow-sm"
            >
              <Cpu className="w-4 h-4 text-[#670626] shrink-0 mt-0.5" />
              <span className="flex-1 font-medium leading-relaxed">{postRegisterNotice}</span>
              <button
                type="button"
                onClick={dismissPostRegisterNotice}
                aria-label="Dismiss notice"
                className="text-[#A83B4D] hover:text-[#670626] p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <form id="login-form" onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Email Address Field */}
            <div className={emailError ? 'is-invalid' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold" htmlFor="email">
                  Email *
                </label>
              </div>
              <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3.5 min-h-[46px]">
                <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2.5" />
                <input
                  className="w-full py-2.5 bg-transparent font-sans text-[#670626] text-sm sm:text-base placeholder:text-[#A83B4D]/70 focus:outline-none"
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
                <p className="font-mono text-xs text-[#670626] font-semibold mt-1" id="email-error" role="alert">
                  {emailError}
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className={passwordError ? 'is-invalid' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold" htmlFor="password">
                  Password *
                </label>
                <a
                  className="font-mono text-xs text-[#A83B4D] hover:text-[#670626] font-semibold transition-colors underline underline-offset-2"
                  href="#"
                  onClick={handleForgotPassword}
                >
                  Forgot password?
                </a>
              </div>
              <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3.5 min-h-[46px]">
                <Lock className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2.5" />
                <input
                  className="w-full py-2.5 bg-transparent font-sans text-[#670626] text-sm sm:text-base placeholder:text-[#A83B4D]/70 focus:outline-none"
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
                  className="text-[#A83B4D] hover:text-[#670626] ml-auto p-1 cursor-pointer"
                  type="button"
                  id="pw-toggle"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="password"
                  onClick={handleTogglePassword}
                >
                  {!showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="font-mono text-xs text-[#670626] font-semibold mt-1" id="password-error" role="alert">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Terms Row */}
            <div className="flex items-center justify-between pt-1" style={{ minHeight: '24px' }}>
              <Checkbox
                id="consent"
                checked={consent}
                onChange={(val) => {
                  setConsent(val);
                  if (val) setConsentError('');
                }}
                label={
                  <span className="text-xs sm:text-sm text-[#670626] font-semibold select-none">
                    Accept access terms
                  </span>
                }
              />
            </div>
            {consentError && (
              <p className="font-mono text-xs text-[#670626] font-semibold -mt-1" id="consent-error" role="alert">
                {consentError}
              </p>
            )}

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
                className="!h-[48px] !text-sm sm:!text-base !bg-[#670626] hover:!bg-[#4A041A] !text-[#F7F1EA] !font-black !tracking-widest !uppercase !shadow-lg !shadow-[#4A041A]/25 active:!scale-[0.99] transition-all rounded-xl group cursor-pointer !border !border-[#4A041A]"
              >
                {isLoading ? 'Signing in...' : isSuccess ? 'Access Granted' : 'Sign In'}
              </Button>

              <button
                type="button"
                id="biometric-login-btn"
                onClick={() => setIsBiometricModalOpen(true)}
                className="w-full !h-[44px] rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] hover:bg-[#DFC9BE] text-[#670626] font-mono text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
              >
                <Camera className="w-4 h-4 text-[#A83B4D]" />
                <span>Biometric Face Login</span>
              </button>
            </div>

            {/* Civilian & Responder Registration Redirection */}
            <div className="pt-3 text-center border-t border-[#D5BEB3]">
              <span className="text-sm text-[#7D2B3D] font-mono">Don't have an account? </span>
              <Link
                to="/register"
                id="register-link"
                className="text-sm font-mono font-bold text-[#670626] hover:text-[#A83B4D] underline underline-offset-4 transition-colors"
              >
                Sign up here
              </Link>
            </div>
          </form>
        </section>
      </div>

      {/* 1:1 Biometric Authentication Modal */}
      <BiometricLoginModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        initialEmail={email}
        portalOrigin={isDedicatedAdminPort ? 'Admin' : 'ResponderCivilian'}
        onLoginSuccess={(res) => {
          setIsBiometricModalOpen(false);
          processSuccessfulSession(res);
        }}
      />
    </main>
  );
};

export default LoginPage;
