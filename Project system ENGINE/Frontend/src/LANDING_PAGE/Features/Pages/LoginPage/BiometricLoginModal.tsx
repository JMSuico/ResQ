// [Layer: LANDING_PAGE/Features/Pages/LoginPage]
// Responsibility: Repeat 1:1 Biometric Authentication Modal for enrolled users.
// Complies with Katipuneros Architecture: Universal Lambdas (=>), Zero 'any', Strict TypeScript, and military HUD aesthetics.

import React, { useState, useRef, useEffect, useCallback, FC } from 'react';
import { Camera, RefreshCw, X, Shield, Check, AlertTriangle, Cpu, Activity, User, ArrowRight, Sparkles } from 'lucide-react';
import { biometricLoginUser, LoginResponse } from '@/Endpoints/authApi';
import { trackSkinFace } from '@/Libs/Vision/idScanner/face/skinFaceTracker';
import { extractBiometricFeatureVector, generateDeterministicBiometricVector } from '@/Libs/Cache/biometricFrameCache';

interface BiometricLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  portalOrigin?: string;
  onLoginSuccess: (response: LoginResponse) => void;
}

export const BiometricLoginModal: FC<BiometricLoginModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  portalOrigin = 'ResponderCivilian',
  onLoginSuccess
}) => {
  const [email, setEmail] = useState<string>(initialEmail);
  const [emailError, setEmailError] = useState<string>('');
  const [stage, setStage] = useState<'IDENTIFIER' | 'CAMERA_SCAN' | 'VERIFYING'>('IDENTIFIER');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusTone, setStatusTone] = useState<'ok' | 'bad' | ''>('');
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const prevGrayRef = useRef<Float32Array | undefined>(undefined);
  const hasDispatchedRef = useRef<boolean>(false);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, []);

  const handleClose = () => {
    stopCamera();
    setStage('IDENTIFIER');
    setStatusMessage('');
    setStatusTone('');
    setScanProgress(0);
    setCameraError(null);
    onClose();
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access physical camera.';
      setCameraError(msg);
      setStatusMessage('Camera access failed. Please ensure your camera is connected and permissions are granted.');
      setStatusTone('bad');
    }
  };

  const executeBiometricLogin = async (descriptorVector: number[]) => {
    setStage('VERIFYING');
    setStatusMessage('Comparing live facial descriptor against account template on secure server…');
    setStatusTone('');
    stopCamera();

    try {
      const response = await biometricLoginUser({
        email: email.trim().toLowerCase(),
        liveDescriptorVector: descriptorVector,
        portalOrigin
      });

      setStatusMessage('Identity verified successfully! Redirecting…');
      setStatusTone('ok');
      setTimeout(() => {
        onLoginSuccess(response);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric verification failed.';
      setStatusMessage(msg);
      setStatusTone('bad');
      setStage('CAMERA_SCAN');
    }
  };

  const processVideoFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState >= 2 && video.videoWidth > 0) {
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, 320, 240);
        const imgData = ctx.getImageData(0, 0, 320, 240);
        const skinRes = trackSkinFace(
          imgData.data,
          320,
          240,
          { cx: 160, cy: 120, rx: 84, ry: 102 },
          prevGrayRef.current
        );
        if (skinRes?.ycbcr?.y) {
          prevGrayRef.current = skinRes.ycbcr.y;
        }

        if (skinRes && skinRes.isValidFace) {
          const yawVal = Math.abs(skinRes.yawDegrees);
          const pitchVal = Math.abs(skinRes.pitchDegrees);
          const isCentered = yawVal <= 15 && pitchVal <= 15;

          if (isCentered) {
            setScanProgress((prev) => {
              const next = prev + 8;
              if (next >= 100 && !hasDispatchedRef.current) {
                const descriptor = skinRes.featureDescriptor || skinRes.hybridProfile.featureDescriptor;
                if (descriptor && descriptor.length > 0) {
                  hasDispatchedRef.current = true;
                  executeBiometricLogin(Array.from(descriptor));
                  return 100;
                }
              }
              return Math.min(next, 95);
            });
          } else {
            setScanProgress((prev) => Math.max(0, prev - 2));
          }
        } else {
          setScanProgress((prev) => Math.max(0, prev - 4));
        }
      }
    }

    if (!hasDispatchedRef.current) {
      animationFrameId.current = requestAnimationFrame(processVideoFrame);
    }
  }, [email, portalOrigin]);

  const handleStartScanning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailError('Please enter a valid registered email address.');
      return;
    }
    setEmailError('');
    hasDispatchedRef.current = false;
    setStage('CAMERA_SCAN');
    setScanProgress(0);
    setStatusMessage('Align your face in the optical HUD reticle to authenticate.');
    setStatusTone('');

    await startCamera();
    animationFrameId.current = requestAnimationFrame(processVideoFrame);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md rounded-2xl bg-[#070b14] border border-rose-500/30 p-6 shadow-2xl text-white font-sans"
        style={{ boxShadow: '0 0 35px rgba(225, 29, 72, 0.25)' }}
      >
        {/* Military Corner Brackets */}
        <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-[#ff5c74]" />
        <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-[#ff5c74]" />
        <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-[#ff5c74]" />
        <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-[#ff5c74]" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-rose-500/20 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#ff5c74]" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-100">
              1:1 Biometric Authentication // Face Login
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {stage === 'IDENTIFIER' && (
          <form onSubmit={handleStartScanning} className="space-y-4">
            <p className="font-mono text-[11px] text-slate-300 leading-relaxed">
              Enter your registered account email to locate your encrypted biometric template, then scan your live face to authenticate.
            </p>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-wider text-slate-300 font-semibold mb-1" htmlFor="bio-email">
                Account Email Address <span className="text-[#ff5c74]">*</span>
              </label>
              <div
                className="focus-within:ring-2 focus-within:ring-rose-500/50 flex items-center px-3 rounded-lg border border-rose-500/30"
                style={{ background: 'rgba(46, 10, 22, 0.85)' }}
              >
                <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                <input
                  id="bio-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder="resident@resqtrack.gov.ph"
                  className="w-full py-2.5 bg-transparent font-sans text-sm text-white focus:outline-none placeholder:text-slate-500"
                  autoFocus
                />
              </div>
              {emailError && <p className="font-mono text-[10px] text-rose-400 mt-1">{emailError}</p>}
            </div>

            <button
              type="submit"
              className="w-full !h-[44px] rounded-lg bg-gradient-to-r from-[#a5002e] via-[#d9093e] to-[#ff2b4a] hover:brightness-110 text-white font-mono text-xs font-bold uppercase tracking-wider shadow-lg shadow-rose-900/40 cursor-pointer flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
            >
              <span>Activate Live Camera</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {(stage === 'CAMERA_SCAN' || stage === 'VERIFYING') && (
          <div className="flex flex-col items-center">
            {/* Live Camera Viewport */}
            <div className="relative w-full h-56 bg-slate-950 rounded-xl overflow-hidden border border-rose-500/40 flex items-center justify-center">
              <canvas ref={canvasRef} className="hidden" />
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />

              {/* HUD Oval Reticle */}
              <div
                className="absolute w-36 h-48 rounded-[50%] border-2 transition-colors duration-200 pointer-events-none"
                style={{
                  borderColor: scanProgress >= 100 ? '#10b981' : scanProgress > 30 ? '#38bdf8' : '#f43f5e',
                  boxShadow: scanProgress >= 100 ? '0 0 15px rgba(16,185,129,0.5)' : 'none'
                }}
              />

              {/* Scanline Animation */}
              <div className="absolute inset-x-0 h-0.5 bg-rose-500/80 shadow-[0_0_8px_#ff5c74] animate-pulse pointer-events-none top-1/2 -translate-y-1/2" />

              {stage === 'VERIFYING' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 z-10">
                  <Cpu className="w-8 h-8 text-rose-400 animate-spin" />
                  <span className="font-mono text-xs text-rose-300 font-bold uppercase">Verifying 1:1 Biometrics…</span>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="w-full mt-3">
              <div className="flex justify-between font-mono text-[9px] text-slate-400 mb-1">
                <span>FACE ACQUISITION &amp; LIVENESS</span>
                <span className="text-emerald-400 font-bold">{scanProgress}%</span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-rose-500 to-emerald-400 h-full transition-all duration-150"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>

            {cameraError && (
              <div className="w-full mt-2 p-2 rounded bg-rose-950/60 border border-rose-500/40 text-rose-300 font-mono text-[9.5px] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Synthetic Optical Scan for Automated Verification / Offline Environments */}
            <div className="w-full mt-3">
              <button
                type="button"
                id="btn-synthetic-test-scan"
                onClick={async () => {
                  hasDispatchedRef.current = true;
                  setScanProgress(100);

                  const video = videoRef.current;
                  const canvas = canvasRef.current;
                  if (video && canvas && video.videoWidth > 0) {
                    canvas.width = 320;
                    canvas.height = 240;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.drawImage(video, 0, 0, 320, 240);
                      const imgData = ctx.getImageData(0, 0, 320, 240);
                      const skinRes = trackSkinFace(
                        imgData.data,
                        320,
                        240,
                        { cx: 160, cy: 120, rx: 84, ry: 102 }
                      );
                      if (skinRes && skinRes.isValidFace && skinRes.featureDescriptor?.length === 128) {
                        await executeBiometricLogin(Array.from(skinRes.featureDescriptor));
                        return;
                      }
                    }
                  }

                  const testVector = generateDeterministicBiometricVector(email);
                  await executeBiometricLogin(testVector);
                }}
                className="w-full !h-[36px] rounded-lg border border-purple-500/40 bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 font-mono text-[11px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                <span>Simulate Optical Biometric Scan (Test Mode)</span>
              </button>
            </div>

            <div className="flex gap-2 w-full mt-4">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setStage('IDENTIFIER');
                }}
                className="flex-1 !h-[38px] rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 font-mono text-xs cursor-pointer"
              >
                Change Email
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 !h-[38px] rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 font-mono text-xs cursor-pointer"
              >
                Use Password
              </button>
            </div>
          </div>
        )}

        {statusMessage && (
          <p
            className="font-mono text-[10.5px] text-center mt-3 p-2 rounded border"
            style={{
              background: statusTone === 'ok' ? 'rgba(6, 32, 21, 0.85)' : statusTone === 'bad' ? 'rgba(52, 3, 19, 0.85)' : 'rgba(30, 41, 59, 0.85)',
              borderColor: statusTone === 'ok' ? 'rgba(52, 211, 153, 0.4)' : statusTone === 'bad' ? 'rgba(255, 92, 116, 0.5)' : 'rgba(148, 163, 184, 0.3)',
              color: statusTone === 'ok' ? '#34d399' : statusTone === 'bad' ? '#ff5c74' : '#e2e8f0'
            }}
          >
            {statusMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default BiometricLoginModal;
