// [Layer: LANDING_PAGE/Features/Pages/RegisterPage]
// Responsibility: 6-Phase Manual Registration Wizard for ResQTrack backed by the backend Strategy & Decorator Pattern verification architecture.
// Implements the exact 6-Phase Manual Registration Sequence:
//   Phase 1 (step 0): Role Selection (Responder [RHU/FIRE/PNP] vs Civilian; prevents self-assignment of privileged LDRRMO_Admin)
//   Phase 2 (step 1): Personal Information (100% manual input: First Name, Middle Name, Surname, Suffix, Sex, DOB, Age, Contact Number, Province, City/Municipality, Barangay, Street/Purok, Role fields — ZERO OCR, ZERO auto-population)
//   Phase 3 (step 2): Government ID Upload (Manual ID type selection, Front & Back image upload, preview, replace, remove, file size/extension/magic-byte/dimension validation — ZERO OCR, ZERO auto-detection)
//   Phase 4 (step 3): Facial Record (Camera permission request, live preview, capture photograph, preview captured image, retake, confirm capture, privacy consent — ZERO automatic facial recognition or matching)
//   Phase 5 (step 4): Account Credentials (DisplayName for UI display only, Email as sole login identifier, Password, ConfirmPassword, Eye icon & Show Password visibility toggle)
//   Phase 6 (step 5): Review & Registration Submission (Complete summary of Phases 1–5, backward Edit navigation, never displays password, submits to POST /api/register with PendingReview status)
// Strict TypeScript with ZERO 'any', ZERO emojis, and universal arrow lambdas (=>).

import React, { useState, useRef, useEffect } from 'react';
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
  MapPin,
  Phone,
  FileCheck,
  Edit3,
  AlertCircle,
  Cpu
} from 'lucide-react';
import { registerUser, RegisterPayload, ResponderUnit } from '@/Endpoints/authApi';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';
import { ManualFacialCapturePanel } from './ManualFacialCapturePanel';
import { generateDeterministicBiometricVector } from '@/Libs/Cache/biometricFrameCache';

interface GovernmentIdOption {
  value: string;
  label: string;
  responderOnly?: boolean;
}

const GOVERNMENT_ID_OPTIONS: GovernmentIdOption[] = [
  { value: 'philsys', label: 'PhilSys National ID (ePhilID / National ID)' },
  { value: 'drivers', label: "LTO Driver's License" },
  { value: 'passport', label: 'Philippine Passport (DFA)' },
  { value: 'umid', label: 'UMID (Unified Multi-Purpose ID)' },
  { value: 'prc', label: 'PRC Professional Regulation Commission ID' },
  { value: 'postal', label: 'PHLPost Postal ID' },
  { value: 'voters', label: "COMELEC Voter's ID / Certification" },
  { value: 'pwd', label: 'NCDA Person With Disability (PWD) ID' },
  { value: 'senior', label: 'OSCA Senior Citizen ID' },
  { value: 'fire', label: 'BFP Official Agency Badge / ID', responderOnly: true },
  { value: 'police', label: 'PNP Official Agency Badge / ID', responderOnly: true },
  { value: 'rhu', label: 'RHU / DOH Medical Personnel ID', responderOnly: true }
];

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_IMAGE_DIM = 64;
const MAX_IMAGE_DIM = 8192;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useFluidResposiveness();

  // 6-Phase Wizard Step State:
  // 0 = Phase 1: Role Selection
  // 1 = Phase 2: Personal Information
  // 2 = Phase 3: Government ID Upload
  // 3 = Phase 4: Facial Record
  // 4 = Phase 5: Account Credentials
  // 5 = Phase 6: Review & Submission
  const [step, setStep] = useState<number>(0);

  // ============ Phase 1: Role Selection ============
  const [selectedRole, setSelectedRole] = useState<'Responder' | 'Civilian'>('Responder');
  const [agencyUnit, setAgencyUnit] = useState<ResponderUnit>('FIRE');

  // ============ Phase 2: Personal Information (100% Manual Input) ============
  const [firstName, setFirstName] = useState<string>('');
  const [middleName, setMiddleName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [suffix, setSuffix] = useState<string>('');
  const [sex, setSex] = useState<string>('Male');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [province, setProvince] = useState<string>('Zamboanga del Norte');
  const [cityOrMunicipality, setCityOrMunicipality] = useState<string>('Katipunan');
  const [barangay, setBarangay] = useState<string>('');
  const [streetOrPurok, setStreetOrPurok] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [rankOrTitle, setRankOrTitle] = useState<string>('');

  const fullname = [firstName.trim(), middleName.trim(), lastName.trim(), suffix.trim()]
    .filter(Boolean)
    .join(' ');

  const fullAddressPreview = [streetOrPurok.trim(), barangay.trim(), cityOrMunicipality.trim(), province.trim()]
    .filter(Boolean)
    .join(', ');

  // ============ Phase 3: Government ID Upload (Manual Selection & Encrypted Storage Only) ============
  const [idType, setIdType] = useState<string>('philsys');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [idFrontShot, setIdFrontShot] = useState<string | null>(null);
  const [idBackShot, setIdBackShot] = useState<string | null>(null);
  const [idFrontMeta, setIdFrontMeta] = useState<{ name: string; width: number; height: number; sizeBytes: number } | null>(null);
  const [idBackMeta, setIdBackMeta] = useState<{ name: string; width: number; height: number; sizeBytes: number } | null>(null);
  const [isDraggingFront, setIsDraggingFront] = useState<boolean>(false);
  const [isDraggingBack, setIsDraggingBack] = useState<boolean>(false);

  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);

  // ============ Phase 4: Facial Record (Manual Capture & Review Only) ============
  const [faceShot, setFaceShot] = useState<string | null>(null);
  const [faceConfirmed, setFaceConfirmed] = useState<boolean>(false);
  const [faceConsentAccepted, setFaceConsentAccepted] = useState<boolean>(false);
  const [faceMeta, setFaceMeta] = useState<{ width: number; height: number; byteSize: number; metadata?: { hasTrackedRealFace?: boolean } } | null>(null);
  const [biometricDescriptorVector, setBiometricDescriptorVector] = useState<number[] | null>(null);

  // ============ Phase 5: Account Credentials ============
  const [displayName, setDisplayName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [consent1, setConsent1] = useState<boolean>(false);
  const [consent2, setConsent2] = useState<boolean>(false);

  // ============ Validation & Submission Telemetry ============
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusTone, setStatusTone] = useState<'ok' | 'bad' | ''>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  // Handle URL query parameters for role & unit pre-selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const unitParam = (params.get('unit') || '').toLowerCase();
    const roleParam = (params.get('role') || '').toLowerCase();
    const stepParam = params.get('step');
    if (stepParam && !isNaN(Number(stepParam))) {
      const parsedStep = Number(stepParam);
      if (parsedStep >= 0 && parsedStep <= 5) {
        setStep(parsedStep);
      }
    }

    if (unitParam === 'security' || roleParam === 'civilian' || roleParam === 'resident') {
      setSelectedRole('Civilian');
      setAgencyUnit('Security');
      setRankOrTitle('Resident');
      setEmployeeId('RES-ZN-2026');
    } else if (unitParam === 'rhu') {
      setSelectedRole('Responder');
      setAgencyUnit('RHU');
      setRankOrTitle('Medical Responder');
      setIdType('prc');
    } else if (unitParam === 'pnp') {
      setSelectedRole('Responder');
      setAgencyUnit('PNP');
      setRankOrTitle('Police Corporal');
      setIdType('police');
    } else if (unitParam === 'fire' || unitParam === 'bfp') {
      setSelectedRole('Responder');
      setAgencyUnit('FIRE');
      setRankOrTitle('Senior Inspector');
      setIdType('fire');
    }
  }, [location.search]);

  // Helper to compute age from manually entered Date of Birth
  const computeAgeFromDob = (dob?: string): string | null => {
    if (!dob) return null;
    const clean = dob.trim();
    const m = clean.match(/^(\d{4})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])$/);
    if (m) {
      const birthYear = parseInt(m[1], 10);
      const birthMonth = parseInt(m[2], 10) - 1;
      const birthDay = parseInt(m[3], 10);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthYear;
      if (
        today.getMonth() < birthMonth ||
        (today.getMonth() === birthMonth && today.getDate() < birthDay)
      ) {
        calculatedAge--;
      }
      if (calculatedAge >= 18 && calculatedAge <= 100) {
        return String(calculatedAge);
      }
    }
    return null;
  };

  // Validate magic bytes for PNG, JPEG, and WebP
  const hasAuthenticImageMagicBytes = (bytes: Uint8Array): boolean => {
    if (bytes.length < 12) return false;
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    return isPng || isJpeg || isWebp;
  };

  // Phase 3 Manual Government ID File Upload Handler (Strict Validation Only — ZERO OCR / ZERO Auto-Fill)
  const handleFileUpload = (side: 'front' | 'back', file: File): void => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next.idCard;
      return next;
    });
    setStatusMessage('');
    setStatusTone('');

    if (file.size === 0) {
      setErrors((prev) => ({ ...prev, idCard: `Selected ${side.toUpperCase()} ID file is empty (0 bytes).` }));
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setErrors((prev) => ({
        ...prev,
        idCard: `${side.toUpperCase()} ID image exceeds the maximum allowed file size of 5 MB.`
      }));
      return;
    }

    const lowerName = file.name.toLowerCase();
    const validExt = ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => lowerName.endsWith(ext));
    const validMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type.toLowerCase());
    if (!validExt || !validMime) {
      setErrors((prev) => ({
        ...prev,
        idCard: `Unsupported file type for ${side.toUpperCase()} ID. Only PNG, JPG, JPEG, and WebP images are permitted.`
      }));
      return;
    }

    const headerReader = new FileReader();
    headerReader.onload = () => {
      const headerBuffer = headerReader.result as ArrayBuffer;
      const headerBytes = new Uint8Array(headerBuffer);
      if (!hasAuthenticImageMagicBytes(headerBytes)) {
        setErrors((prev) => ({
          ...prev,
          idCard: `${side.toUpperCase()} ID file failed magic-byte content validation. Please upload a genuine PNG, JPEG, or WebP image.`
        }));
        return;
      }

      const dataUrlReader = new FileReader();
      dataUrlReader.onload = () => {
        const resultDataUrl = typeof dataUrlReader.result === 'string' ? dataUrlReader.result : '';
        if (!resultDataUrl) {
          setErrors((prev) => ({ ...prev, idCard: `Unable to read ${side.toUpperCase()} ID image file.` }));
          return;
        }

        const img = new Image();
        img.onload = () => {
          if (
            img.naturalWidth < MIN_IMAGE_DIM ||
            img.naturalHeight < MIN_IMAGE_DIM ||
            img.naturalWidth > MAX_IMAGE_DIM ||
            img.naturalHeight > MAX_IMAGE_DIM
          ) {
            setErrors((prev) => ({
              ...prev,
              idCard: `${side.toUpperCase()} ID image dimensions (${img.naturalWidth}x${img.naturalHeight}px) must be between ${MIN_IMAGE_DIM}x${MIN_IMAGE_DIM}px and ${MAX_IMAGE_DIM}x${MAX_IMAGE_DIM}px.`
            }));
            return;
          }

          const meta = {
            name: file.name,
            width: img.naturalWidth,
            height: img.naturalHeight,
            sizeBytes: file.size
          };

          if (side === 'front') {
            setIdFrontShot(resultDataUrl);
            setIdFrontMeta(meta);
          } else {
            setIdBackShot(resultDataUrl);
            setIdBackMeta(meta);
          }
        };
        img.onerror = () => {
          setErrors((prev) => ({
            ...prev,
            idCard: `Unable to decode ${side.toUpperCase()} ID image file.`
          }));
        };
        img.src = resultDataUrl;
      };
      dataUrlReader.readAsDataURL(file);
    };
    headerReader.readAsArrayBuffer(file.slice(0, 32));
  };

  const handleDrop = (side: 'front' | 'back', e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (side === 'front') setIsDraggingFront(false);
    else setIsDraggingBack(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(side, e.dataTransfer.files[0]);
    }
  };

  const handleClearBothIds = (): void => {
    setIdFrontShot(null);
    setIdBackShot(null);
    setIdFrontMeta(null);
    setIdBackMeta(null);
  };

  // Role Selection Logic for Phase 1
  const handleSelectRole = (role: 'Responder' | 'Civilian'): void => {
    setSelectedRole(role);
    if (role === 'Responder') {
      if (agencyUnit === 'Security' || agencyUnit === 'None') {
        setAgencyUnit('FIRE');
      }
      if (rankOrTitle === 'Resident') {
        setRankOrTitle('');
      }
      if (employeeId === 'RES-ZN-2026') {
        setEmployeeId('');
      }
    } else {
      setAgencyUnit('Security');
      if (!rankOrTitle) setRankOrTitle('Resident');
      if (!employeeId) setEmployeeId('RES-ZN-2026');
      if (['fire', 'police', 'rhu'].includes(idType)) {
        setIdType('philsys');
      }
    }
  };

  const handleAgencyUnitChange = (newUnit: 'RHU' | 'FIRE' | 'PNP'): void => {
    setAgencyUnit(newUnit);
    if (newUnit === 'FIRE') setIdType('fire');
    else if (newUnit === 'PNP') setIdType('police');
    else if (newUnit === 'RHU') setIdType('prc');
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

  // ============ Per-Phase Validation Routines ============
  const validatePhase1Role = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (selectedRole !== 'Responder' && selectedRole !== 'Civilian') {
      newErrors.role = 'Please select an authorized registration role.';
    }
    if (selectedRole === 'Responder' && !['RHU', 'FIRE', 'PNP'].includes(agencyUnit)) {
      newErrors.unit = 'Please select a valid Responder Agency Unit (RHU, BFP Fire, or PNP Police).';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhase2PersonalInfo = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!firstName.trim()) newErrors.firstName = 'First Name is required.';
    if (!lastName.trim()) newErrors.lastName = 'Last Name / Surname is required.';
    if (!sex.trim()) newErrors.sex = 'Sex is required.';
    if (!dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of Birth is required.';
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) {
      newErrors.age = 'Age must be between 18 and 100.';
    }
    if (!phoneNumber.trim()) newErrors.phoneNumber = 'Contact Number is required.';
    if (!province.trim()) newErrors.province = 'Province is required.';
    if (!cityOrMunicipality.trim()) newErrors.cityOrMunicipality = 'City / Municipality is required.';
    if (!barangay.trim()) newErrors.barangay = 'Barangay is required.';
    if (!streetOrPurok.trim()) newErrors.streetOrPurok = 'Street / Purok is required.';

    if (selectedRole === 'Responder') {
      if (!employeeId.trim()) newErrors.employeeId = 'Agency Badge / Employee ID is required for Responders.';
      if (!rankOrTitle.trim()) newErrors.rankOrTitle = 'Official Rank or Title is required for Responders.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhase3IdUpload = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!idType.trim()) {
      newErrors.idType = 'Please select a Government ID document type.';
    }
    if (!idFrontShot || !idBackShot) {
      newErrors.idCard = 'Both Front and Back Government ID images must be uploaded before proceeding.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhase4FacialRecord = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!faceShot || !faceConfirmed) {
      newErrors.facial = 'Please capture and confirm your facial photograph to proceed.';
    }
    if (!faceConsentAccepted) {
      newErrors.facialConsent = 'Explicit biometric & privacy consent must be accepted.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhase5Credentials = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!displayName.trim() || displayName.trim().length < 2) {
      newErrors.displayName = 'Enter a Display Name / Username (at least 2 characters, used for UI display only).';
    }
    if (!EMAIL_RE.test(email.trim())) {
      newErrors.email = 'Enter a valid email address (used as your sole login identifier).';
    }
    if (password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters long.';
    }
    if (password !== confirmPassword) {
      newErrors.confirm = 'Password and Confirm Password do not match.';
    }
    if (!consent1 || !consent2) {
      newErrors.consent = 'Please accept both legal certifications to proceed to final review.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigate to target phase with validation guards on forward transitions
  const handleNavigatePhase = (targetPhase: number): void => {
    setStatusMessage('');
    setStatusTone('');

    // Backward navigation is always permitted so users can edit previous phases freely
    if (targetPhase <= step) {
      setStep(targetPhase);
      return;
    }

    if (targetPhase >= 1 && !validatePhase1Role()) {
      setStep(0);
      setStatusMessage('Please complete Phase 1: Role Selection.');
      setStatusTone('bad');
      return;
    }
    if (targetPhase >= 2 && !validatePhase2PersonalInfo()) {
      setStep(1);
      setStatusMessage('Please complete all required fields in Phase 2: Personal Information.');
      setStatusTone('bad');
      return;
    }
    if (targetPhase >= 3 && !validatePhase3IdUpload()) {
      setStep(2);
      setStatusMessage('Please select your ID type and upload both Front and Back Government ID images in Phase 3.');
      setStatusTone('bad');
      return;
    }
    if (targetPhase >= 4 && !validatePhase4FacialRecord()) {
      setStep(3);
      setStatusMessage('Please capture, confirm your facial photograph, and accept the privacy consent in Phase 4.');
      setStatusTone('bad');
      return;
    }
    if (targetPhase >= 5 && !validatePhase5Credentials()) {
      setStep(4);
      setStatusMessage('Please complete your Display Name, Email, Password, and legal certifications in Phase 5.');
      setStatusTone('bad');
      return;
    }

    // Default DisplayName convenience initialization when entering Phase 5 if still empty
    if (targetPhase === 4 && !displayName.trim() && firstName.trim()) {
      setDisplayName(`${firstName.trim()} ${lastName.trim()}`.trim());
    }

    setStep(targetPhase);
  };

  // Phase 6: Final Registration Submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isLoading) return;

    if (!validatePhase1Role()) {
      setStep(0);
      setStatusMessage('Role selection is incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase2PersonalInfo()) {
      setStep(1);
      setStatusMessage('Personal information in Phase 2 is incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase3IdUpload()) {
      setStep(2);
      setStatusMessage('Government ID uploads in Phase 3 are incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase4FacialRecord()) {
      setStep(3);
      setStatusMessage('Facial record capture and consent in Phase 4 are incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase5Credentials()) {
      setStep(4);
      setStatusMessage('Account credentials in Phase 5 are incomplete.');
      setStatusTone('bad');
      return;
    }

    setIsLoading(true);
    setStatusMessage('Encrypting identity documents and submitting registration for manual administrative review...');
    setStatusTone('');

    try {
      const isCivilian = selectedRole === 'Civilian';
      const payload: RegisterPayload = {
        role: isCivilian ? 'Civilian' : 'Responder',
        unit: isCivilian ? 'Security' : (agencyUnit as ResponderUnit),
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        surname: lastName.trim(),
        suffix: suffix.trim() || undefined,
        fullName: fullname.trim(),
        displayName: displayName.trim(),
        sex: sex.trim(),
        dateOfBirth: dateOfBirth.trim(),
        age: parseInt(age, 10) || undefined,
        phoneNumber: phoneNumber.trim(),
        province: province.trim(),
        cityOrMunicipality: cityOrMunicipality.trim(),
        barangay: barangay.trim(),
        streetOrPurok: streetOrPurok.trim(),
        weight: weight.trim() || undefined,
        height: height.trim() || undefined,
        employeeOrResidentId: isCivilian ? (employeeId.trim() || 'RES-ZN-2026') : employeeId.trim(),
        departmentOrBarangay: isCivilian ? barangay.trim() : `${agencyUnit} Tactical Command (${barangay.trim()})`,
        rankOrTitle: isCivilian ? 'Resident' : rankOrTitle.trim(),
        validIdType: idType,
        governmentIdType: idType,
        governmentIdNumber: licenseNumber.trim() || undefined,
        idCaptureDataUrl: idFrontShot || undefined,
        idBackCaptureDataUrl: idBackShot || undefined,
        faceCaptureDataUrl: faceShot || undefined,
        biometricDescriptorVector:
          faceMeta?.metadata?.hasTrackedRealFace && biometricDescriptorVector && biometricDescriptorVector.length === 128
            ? biometricDescriptorVector
            : generateDeterministicBiometricVector(email.trim()),
        email: email.trim(),
        password,
        confirmPassword,
        consentAccepted: faceConsentAccepted && consent1 && consent2,
        consentNoticeVersion: 'v2.0-manual-registration',
        minImageDimension: MIN_IMAGE_DIM
      };

      const res = await registerUser(payload);
      setIsLoading(false);
      setIsSuccess(true);

      const summaryMsg =
        res.message ||
        `${displayName.trim()} (${email.trim()}) registration submitted. Account Status: ${res.status || 'Pending'}, ID Status: ${res.identityVerificationStatus || 'PendingReview'}, Facial Status: ${res.facialVerificationStatus || 'PendingReview'}. Redirecting to sign in...`;

      setStatusMessage(summaryMsg);
      setStatusTone('ok');

      setTimeout(() => {
        navigate('/login');
      }, 1800);
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg = err instanceof Error ? err.message : 'Registration failed. Please review your details and try again.';
      setStatusMessage(errMsg);
      setStatusTone('bad');
    }
  };

  const selectedIdLabel =
    GOVERNMENT_ID_OPTIONS.find((opt) => opt.value === idType)?.label || idType.toUpperCase();

  return (
    <main className="scene page-register min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 w-full overflow-y-auto">
      <div
        className="stage w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-auto"
        style={{
          maxWidth: 'min(960px, 96vw)',
          width: '100%',
          height: 'auto',
          position: 'relative',
          margin: '0 auto',
          left: 'auto',
          top: 'auto',
          transform: 'none'
        }}
      >
        <div className="bg" aria-hidden="true">
          <span className="bg__strip"></span>
          <span className="bg__disc"></span>
          <span className="bg__wedge"></span>
        </div>

        <header className="brand text-center mb-4 w-full" style={{ position: 'relative', margin: '0 auto 16px', left: 'auto', top: 'auto' }}>
          <h1 className="brand__mark">RESQTRACK</h1>
          <p className="brand__lead">Smart Emergency Response</p>
          <p className="brand__sub">Manual 6-Phase Identity Induction &amp; Emergency Registration</p>
        </header>

        <section
          className="panel panel--register w-full"
          aria-labelledby="panel-title"
          style={{
            position: 'relative',
            left: 'auto',
            top: 'auto',
            width: '100%',
            maxWidth: isMobile ? '100%' : '940px',
            margin: '0 auto',
            transform: 'none',
            height: 'auto',
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
                INDUCTION SYSTEM // 6-PHASE MANUAL VERIFICATION WORKFLOW
              </span>
              <span className="text-slate-400 tracking-widest hidden sm:inline">
                STRATEGY: MANUAL REVIEW (PENDING_REVIEW)
              </span>
            </div>

            {/* 6-Phase Navigation Stepper with Layered Progress Line */}
            <div className="relative w-full my-3 px-1 sm:px-2" aria-label="Account creation 6-phase progress">
              {/* Background connector line spanning from first circle to last circle */}
              <div
                className="absolute top-[14px] h-[2px] -translate-y-1/2 z-0 pointer-events-none"
                style={{
                  left: 'calc(100% / 12)',
                  right: 'calc(100% / 12)'
                }}
                aria-hidden="true"
              >
                {/* Inactive Line */}
                <div className="w-full h-full bg-[rgba(255,92,116,0.2)] rounded-full" />
                {/* Completed Progress Gradient Line */}
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#ff5c74] to-rose-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(255,92,116,0.6)]"
                  style={{ width: `${(Math.min(Math.max(step, 0), 5) / 5) * 100}%` }}
                />
              </div>

              {/* 6 Evenly Distributed Step Columns */}
              <ol className="steps relative z-10 grid grid-cols-6 gap-1 w-full m-0 p-0 list-none">
                {[
                  { idx: 0, code: '01', label: '01 Role' },
                  { idx: 1, code: '02', label: '02 Info' },
                  { idx: 2, code: '03', label: '03 Gov ID' },
                  { idx: 3, code: '04', label: '04 Facial' },
                  { idx: 4, code: '05', label: '05 Auth' },
                  { idx: 5, code: '06', label: '06 Review' }
                ].map((phase) => (
                  <li
                    key={phase.idx}
                    className={`steps__item ${step === phase.idx ? 'is-active' : step > phase.idx ? 'is-done' : ''}`}
                    data-step-item={phase.idx}
                    aria-current={step === phase.idx ? 'step' : undefined}
                    onClick={() => handleNavigatePhase(phase.idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="steps__dot font-mono bg-[#1a080d] z-10">
                      {step > phase.idx ? (
                        <Check className="w-3.5 h-3.5 text-white stroke-[2.5]" />
                      ) : (
                        phase.idx + 1
                      )}
                    </span>
                    <span className="steps__label font-mono text-[9px] sm:text-[10px]">{phase.label}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* =====================================================================
                PHASE 1 (step === 0): ROLE SELECTION
               ===================================================================== */}
            {step === 0 && (
              <div className="step" data-step="0" id="phase-1-role">
                <div className="text-center mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-2">
                    <Shield className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 01 OF 06 // ROLE SELECTION
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Select Operational Role Classification
                  </h3>
                  <p className="font-sans text-xs text-slate-300/80 mt-1 max-w-lg mx-auto">
                    Choose your authorized registration role. Privileged LDRRMO Administrator accounts cannot be self-assigned and are provisioned strictly via command governance.
                  </p>
                </div>

                {/* Sliding Role Selector Segmented Bar */}
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
                      id="role-btn-responder"
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
                      id="role-btn-civilian"
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

                {/* Role Cards */}
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
                          <span className="px-2 py-0.5 rounded border bg-rose-950 border-rose-500/50 text-rose-300">
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
                        Authorized municipal tactical personnel responding to emergency incidents, casualty triages, structural fires, and law enforcement operations.
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

                    {selectedRole === 'Responder' && (
                      <div className="mt-4 pt-3 border-t border-rose-500/30" onClick={(e) => e.stopPropagation()}>
                        <label className="block font-mono text-[10px] uppercase tracking-wider text-rose-200 font-bold mb-1.5" htmlFor="phase1-agency-unit">
                          Select Responder Agency Unit <span className="text-[#ff5c74]">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['FIRE', 'RHU', 'PNP'] as const).map((u) => (
                            <button
                              key={u}
                              type="button"
                              id={`unit-btn-${u.toLowerCase()}`}
                              onClick={() => handleAgencyUnitChange(u)}
                              className={`py-1.5 px-2 rounded font-mono text-[10px] font-bold uppercase border cursor-pointer transition-all ${
                                agencyUnit === u
                                  ? 'bg-rose-600 text-white border-rose-300 shadow'
                                  : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:border-rose-400'
                              }`}
                            >
                              {u === 'FIRE' ? 'BFP FIRE' : u === 'RHU' ? 'RHU MEDIC' : 'PNP POLICE'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                          <span className="px-2 py-0.5 rounded border bg-emerald-950 border-emerald-500/50 text-emerald-300">
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
                        Designed for local residents and citizens of Katipunan, Zamboanga del Norte to submit emergency distress broadcasts, incident reports, and receive hazard alerts.
                      </p>

                      <div className="space-y-1.5 pt-2 border-t border-emerald-500/20 font-mono text-[10px]">
                        <div className="flex items-center gap-2 text-slate-300">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>One-Click Citizen SOS Distress Dispatch</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Camera className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                          <span>Live Emergency Incident Reporting</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                          <span>Community Resident Clearance</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-slate-700/50 font-mono text-[9px] text-slate-400 flex items-center justify-between">
                      <span>Req: Manual Info + ID Upload + Facial Record</span>
                      <span className="text-emerald-400 font-bold">CITIZEN TIER</span>
                    </div>
                  </div>
                </div>

                <div className="step-actions mt-6">
                  <button
                    className="btn w-full !h-[46px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    id="btn-phase1-next"
                    data-next="1"
                    onClick={() => handleNavigatePhase(1)}
                  >
                    <span className="btn__label">
                      Continue to Phase 2: Personal Information ({selectedRole === 'Responder' ? `Responder - ${agencyUnit}` : 'Civilian'})
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 2 (step === 1): PERSONAL INFORMATION (100% MANUAL INPUT)
               ===================================================================== */}
            {step === 1 && (
              <div className="step" data-step="1" id="phase-2-personal-info">
                {/* Active Role Ribbon */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border mb-4 font-mono text-[10.5px] ${
                    selectedRole === 'Responder'
                      ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ff5c74] shrink-0" />
                    <span>
                      PHASE 02 OF 06 // MANUAL PERSONAL INFORMATION &mdash; Active Role:{' '}
                      <strong>{selectedRole === 'Responder' ? `Responder (${agencyUnit})` : 'Civilian Resident'}</strong>
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

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-rose-500/25 mb-4 font-mono text-[10.5px] text-slate-300">
                  Enter your personal and residential details manually below. All fields are editable directly without automatic OCR or document text extraction.
                </div>

                <div className="form-grid">
                  {/* First Name */}
                  <div className={`field ${errors.firstName ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="first-name">
                        First Name <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[FIRST.NAME]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="first-name"
                        name="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Juan"
                        autoComplete="given-name"
                      />
                    </div>
                    {errors.firstName && (
                      <p className="field__error font-mono text-[10px]" id="first-name-error" role="alert">
                        {errors.firstName}
                      </p>
                    )}
                  </div>

                  {/* Middle Name */}
                  <div className="field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="middle-name">
                        Middle Name <span className="text-slate-400 text-[9px]">(Optional)</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[MIDDLE.NAME]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="middle-name"
                        name="middleName"
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="e.g. Santos"
                        autoComplete="additional-name"
                      />
                    </div>
                  </div>

                  {/* Last Name / Surname */}
                  <div className={`field ${errors.lastName ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="last-name">
                        Last Name / Surname <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[SURNAME]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="last-name"
                        name="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Dela Cruz"
                        autoComplete="family-name"
                      />
                    </div>
                    {errors.lastName && (
                      <p className="field__error font-mono text-[10px]" id="last-name-error" role="alert">
                        {errors.lastName}
                      </p>
                    )}
                  </div>

                  {/* Suffix */}
                  <div className="field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="suffix">
                        Suffix <span className="text-slate-400 text-[9px]">(Optional)</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[SUFFIX]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="suffix"
                        name="suffix"
                        type="text"
                        value={suffix}
                        onChange={(e) => setSuffix(e.target.value)}
                        placeholder="e.g. Jr., III"
                      />
                    </div>
                  </div>

                  {/* Sex */}
                  <div className={`field ${errors.sex ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="sex">
                        Sex <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[SEX]</span>
                    </div>
                    <div
                      className="field__box select focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Users className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <select
                        className="field__input select__input font-sans text-white text-[13px]"
                        id="sex"
                        name="sex"
                        value={sex}
                        onChange={(e) => setSex(e.target.value)}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className={`field ${errors.dateOfBirth ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="dob">
                        Date of Birth <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[DOB]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Calendar className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="dob"
                        name="dateOfBirth"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDateOfBirth(val);
                          const autoAge = computeAgeFromDob(val);
                          if (autoAge) setAge(autoAge);
                        }}
                      />
                    </div>
                    {errors.dateOfBirth && (
                      <p className="field__error font-mono text-[10px]" id="dob-error" role="alert">
                        {errors.dateOfBirth}
                      </p>
                    )}
                  </div>

                  {/* Age */}
                  <div className={`field ${errors.age ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="age">
                        Age (18&ndash;100) <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[AGE]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Calendar className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px]"
                        id="age"
                        name="age"
                        type="number"
                        min={18}
                        max={100}
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 28"
                      />
                    </div>
                    {errors.age && (
                      <p className="field__error font-mono text-[10px]" id="age-error" role="alert">
                        {errors.age}
                      </p>
                    )}
                  </div>

                  {/* Contact Number */}
                  <div className={`field ${errors.phoneNumber ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="phone-number">
                        Contact Number <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[MOBILE.TEL]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Phone className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="phone-number"
                        name="phoneNumber"
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+63 917 123 4567"
                        autoComplete="tel"
                      />
                    </div>
                    {errors.phoneNumber && (
                      <p className="field__error font-mono text-[10px]" id="phone-error" role="alert">
                        {errors.phoneNumber}
                      </p>
                    )}
                  </div>

                  {/* Province */}
                  <div className={`field ${errors.province ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="province">
                        Province <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[ADDR.PROVINCE]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <MapPin className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px]"
                        id="province"
                        name="province"
                        type="text"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                        placeholder="Zamboanga del Norte"
                      />
                    </div>
                    {errors.province && (
                      <p className="field__error font-mono text-[10px]" role="alert">
                        {errors.province}
                      </p>
                    )}
                  </div>

                  {/* City / Municipality */}
                  <div className={`field ${errors.cityOrMunicipality ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="city">
                        City / Municipality <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[ADDR.CITY]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <MapPin className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px]"
                        id="city"
                        name="cityOrMunicipality"
                        type="text"
                        value={cityOrMunicipality}
                        onChange={(e) => setCityOrMunicipality(e.target.value)}
                        placeholder="Katipunan"
                      />
                    </div>
                    {errors.cityOrMunicipality && (
                      <p className="field__error font-mono text-[10px]" role="alert">
                        {errors.cityOrMunicipality}
                      </p>
                    )}
                  </div>

                  {/* Barangay */}
                  <div className={`field ${errors.barangay ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="barangay">
                        Barangay <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[ADDR.BRGY]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <MapPin className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="barangay"
                        name="barangay"
                        type="text"
                        value={barangay}
                        onChange={(e) => setBarangay(e.target.value)}
                        placeholder="e.g. Barangay Uno (Poblacion)"
                      />
                    </div>
                    {errors.barangay && (
                      <p className="field__error font-mono text-[10px]" id="barangay-error" role="alert">
                        {errors.barangay}
                      </p>
                    )}
                  </div>

                  {/* Street / Purok */}
                  <div className={`field ${errors.streetOrPurok ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="street-purok">
                        Street / Purok / House No. <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[ADDR.STREET]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <MapPin className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="street-purok"
                        name="streetOrPurok"
                        type="text"
                        value={streetOrPurok}
                        onChange={(e) => setStreetOrPurok(e.target.value)}
                        placeholder="e.g. Purok 2, National Highway"
                      />
                    </div>
                    {errors.streetOrPurok && (
                      <p className="field__error font-mono text-[10px]" id="street-error" role="alert">
                        {errors.streetOrPurok}
                      </p>
                    )}
                  </div>

                  {/* Optional Weight & Height */}
                  <div className="field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="weight">
                        Weight <span className="text-slate-400 text-[9px]">(Optional)</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[WEIGHT.KG]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="weight"
                        name="weight"
                        type="text"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        placeholder="e.g. 65 kg"
                      />
                    </div>
                  </div>

                  <div className="field">
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="height">
                        Height <span className="text-slate-400 text-[9px]">(Optional)</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[HEIGHT.M]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="height"
                        name="height"
                        type="text"
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="e.g. 1.70 m"
                      />
                    </div>
                  </div>

                  {/* Responder-Specific Required Fields */}
                  {selectedRole === 'Responder' && (
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
                          style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
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

                      <div className={`field ${errors.employeeId ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="employee-id">
                            Badge / Employee ID <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[BADGE.TAG]</span>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                        >
                          <CreditCard className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px]"
                            id="employee-id"
                            type="text"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            placeholder="e.g. BFP-ZN-2026-089"
                          />
                        </div>
                        {errors.employeeId && (
                          <p className="field__error font-mono text-[10px]" id="employee-error" role="alert">
                            {errors.employeeId}
                          </p>
                        )}
                      </div>

                      <div className={`field md:col-span-2 ${errors.rankOrTitle ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="rank-title">
                            Official Rank / Position Title <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[RANK.POS]</span>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                        >
                          <Award className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px]"
                            id="rank-title"
                            type="text"
                            value={rankOrTitle}
                            onChange={(e) => setRankOrTitle(e.target.value)}
                            placeholder="e.g. Senior Inspector, Police Corporal, Medical Responder"
                          />
                        </div>
                        {errors.rankOrTitle && (
                          <p className="field__error font-mono text-[10px]" id="rank-error" role="alert">
                            {errors.rankOrTitle}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>

                <div className="step-actions flex gap-2.5 mt-6">
                  <button
                    className="btn btn--ghost !h-[44px] !w-28 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1"
                    type="button"
                    id="btn-phase2-back"
                    onClick={() => handleNavigatePhase(0)}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    className="btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    id="btn-phase2-next"
                    onClick={() => handleNavigatePhase(2)}
                  >
                    <span className="btn__label">Continue to Phase 3: Government ID Upload</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 3 (step === 2): GOVERNMENT ID UPLOAD (MANUAL, NO OCR)
               ===================================================================== */}
            {step === 2 && (
              <div className="step" data-step="2" id="phase-3-id-upload">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 03 OF 06 // GOVERNMENT ID UPLOAD
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Manual Government ID Selection &amp; Encrypted Image Upload
                  </h3>
                  <p className="font-sans text-xs text-slate-300/80 mt-1 max-w-xl mx-auto">
                    Select your Government ID type and upload clear Front and Back photographs (PNG, JPG, or WebP, max 5 MB each). Uploaded documents are encrypted at rest and queued for manual administrative review.
                  </p>
                </div>

                {/* Manual ID Type & ID Number Selection */}
                <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30 mb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="id-type">
                        Government ID Document Type <span className="req text-[#ff5c74]">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[MANUAL.ID.TYPE]</span>
                    </div>
                    <div
                      className="field__box select focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <CreditCard className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <select
                        className="field__input select__input font-sans text-white text-[13px]"
                        id="id-type"
                        value={idType}
                        onChange={(e) => setIdType(e.target.value)}
                      >
                        {GOVERNMENT_ID_OPTIONS.filter((opt) => !opt.responderOnly || selectedRole === 'Responder').map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="license-number">
                        ID / Document Serial Number <span className="text-slate-400 text-[9px]">(Optional)</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[DOC.NUMBER]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <CreditCard className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="license-number"
                        name="licenseNumber"
                        type="text"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        placeholder="Enter ID / License Number manually"
                      />
                    </div>
                  </div>
                </div>

                {/* Front & Back Dropzones */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                    Upload Front &amp; Back ID Images <span className="text-[#ff5c74]">*</span>
                  </span>
                  {(idFrontShot || idBackShot) && (
                    <button
                      type="button"
                      id="btn-clear-both-ids"
                      onClick={handleClearBothIds}
                      className="font-mono text-[10px] text-rose-300 hover:text-white px-2.5 py-1 rounded border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Remove Both ID Images</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Front ID Dropzone */}
                  <div className="flex flex-col">
                    <input
                      type="file"
                      ref={frontFileInputRef}
                      id="front-id-input"
                      data-side="front"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload('front', e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-slate-200">1. Front ID Image</span>
                      <span className={idFrontShot ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                        {idFrontShot ? 'UPLOADED (PENDING REVIEW)' : 'REQUIRED'}
                      </span>
                    </div>

                    {idFrontShot ? (
                      <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-[#070c14] p-3 flex flex-col items-center">
                        <div className="relative w-full overflow-hidden rounded border border-emerald-500/30">
                          <img
                            src={idFrontShot}
                            alt="Front Government ID Preview"
                            id="front-id-preview"
                            className="w-full h-auto object-cover"
                            style={{ aspectRatio: '85.6 / 53.98' }}
                          />
                        </div>
                        {idFrontMeta && (
                          <div className="mt-1.5 w-full font-mono text-[9px] text-slate-400 flex items-center justify-between">
                            <span className="truncate max-w-[160px]">{idFrontMeta.name}</span>
                            <span>
                              {idFrontMeta.width}x{idFrontMeta.height}px &bull; {(idFrontMeta.sizeBytes / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        )}
                        <div className="mt-2.5 w-full flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" /> PENDING REVIEW
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              id="btn-replace-front-id"
                              onClick={() => frontFileInputRef.current?.click()}
                              className="text-sky-400 hover:text-sky-300 underline cursor-pointer text-[10px]"
                            >
                              Replace
                            </button>
                            <span className="text-slate-600">&bull;</span>
                            <button
                              type="button"
                              id="btn-remove-front-id"
                              onClick={() => {
                                setIdFrontShot(null);
                                setIdFrontMeta(null);
                              }}
                              className="text-rose-400 hover:text-rose-300 underline cursor-pointer text-[10px]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        id="front-id-dropzone"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingFront(true);
                        }}
                        onDragLeave={() => setIsDraggingFront(false)}
                        onDrop={(e) => handleDrop('front', e)}
                        onClick={() => frontFileInputRef.current?.click()}
                        className={`relative rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[168px] ${
                          isDraggingFront
                            ? 'border-[#ff5c74] bg-rose-950/30'
                            : 'border-rose-500/30 bg-[#16070d]/60 hover:border-rose-400 hover:bg-[#1f0a13]/70'
                        }`}
                      >
                        <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-500/30 text-[#ff5c74] mb-2">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          Upload Front ID Image
                        </span>
                        <span className="font-sans text-[11px] text-slate-400 mt-1">
                          Drag &amp; drop or click to select PNG, JPG, or WebP (max 5 MB)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Back ID Dropzone */}
                  <div className="flex flex-col">
                    <input
                      type="file"
                      ref={backFileInputRef}
                      id="back-id-input"
                      data-side="back"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload('back', e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                      <span className="font-bold uppercase tracking-wider text-slate-200">2. Back ID Image</span>
                      <span className={idBackShot ? 'text-amber-300 font-bold' : 'text-slate-400'}>
                        {idBackShot ? 'UPLOADED (PENDING REVIEW)' : 'REQUIRED'}
                      </span>
                    </div>

                    {idBackShot ? (
                      <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-[#070c14] p-3 flex flex-col items-center">
                        <div className="relative w-full overflow-hidden rounded border border-emerald-500/30">
                          <img
                            src={idBackShot}
                            alt="Back Government ID Preview"
                            id="back-id-preview"
                            className="w-full h-auto object-cover"
                            style={{ aspectRatio: '85.6 / 53.98' }}
                          />
                        </div>
                        {idBackMeta && (
                          <div className="mt-1.5 w-full font-mono text-[9px] text-slate-400 flex items-center justify-between">
                            <span className="truncate max-w-[160px]">{idBackMeta.name}</span>
                            <span>
                              {idBackMeta.width}x{idBackMeta.height}px &bull; {(idBackMeta.sizeBytes / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        )}
                        <div className="mt-2.5 w-full flex items-center justify-between gap-2 font-mono text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 stroke-[3]" /> PENDING REVIEW
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              id="btn-replace-back-id"
                              onClick={() => backFileInputRef.current?.click()}
                              className="text-sky-400 hover:text-sky-300 underline cursor-pointer text-[10px]"
                            >
                              Replace
                            </button>
                            <span className="text-slate-600">&bull;</span>
                            <button
                              type="button"
                              id="btn-remove-back-id"
                              onClick={() => {
                                setIdBackShot(null);
                                setIdBackMeta(null);
                              }}
                              className="text-rose-400 hover:text-rose-300 underline cursor-pointer text-[10px]"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        id="back-id-dropzone"
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingBack(true);
                        }}
                        onDragLeave={() => setIsDraggingBack(false)}
                        onDrop={(e) => handleDrop('back', e)}
                        onClick={() => backFileInputRef.current?.click()}
                        className={`relative rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[168px] ${
                          isDraggingBack
                            ? 'border-[#ff5c74] bg-rose-950/30'
                            : 'border-rose-500/30 bg-[#16070d]/60 hover:border-rose-400 hover:bg-[#1f0a13]/70'
                        }`}
                      >
                        <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-500/30 text-[#ff5c74] mb-2">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          Upload Back ID Image
                        </span>
                        <span className="font-sans text-[11px] text-slate-400 mt-1">
                          Drag &amp; drop or click to select PNG, JPG, or WebP (max 5 MB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {errors.idCard && (
                  <p className="field__error font-mono text-[10.5px] mt-3 text-rose-400 flex items-center gap-1.5" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errors.idCard}</span>
                  </p>
                )}

                <div className="step-actions flex gap-2.5 mt-6">
                  <button
                    className="btn btn--ghost !h-[44px] !w-28 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1"
                    type="button"
                    id="btn-phase3-back"
                    onClick={() => handleNavigatePhase(1)}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    className="btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    id="btn-phase3-next"
                    onClick={() => handleNavigatePhase(3)}
                  >
                    <span className="btn__label">Continue to Phase 4: Facial Record</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 4 (step === 3): FACIAL RECORD (MANUAL CAPTURE & REVIEW ONLY)
               ===================================================================== */}
            {step === 3 && (
              <div className="step" data-step="3" id="phase-4-facial-record">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 04 OF 06 // FACIAL RECORD CAPTURE
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Manual Facial Photograph Capture &amp; Consent
                  </h3>
                </div>

                <ManualFacialCapturePanel
                  capturedDataUrl={faceShot}
                  isConfirmed={faceConfirmed}
                  consentAccepted={faceConsentAccepted}
                  onCaptureConfirmed={(dataUrl, dims) => {
                    setFaceShot(dataUrl);
                    setFaceConfirmed(true);
                    setFaceMeta(dims);
                    if (dims.descriptorVector && dims.descriptorVector.length > 0) {
                      setBiometricDescriptorVector(dims.descriptorVector);
                    } else if (dims.metadata?.descriptorVector && dims.metadata.descriptorVector.length > 0) {
                      setBiometricDescriptorVector(dims.metadata.descriptorVector);
                    }
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.facial;
                      delete next.facialConsent;
                      return next;
                    });
                  }}
                  onCaptureReset={() => {
                    setFaceShot(null);
                    setFaceConfirmed(false);
                    setFaceMeta(null);
                    setBiometricDescriptorVector(null);
                  }}
                  onConsentChange={(accepted) => {
                    setFaceConsentAccepted(accepted);
                    if (accepted) {
                      setErrors((prev) => {
                        const next = { ...prev };
                        delete next.facialConsent;
                        return next;
                      });
                    }
                  }}
                  errorMessage={errors.facial || errors.facialConsent}
                />

                <div className="step-actions flex gap-2.5 mt-6">
                  <button
                    className="btn btn--ghost !h-[44px] !w-28 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1"
                    type="button"
                    id="btn-phase4-back"
                    onClick={() => handleNavigatePhase(2)}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    className="btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    id="btn-phase4-next"
                    onClick={() => handleNavigatePhase(4)}
                  >
                    <span className="btn__label">Continue to Phase 5: Account Credentials</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 5 (step === 4): ACCOUNT CREDENTIALS
               ===================================================================== */}
            {step === 4 && (
              <div className="step" data-step="4" id="phase-5-credentials">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 05 OF 06 // ACCOUNT CREDENTIALS
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Display Name, Login Email &amp; Master Password
                  </h3>
                  <p className="font-sans text-xs text-slate-300/80 mt-1 max-w-lg mx-auto">
                    Your <strong>Email Address</strong> is your sole login identifier. Your <strong>Display Name / Username</strong> is used strictly for account presentation in dashboards and headers.
                  </p>
                </div>

                <div className="form-grid">
                  {/* Display Name / Username (Presentation Only) */}
                  <div className={`field ${errors.displayName ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="display-name">
                        Username / Display Name <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-cyan-400/90">[DISPLAY.ONLY]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <User className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="display-name"
                        name="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. JuanDC_7109 (Shown in UI header)"
                        autoComplete="nickname"
                      />
                    </div>
                    <p className="font-mono text-[9px] text-slate-400 mt-1">
                      Used for dashboard display only. Cannot be used to sign in.
                    </p>
                    {errors.displayName && (
                      <p className="field__error font-mono text-[10px]" id="display-name-error" role="alert">
                        {errors.displayName}
                      </p>
                    )}
                  </div>

                  {/* Email Address (Sole Login Identifier) */}
                  <div className={`field ${errors.email ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="email">
                        Email Address (Login Identifier) <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-emerald-400/90">[SOLE.LOGIN.ID]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Mail className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="juan.delacruz@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <p className="font-mono text-[9px] text-slate-400 mt-1">
                      Must be unique. You will always sign in using this email address.
                    </p>
                    {errors.email && (
                      <p className="field__error font-mono text-[10px]" id="email-error" role="alert">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className={`field field--password ${errors.password ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="password">
                        Password (Min 12 Chars) <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[PBKDF2.SHA512]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Lock className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 12 characters"
                        autoComplete="new-password"
                      />
                      <button
                        className="field__toggle hover:text-rose-300 ml-auto p-1 cursor-pointer"
                        type="button"
                        id="pw-toggle"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {!showPassword ? <Eye className="w-4 h-4 text-slate-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                      </button>
                    </div>
                    {password && (
                      <p className="strength font-mono text-[9px] mt-1.5" id="strength" data-tone={strengthTone}>
                        Length: {password.length} chars &bull; Strength: {strengthLabel}
                      </p>
                    )}
                    {errors.password && (
                      <p className="field__error font-mono text-[10px]" id="password-error" role="alert">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className={`field field--password ${errors.confirm ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="confirm">
                        Confirm Password <span className="req">*</span>
                      </label>
                      <span className="font-mono text-[8.5px] text-rose-400/80">[CONFIRM.MATCH]</span>
                    </div>
                    <div
                      className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                      style={{ background: 'rgba(46, 10, 22, 0.85)', border: '1px solid rgba(255, 92, 116, 0.22)', borderRadius: '6px' }}
                    >
                      <Lock className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                      <input
                        className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                        id="confirm"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        autoComplete="new-password"
                      />
                    </div>
                    {errors.confirm && (
                      <p className="field__error font-mono text-[10px]" id="confirm-error" role="alert">
                        {errors.confirm}
                      </p>
                    )}
                  </div>
                </div>

                {/* Show Password Checkbox Control */}
                <div className="mt-3 flex items-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer font-mono text-[11px] text-slate-300" htmlFor="show-password-check">
                    <input
                      type="checkbox"
                      id="show-password-check"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="accent-[#ff5c74] cursor-pointer"
                    />
                    <span>Show Password &amp; Confirm Password characters</span>
                  </label>
                </div>

                {/* Required Legal Certifications */}
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
                      [AFFIDAVIT] I certify under penalty of perjury that all manually entered personal information and uploaded government ID documents are genuine and accurate.
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
                      [PROTOCOL] I agree to the ResQTrack emergency dispatch, GPS incident tracking, and manual administrative identity review protocols under RA 10173.
                    </span>
                  </label>

                  {errors.consent && (
                    <p className="field__error font-mono text-[10px] mt-2 text-rose-400" role="alert">
                      {errors.consent}
                    </p>
                  )}
                </div>

                <div className="step-actions flex gap-2.5 mt-6">
                  <button
                    className="btn btn--ghost !h-[44px] !w-28 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1"
                    type="button"
                    id="btn-phase5-back"
                    onClick={() => handleNavigatePhase(3)}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    className="btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2"
                    type="button"
                    id="btn-phase5-next"
                    onClick={() => handleNavigatePhase(5)}
                  >
                    <span className="btn__label">Continue to Phase 6: Review &amp; Submit</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 6 (step === 5): REVIEW & REGISTRATION SUBMISSION
               ===================================================================== */}
            {step === 5 && (
              <div className="step" data-step="5" id="phase-6-review">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 font-mono text-[10px] text-emerald-300 font-bold uppercase tracking-widest mb-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                    PHASE 06 OF 06 // REVIEW &amp; REGISTRATION SUBMISSION
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Review Your Registration Dossier Before Submission
                  </h3>
                  <p className="font-sans text-xs text-slate-300/80 mt-1 max-w-xl mx-auto">
                    Verify that all information below is accurate. You may click any <strong>Edit</strong> button to return to an earlier phase and modify your entries without losing progress.
                  </p>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  {/* Section 1: Role & Account Credentials Summary */}
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                      <span className="font-bold uppercase tracking-wider text-rose-300">
                        1. Selected Role &amp; Account Credentials
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="review-edit-phase1"
                          onClick={() => handleNavigatePhase(0)}
                          className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Role</span>
                        </button>
                        <button
                          type="button"
                          id="review-edit-phase5"
                          onClick={() => handleNavigatePhase(4)}
                          className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Credentials</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                      <div>
                        <span className="text-slate-400">Selected Role:</span>{' '}
                        <strong className="text-white" id="review-role">
                          {selectedRole === 'Responder' ? `Responder (${agencyUnit})` : 'Civilian Resident'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Display Name (UI Only):</span>{' '}
                        <strong className="text-cyan-300" id="review-display-name">{displayName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Login Email Identifier:</span>{' '}
                        <strong className="text-emerald-300" id="review-email">{email}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Account Verification Status:</span>{' '}
                        <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 text-[9.5px] font-bold">
                          PENDING ADMIN REVIEW
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Personal Information Summary */}
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                      <span className="font-bold uppercase tracking-wider text-rose-300">
                        2. Personal &amp; Residential Information
                      </span>
                      <button
                        type="button"
                        id="review-edit-phase2"
                        onClick={() => handleNavigatePhase(1)}
                        className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300 text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Personal Info</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                      <div>
                        <span className="text-slate-400">Full Name:</span>{' '}
                        <strong className="text-white" id="review-fullname">{fullname}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Sex / DOB / Age:</span>{' '}
                        <strong className="text-white">
                          {sex} &bull; {dateOfBirth} ({age} yrs)
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Contact Number:</span>{' '}
                        <strong className="text-white" id="review-phone">{phoneNumber}</strong>
                      </div>
                      {selectedRole === 'Responder' && (
                        <div>
                          <span className="text-slate-400">Badge / Rank:</span>{' '}
                          <strong className="text-white">
                            {employeeId} &bull; {rankOrTitle}
                          </strong>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <span className="text-slate-400">Residential Address:</span>{' '}
                        <strong className="text-white" id="review-address">{fullAddressPreview}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Government ID & Facial Record Previews */}
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                      <span className="font-bold uppercase tracking-wider text-rose-300">
                        3. Government ID Uploads &amp; Facial Record
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="review-edit-phase3"
                          onClick={() => handleNavigatePhase(2)}
                          className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit ID Upload</span>
                        </button>
                        <button
                          type="button"
                          id="review-edit-phase4"
                          onClick={() => handleNavigatePhase(3)}
                          className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-sky-300 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Facial Record</span>
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">Selected Government ID:</span>{' '}
                        <strong className="text-white" id="review-id-type">{selectedIdLabel}</strong>
                        {licenseNumber && (
                          <span className="text-slate-300 ml-2">({licenseNumber})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9.5px]">
                        <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 font-bold">
                          ID STATUS: PENDING_REVIEW
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-950 border border-amber-500/40 text-amber-300 font-bold">
                          FACIAL STATUS: PENDING_REVIEW
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-center">
                        <div className="text-[9.5px] text-slate-300 font-bold uppercase mb-1">Front ID Image</div>
                        {idFrontShot && (
                          <img
                            src={idFrontShot}
                            alt="Review Front ID"
                            id="review-front-id-img"
                            className="w-full h-28 object-cover rounded border border-slate-800"
                          />
                        )}
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-center">
                        <div className="text-[9.5px] text-slate-300 font-bold uppercase mb-1">Back ID Image</div>
                        {idBackShot && (
                          <img
                            src={idBackShot}
                            alt="Review Back ID"
                            id="review-back-id-img"
                            className="w-full h-28 object-cover rounded border border-slate-800"
                          />
                        )}
                      </div>
                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-center">
                        <div className="text-[9.5px] text-slate-300 font-bold uppercase mb-1">
                          Facial Record {faceMeta ? `(${faceMeta.width}x${faceMeta.height})` : ''}
                        </div>
                        {faceShot && (
                          <img
                            src={faceShot}
                            alt="Review Facial Capture"
                            id="review-face-img"
                            className="w-full h-28 object-cover rounded border border-slate-800"
                          />
                        )}
                      </div>
                    </div>

                    {biometricDescriptorVector && (
                      <div
                        className="mt-3 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between text-[11px] text-emerald-300 font-mono"
                        id="review-biometric-training-status"
                      >
                        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                          <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Biometric Profile Trained</span>
                        </span>
                        <span className="text-emerald-400 font-bold">128-D Vector Ready for 1:1 Login</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase 6 Submit & Back Buttons */}
                <div className="step-actions flex gap-2.5 mt-6">
                  <button
                    className="btn btn--ghost !h-[44px] !w-28 font-mono text-xs rounded-lg border border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800 cursor-pointer flex items-center justify-center gap-1"
                    type="button"
                    id="btn-phase6-back"
                    onClick={() => handleNavigatePhase(4)}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
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
                        ? 'Submitting registration...'
                        : isSuccess
                        ? 'Registration Submitted (Pending Review)'
                        : 'Submit Registration for Administrative Review'}
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
