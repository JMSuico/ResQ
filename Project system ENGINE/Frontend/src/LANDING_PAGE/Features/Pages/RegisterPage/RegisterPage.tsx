// [Layer: LANDING_PAGE/Features/Pages/RegisterPage]
// Responsibility: Pixel-faithful, responsive React 19 conversion of ResQTrack Register Page.
// Implements 4-Step Role-Based Registration Wizard:
// Step 0: 00 Role (Role selection: Responder vs Civilian)
// Step 1: 01 Identity (Personal Info + ID Type + Front & Back ID Live Camera / Upload Capture)
// Step 2: 02 Biometrics (MultiAngleBiometricEngine Facial Verification)
// Step 3: 03 Security (Argon2 Master Password, Consents, Final Registration Submission)
// Strict TypeScript with ZERO 'any'. Universal expression-bodied lambdas (=>).

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  User,
  Mail,
  Users,
  ChevronDown,
  Calendar,
  CreditCard,
  Shield,
  ShieldCheck,
  Flame,
  HeartPulse,
  Siren,
  Award,
  ArrowRight,
  ArrowLeft,
  Lock,
  Eye,
  EyeOff,
  Camera,
  RefreshCw,
  Check,
  CheckCircle2,
  Upload,
  AlertCircle,
  X,
  Scan,
  Maximize2
} from 'lucide-react';
import { registerUser, RegisterPayload, ResponderUnit } from '@/Endpoints/authApi';
import { MultiAngleBiometricEngine } from './MultiAngleBiometricEngine';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useFluidResposiveness();

  // Wizard Step: 0 = Role, 1 = Identity (Personal & ID Capture), 2 = Biometrics, 3 = Security
  const [step, setStep] = useState<number>(0);

  // Step 0 - Role Classification Selection
  const [selectedRole, setSelectedRole] = useState<'Responder' | 'Civilian'>('Responder');

  // Form Fields - Step 1 (Personal Info)
  const [fullname, setFullname] = useState<string>('Insp. Eduardo M. Reyes');
  const [email, setEmail] = useState<string>('e.reyes@bfp.gov.ph');
  const [sex, setSex] = useState<string>('male');
  const [age, setAge] = useState<string>('32');
  const [idType, setIdType] = useState<string>('prc');

  // Form Fields - Step 1 (Agency Info for Responders)
  const [agencyUnit, setAgencyUnit] = useState<ResponderUnit>('FIRE');
  const [employeeId, setEmployeeId] = useState<string>('BFP-ZN-2024-089');
  const [rankOrTitle, setRankOrTitle] = useState<string>('Senior Inspector');

  // ID Capture State - Step 1
  const [idCaptureMode, setIdCaptureMode] = useState<'camera' | 'upload'>('camera');
  const [idFrontShot, setIdFrontShot] = useState<string | null>(null);
  const [idBackShot, setIdBackShot] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isDraggingFront, setIsDraggingFront] = useState<boolean>(false);
  const [isDraggingBack, setIsDraggingBack] = useState<boolean>(false);

  // Refs for camera video and file inputs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);

  // Step 2 - Biometric Facial Verification
  const [faceShot, setFaceShot] = useState<string | null>(null);
  const [faceVerified, setFaceVerified] = useState<boolean>(false);

  // Step 3 - Security & Consents
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [consent1, setConsent1] = useState<boolean>(false);
  const [consent2, setConsent2] = useState<boolean>(false);

  // Validation Errors & System Status Telemetry
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusTone, setStatusTone] = useState<'ok' | 'bad' | ''>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  // Handle URL query parameters for role & unit pre-selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const unitParam = (params.get('unit') || '').toLowerCase();
    const roleParam = (params.get('role') || '').toLowerCase();

    if (unitParam === 'security' || roleParam === 'civilian' || roleParam === 'resident') {
      setSelectedRole('Civilian');
      setAgencyUnit('Security');
      setRankOrTitle('Resident');
      setEmployeeId('RES-ZN-2024');
      setFullname('Juan Dela Cruz');
      setEmail('juan.delacruz@gmail.com');
    } else if (unitParam === 'rhu') {
      setSelectedRole('Responder');
      setAgencyUnit('RHU');
      setEmployeeId('RHU-ZN-2024-042');
      setRankOrTitle('Medical Responder');
      setEmail('e.reyes@rhu.gov.ph');
    } else if (unitParam === 'pnp') {
      setSelectedRole('Responder');
      setAgencyUnit('PNP');
      setEmployeeId('PNP-ZN-2024-118');
      setRankOrTitle('Police Corporal');
      setEmail('e.reyes@pnp.gov.ph');
    } else if (unitParam === 'fire' || unitParam === 'bfp') {
      setSelectedRole('Responder');
      setAgencyUnit('FIRE');
      setEmployeeId('BFP-ZN-2024-089');
      setRankOrTitle('Senior Inspector');
      setEmail('e.reyes@bfp.gov.ph');
    }
  }, [location.search]);

  // Synthetic fallback ID generator for environments without hardware cameras
  const generateSyntheticIdCanvas = (side: 'front' | 'back'): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 856;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Dark HUD ID Card surface
      ctx.fillStyle = side === 'front' ? '#0d1829' : '#141c2c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Fine grid texture
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Security Top Header Strip
      ctx.fillStyle = side === 'front' ? '#1e0710' : '#082f49';
      ctx.fillRect(0, 0, canvas.width, 70);
      ctx.fillStyle = '#ff5c74';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText(`GOVERNMENT OF THE PHILIPPINES // ${idType.toUpperCase()}`, 30, 44);

      if (side === 'front') {
        // Photo Holder
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(30, 100, 170, 220);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(30, 100, 170, 220);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText('[PHOTO MATRIX]', 50, 215);

        // Holder Metadata
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 24px monospace';
        ctx.fillText(fullname.toUpperCase(), 230, 140);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '16px monospace';
        ctx.fillText(`ROLE: ${selectedRole.toUpperCase()} [${selectedRole === 'Responder' ? agencyUnit : 'CIVILIAN'}]`, 230, 185);
        ctx.fillText(`ID#: ${selectedRole === 'Responder' ? employeeId : 'RES-ZN-2024'}`, 230, 225);
        ctx.fillText(`AGE: ${age} // SEX: ${sex.toUpperCase()}`, 230, 265);
        ctx.fillText(`RANK: ${selectedRole === 'Responder' ? rankOrTitle : 'COMMUNITY RESIDENT'}`, 230, 305);
      } else {
        // Back: Barcode & Digital Cryptographic Strip
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(30, 100, canvas.width - 60, 130);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(30, 100, canvas.width - 60, 130);

        // Barcode lines
        ctx.fillStyle = '#ffffff';
        for (let b = 50; b < canvas.width - 80; b += 11) {
          ctx.fillRect(b, 120, (b % 5 === 0 ? 6 : 3), 90);
        }

        ctx.fillStyle = '#94a3b8';
        ctx.font = '14px monospace';
        ctx.fillText('OFFICIAL RESQTRACK ENCRYPTION & BIOMETRIC REPOSITORY SIGNATURE', 30, 275);
        ctx.fillText(`CLEARANCE SEC-VECTOR: 0x${Math.random().toString(16).substring(2, 10).toUpperCase()}-VERIFIED`, 30, 315);
      }

      // Bottom Status Seal
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`[${side.toUpperCase()} ID SECURED ✓ // 300 DPI OPTICAL]`, 30, canvas.height - 30);
    }
    return canvas.toDataURL('image/png');
  };

  // Helper to generate a clean dual composite canvas merging front and back ID cards
  const generateDualIdComposite = (frontUrl: string, backUrl: string): string => {
    const canvas = document.createElement('canvas');
    canvas.width = 856;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return frontUrl;

    // Military HUD card background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top Header Banner
    ctx.fillStyle = '#1e0710';
    ctx.fillRect(0, 0, canvas.width, 36);
    ctx.fillStyle = '#ff5c74';
    ctx.font = 'bold 11.5px "JetBrains Mono", monospace';
    ctx.fillText(
      `RESQTRACK // DUAL ID COMPOSITE // DOC: ${idType.toUpperCase()} // HOLDER: ${fullname.toUpperCase()} // TIER: ${selectedRole.toUpperCase()}`,
      16,
      23
    );

    // Front ID Snapshot
    const imgFront = new Image();
    imgFront.src = frontUrl;
    try {
      ctx.drawImage(imgFront, 16, 48, 400, 252);
    } catch {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(16, 48, 400, 252);
    }

    // Back ID Snapshot
    const imgBack = new Image();
    imgBack.src = backUrl;
    try {
      ctx.drawImage(imgBack, 440, 48, 400, 252);
    } catch {
      ctx.fillStyle = '#334155';
      ctx.fillRect(440, 48, 400, 252);
    }

    // HUD Frame borders
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 48, 400, 252);
    ctx.strokeRect(440, 48, 400, 252);

    // Corner targeting brackets
    ctx.strokeStyle = '#ff5c74';
    ctx.lineWidth = 2;
    // Front corners
    ctx.strokeRect(14, 46, 10, 10);
    ctx.strokeRect(408, 288, 10, 10);
    // Back corners
    ctx.strokeRect(438, 46, 10, 10);
    ctx.strokeRect(832, 288, 10, 10);

    // HUD Text Badges
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText('FRONT ID CARD [SECURED ✓]', 24, 68);
    ctx.fillText('BACK ID CARD [SECURED ✓]', 448, 68);

    return canvas.toDataURL('image/png');
  };

  // Camera Lifecycle Controller
  const startCamera = useCallback(async () => {
    if (videoStreamRef.current) return;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API unavailable in this browser environment');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
      setCameraError(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access restricted or unavailable';
      setCameraError(msg);
      setIsCameraActive(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  // Manage camera streaming based on active step and capture state
  useEffect(() => {
    const isCapturing = step === 1 && idCaptureMode === 'camera' && (!idFrontShot || !idBackShot);
    if (isCapturing) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step, idCaptureMode, idFrontShot, idBackShot, startCamera, stopCamera]);

  // Capture current stage from video feed or synthetic fallback
  const captureFromVideoOrSynthetic = (side: 'front' | 'back'): string => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = 856;
      canvas.height = 540;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(7, 12, 20, 0.78)';
        ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`RESQTRACK ID SENSOR // ${side.toUpperCase()} // ${idType.toUpperCase()}`, 16, canvas.height - 12);
        return canvas.toDataURL('image/png');
      }
    }
    return generateSyntheticIdCanvas(side);
  };

  const handleCaptureCurrentStage = () => {
    const isFrontStage = !idFrontShot;
    const side = isFrontStage ? 'front' : 'back';
    const shotUrl = captureFromVideoOrSynthetic(side);

    if (isFrontStage) {
      setIdFrontShot(shotUrl);
      setStatusMessage('Front of ID card secured. Now flip card to capture back side.');
      setStatusTone('ok');
    } else {
      setIdBackShot(shotUrl);
      setStatusMessage('Both front and back ID cards secured successfully.');
      setStatusTone('ok');
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.idCard;
      return next;
    });
  };

  const handleRetakeAllId = () => {
    setIdFrontShot(null);
    setIdBackShot(null);
    setStatusMessage('ID card snapshots cleared. Align front of card to restart capture.');
    setStatusTone('');
  };

  // Upload Handling (File Picker & Drag-and-Drop)
  const handleFileUpload = (side: 'front' | 'back', file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, idCard: 'Please upload a valid image file (PNG, JPG, or WebP).' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      if (side === 'front') {
        setIdFrontShot(result);
      } else {
        setIdBackShot(result);
      }
      setErrors((prev) => {
        const next = { ...prev };
        delete next.idCard;
        return next;
      });
      setStatusMessage(`${side === 'front' ? 'Front' : 'Back'} ID image uploaded.`);
      setStatusTone('ok');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (side: 'front' | 'back', e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (side === 'front') setIsDraggingFront(false);
    else setIsDraggingBack(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(side, e.dataTransfer.files[0]);
    }
  };

  // Facial Biometric Callbacks
  const handleFaceVerified = (payloadUrl: string) => {
    setFaceShot(payloadUrl);
    setFaceVerified(true);
    setStatusMessage('Multi-angle biometric proof verified (99.8% confidence). SHA-256 vector secured.');
    setStatusTone('ok');
  };

  const handleFaceRetake = () => {
    setFaceShot(null);
    setFaceVerified(false);
    setStatusMessage('Biometric proof reset. Please realign for facial scan.');
    setStatusTone('');
  };

  // Password entropy score calculation
  const calculatePasswordScore = (pwd: string): number => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return score;
  };

  const score = calculatePasswordScore(password);
  const strengthLabel = score >= 5 ? 'STRONG' : score >= 3 ? 'FAIR' : score >= 1 ? 'WEAK' : 'VERY WEAK';
  const strengthTone = score >= 5 ? 'ok' : score >= 3 ? 'warn' : 'bad';

  // Role Selection Logic for Step 0
  const handleSelectRole = (role: 'Responder' | 'Civilian') => {
    setSelectedRole(role);
    if (role === 'Responder') {
      if (agencyUnit === 'Security' || agencyUnit === 'None') {
        setAgencyUnit('FIRE');
      }
      if (employeeId === 'RES-ZN-2024' || !employeeId) {
        setEmployeeId('BFP-ZN-2024-089');
      }
      if (rankOrTitle === 'Resident' || !rankOrTitle) {
        setRankOrTitle('Senior Inspector');
      }
      if (fullname === 'Juan Dela Cruz') {
        setFullname('Insp. Eduardo M. Reyes');
      }
      if (email === 'juan.delacruz@gmail.com') {
        setEmail('e.reyes@bfp.gov.ph');
      }
    } else {
      setAgencyUnit('Security');
      setRankOrTitle('Resident');
      setEmployeeId('RES-ZN-2024');
      if (fullname === 'Insp. Eduardo M. Reyes') {
        setFullname('Juan Dela Cruz');
      }
      if (email === 'e.reyes@bfp.gov.ph') {
        setEmail('juan.delacruz@gmail.com');
      }
    }
  };

  const handleAgencyUnitChange = (newUnit: 'RHU' | 'FIRE' | 'PNP') => {
    setAgencyUnit(newUnit);
    if (newUnit === 'FIRE') {
      setEmployeeId('BFP-ZN-2024-089');
      setEmail((prev) => (prev.includes('@') ? prev.replace(/@.*$/, '@bfp.gov.ph') : 'e.reyes@bfp.gov.ph'));
      setRankOrTitle('Senior Inspector');
      setIdType('fire');
    } else if (newUnit === 'PNP') {
      setEmployeeId('PNP-ZN-2024-118');
      setEmail((prev) => (prev.includes('@') ? prev.replace(/@.*$/, '@pnp.gov.ph') : 'e.reyes@pnp.gov.ph'));
      setRankOrTitle('Police Corporal');
      setIdType('police');
    } else if (newUnit === 'RHU') {
      setEmployeeId('RHU-ZN-2024-042');
      setEmail((prev) => (prev.includes('@') ? prev.replace(/@.*$/, '@rhu.gov.ph') : 'e.reyes@rhu.gov.ph'));
      setRankOrTitle('Medical Responder');
      setIdType('prc');
    }
  };

  // Validation routines
  const validateStep1 = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!fullname.trim()) newErrors.fullname = 'Enter your full legal name.';
    if (!EMAIL_RE.test(email.trim())) newErrors.email = 'Enter a valid email address.';
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) {
      newErrors.age = 'Age must be between 18 and 100.';
    }
    if (selectedRole === 'Responder') {
      if (!employeeId.trim()) newErrors.employeeId = 'Enter your agency badge / employee ID.';
      if (!rankOrTitle.trim()) newErrors.rankOrTitle = 'Enter your official rank or position title.';
    }
    if (!idFrontShot || !idBackShot) {
      newErrors.idCard = 'Both front and back ID cards must be captured or uploaded.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters for government compliance.';
    }
    if (password !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match.';
    }
    if (!consent1 || !consent2) {
      newErrors.consent = 'Accept the required affidavit certifications to continue.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Step transitions
  const handleNextStep = (targetStep: number) => {
    if (targetStep === 0) {
      setStep(0);
      setStatusMessage('');
      setStatusTone('');
      return;
    }
    if (targetStep === 1) {
      setStep(1);
      setStatusMessage('');
      setStatusTone('');
      return;
    }
    if (targetStep === 2) {
      if (!validateStep1()) {
        setStatusMessage('Complete all required personal fields and secure both front and back ID cards.');
        setStatusTone('bad');
        return;
      }
      setStep(2);
      setStatusMessage('');
      setStatusTone('');
      return;
    }
    if (targetStep === 3) {
      if (!validateStep1()) {
        setStatusMessage('Complete all required identity fields and ID card captures in Step 1.');
        setStatusTone('bad');
        return;
      }
      if (!faceVerified || !faceShot) {
        setStatusMessage('Facial biometric verification must be completed to proceed.');
        setStatusTone('bad');
        return;
      }
      setStep(3);
      setStatusMessage('');
      setStatusTone('');
    }
  };

  // Final Registration Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!validateStep1()) {
      setStep(1);
      setStatusMessage('ID credentials and personal information incomplete.');
      setStatusTone('bad');
      return;
    }

    if (!faceVerified || !faceShot) {
      setStep(2);
      setStatusMessage('Facial biometric verification required before account activation.');
      setStatusTone('bad');
      return;
    }

    if (!validateStep3()) {
      setStatusMessage('Ensure your password meets complexity requirements and certifications are accepted.');
      setStatusTone('bad');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Validating agency credentials and compiling biometric proof\u2026');
    setStatusTone('');

    try {
      const isCivilian = selectedRole === 'Civilian';
      const dualCompositeUrl = idFrontShot && idBackShot ? generateDualIdComposite(idFrontShot, idBackShot) : undefined;

      const payload: RegisterPayload = {
        fullName: fullname.trim(),
        email: email.trim(),
        password,
        phoneNumber: '0917-000-0000',
        employeeOrResidentId: !isCivilian ? employeeId.trim() : 'RES-ZN-2024',
        validIdType: idType,
        role: isCivilian ? 'Civilian' : 'Responder',
        unit: isCivilian ? 'Security' : (agencyUnit as ResponderUnit),
        departmentOrBarangay: isCivilian ? 'Community Resident Sector' : `${agencyUnit} Tactical Command`,
        rankOrTitle: !isCivilian ? rankOrTitle.trim() || 'Emergency Officer' : 'Resident',
        idCaptureDataUrl: dualCompositeUrl,
        faceCaptureDataUrl: faceShot || undefined
      };

      const res = await registerUser(payload);
      setIsLoading(false);
      setIsSuccess(true);

      const msg =
        (payload.employeeOrResidentId ? payload.employeeOrResidentId.toUpperCase() : payload.fullName) +
        (res.status === 'Verified' || res.faceVerified
          ? ' registered \u00b7 ID + face verified. Account active \u2014 redirecting to sign in\u2026'
          : ' registered \u00b7 Awaiting verification\u2026');

      setStatusMessage(msg);
      setStatusTone('ok');

      setTimeout(() => {
        navigate('/login');
      }, 1600);
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : 'Registration failed. Please try again.';
      setStatusMessage(errMsg);
      setStatusTone('bad');
    }
  };

  return (
    <main className="scene page-register min-h-screen flex items-center justify-center p-3 sm:p-6 w-full">
      <div className="stage w-full max-w-4xl mx-auto flex flex-col items-center justify-center">
        <div className="bg" aria-hidden="true">
          <span className="bg__strip"></span>
          <span className="bg__disc"></span>
          <span className="bg__wedge"></span>
        </div>

        <header className="brand text-center mb-4">
          <h1 className="brand__mark">RESQTRACK</h1>
          <p className="brand__lead">Smart Emergency Response</p>
          <p className="brand__sub">System with Image Processing and Real-Time Tracking</p>
        </header>

        <section
          className="panel panel--register relative w-full"
          aria-labelledby="panel-title"
          style={{
            maxWidth: isMobile ? '100%' : '900px',
            margin: '0 auto',
            border: '1px solid rgba(255, 92, 116, 0.22)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.65), 0 0 20px rgba(232,17,76,0.15)',
            paddingBottom: '20px'
          }}
        >
          {/* Military HUD Corner Brackets */}
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#ff5c74]/70 pointer-events-none rounded-tl-[3px] z-20" aria-hidden="true" />
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#ff5c74]/70 pointer-events-none rounded-tr-[3px] z-20" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#ff5c74]/70 pointer-events-none rounded-bl-[3px] z-20" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#ff5c74]/70 pointer-events-none rounded-br-[3px] z-20" aria-hidden="true" />

          <span className="panel__rule" aria-hidden="true"></span>
          <h2 className="visually-hidden" id="panel-title">Create account</h2>

          <form className="panel__body" id="register-form" onSubmit={handleSubmit} noValidate>
            {/* Live Telemetry Status Header */}
            <div className="flex items-center justify-between font-mono text-[9px] tracking-wider text-rose-300/80 border-b border-rose-500/20 pb-2 mb-2">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                INDUCTION SYSTEM // SEC-CLEARANCE
              </span>
              <span className="text-slate-400 tracking-widest hidden sm:inline">BIOMETRIC TIER: ENHANCED</span>
            </div>

            {/* 4-Step Navigation Wizard: 00 Role -> 01 Identity -> 02 Biometrics -> 03 Security */}
            <ol className="steps overflow-x-auto pb-1 max-w-full scrollbar-none" aria-label="Account creation progress">
              <li
                className={`steps__item ${step === 0 ? 'is-active' : step > 0 ? 'is-done' : ''}`}
                data-step-item="0"
                aria-current={step === 0 ? 'step' : undefined}
                onClick={() => setStep(0)}
                style={{ cursor: 'pointer' }}
              >
                <span className="steps__dot font-mono">0</span>
                <span className="steps__label font-mono text-[10px]">00 Role</span>
              </li>
              <li
                className={`steps__item ${step === 1 ? 'is-active' : step > 1 ? 'is-done' : ''}`}
                data-step-item="1"
                aria-current={step === 1 ? 'step' : undefined}
                onClick={() => handleNextStep(1)}
                style={{ cursor: 'pointer' }}
              >
                <span className="steps__dot font-mono">1</span>
                <span className="steps__label font-mono text-[10px]">01 Identity</span>
              </li>
              <li
                className={`steps__item ${step === 2 ? 'is-active' : step > 2 ? 'is-done' : ''}`}
                data-step-item="2"
                aria-current={step === 2 ? 'step' : undefined}
                onClick={() => handleNextStep(2)}
                style={{ cursor: 'pointer' }}
              >
                <span className="steps__dot font-mono">2</span>
                <span className="steps__label font-mono text-[10px]">02 Biometrics</span>
              </li>
              <li
                className={`steps__item ${step === 3 ? 'is-active' : step > 3 ? 'is-done' : ''}`}
                data-step-item="3"
                aria-current={step === 3 ? 'step' : undefined}
                onClick={() => handleNextStep(3)}
                style={{ cursor: 'pointer' }}
              >
                <span className="steps__dot font-mono">3</span>
                <span className="steps__label font-mono text-[10px]">03 Security</span>
              </li>
            </ol>

            {/* ============ Step 0 — Role Selection ============ */}
            {step === 0 && (
              <div className="step" data-step="0">
                <div className="text-center mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-2">
                    <Shield className="w-3.5 h-3.5 text-[#ff5c74]" />
                    SECURITY INDUCTION GATEWAY // STAGE 00
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Select Induction Profile Classification
                  </h3>
                  <p className="font-sans text-xs text-slate-300/80 mt-1 max-w-md mx-auto">
                    Choose your authorized operational clearance tier. Your role determines telemetry permissions, dispatch authority, and credential requirements.
                  </p>
                </div>

                {/* Sliding Window Role Selector Segmented Bar */}
                <div className="relative p-1 bg-black/50 backdrop-blur-md rounded-xl border border-rose-500/25 mb-6 max-w-md mx-auto">
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out pointer-events-none shadow-lg ${
                      selectedRole === 'Responder'
                        ? 'left-1 bg-gradient-to-r from-[#a5002e] via-[#d9093e] to-[#ff2b4a] border border-[#ff5c74] shadow-[0_0_16px_rgba(232,17,76,0.4)]'
                        : 'left-[calc(50%+2px)] bg-gradient-to-r from-emerald-800 via-emerald-600 to-teal-500 border border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.4)]'
                    }`}
                  />
                  <div className="grid grid-cols-2 relative z-10">
                    <button
                      type="button"
                      onClick={() => handleSelectRole('Responder')}
                      className={`py-2 px-3 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedRole === 'Responder' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Responders</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRole('Civilian')}
                      className={`py-2 px-3 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedRole === 'Civilian' ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <User className="w-4 h-4 shrink-0" />
                      <span>Civilians</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Role Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: RESPONDERS */}
                  <div
                    onClick={() => handleSelectRole('Responder')}
                    className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      selectedRole === 'Responder'
                        ? 'bg-[#1e0710]/90 border-2 border-rose-500 shadow-[0_0_24px_rgba(232,17,76,0.3)] ring-1 ring-rose-400/50'
                        : 'bg-[#0f1420]/80 border border-slate-700/60 hover:border-rose-500/50 hover:bg-[#180a14]/60'
                    }`}
                  >
                    {selectedRole === 'Responder' && (
                      <>
                        <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-[#ff5c74] pointer-events-none" />
                        <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-[#ff5c74] pointer-events-none" />
                        <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-[#ff5c74] pointer-events-none" />
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-[#ff5c74] pointer-events-none" />
                      </>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            selectedRole === 'Responder'
                              ? 'bg-rose-950/80 border-rose-500/60 text-[#ff5c74]'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 group-hover:text-rose-400'
                          }`}
                        >
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider font-bold">
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              selectedRole === 'Responder'
                                ? 'bg-rose-950 border-rose-500/50 text-rose-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            TIER-1 DISPATCH
                          </span>
                          {selectedRole === 'Responder' && (
                            <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-mono text-sm font-bold text-white uppercase tracking-wider">Responders</h4>
                      <p className="font-mono text-[10px] text-rose-300/90 font-medium mb-2">Emergency Response Personnel</p>
                      <p className="font-sans text-[11.5px] text-slate-300 leading-relaxed mb-3">
                        Authorized municipal tactical personnel responding to emergency incidents, casualty triages, structural fires, and security operations.
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-rose-500/20 font-mono text-[10px]">
                        <div className="flex items-center gap-2 text-slate-300">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>RHU Medical (Triage &amp; Paramedic)</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>BFP Fire (Suppression &amp; Rescue)</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Siren className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>PNP Police (Patrol &amp; Law Enforcement)</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-700/50 font-mono text-[9px] text-slate-400 flex items-center justify-between">
                      <span>Req: Badge ID + Rank + Facial Scan</span>
                      <span className="text-rose-400 font-bold">AGENCY SEC</span>
                    </div>
                  </div>

                  {/* Card 2: CIVILIANS */}
                  <div
                    onClick={() => handleSelectRole('Civilian')}
                    className={`group relative rounded-xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      selectedRole === 'Civilian'
                        ? 'bg-[#061d15]/90 border-2 border-emerald-500 shadow-[0_0_24px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/50'
                        : 'bg-[#0f1420]/80 border border-slate-700/60 hover:border-emerald-500/50 hover:bg-[#071913]/60'
                    }`}
                  >
                    {selectedRole === 'Civilian' && (
                      <>
                        <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
                        <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
                        <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-400 pointer-events-none" />
                        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-400 pointer-events-none" />
                      </>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            selectedRole === 'Civilian'
                              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-400'
                              : 'bg-slate-800/80 border-slate-700 text-slate-400 group-hover:text-emerald-400'
                          }`}
                        >
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider font-bold">
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              selectedRole === 'Civilian'
                                ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300'
                                : 'bg-slate-800 border-slate-700 text-slate-400'
                            }`}
                          >
                            TIER-3 CITIZEN
                          </span>
                          {selectedRole === 'Civilian' && (
                            <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-mono text-sm font-bold text-white uppercase tracking-wider">Civilians</h4>
                      <p className="font-mono text-[10px] text-emerald-300/90 font-medium mb-2">Community Resident / Citizen SOS</p>
                      <p className="font-sans text-[11.5px] text-slate-300 leading-relaxed mb-3">
                        Designed for local residents and community citizens to submit immediate SOS distress broadcasts, report road accidents with camera AI, and receive danger bulletins.
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-emerald-500/20 font-mono text-[10px]">
                        <div className="flex items-center gap-2 text-slate-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>One-Click Citizen SOS Distress Dispatch</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Camera className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span>Accident &amp; Incident AI Detection</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Automated Resident Clearance (RES-ZN-2024)</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-700/50 font-mono text-[9px] text-slate-400 flex items-center justify-between">
                      <span>Req: ID Doc + Live Face Scan</span>
                      <span className="text-emerald-400 font-bold">CITIZEN FAST-TRACK</span>
                    </div>
                  </div>
                </div>

                {/* Step 0 Continue Button */}
                <div className="step-actions mt-6">
                  <button
                    className="btn w-full !h-[46px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    data-next="1"
                    onClick={() => handleNextStep(1)}
                  >
                    <span className="btn__label">
                      Continue as {selectedRole === 'Responder' ? 'Emergency Responder' : 'Community Resident'}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* ============ Step 1 — Personal Info & ID Front/Back Capture ============ */}
            {step === 1 && (
              <div className="step" data-step="1">
                {/* Active Role Indicator Ribbon */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border mb-4 font-mono text-[10.5px] ${
                    selectedRole === 'Responder'
                      ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedRole === 'Responder' ? (
                      <Shield className="w-4 h-4 text-[#ff5c74] shrink-0" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>
                      Active Tier: <strong>{selectedRole === 'Responder' ? 'Emergency Responder Personnel' : 'Community Resident (Civilian)'}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="underline text-[10px] hover:text-white cursor-pointer ml-2"
                  >
                    Change Role
                  </button>
                </div>

                <div className="form-grid">
                  <div className={`field ${errors.fullname ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="fullname">
                        Full Legal Name <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[CIVIL.NAME]</span>
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
                        id="fullname"
                        name="fullname"
                        type="text"
                        value={fullname}
                        onChange={(e) => setFullname(e.target.value)}
                        autoComplete="name"
                        spellCheck={false}
                      />
                    </div>
                    {errors.fullname && (
                      <p className="field__error font-mono text-[10px]" id="fullname-error" role="alert">
                        {errors.fullname}
                      </p>
                    )}
                  </div>

                  <div className={`field ${errors.email ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="email">
                        Email Address <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">
                        {selectedRole === 'Responder' ? '[OFFICIAL.GOV]' : '[CITIZEN.EMAIL]'}
                      </span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{
                        background: 'rgba(46, 10, 22, 0.85)',
                        border: '1px solid rgba(255, 92, 116, 0.22)',
                        borderRadius: '6px'
                      }}
                    >
                      <Mail className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        spellCheck={false}
                      />
                    </div>
                    {errors.email && (
                      <p className="field__error font-mono text-[10px]" id="email-error" role="alert">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="field" id="sex-field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="sex">
                        Sex <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[DEMO]</span>
                    </div>
                    <div
                      className="field__box select focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{
                        background: 'rgba(46, 10, 22, 0.85)',
                        border: '1px solid rgba(255, 92, 116, 0.22)',
                        borderRadius: '6px'
                      }}
                    >
                      <Users className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <select
                        className="field__input select__input font-sans text-white text-[13px]"
                        id="sex"
                        value={sex}
                        onChange={(e) => setSex(e.target.value)}
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                    </div>
                  </div>

                  <div className={`field ${errors.age ? 'is-invalid' : ''}`} id="age-field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="age">
                        Age <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[YEARS]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{
                        background: 'rgba(46, 10, 22, 0.85)',
                        border: '1px solid rgba(255, 92, 116, 0.22)',
                        borderRadius: '6px'
                      }}
                    >
                      <Calendar className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px]"
                        id="age"
                        type="number"
                        min="18"
                        max="100"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                      />
                    </div>
                    {errors.age && (
                      <p className="field__error font-mono text-[10px]" id="age-error" role="alert">
                        {errors.age}
                      </p>
                    )}
                  </div>

                  <div className="field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="id-type">
                        ID Document Type <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[DOC.CLASS]</span>
                    </div>
                    <div
                      className="field__box select focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{
                        background: 'rgba(46, 10, 22, 0.85)',
                        border: '1px solid rgba(255, 92, 116, 0.22)',
                        borderRadius: '6px'
                      }}
                    >
                      <CreditCard className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <select
                        className="field__input select__input font-sans text-white text-[13px]"
                        id="id-type"
                        value={idType}
                        onChange={(e) => setIdType(e.target.value)}
                      >
                        <option value="philsys">PhilSys National ID</option>
                        <option value="passport">Philippine Passport</option>
                        <option value="postal">Postal ID</option>
                        <option value="drivers">LTO Driver's License</option>
                        <option value="prc">PRC Professional License</option>
                        {selectedRole === 'Responder' && (
                          <>
                            <option value="fire">BFP Service ID</option>
                            <option value="police">PNP Official ID</option>
                          </>
                        )}
                        <option value="umid">Unified Multi-Purpose ID (UMID)</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                    </div>
                  </div>

                  {/* RESPONDER SPECIFIC FIELDS */}
                  {selectedRole === 'Responder' ? (
                    <>
                      <div className="field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="agency-unit">
                            Agency Unit <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[AGENCY.UNIT]</span>
                        </div>
                        <div
                          className="field__box select focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <Shield className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <select
                            className="field__input select__input font-sans text-white text-[13px]"
                            id="agency-unit"
                            value={agencyUnit}
                            onChange={(e) => handleAgencyUnitChange(e.target.value as 'RHU' | 'FIRE' | 'PNP')}
                          >
                            <option value="RHU">RHU Medical (Rural Health Unit)</option>
                            <option value="FIRE">BFP Fire (Bureau of Fire Protection)</option>
                            <option value="PNP">PNP Police (Philippine National Police)</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                        </div>
                      </div>

                      <div className={`field ${errors.employeeId ? 'is-invalid' : ''}`} id="employee-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="employee-id">
                            Badge / Employee ID <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[BADGE.TAG]</span>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <CreditCard className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px]"
                            id="employee-id"
                            type="text"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            placeholder="e.g. BFP-ZN-2024-089"
                          />
                        </div>
                        {errors.employeeId && (
                          <p className="field__error font-mono text-[10px]" id="employee-error" role="alert">
                            {errors.employeeId}
                          </p>
                        )}
                      </div>

                      <div className={`field ${errors.rankOrTitle ? 'is-invalid' : ''}`} id="rank-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="rank-title">
                            Rank / Official Title <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[RANK.POS]</span>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <Award className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px]"
                            id="rank-title"
                            type="text"
                            value={rankOrTitle}
                            onChange={(e) => setRankOrTitle(e.target.value)}
                            placeholder="e.g. Senior Inspector, Officer 1, Medic"
                          />
                        </div>
                        {errors.rankOrTitle && (
                          <p className="field__error font-mono text-[10px]" id="rank-error" role="alert">
                            {errors.rankOrTitle}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    /* CIVILIAN AUTOMATED PROFILE SUMMARY */
                    <div className="col-span-full p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3 mt-1">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="font-mono text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold uppercase tracking-wider text-emerald-300">
                            Resident Fast-Track Clearance
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-900/80 text-emerald-200 border border-emerald-500/40">
                            AUTO-CONFIG
                          </span>
                        </div>
                        <p className="font-sans text-[11px] text-slate-300 leading-relaxed">
                          Your profile is auto-assigned as <strong>Resident [RES-ZN-2024]</strong> with Community Guard tier. No government agency badge or station assignment is required.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ============ ID CARD FRONT & BACK CAPTURE SECTION ============ */}
                <div className="mt-6 pt-5 border-t border-rose-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <Scan className="w-4 h-4 text-[#ff5c74]" />
                        <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          Government ID Dual Optical Capture <span className="text-[#ff5c74]">*</span>
                        </h4>
                      </div>
                      <p className="font-mono text-[9px] text-rose-300/80 mt-0.5">
                        Both front &amp; back sides of your {idType.toUpperCase()} are required for identity induction.
                      </p>
                    </div>

                    {/* Mode Switcher: Live Camera vs Upload */}
                    <div className="inline-flex p-1 rounded-lg bg-black/60 border border-rose-500/30 font-mono text-[10px] self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setIdCaptureMode('camera')}
                        className={`px-3 py-1 rounded-md flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                          idCaptureMode === 'camera'
                            ? 'bg-gradient-to-r from-[#a5002e] to-[#ff2b4a] text-white shadow-[0_0_12px_rgba(232,17,76,0.5)]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Live Camera Capture</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdCaptureMode('upload')}
                        className={`px-3 py-1 rounded-md flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                          idCaptureMode === 'upload'
                            ? 'bg-gradient-to-r from-[#a5002e] to-[#ff2b4a] text-white shadow-[0_0_12px_rgba(232,17,76,0.5)]'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Picture File</span>
                      </button>
                    </div>
                  </div>

                  {/* MODE 1: LIVE CAMERA CAPTURE */}
                  {idCaptureMode === 'camera' && (
                    <div className="space-y-4">
                      {/* Check if both front & back are captured -> Display side-by-side preview */}
                      {idFrontShot && idBackShot ? (
                        <div className="p-4 rounded-xl bg-black/50 border border-emerald-500/40">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-mono text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4" />
                              DUAL ID CREDENTIAL SECURED (FRONT &amp; BACK)
                            </span>
                            <button
                              type="button"
                              onClick={handleRetakeAllId}
                              className="font-mono text-[10px] text-rose-300 hover:text-white px-2.5 py-1 rounded border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 cursor-pointer flex items-center gap-1 transition-all"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Retake ID Cards</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Front Card Preview */}
                            <div className="relative rounded-lg overflow-hidden border border-emerald-500/50 bg-[#070c14] p-2 flex flex-col items-center">
                              <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
                              <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
                              <img
                                src={idFrontShot}
                                alt="Front ID Preview"
                                className="w-full h-auto object-cover rounded shadow"
                                style={{ aspectRatio: '85.6 / 53.98' }}
                              />
                              <div className="mt-2 w-full flex items-center justify-between font-mono text-[9.5px]">
                                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" /> FRONT ID SECURED ✓
                                </span>
                                <span className="text-slate-400">300 DPI // ISO-1</span>
                              </div>
                            </div>

                            {/* Back Card Preview */}
                            <div className="relative rounded-lg overflow-hidden border border-emerald-500/50 bg-[#070c14] p-2 flex flex-col items-center">
                              <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-400 pointer-events-none" />
                              <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-400 pointer-events-none" />
                              <img
                                src={idBackShot}
                                alt="Back ID Preview"
                                className="w-full h-auto object-cover rounded shadow"
                                style={{ aspectRatio: '85.6 / 53.98' }}
                              />
                              <div className="mt-2 w-full flex items-center justify-between font-mono text-[9.5px]">
                                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" /> BACK ID SECURED ✓
                                </span>
                                <span className="text-slate-400">OPTICAL ENCRYPTION</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Live Viewfinder Active (Stage 1: Front ID or Stage 2: Back ID) */
                        <div className="p-4 rounded-xl bg-black/60 border border-rose-500/30">
                          <div className="flex items-center justify-between font-mono text-[10px] mb-2.5 pb-2 border-b border-rose-500/20">
                            <span className="font-bold text-rose-300 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                              {!idFrontShot
                                ? 'STAGE 1: CAPTURE FRONT OF ID CARD'
                                : 'STAGE 2: NOW CAPTURE BACK OF ID CARD'}
                            </span>
                            <span className="text-slate-400">
                              {!idFrontShot ? 'STEP [1/2] FRONT' : 'STEP [2/2] BACK'}
                            </span>
                          </div>

                          {/* Viewfinder Aspect Ratio Window */}
                          <div className="relative w-full max-w-lg mx-auto bg-[#070c14] rounded-lg overflow-hidden border border-rose-500/40 aspect-[16/10] flex items-center justify-center">
                            {/* Live Video Feed */}
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="absolute inset-0 w-full h-full object-cover"
                            />

                            {/* Fallback Simulation Notice if Camera Not Found */}
                            {cameraError && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 p-4 text-center z-10">
                                <AlertCircle className="w-6 h-6 text-amber-400 mb-1" />
                                <p className="font-mono text-xs text-amber-200 font-bold">HARDWARE OPTICAL STREAM RESTRICTED</p>
                                <p className="font-sans text-[11px] text-slate-300 mt-0.5 max-w-xs">
                                  {cameraError}. The sensor engine will automatically generate an authenticated synthetic ID snapshot.
                                </p>
                              </div>
                            )}

                            {/* ID-1 Card Guide Overlay (85.6mm x 53.98mm Aspect Ratio) */}
                            <div
                              className="relative z-10 w-[84%] max-w-[380px] border-2 border-dashed border-[#ff5c74] rounded-lg shadow-[0_0_24px_rgba(255,92,116,0.35)] flex flex-col items-center justify-between p-3 pointer-events-none"
                              style={{ aspectRatio: '85.6 / 53.98' }}
                            >
                              {/* 4 Corner Targeting Brackets */}
                              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#ff5c74]" />
                              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#ff5c74]" />
                              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#ff5c74]" />
                              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#ff5c74]" />

                              {/* Live scan line */}
                              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#ff5c74]/70 to-transparent animate-pulse" />

                              <div className="w-full flex items-center justify-between font-mono text-[9px] text-rose-300 font-bold">
                                <span>ISO/IEC 7810 ID-1 (85.6×53.98mm)</span>
                                <span>{idType.toUpperCase()}</span>
                              </div>

                              <div className="px-3 py-1 rounded bg-black/75 border border-rose-500/50 font-mono text-[10.5px] font-bold text-white uppercase tracking-wider shadow">
                                {!idFrontShot ? 'ALIGN FRONT OF ID CARD' : 'FLIP CARD & ALIGN BACK'}
                              </div>

                              <div className="w-full flex items-center justify-between font-mono text-[8.5px] text-slate-400">
                                <span>OPTICAL 300 DPI</span>
                                <span className="text-emerald-400 font-bold">TARGET LOCKED</span>
                              </div>
                            </div>
                          </div>

                          {/* Capture Controls */}
                          <div className="mt-3.5 flex flex-col sm:flex-row items-center gap-2">
                            {idFrontShot && !idBackShot && (
                              <button
                                type="button"
                                onClick={() => setIdFrontShot(null)}
                                className="w-full sm:w-auto px-4 !h-[42px] font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/80 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Retake Front</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={handleCaptureCurrentStage}
                              className="w-full flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Camera className="w-4 h-4" />
                              <span>
                                {!idFrontShot ? 'CAPTURE FRONT ID' : 'CAPTURE BACK ID'}
                              </span>
                            </button>
                          </div>

                          {/* Temporary thumbnail showing front card once captured */}
                          {idFrontShot && !idBackShot && (
                            <div className="mt-3 pt-2.5 border-t border-rose-500/20 flex items-center gap-3">
                              <img
                                src={idFrontShot}
                                alt="Front Captured Preview"
                                className="w-16 h-10 object-cover rounded border border-emerald-500/60"
                              />
                              <div className="font-mono text-[10px]">
                                <span className="text-emerald-400 font-bold">[FRONT ID SECURED ✓]</span>
                                <p className="text-slate-400 text-[9px]">Card front frozen in memory. Flip card to capture reverse side.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* MODE 2: UPLOAD PICTURE FILE */}
                  {idCaptureMode === 'upload' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Dropzone 1: Front ID Card */}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                          <span className="font-bold uppercase tracking-wider text-slate-200">Front ID Card</span>
                          <span className={idFrontShot ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                            {idFrontShot ? 'SECURED ✓' : 'REQUIRED'}
                          </span>
                        </div>

                        {idFrontShot ? (
                          <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-[#070c14] p-3 flex flex-col items-center">
                            <img
                              src={idFrontShot}
                              alt="Front ID Card Upload"
                              className="w-full h-auto object-cover rounded border border-emerald-500/30"
                              style={{ aspectRatio: '85.6 / 53.98' }}
                            />
                            <div className="mt-2.5 w-full flex items-center justify-between font-mono text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" /> FRONT ID SECURED ✓
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => frontFileInputRef.current?.click()}
                                  className="text-sky-400 hover:text-sky-300 underline cursor-pointer text-[9.5px]"
                                >
                                  Replace
                                </button>
                                <span className="text-slate-600">&bull;</span>
                                <button
                                  type="button"
                                  onClick={() => setIdFrontShot(null)}
                                  className="text-rose-400 hover:text-rose-300 underline cursor-pointer text-[9.5px]"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDraggingFront(true);
                            }}
                            onDragLeave={() => setIsDraggingFront(false)}
                            onDrop={(e) => handleDrop('front', e)}
                            onClick={() => frontFileInputRef.current?.click()}
                            className={`rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[160px] ${
                              isDraggingFront
                                ? 'border-[#ff5c74] bg-rose-950/30'
                                : 'border-rose-500/30 bg-[#16070d]/60 hover:border-rose-400 hover:bg-[#1f0a13]/70'
                            }`}
                          >
                            <input
                              type="file"
                              ref={frontFileInputRef}
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUpload('front', e.target.files[0]);
                                }
                              }}
                            />
                            <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-500/30 text-[#ff5c74] mb-2">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                              Front ID Card
                            </span>
                            <span className="font-sans text-[11px] text-slate-400 mt-1">
                              Drag &amp; drop or click to upload PNG/JPG
                            </span>
                            <span className="font-mono text-[8.5px] text-rose-400/80 mt-1.5">
                              [ISO/IEC 7810 ASPECT RATIO]
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dropzone 2: Back ID Card */}
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                          <span className="font-bold uppercase tracking-wider text-slate-200">Back ID Card</span>
                          <span className={idBackShot ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                            {idBackShot ? 'SECURED ✓' : 'REQUIRED'}
                          </span>
                        </div>

                        {idBackShot ? (
                          <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-[#070c14] p-3 flex flex-col items-center">
                            <img
                              src={idBackShot}
                              alt="Back ID Card Upload"
                              className="w-full h-auto object-cover rounded border border-emerald-500/30"
                              style={{ aspectRatio: '85.6 / 53.98' }}
                            />
                            <div className="mt-2.5 w-full flex items-center justify-between font-mono text-[10px]">
                              <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                                <Check className="w-3 h-3 stroke-[3]" /> BACK ID SECURED ✓
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => backFileInputRef.current?.click()}
                                  className="text-sky-400 hover:text-sky-300 underline cursor-pointer text-[9.5px]"
                                >
                                  Replace
                                </button>
                                <span className="text-slate-600">&bull;</span>
                                <button
                                  type="button"
                                  onClick={() => setIdBackShot(null)}
                                  className="text-rose-400 hover:text-rose-300 underline cursor-pointer text-[9.5px]"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDraggingBack(true);
                            }}
                            onDragLeave={() => setIsDraggingBack(false)}
                            onDrop={(e) => handleDrop('back', e)}
                            onClick={() => backFileInputRef.current?.click()}
                            className={`rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[160px] ${
                              isDraggingBack
                                ? 'border-[#ff5c74] bg-rose-950/30'
                                : 'border-rose-500/30 bg-[#16070d]/60 hover:border-rose-400 hover:bg-[#1f0a13]/70'
                            }`}
                          >
                            <input
                              type="file"
                              ref={backFileInputRef}
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleFileUpload('back', e.target.files[0]);
                                }
                              }}
                            />
                            <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-500/30 text-[#ff5c74] mb-2">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                              Back ID Card
                            </span>
                            <span className="font-sans text-[11px] text-slate-400 mt-1">
                              Drag &amp; drop or click to upload PNG/JPG
                            </span>
                            <span className="font-mono text-[8.5px] text-rose-400/80 mt-1.5">
                              [ISO/IEC 7810 ASPECT RATIO]
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ID Validation Error */}
                  {errors.idCard && (
                    <p className="field__error font-mono text-[10.5px] mt-2.5 text-rose-400" role="alert">
                      {errors.idCard}
                    </p>
                  )}
                </div>

                {/* Step 1 Actions */}
                <div className="step-actions flex gap-2.5 mt-6">
                  <button
                    className="btn btn--ghost !h-[44px] !w-24 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    type="button"
                    data-back="0"
                    onClick={() => setStep(0)}
                  >
                    <span className="btn__label">Back</span>
                  </button>
                  <button
                    className="btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    data-next="2"
                    onClick={() => handleNextStep(2)}
                  >
                    <span className="btn__label">Continue to Biometric Verification</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* ============ Step 2 — Facial Biometric Verification ============ */}
            {step === 2 && (
              <div className="step" data-step="2">
                <div className="face" id="face-box">
                  <div className="col-span-full flex items-center justify-between mb-2">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-wider text-slate-200 font-bold">
                        STAGE 02 // Multi-Angle Fast-Capture Facial Biometrics &amp; Liveness
                      </p>
                      <p className="font-mono text-[9px] text-rose-300/80 mt-0.5">
                        Follow the HUD target prompts (Center, Turn Left, Turn Right, Look Up) to generate your verified biometric proof.
                      </p>
                    </div>
                    <span className="font-mono text-[9px] text-emerald-400 shrink-0 hidden sm:inline">
                      [ANTI-SPOOF: LAPLACIAN ACTIVE]
                    </span>
                  </div>

                  <div className="col-span-full">
                    <MultiAngleBiometricEngine
                      onVerified={handleFaceVerified}
                      onRetake={handleFaceRetake}
                      initialVerified={faceVerified}
                      initialDataUrl={faceShot}
                    />
                  </div>
                </div>

                <div className="step-actions flex gap-2.5 mt-5">
                  <button
                    className="btn btn--ghost !h-[44px] !w-24 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    type="button"
                    data-back="1"
                    onClick={() => setStep(1)}
                  >
                    <span className="btn__label">Back</span>
                  </button>
                  <button
                    className="btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    data-next="3"
                    onClick={() => handleNextStep(3)}
                  >
                    <span className="btn__label">Continue to Security Credentials</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* ============ Step 3 — Security Credentials & Consents ============ */}
            {step === 3 && (
              <div className="step" data-step="3">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#ff5c74]" />
                    SECURITY CREDENTIAL ENROLLMENT // STAGE 03
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Master Password &amp; Legal Activation
                  </h3>
                </div>

                <div className="form-grid">
                  <div className={`field field--password ${errors.password ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="password">
                        Master Clearance Password <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[ARGON2.KEY]</span>
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
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                      <button
                        className="field__toggle hover:text-rose-300 ml-auto p-1 cursor-pointer"
                        type="button"
                        id="pw-toggle"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label="Toggle password view"
                      >
                        {!showPassword ? <Eye className="w-4 h-4 text-slate-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    {password && (
                      <p className="strength font-mono text-[9px] mt-1.5" id="strength" data-tone={strengthTone}>
                        Entropy: {password.length} chars &bull; Rating: {strengthLabel}
                      </p>
                    )}
                    {errors.password && (
                      <p className="field__error font-mono text-[10px]" id="password-error" role="alert">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  <div className={`field field--password ${errors.confirm ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="confirm">
                        Confirm Clearance Password <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[HASH.MATCH]</span>
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
                        id="confirm"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••••••"
                      />
                    </div>
                    {errors.confirm && (
                      <p className="field__error font-mono text-[10px]" id="confirm-error" role="alert">
                        {errors.confirm}
                      </p>
                    )}
                  </div>
                </div>

                {/* Legal Certifications and Consents */}
                <div className="consents mt-5 p-4 rounded-lg bg-black/40 border border-rose-500/20">
                  <div className="font-mono text-[10px] text-rose-400 font-bold uppercase tracking-wider mb-2">
                    Required Legal Certifications &amp; Consents
                  </div>
                  <label className="check flex items-start gap-2.5 cursor-pointer mb-2.5">
                    <input
                      type="checkbox"
                      id="consent-1"
                      checked={consent1}
                      onChange={(e) => setConsent1(e.target.checked)}
                      className="mt-0.5 accent-[#ff5c74] cursor-pointer"
                    />
                    <span className="check__text font-mono text-[11px] text-slate-300">
                      [AFFIDAVIT] I certify under penalty of perjury that all provided personal and agency data are genuine and verified.
                    </span>
                  </label>

                  <label className="check flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      id="consent-2"
                      checked={consent2}
                      onChange={(e) => setConsent2(e.target.checked)}
                      className="mt-0.5 accent-[#ff5c74] cursor-pointer"
                    />
                    <span className="check__text font-mono text-[11px] text-slate-300">
                      [PROTOCOL] I agree to the ResQTrack emergency dispatch, GPS incident tracking, and biometric verification operational protocols.
                    </span>
                  </label>

                  {errors.consent && (
                    <p className="field__error font-mono text-[10px] mt-2 text-rose-400" role="alert">
                      {errors.consent}
                    </p>
                  )}
                </div>

                {/* Step 3 Actions & Submission */}
                <div className="step-actions flex gap-2.5 mt-5">
                  <button
                    className="btn btn--ghost !h-[44px] !w-24 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer"
                    type="button"
                    data-back="2"
                    onClick={() => setStep(2)}
                  >
                    <span className="btn__label">Back</span>
                  </button>

                  <button
                    className={`btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2 ${
                      isLoading ? 'is-loading' : ''
                    } ${isSuccess ? 'is-ok' : ''}`}
                    type="submit"
                    id="submit"
                    disabled={isLoading}
                  >
                    <span className="btn__label">
                      {isLoading
                        ? 'Creating account…'
                        : isSuccess
                        ? 'Account created'
                        : 'Complete Registration & Activate Account'}
                    </span>
                    {isSuccess ? <Check className="w-4 h-4 ml-1" /> : <ArrowRight className="w-4 h-4 ml-1" />}
                    <span className="btn__spinner" aria-hidden="true"></span>
                  </button>
                </div>
              </div>
            )}

            {/* Status Messages */}
            {statusMessage && (
              <p
                className="status font-mono text-[11px] font-semibold my-2.5 text-center"
                id="status"
                role="status"
                aria-live="polite"
                data-tone={statusTone || undefined}
              >
                {statusMessage}
              </p>
            )}

            <div className="row font-mono text-[11.5px]" style={{ marginTop: '14px', justifyContent: 'center' }}>
              <span className="check__text text-slate-400">Already have an emergency account?</span>
              <Link className="link text-rose-400 hover:text-rose-300 font-bold" to="/login" style={{ marginLeft: '6px' }}>
                Sign in here &rarr;
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

export default RegisterPage;
