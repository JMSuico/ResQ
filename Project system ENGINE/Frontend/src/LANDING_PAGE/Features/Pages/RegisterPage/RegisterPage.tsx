// [Layer: LANDING_PAGE/Features/Pages/RegisterPage]
// Responsibility: Unified 5-Phase Registration Wizard for ResQTrack backed by background dual-side Government ID verification,
// hidden-until-verified personal information inputs, 4-pose facial biometric matching, standby token caching, and AI auto-approval.
// Implements the Unified 5-Phase Registration Sequence:
//   Phase 1 (step 0): Role Selection (Responder [FIRE/RHU/PNP] vs Civilian; blocks LDRRMO_Admin self-assignment)
//   Phase 2 (step 1): Unified Government ID Upload & Identity Info (ID type + Front/Back upload -> background local pre-flight & Claude Vision verification -> unlocks #personal-info-section and non-destructively auto-fills visible fields)
//   Phase 3 (step 2): Facial Record (4-pose 30-60 FPS capture, anti-spoofing, Face-to-Gov-ID portrait match, RA 10173 consent)
//   Phase 4 (step 3): Account Credentials (DisplayName for UI only, Email login identifier, Password, ConfirmPassword, legal certifications)
//   Phase 5 (step 4): Review & Submission (Summary of Phases 1-4, approval mode badge, backward Edit navigation, submits standby tokens to POST /api/register)
// Strict TypeScript with ZERO 'any', ZERO emojis, ZERO 'function' keyword, and universal arrow lambdas (=>).

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
  ShieldAlert,
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
  Upload,
  MapPin,
  Phone,
  FileCheck,
  Edit3,
  AlertCircle,
  Cpu
} from 'lucide-react';
import {
  registerUser,
  type RegisterPayload,
  type RegisterResponse,
  type ResponderUnit
} from '@/Endpoints/authApi';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';
import {
  useBackgroundIdVerification,
  clearStandbyRegistrationTokens,
  persistStandbyFacialToken,
  type VisibleExtractedAutoFillFields
} from '@/Hooks/useBackgroundIdVerification';
import { IdVerificationBanner } from './IdVerificationBanner';
import { ManualFacialCapturePanel } from './ManualFacialCapturePanel';
import {
  biometricFrameCache,
  extractBiometricFeatureVector,
  generateDeterministicBiometricVector,
  synthesizeMultiPoseTrainedProfile
} from '@/Libs/Cache/biometricFrameCache';
import {
  sanitizeVisibleOcrFields,
  mergeVisibleOcrFields,
  computeAgeFromIsoDob,
  normalizeVisibleSex
} from '@/Libs/Vision/idScanner/ai/ocrFieldUtils';
import { downscaleIdImageDataUrl } from '@/Libs/Vision/idScanner/ai/ClaudeSonnetOcrProvider';

interface GovernmentIdOption {
  readonly value: string;
  readonly label: string;
  readonly responderOnly?: boolean;
}

interface WizardStepItem {
  readonly idx: number;
  readonly code: string;
  readonly label: string;
}

interface FacialTokenIssuedEvent {
  readonly facialVerificationToken?: string | null;
  readonly faceToIdSimilarity?: number | null;
  readonly isFaceMatchedToId?: boolean;
  readonly requiresPendingManualReview?: boolean;
  readonly statusMessage?: string;
}

type RegisterSubmissionPayload = RegisterPayload & {
  idVerificationToken?: string;
  facialVerificationToken?: string;
  geometricSignatureJson?: string;
  poseFramesJson?: string;
  aiBiometricStrategyName?: string;
};

type RegisterResponseWithAutoApproval = RegisterResponse & {
  readonly autoApprovedByAi?: boolean;
  readonly autoApprovalReason?: string;
};

const STEPS: readonly WizardStepItem[] = [
  { idx: 0, code: '01', label: '01 Role' },
  { idx: 1, code: '02', label: '02 ID & Info' },
  { idx: 2, code: '03', label: '03 Facial' },
  { idx: 3, code: '04', label: '04 Auth' },
  { idx: 4, code: '05', label: '05 Review' }
];

const GOVERNMENT_ID_OPTIONS: readonly GovernmentIdOption[] = [
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
const POST_REGISTER_LEARNING_STORAGE_KEY = 'resqtrack_post_register_learning_notice';
const AI_LEARNING_REMINDER_TEXT =
  'Account and facial frames saved to database. AI is studying your oval, forward, left, right, and blink poses with your ID details — please wait up to 5 minutes before signing in via Biometric Login.';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useFluidResposiveness();

  // Unified 5-Phase Wizard Step State:
  // 0 = Phase 1: Role Selection
  // 1 = Phase 2: Government ID Upload & Hidden Personal Info
  // 2 = Phase 3: Facial Record & Face-to-ID Match
  // 3 = Phase 4: Account Credentials
  // 4 = Phase 5: Review & Submission
  const [step, setStep] = useState<number>(0);

  // ============ Phase 1: Role Selection ============
  const [selectedRole, setSelectedRole] = useState<'Responder' | 'Civilian'>('Responder');
  const [agencyUnit, setAgencyUnit] = useState<ResponderUnit>('FIRE');

  // ============ Phase 2: Government ID Upload & Personal Information ============
  const [idType, setIdType] = useState<string>('');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [idFrontShot, setIdFrontShot] = useState<string | null>(null);
  const [idBackShot, setIdBackShot] = useState<string | null>(null);
  const [idFrontMeta, setIdFrontMeta] = useState<{
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
  } | null>(null);
  const [idBackMeta, setIdBackMeta] = useState<{
    name: string;
    width: number;
    height: number;
    sizeBytes: number;
  } | null>(null);
  const [isDraggingFront, setIsDraggingFront] = useState<boolean>(false);
  const [isDraggingBack, setIsDraggingBack] = useState<boolean>(false);

  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);

  const [firstName, setFirstName] = useState<string>('');
  const [middleName, setMiddleName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [suffix, setSuffix] = useState<string>('');
  const [sex, setSex] = useState<string>('');
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

  const fullAddressPreview = [
    streetOrPurok.trim(),
    barangay.trim(),
    cityOrMunicipality.trim(),
    province.trim()
  ]
    .filter(Boolean)
    .join(', ');

  // ============ Phase 3: Facial Record & Token Standby ============
  const [faceShot, setFaceShot] = useState<string | null>(null);
  const [faceConfirmed, setFaceConfirmed] = useState<boolean>(false);
  const [faceConsentAccepted, setFaceConsentAccepted] = useState<boolean>(false);
  const [faceMeta, setFaceMeta] = useState<{
    width: number;
    height: number;
    byteSize: number;
    metadata?: {
      hasTrackedRealFace?: boolean;
      trainingStatus?: string;
      isSyntheticTestRecord?: boolean;
      geometricSignatureJson?: string;
      poseFramesJson?: string;
      aiBiometricStrategyName?: string;
    };
  } | null>(null);
  const [biometricDescriptorVector, setBiometricDescriptorVector] = useState<number[] | null>(null);
  const [facialGeometricSignatureJson, setFacialGeometricSignatureJson] = useState<string>('');
  const [facialPoseFramesJson, setFacialPoseFramesJson] = useState<string>('');
  const [facialVerificationToken, setFacialVerificationToken] = useState<string | null>(null);
  const [faceToIdSimilarity, setFaceToIdSimilarity] = useState<number | null>(null);
  const [isFaceMatchedToId, setIsFaceMatchedToId] = useState<boolean>(false);
  const [facialRequiresPendingManualReview, setFacialRequiresPendingManualReview] =
    useState<boolean>(false);
  const [facialStatusMessage, setFacialStatusMessage] = useState<string>('');

  // ============ Phase 4: Account Credentials ============
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
  const [learningToastMessage, setLearningToastMessage] = useState<string>('');
  const [persistenceConfirmation, setPersistenceConfirmation] = useState<{
    biometricTrainingStatus?: string;
    biometricTrainingReadyTargetUtc?: string;
    trainedFrameCount?: number;
  } | null>(null);

  const visibleGovernmentIdOptions = GOVERNMENT_ID_OPTIONS.filter(
    (opt) => !opt.responderOnly || selectedRole === 'Responder'
  );
  const isIdTypeSelected = Boolean(
    idType.trim() && visibleGovernmentIdOptions.some((opt) => opt.value === idType)
  );
  const selectedIdLabel =
    visibleGovernmentIdOptions.find((opt) => opt.value === idType)?.label ||
    (idType.trim() ? idType.toUpperCase() : '');

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

  // Non-destructive visible-only OCR auto-fill callback invoked when background ID verification passes
  const handleAutoFillVisibleFields = (extracted: VisibleExtractedAutoFillFields): void => {
    const { fields: sanitized } = sanitizeVisibleOcrFields({
      firstName: extracted.firstName,
      middleName: extracted.middleName,
      lastName: extracted.lastName,
      suffix: extracted.suffix,
      sex: normalizeVisibleSex(extracted.sex),
      dob: extracted.dob,
      age: extracted.age,
      licenseNumber: extracted.licenseNumber,
      barangay: extracted.barangay,
      streetPurok: extracted.streetPurok,
      cityOrMunicipality: extracted.cityOrMunicipality,
      province: extracted.province,
      weight: extracted.weight,
      height: extracted.height,
      phoneNumber: extracted.phoneNumber
    });

    const derivedAge = sanitized.dob
      ? computeAgeFromIsoDob(sanitized.dob) || computeAgeFromDob(sanitized.dob) || ''
      : '';
    const incomingAge = sanitized.age || derivedAge || '';

    const merged = mergeVisibleOcrFields(
      {
        firstName,
        middleName,
        lastName,
        suffix,
        sex,
        dateOfBirth,
        age,
        licenseNumber,
        barangay,
        streetOrPurok,
        cityOrMunicipality,
        province,
        weight,
        height,
        phoneNumber
      },
      {
        firstName: sanitized.firstName,
        middleName: sanitized.middleName,
        lastName: sanitized.lastName,
        suffix: sanitized.suffix,
        sex: sanitized.sex ? normalizeVisibleSex(sanitized.sex) : undefined,
        dateOfBirth: sanitized.dob,
        age: incomingAge || undefined,
        licenseNumber: sanitized.licenseNumber,
        barangay: sanitized.barangay,
        streetOrPurok: sanitized.streetPurok,
        cityOrMunicipality: sanitized.cityOrMunicipality,
        province: sanitized.province,
        weight: sanitized.weight,
        height: sanitized.height,
        phoneNumber: sanitized.phoneNumber
      }
    );

    const finalAge =
      merged.age.trim().length > 0
        ? merged.age
        : merged.dateOfBirth.trim().length > 0
        ? computeAgeFromIsoDob(merged.dateOfBirth) || computeAgeFromDob(merged.dateOfBirth) || ''
        : '';

    setFirstName(merged.firstName);
    setMiddleName(merged.middleName);
    setLastName(merged.lastName);
    setSuffix(merged.suffix);
    setSex(merged.sex);
    setDateOfBirth(merged.dateOfBirth);
    setAge(finalAge);
    setLicenseNumber(merged.licenseNumber);
    setBarangay(merged.barangay);
    setStreetOrPurok(merged.streetOrPurok);
    setCityOrMunicipality(merged.cityOrMunicipality);
    setProvince(merged.province);
    setWeight(merged.weight);
    setHeight(merged.height);
    setPhoneNumber(merged.phoneNumber);
  };

  // Headless background dual-side ID verification & OCR hook
  const idVerification = useBackgroundIdVerification({
    frontImageDataUrl: idFrontShot,
    backImageDataUrl: idBackShot,
    idType,
    selectedIdLabel: selectedIdLabel || undefined,
    onAutoFillVisibleFields: handleAutoFillVisibleFields
  });

  // Reset facial verification standby token when ID images or ID type change
  const resetStaleFacialTokenOnIdMutation = (): void => {
    setFacialVerificationToken(null);
    setFaceToIdSimilarity(null);
    setIsFaceMatchedToId(false);
    setFacialRequiresPendingManualReview(false);
    setFacialStatusMessage('');
    setFaceConfirmed(false);
    persistStandbyFacialToken(null);
  };

  // Clear any leftover standby sessionStorage keys on fresh page mount when images aren't loaded yet
  useEffect(() => {
    if (!idFrontShot && !idBackShot) {
      clearStandbyRegistrationTokens();
    }
  }, []);

  // Handle URL query parameters for role, unit, and ?step= clamping [0, 4]
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const unitParam = (params.get('unit') || '').toLowerCase();
    const roleParam = (params.get('role') || '').toLowerCase();
    const stepParam = params.get('step');
    if (stepParam !== null && stepParam.trim() !== '' && !isNaN(Number(stepParam))) {
      const parsedStep = Math.trunc(Number(stepParam));
      const clampedStep = Math.min(4, Math.max(0, parsedStep));
      setStep(clampedStep);
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
    } else if (unitParam === 'pnp') {
      setSelectedRole('Responder');
      setAgencyUnit('PNP');
      setRankOrTitle('Police Corporal');
    } else if (unitParam === 'fire' || unitParam === 'bfp') {
      setSelectedRole('Responder');
      setAgencyUnit('FIRE');
      setRankOrTitle('Senior Inspector');
    }
  }, [location.search]);

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

  const setMissingIdTypeError = (): void => {
    const message =
      'Please select a Government ID document type before uploading Front or Back ID images.';
    setErrors((prev) => ({
      ...prev,
      idType: message
    }));
    setStatusMessage(message);
    setStatusTone('bad');
  };

  // Phase 2 Government ID File Upload Handler (Magic-byte & dimension validation)
  const handleFileUpload = (side: 'front' | 'back', file: File): void => {
    if (!isIdTypeSelected) {
      const targetInput =
        side === 'front' ? frontFileInputRef.current : backFileInputRef.current;
      if (targetInput) {
        targetInput.value = '';
      }
      setMissingIdTypeError();
      return;
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.idCard;
      delete next.idType;
      return next;
    });
    setStatusMessage('');
    setStatusTone('');

    if (file.size === 0) {
      setErrors((prev) => ({
        ...prev,
        idCard: `Selected ${side.toUpperCase()} ID file is empty (0 bytes).`
      }));
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
    const validMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(
      file.type.toLowerCase()
    );
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
          setErrors((prev) => ({
            ...prev,
            idCard: `Unable to read ${side.toUpperCase()} ID image file.`
          }));
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

          // Normalize >1568px camera photos once on upload so background OCR and Phase 5 /api/register
          // submit identical image bytes matching the standby HMAC IdVerificationToken hash pair.
          void downscaleIdImageDataUrl(resultDataUrl).then((normalizedDataUrl: string): void => {
            resetStaleFacialTokenOnIdMutation();
            if (side === 'front') {
              setIdFrontShot(normalizedDataUrl);
              setIdFrontMeta(meta);
            } else {
              setIdBackShot(normalizedDataUrl);
              setIdBackMeta(meta);
            }
          });
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

    if (!isIdTypeSelected) {
      setMissingIdTypeError();
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(side, e.dataTransfer.files[0]);
    }
  };

  const handleRemoveSingleIdSide = (side: 'front' | 'back'): void => {
    if (side === 'front') {
      setIdFrontShot(null);
      setIdFrontMeta(null);
      if (frontFileInputRef.current) {
        frontFileInputRef.current.value = '';
      }
    } else {
      setIdBackShot(null);
      setIdBackMeta(null);
      if (backFileInputRef.current) {
        backFileInputRef.current.value = '';
      }
    }
    idVerification.clearStandbyToken();
    clearStandbyRegistrationTokens();
    resetStaleFacialTokenOnIdMutation();
  };

  const clearUploadedIdAssets = (): void => {
    setIdFrontShot(null);
    setIdBackShot(null);
    setIdFrontMeta(null);
    setIdBackMeta(null);
    if (frontFileInputRef.current) {
      frontFileInputRef.current.value = '';
    }
    if (backFileInputRef.current) {
      backFileInputRef.current.value = '';
    }
    idVerification.clearStandbyToken();
    clearStandbyRegistrationTokens();
    resetStaleFacialTokenOnIdMutation();
  };

  const handleClearBothIds = (): void => {
    clearUploadedIdAssets();
    setErrors((prev) => {
      const next = { ...prev };
      delete next.idCard;
      return next;
    });
  };

  const handleIdTypeChange = (nextType: string): void => {
    const trimmedNext = nextType.trim();
    setStatusMessage('');
    setStatusTone('');
    setErrors((prev) => {
      const next = { ...prev };
      delete next.idType;
      delete next.idCard;
      return next;
    });

    if (!trimmedNext) {
      setIdType('');
      clearUploadedIdAssets();
      return;
    }

    setIdType(trimmedNext);
    idVerification.clearStandbyToken();
    clearStandbyRegistrationTokens();
    resetStaleFacialTokenOnIdMutation();
  };

  // Role Selection Logic for Phase 1
  const handleSelectRole = (role: 'Responder' | 'Civilian'): void => {
    const isRoleSwitching = role !== selectedRole;
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
      if (isRoleSwitching) {
        handleIdTypeChange('');
      }
    } else {
      setAgencyUnit('Security');
      if (!rankOrTitle) setRankOrTitle('Resident');
      if (!employeeId) setEmployeeId('RES-ZN-2026');
      const isResponderOnlyIdType = GOVERNMENT_ID_OPTIONS.some(
        (opt) => opt.responderOnly && opt.value === idType
      );
      if (isRoleSwitching || isResponderOnlyIdType) {
        handleIdTypeChange('');
      }
    }
  };

  const handleAgencyUnitChange = (newUnit: 'RHU' | 'FIRE' | 'PNP'): void => {
    setAgencyUnit(newUnit);
  };

  const handleFacialTokenIssued = (
    arg: FacialTokenIssuedEvent | string | null,
    score?: number,
    matched?: boolean
  ): void => {
    if (arg === null || typeof arg === 'string') {
      const cleanToken = typeof arg === 'string' && arg.trim().length > 0 ? arg.trim() : null;
      setFacialVerificationToken(cleanToken);
      persistStandbyFacialToken(cleanToken);
      setFaceToIdSimilarity(typeof score === 'number' && Number.isFinite(score) ? score : null);
      setIsFaceMatchedToId(Boolean(matched ?? Boolean(cleanToken)));
      setFacialRequiresPendingManualReview(!cleanToken);
      setFacialStatusMessage('');
      return;
    }

    const cleanToken =
      typeof arg.facialVerificationToken === 'string' &&
      arg.facialVerificationToken.trim().length > 0
        ? arg.facialVerificationToken.trim()
        : null;
    setFacialVerificationToken(cleanToken);
    persistStandbyFacialToken(cleanToken);
    setFaceToIdSimilarity(
      typeof arg.faceToIdSimilarity === 'number' && Number.isFinite(arg.faceToIdSimilarity)
        ? arg.faceToIdSimilarity
        : null
    );
    setIsFaceMatchedToId(Boolean(arg.isFaceMatchedToId));
    setFacialRequiresPendingManualReview(Boolean(arg.requiresPendingManualReview));
    setFacialStatusMessage((arg.statusMessage ?? '').trim());
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
  const strengthLabel =
    score >= 5 ? 'STRONG' : score >= 3 ? 'FAIR' : score >= 1 ? 'WEAK' : 'VERY WEAK';
  const strengthTone = score >= 5 ? 'ok' : score >= 3 ? 'warn' : 'bad';

  const isPhase2ReadyForNext = ((): boolean => {
    if (!isIdTypeSelected || !idVerification.canUnlockPersonalInfo) return false;
    if (!idFrontShot || !idBackShot) return false;
    if (!firstName.trim() || !lastName.trim() || !sex.trim() || !dateOfBirth.trim()) return false;
    const parsedAge = parseInt(age, 10);
    if (isNaN(parsedAge) || parsedAge < 18 || parsedAge > 100) return false;
    if (
      !phoneNumber.trim() ||
      !province.trim() ||
      !cityOrMunicipality.trim() ||
      !barangay.trim() ||
      !streetOrPurok.trim()
    ) {
      return false;
    }
    if (selectedRole === 'Responder') {
      if (!['RHU', 'FIRE', 'PNP'].includes(agencyUnit)) return false;
      if (!employeeId.trim() || !rankOrTitle.trim()) return false;
    }
    return true;
  })();

  const isAiAutoApproveReady = Boolean(
    idVerification.idVerificationToken && facialVerificationToken
  );

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

  const validatePhase2IdAndPersonalInfo = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!isIdTypeSelected) {
      newErrors.idType = 'Please select a Government ID document type.';
      setErrors(newErrors);
      return false;
    }
    if (!idFrontShot || !idBackShot) {
      newErrors.idCard =
        'Both Front and Back Government ID images must be uploaded before proceeding.';
    }
    if (!idVerification.canUnlockPersonalInfo) {
      newErrors.idCard =
        idVerification.errorMessage ||
        'Please wait for Government ID verification to unlock Personal Information.';
      setErrors(newErrors);
      return false;
    }

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
    if (!cityOrMunicipality.trim()) {
      newErrors.cityOrMunicipality = 'City / Municipality is required.';
    }
    if (!barangay.trim()) newErrors.barangay = 'Barangay is required.';
    if (!streetOrPurok.trim()) newErrors.streetOrPurok = 'Street / Purok is required.';

    if (selectedRole === 'Responder') {
      if (!employeeId.trim()) {
        newErrors.employeeId = 'Agency Badge / Employee ID is required for Responders.';
      }
      if (!rankOrTitle.trim()) {
        newErrors.rankOrTitle = 'Official Rank or Title is required for Responders.';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhase3FacialRecord = (): boolean => {
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

  const validatePhase4Credentials = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!displayName.trim() || displayName.trim().length < 2) {
      newErrors.displayName =
        'Enter a Display Name / Username (at least 2 characters, used for UI display only).';
    }
    if (!EMAIL_RE.test(email.trim())) {
      newErrors.email = 'Enter a valid email address (used as your sole login identifier).';
    }
    if (password.length < 12) {
      newErrors.password = 'Password must be at least 12 characters long.';
    } else if (displayName.trim() && displayName.trim() === password) {
      newErrors.password = 'Master password cannot match your Display Name / Username.';
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

  // Navigate to target phase (0..4) with validation guards on forward transitions
  const handleNavigatePhase = (targetPhase: number): void => {
    const clampedTarget = Math.min(4, Math.max(0, targetPhase));
    setStatusMessage('');
    setStatusTone('');

    // Backward navigation is always permitted so users can edit earlier phases freely
    if (clampedTarget <= step) {
      setStep(clampedTarget);
      return;
    }

    if (clampedTarget >= 1 && !validatePhase1Role()) {
      setStep(0);
      setStatusMessage('Please complete Phase 1: Role Selection.');
      setStatusTone('bad');
      return;
    }
    if (clampedTarget >= 2 && !validatePhase2IdAndPersonalInfo()) {
      setStep(1);
      setStatusMessage(
        !isIdTypeSelected
          ? 'Please select a Government ID document type before uploading Front and Back ID images.'
          : idVerification.canUnlockPersonalInfo
          ? 'Please complete all required fields in Phase 2: ID & Personal Information.'
          : 'Please upload genuine Front and Back Government ID images to unlock Personal Information.'
      );
      setStatusTone('bad');
      return;
    }
    if (clampedTarget >= 3 && !validatePhase3FacialRecord()) {
      setStep(2);
      setStatusMessage(
        'Please capture, confirm your facial photograph, and accept the privacy consent in Phase 3.'
      );
      setStatusTone('bad');
      return;
    }
    if (clampedTarget >= 4 && !validatePhase4Credentials()) {
      setStep(3);
      setStatusMessage(
        'Please complete your Display Name, Email, Password, and legal certifications in Phase 4.'
      );
      setStatusTone('bad');
      return;
    }

    // Default DisplayName convenience initialization when entering Phase 4 if still empty
    if (clampedTarget === 3 && !displayName.trim() && firstName.trim()) {
      setDisplayName(`${firstName.trim()} ${lastName.trim()}`.trim());
    }

    setStep(clampedTarget);
  };

  // Phase 5: Final Registration Submission
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (isLoading) return;

    if (!validatePhase1Role()) {
      setStep(0);
      setStatusMessage('Role selection is incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase2IdAndPersonalInfo()) {
      setStep(1);
      setStatusMessage('Government ID verification or personal details in Phase 2 are incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase3FacialRecord()) {
      setStep(2);
      setStatusMessage('Facial record capture and consent in Phase 3 are incomplete.');
      setStatusTone('bad');
      return;
    }
    if (!validatePhase4Credentials()) {
      setStep(3);
      setStatusMessage('Account credentials in Phase 4 are incomplete.');
      setStatusTone('bad');
      return;
    }

    setIsLoading(true);
    setStatusMessage(
      isAiAutoApproveReady
        ? 'Validating standby AI verification tokens and activating your verified ResQTrack account...'
        : 'Encrypting identity documents and submitting registration for governance review...'
    );
    setStatusTone('');

    try {
      const isCivilian = selectedRole === 'Civilian';
      const isSyntheticCapture = Boolean(faceMeta?.metadata?.isSyntheticTestRecord);
      let finalDescriptorVector: number[] | undefined =
        biometricDescriptorVector && biometricDescriptorVector.length === 128
          ? biometricDescriptorVector
          : undefined;

      // Never fall back silently to generateDeterministicBiometricVector(email) when real webcam frames are present.
      if (!finalDescriptorVector && !isSyntheticCapture) {
        if (biometricFrameCache.getTotalCount() > 0) {
          const synthesized = await synthesizeMultiPoseTrainedProfile(biometricFrameCache);
          if (synthesized.descriptorVector.length === 128) {
            finalDescriptorVector = synthesized.descriptorVector;
          }
        } else if (faceShot) {
          const extracted = await extractBiometricFeatureVector(faceShot);
          if (extracted.length === 128) {
            finalDescriptorVector = extracted;
          }
        }
      } else if (!finalDescriptorVector && faceConfirmed && isSyntheticCapture) {
        finalDescriptorVector = generateDeterministicBiometricVector(email.trim());
      }

      const payload: RegisterSubmissionPayload = {
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
        employeeOrResidentId: isCivilian
          ? employeeId.trim() || 'RES-ZN-2026'
          : employeeId.trim(),
        departmentOrBarangay: isCivilian
          ? barangay.trim()
          : `${agencyUnit} Tactical Command (${barangay.trim()})`,
        rankOrTitle: isCivilian ? 'Resident' : rankOrTitle.trim(),
        validIdType: idType,
        governmentIdType: idType,
        governmentIdNumber: licenseNumber.trim() || undefined,
        idCaptureDataUrl: idFrontShot || undefined,
        idBackCaptureDataUrl: idBackShot || undefined,
        faceCaptureDataUrl: faceShot || undefined,
        idVerificationToken: isAiAutoApproveReady
          ? idVerification.idVerificationToken || undefined
          : undefined,
        facialVerificationToken: isAiAutoApproveReady
          ? facialVerificationToken || undefined
          : undefined,
        biometricDescriptorVector: finalDescriptorVector,
        geometricSignatureJson:
          facialGeometricSignatureJson || faceMeta?.metadata?.geometricSignatureJson || undefined,
        poseFramesJson: facialPoseFramesJson || faceMeta?.metadata?.poseFramesJson || undefined,
        aiBiometricStrategyName:
          faceMeta?.metadata?.aiBiometricStrategyName ||
          (facialGeometricSignatureJson ? 'ClaudeVisionFacialBiometricStrategy' : undefined),
        email: email.trim(),
        password,
        confirmPassword,
        consentAccepted: faceConsentAccepted && consent1 && consent2,
        consentNoticeVersion: 'v2.0-unified-registration',
        minImageDimension: MIN_IMAGE_DIM
      };

      const res = (await registerUser(payload)) as RegisterResponseWithAutoApproval;
      biometricFrameCache.clear();
      idVerification.clearStandbyToken();
      setFacialVerificationToken(null);
      clearStandbyRegistrationTokens();

      setIsLoading(false);
      setIsSuccess(true);
      setLearningToastMessage(AI_LEARNING_REMINDER_TEXT);
      setPersistenceConfirmation({
        biometricTrainingStatus: res.biometricTrainingStatus,
        biometricTrainingReadyTargetUtc: res.biometricTrainingReadyTargetUtc,
        trainedFrameCount: res.trainedFrameCount
      });
      try {
        sessionStorage.setItem(POST_REGISTER_LEARNING_STORAGE_KEY, AI_LEARNING_REMINDER_TEXT);
      } catch {
        // Storage safeguard
      }

      const summaryMsg =
        res.message ||
        (res.autoApprovedByAi
          ? `${displayName.trim()} (${email.trim()}) verified and auto-approved by AI! Account Status: ${res.status || 'Verified'}. Redirecting to sign in...`
          : `${displayName.trim()} (${email.trim()}) registration submitted. Account Status: ${res.status || 'Pending'}, ID Status: ${res.identityVerificationStatus || 'PendingReview'}, Facial Status: ${res.facialVerificationStatus || 'PendingReview'}. Redirecting to sign in...`);

      setStatusMessage(summaryMsg);
      setStatusTone('ok');

      setTimeout(() => {
        navigate('/login', {
          state: { postRegisterLearningNotice: AI_LEARNING_REMINDER_TEXT }
        });
      }, 2800);
    } catch (err: unknown) {
      setIsLoading(false);
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Registration failed. Please review your details and try again.';
      setStatusMessage(errMsg);
      setStatusTone('bad');
    }
  };

  const resolveSlotBadge = (hasImage: boolean): { text: string; className: string } => {
    if (!hasImage) {
      return { text: 'REQUIRED', className: 'text-[#A83B4D]' };
    }
    if (idVerification.status === 'VERIFIED_GENUINE') {
      return { text: 'AI VERIFIED', className: 'text-emerald-700 font-bold' };
    }
    if (idVerification.status === 'VERIFYING') {
      return { text: 'VERIFYING...', className: 'text-[#A83B4D] font-bold' };
    }
    if (idVerification.status === 'REJECTED_LOCAL' || idVerification.status === 'REJECTED_AI') {
      return { text: 'ACTION REQUIRED', className: 'text-[#670626] font-bold' };
    }
    if (idVerification.status === 'PENDING_MANUAL_REVIEW') {
      return { text: 'PENDING REVIEW', className: 'text-amber-700 font-bold' };
    }
    return { text: 'UPLOADED', className: 'text-[#670626] font-bold' };
  };

  const frontSlotBadge = resolveSlotBadge(Boolean(idFrontShot));
  const backSlotBadge = resolveSlotBadge(Boolean(idBackShot));

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 w-full overflow-y-auto relative"
      style={{ background: 'linear-gradient(145deg, #4A041A 0%, #670626 55%, #3B0315 100%)' }}
    >
      {/* Prominent 5-Minute AI Learning Toast Notification */}
      {learningToastMessage && (
        <div
          id="registration-ai-learning-toast"
          role="alert"
          aria-live="assertive"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(680px,94vw)] rounded-2xl bg-[#F7F1EA] border-2 border-[#670626] p-4 shadow-[0_24px_48px_-10px_rgba(38,2,14,0.65)] text-[#670626] flex items-start gap-3"
        >
          <div className="p-2 rounded-xl bg-[#670626] text-[#F7F1EA] shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="font-mono text-xs font-bold uppercase tracking-wider text-[#A83B4D]">
              Biometric Enrollment Persisted // 5-Minute AI Study Active
            </div>
            <p className="font-sans text-xs sm:text-sm font-semibold text-[#670626] leading-relaxed m-0">
              {learningToastMessage}
            </p>
          </div>
        </div>
      )}

      <div className="w-full max-w-[940px] mx-auto flex flex-col items-center justify-center my-auto relative z-10">
        <header className="text-center mb-5 w-full">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[#F7F1EA] font-['Montserrat',sans-serif]">
            RESQTRACK
          </h1>
          <p className="text-sm sm:text-base font-bold text-[#E9D9D0] mt-1 tracking-wide">
            Account Registration
          </p>
        </header>

        <section
          className="clay-surface relative w-full rounded-3xl bg-[#F7F1EA] border border-[#E9D9D0] p-5 sm:p-8 text-[#670626] shadow-[0_28px_64px_-12px_rgba(38,2,14,0.55),inset_0_2px_4px_rgba(255,255,255,0.85)]"
          aria-labelledby="panel-title"
          style={{ maxWidth: isMobile ? '100%' : '940px' }}
        >
          <h2 className="visually-hidden" id="panel-title">
            Create account
          </h2>

          <form id="register-form" onSubmit={handleSubmit} noValidate>
            {/* Live Telemetry Status Header */}
            <div className="flex items-center justify-between font-mono text-xs sm:text-sm tracking-wider text-[#670626] border-b border-[#D5BEB3] pb-3 mb-4">
              <span className="flex items-center gap-2 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-[#670626] animate-pulse" />
                5-PHASE REGISTRATION
              </span>
              <span className="text-[#A83B4D] tracking-widest hidden sm:inline text-xs font-bold">
                {isAiAutoApproveReady ? 'AI AUTO-APPROVE' : 'MANUAL REVIEW'}
              </span>
            </div>

            {/* 5-Phase Navigation Stepper with Layered Progress Line */}
            <div
              className="relative w-full my-4 px-1 sm:px-2"
              aria-label="Account creation 5-phase progress"
            >
              {/* Background connector line spanning from first circle to last circle */}
              <div
                className="absolute top-[16px] h-[2px] -translate-y-1/2 z-0 pointer-events-none"
                style={{
                  left: 'calc(100% / 10)',
                  right: 'calc(100% / 10)'
                }}
                aria-hidden="true"
              >
                <div className="w-full h-full bg-[#D5BEB3] rounded-full" />
                <div
                  className="absolute top-0 left-0 h-full bg-[#670626] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(Math.min(Math.max(step, 0), 4) / 4) * 100}%` }}
                />
              </div>

              {/* 5 Evenly Distributed Step Columns */}
              <ol className="relative z-10 grid grid-cols-5 gap-1 w-full m-0 p-0 list-none">
                {STEPS.map((phase) => {
                  const isActive = step === phase.idx;
                  const isDone = step > phase.idx;
                  return (
                    <li
                      key={phase.idx}
                      className={`flex flex-col items-center justify-start text-center gap-1.5 min-w-0 select-none ${
                        isActive ? 'is-active' : isDone ? 'is-done' : ''
                      }`}
                      data-step-item={phase.idx}
                      aria-current={isActive ? 'step' : undefined}
                      onClick={() => handleNavigatePhase(phase.idx)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs sm:text-sm font-bold z-10 transition-all border-2 ${
                          isDone
                            ? 'bg-[#670626] border-[#670626] text-[#F7F1EA]'
                            : isActive
                            ? 'bg-[#F7F1EA] border-[#670626] text-[#670626] ring-4 ring-[#670626]/15'
                            : 'bg-[#E9D9D0] border-[#D5BEB3] text-[#7D2B3D]'
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-4 h-4 text-[#F7F1EA] stroke-[2.5]" />
                        ) : (
                          phase.idx + 1
                        )}
                      </span>
                      <span
                        className={`font-mono text-xs sm:text-sm leading-tight ${
                          isActive
                            ? 'text-[#670626] font-extrabold'
                            : isDone
                            ? 'text-[#670626] font-bold'
                            : 'text-[#A83B4D] font-semibold'
                        }`}
                      >
                        {phase.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* =====================================================================
                PHASE 1 (step === 0): ROLE SELECTION
               ===================================================================== */}
            {step === 0 && (
              <div className="step" data-step="0" id="phase-1-role">
                <div className="text-center mb-5">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E9D9D0] border border-[#D5BEB3] font-mono text-xs text-[#670626] font-bold uppercase tracking-widest mb-2">
                    <Shield className="w-4 h-4 text-[#A83B4D]" />
                    PHASE 1/5 // ROLE
                  </div>
                  <h3 className="font-mono text-base sm:text-lg font-bold text-[#670626] uppercase tracking-wider">
                    Select Role <span className="text-[#A83B4D]">*</span>
                  </h3>
                </div>

                {/* Sliding Role Selector Segmented Bar */}
                <div className="relative p-1 bg-[#E9D9D0] rounded-2xl border border-[#D5BEB3] mb-6 max-w-md mx-auto">
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl transition-all duration-300 ease-out pointer-events-none shadow-md bg-[#670626] ${
                      selectedRole === 'Responder' ? 'left-1' : 'left-[calc(50%+2px)]'
                    }`}
                  />
                  <div className="grid grid-cols-2 relative z-10">
                    <button
                      type="button"
                      id="role-btn-responder"
                      onClick={() => handleSelectRole('Responder')}
                      className={`py-2.5 px-3 rounded-xl font-mono text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedRole === 'Responder'
                          ? 'text-[#F7F1EA]'
                          : 'text-[#670626] hover:text-[#4A041A]'
                      }`}
                    >
                      <Shield className="w-4 h-4 shrink-0" />
                      <span>Responders</span>
                    </button>
                    <button
                      type="button"
                      id="role-btn-civilian"
                      onClick={() => handleSelectRole('Civilian')}
                      className={`py-2.5 px-3 rounded-xl font-mono text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedRole === 'Civilian'
                          ? 'text-[#F7F1EA]'
                          : 'text-[#670626] hover:text-[#4A041A]'
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
                    className={`group relative rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      selectedRole === 'Responder'
                        ? 'bg-[#EFE4DD] border-2 border-[#670626] shadow-md ring-2 ring-[#A83B4D]/25'
                        : 'bg-[#F7F1EA] border border-[#D5BEB3] hover:border-[#A83B4D] hover:bg-[#EFE4DD]/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            selectedRole === 'Responder'
                              ? 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]'
                              : 'bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]'
                          }`}
                        >
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider font-bold">
                          <span className="px-2.5 py-0.5 rounded-md border bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]">
                            TIER-1 DISPATCH
                          </span>
                          {selectedRole === 'Responder' && (
                            <span className="w-5 h-5 rounded-full bg-[#670626] text-[#F7F1EA] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-mono text-base font-bold text-[#670626] uppercase tracking-wider mb-2.5">
                        Responders
                      </h4>

                      <div className="space-y-2 pt-2.5 border-t border-[#D5BEB3] font-mono text-xs sm:text-sm">
                        <div className="flex items-center gap-2 text-[#591529]">
                          <HeartPulse className="w-4 h-4 text-[#A83B4D] shrink-0" />
                          <span>RHU &middot; Medical</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#591529]">
                          <Flame className="w-4 h-4 text-[#A83B4D] shrink-0" />
                          <span>BFP &middot; Fire</span>
                        </div>
                        <div className="flex items-center gap-2 text-[#591529]">
                          <Siren className="w-4 h-4 text-[#A83B4D] shrink-0" />
                          <span>PNP &middot; Police</span>
                        </div>
                      </div>
                    </div>

                    {selectedRole === 'Responder' && (
                      <div
                        className="mt-4 pt-3 border-t border-[#D5BEB3]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold mb-2"
                          htmlFor="phase1-agency-unit"
                        >
                          Unit <span className="text-[#A83B4D]">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['FIRE', 'RHU', 'PNP'] as const).map((u) => (
                            <button
                              key={u}
                              type="button"
                              id={`unit-btn-${u.toLowerCase()}`}
                              onClick={() => handleAgencyUnitChange(u)}
                              className={`py-2 px-2 rounded-xl font-mono text-xs font-bold uppercase border cursor-pointer transition-all ${
                                agencyUnit === u
                                  ? 'bg-[#670626] text-[#F7F1EA] border-[#4A041A] shadow-sm'
                                  : 'bg-[#E9D9D0] text-[#670626] border-[#D5BEB3] hover:border-[#670626]'
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
                    className={`group relative rounded-2xl p-5 transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      selectedRole === 'Civilian'
                        ? 'bg-[#EFE4DD] border-2 border-[#670626] shadow-md ring-2 ring-[#A83B4D]/25'
                        : 'bg-[#F7F1EA] border border-[#D5BEB3] hover:border-[#A83B4D] hover:bg-[#EFE4DD]/70'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`p-2.5 rounded-xl border ${
                            selectedRole === 'Civilian'
                              ? 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]'
                              : 'bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]'
                          }`}
                        >
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider font-bold">
                          <span className="px-2.5 py-0.5 rounded-md border bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]">
                            TIER-3 CITIZEN
                          </span>
                          {selectedRole === 'Civilian' && (
                            <span className="w-5 h-5 rounded-full bg-[#670626] text-[#F7F1EA] flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-mono text-base font-bold text-[#670626] uppercase tracking-wider">
                        Civilians
                      </h4>
                      <p className="font-mono text-xs sm:text-sm text-[#A83B4D] font-semibold mb-2 mt-1">
                        Community Resident
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-[#D5BEB3] font-mono text-xs sm:text-sm text-[#7D2B3D] flex items-center justify-between">
                      <span>Req: Gov ID &middot; Profile &middot; Face Match</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    className="w-full !h-[48px] text-sm sm:text-base bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold tracking-wider uppercase rounded-xl shadow-lg shadow-[#4A041A]/25 cursor-pointer flex items-center justify-center gap-2 transition-all"
                    type="button"
                    id="btn-phase1-next"
                    data-next="1"
                    onClick={() => handleNavigatePhase(1)}
                  >
                    <span>
                      Continue ({selectedRole === 'Responder' ? `Responder · ${agencyUnit}` : 'Civilian'})
                    </span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 2 (step === 1): UNIFIED GOVERNMENT ID & HIDDEN PERSONAL INFO
               ===================================================================== */}
            {step === 1 && (
              <div className="step" data-step="1" data-phase="id-identity" id="phase-2-id-identity">
                {/* Active Role Ribbon */}
                <div className="flex items-center justify-between p-3 rounded-xl border mb-4 font-mono text-xs sm:text-sm bg-[#EFE4DD] border-[#D5BEB3] text-[#670626]">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#A83B4D] shrink-0" />
                    <span>
                      Active Role:{' '}
                      <strong>
                        {selectedRole === 'Responder'
                          ? `Responder (${agencyUnit})`
                          : 'Civilian'}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNavigatePhase(0)}
                    className="underline text-xs sm:text-sm font-bold text-[#670626] hover:text-[#A83B4D] cursor-pointer ml-2"
                  >
                    Change
                  </button>
                </div>

                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E9D9D0] border border-[#D5BEB3] font-mono text-xs text-[#670626] font-bold uppercase tracking-widest mb-1.5">
                    <CreditCard className="w-4 h-4 text-[#A83B4D]" />
                    PHASE 2/5 // GOV ID &amp; PROFILE
                  </div>
                  <p className="font-sans text-sm text-[#591529] mt-1 max-w-xl mx-auto">
                    Upload Front &amp; Back ID photos (PNG/JPG/WebP, max 5 MB).
                  </p>
                </div>

                {/* Government ID Document Type Selector */}
                <div
                  className={`p-4 rounded-2xl bg-[#EFE4DD] border mb-5 ${
                    errors.idType ? 'is-invalid border-[#670626]' : 'border-[#D5BEB3]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                      htmlFor="id-type"
                    >
                      Government ID Type <span className="text-[#A83B4D]">*</span>
                    </label>
                  </div>
                  <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[46px]">
                    <CreditCard className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                    <select
                      className="w-full py-2.5 bg-transparent font-sans text-[#670626] text-sm font-medium appearance-none cursor-pointer focus:outline-none"
                      id="id-type"
                      name="idType"
                      aria-invalid={Boolean(errors.idType)}
                      aria-describedby={errors.idType ? 'id-type-error' : undefined}
                      value={idType}
                      onChange={(e) => handleIdTypeChange(e.target.value)}
                    >
                      <option value="" className="bg-[#F7F1EA] text-[#670626]">Choose ID Type</option>
                      {visibleGovernmentIdOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#F7F1EA] text-[#670626]">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-[#A83B4D] ml-auto shrink-0 pointer-events-none" />
                  </div>
                  {errors.idType && (
                    <p
                      className="font-mono text-xs mt-2 text-[#670626] font-semibold flex items-center gap-1.5"
                      id="id-type-error"
                      role="alert"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errors.idType}</span>
                    </p>
                  )}
                </div>

                {/* Gated Front & Back Dropzones */}
                {!isIdTypeSelected ? (
                  <div
                    id="id-upload-locked-notice"
                    role="status"
                    aria-live="polite"
                    className="id-upload-locked-notice rounded-2xl bg-[#EFE4DD] border border-[#D5BEB3] p-5 flex items-start gap-3.5"
                  >
                    <div className="p-2.5 rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] shrink-0">
                      <ShieldAlert className="w-5 h-5 text-[#670626]" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-sm font-bold uppercase tracking-wider text-[#670626] flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-[#A83B4D] shrink-0" />
                        <span>ID Upload Locked</span>
                      </div>
                      <p className="font-sans text-sm text-[#591529] leading-relaxed m-0">
                        Select an ID type above to enable upload.
                      </p>
                    </div>
                  </div>
                ) : (
                  <section id="id-upload-section" aria-label="Government ID Upload">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-sm font-bold text-[#670626] uppercase tracking-wider">
                        Front &amp; Back ID <span className="text-[#A83B4D]">*</span>
                      </span>
                      {(idFrontShot || idBackShot) && (
                        <button
                          type="button"
                          id="btn-clear-both-ids"
                          onClick={handleClearBothIds}
                          className="font-mono text-xs text-[#670626] hover:text-[#4A041A] px-3 py-1.5 rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] hover:bg-[#DFC9BE] cursor-pointer flex items-center gap-1.5 font-semibold"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#A83B4D]" />
                          <span>Clear Both</span>
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
                            }
                            e.target.value = '';
                          }}
                        />
                        <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
                          <span className="font-bold uppercase tracking-wider text-[#670626]">
                            Front ID <span className="text-[#A83B4D]">*</span>
                          </span>
                          <span className={frontSlotBadge.className}>{frontSlotBadge.text}</span>
                        </div>

                        {idFrontShot ? (
                          <div className="relative rounded-2xl overflow-hidden border border-[#D5BEB3] bg-[#EFE4DD] p-3 flex flex-col items-center">
                            <div className="relative w-full overflow-hidden rounded-xl border border-[#D5BEB3]">
                              <img
                                src={idFrontShot}
                                alt="Front Government ID Preview"
                                id="front-id-preview"
                                className="w-full h-auto object-cover"
                                style={{ aspectRatio: '85.6 / 53.98' }}
                              />
                            </div>
                            {idFrontMeta && (
                              <div className="mt-2 w-full font-mono text-xs text-[#7D2B3D] flex items-center justify-between">
                                <span className="truncate max-w-[160px]">{idFrontMeta.name}</span>
                                <span>
                                  {idFrontMeta.width}x{idFrontMeta.height}px &bull;{' '}
                                  {(idFrontMeta.sizeBytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            )}
                            <div className="mt-2.5 w-full flex items-center justify-between gap-2 font-mono text-xs">
                              <span
                                className={`px-2.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${
                                  idVerification.status === 'VERIFIED_GENUINE'
                                    ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                                    : 'bg-[#F7F1EA] border-[#D5BEB3] text-[#670626]'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> {frontSlotBadge.text}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  id="btn-replace-front-id"
                                  onClick={() => frontFileInputRef.current?.click()}
                                  className="text-[#670626] hover:text-[#A83B4D] font-semibold underline cursor-pointer text-xs"
                                >
                                  Replace
                                </button>
                                <span className="text-[#A83B4D]">&bull;</span>
                                <button
                                  type="button"
                                  id="btn-remove-front-id"
                                  onClick={() => handleRemoveSingleIdSide('front')}
                                  className="text-[#A83B4D] hover:text-[#670626] font-semibold underline cursor-pointer text-xs"
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
                            className={`relative rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[172px] ${
                              isDraggingFront
                                ? 'border-[#670626] bg-[#E9D9D0]'
                                : 'border-[#A83B4D]/50 bg-[#EFE4DD] hover:border-[#670626] hover:bg-[#E9D9D0]'
                            }`}
                          >
                            <div className="p-3 rounded-full bg-[#F7F1EA] border border-[#D5BEB3] text-[#670626] mb-2">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-mono text-sm font-bold text-[#670626] uppercase tracking-wider">
                              Front ID <span className="text-[#A83B4D]">*</span>
                            </span>
                            <span className="font-sans text-xs text-[#7D2B3D] mt-1">
                              Drop or click (PNG/JPG/WebP, &lt;= 5 MB)
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
                            }
                            e.target.value = '';
                          }}
                        />
                        <div className="flex items-center justify-between mb-1.5 font-mono text-xs">
                          <span className="font-bold uppercase tracking-wider text-[#670626]">
                            Back ID <span className="text-[#A83B4D]">*</span>
                          </span>
                          <span className={backSlotBadge.className}>{backSlotBadge.text}</span>
                        </div>

                        {idBackShot ? (
                          <div className="relative rounded-2xl overflow-hidden border border-[#D5BEB3] bg-[#EFE4DD] p-3 flex flex-col items-center">
                            <div className="relative w-full overflow-hidden rounded-xl border border-[#D5BEB3]">
                              <img
                                src={idBackShot}
                                alt="Back Government ID Preview"
                                id="back-id-preview"
                                className="w-full h-auto object-cover"
                                style={{ aspectRatio: '85.6 / 53.98' }}
                              />
                            </div>
                            {idBackMeta && (
                              <div className="mt-2 w-full font-mono text-xs text-[#7D2B3D] flex items-center justify-between">
                                <span className="truncate max-w-[160px]">{idBackMeta.name}</span>
                                <span>
                                  {idBackMeta.width}x{idBackMeta.height}px &bull;{' '}
                                  {(idBackMeta.sizeBytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            )}
                            <div className="mt-2.5 w-full flex items-center justify-between gap-2 font-mono text-xs">
                              <span
                                className={`px-2.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${
                                  idVerification.status === 'VERIFIED_GENUINE'
                                    ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                                    : 'bg-[#F7F1EA] border-[#D5BEB3] text-[#670626]'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" /> {backSlotBadge.text}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  id="btn-replace-back-id"
                                  onClick={() => backFileInputRef.current?.click()}
                                  className="text-[#670626] hover:text-[#A83B4D] font-semibold underline cursor-pointer text-xs"
                                >
                                  Replace
                                </button>
                                <span className="text-[#A83B4D]">&bull;</span>
                                <button
                                  type="button"
                                  id="btn-remove-back-id"
                                  onClick={() => handleRemoveSingleIdSide('back')}
                                  className="text-[#A83B4D] hover:text-[#670626] font-semibold underline cursor-pointer text-xs"
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
                            className={`relative rounded-2xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[172px] ${
                              isDraggingBack
                                ? 'border-[#670626] bg-[#E9D9D0]'
                                : 'border-[#A83B4D]/50 bg-[#EFE4DD] hover:border-[#670626] hover:bg-[#E9D9D0]'
                            }`}
                          >
                            <div className="p-3 rounded-full bg-[#F7F1EA] border border-[#D5BEB3] text-[#670626] mb-2">
                              <Upload className="w-5 h-5" />
                            </div>
                            <span className="font-mono text-sm font-bold text-[#670626] uppercase tracking-wider">
                              Back ID <span className="text-[#A83B4D]">*</span>
                            </span>
                            <span className="font-sans text-xs text-[#7D2B3D] mt-1">
                              Drop or click (PNG/JPG/WebP, &lt;= 5 MB)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {errors.idCard && (
                      <p
                        className="font-mono text-xs mt-3 text-[#670626] font-semibold flex items-center gap-1.5"
                        role="alert"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errors.idCard}</span>
                      </p>
                    )}

                    {/* Headless Background Verification Status Banner */}
                    <IdVerificationBanner
                      status={idVerification.status}
                      errorCode={idVerification.errorCode}
                      errorMessage={idVerification.errorMessage}
                      detectedIdLabel={idVerification.detectedIdLabel}
                      hasFrontImage={Boolean(idFrontShot)}
                      hasBackImage={Boolean(idBackShot)}
                      hasStandbyToken={Boolean(idVerification.idVerificationToken)}
                      onRetry={idVerification.retryVerification}
                    />
                  </section>
                )}

                {/* Hidden-Until-Verified Personal & Address Section */}
                {isIdTypeSelected &&
                  Boolean(idFrontShot && idBackShot) &&
                  idVerification.canUnlockPersonalInfo && (
                  <section
                    id="personal-info-section"
                    aria-label="Personal and Residential Information"
                    className="mt-5 pt-4 border-t border-[#D5BEB3]"
                  >
                    <div className="p-3.5 rounded-xl bg-[#EFE4DD] border border-[#D5BEB3] mb-4 font-mono text-xs sm:text-sm text-[#670626] font-semibold">
                      {idVerification.status === 'VERIFIED_GENUINE'
                        ? 'Visible ID fields auto-filled. Complete required (*) fields.'
                        : 'AI unavailable — enter details for manual review.'}
                    </div>

                    <div className="form-grid">
                      {/* ID / Document Serial Number */}
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="license-number"
                          >
                            ID / Document Number{' '}
                            <span className="text-[#A83B4D] text-xs">(Optional)</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <CreditCard className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="license-number"
                            name="licenseNumber"
                            type="text"
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value)}
                            placeholder="ID / Document number"
                          />
                        </div>
                      </div>

                      {/* First Name */}
                      <div className={errors.firstName ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="first-name"
                          >
                            First Name <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="first-name"
                            name="firstName"
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="First name"
                            autoComplete="given-name"
                          />
                        </div>
                        {errors.firstName && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="first-name-error"
                            role="alert"
                          >
                            {errors.firstName}
                          </p>
                        )}
                      </div>

                      {/* Middle Name */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="middle-name"
                          >
                            Middle Name{' '}
                            <span className="text-[#A83B4D] text-xs">(Optional)</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="middle-name"
                            name="middleName"
                            type="text"
                            value={middleName}
                            onChange={(e) => setMiddleName(e.target.value)}
                            placeholder="Middle name"
                            autoComplete="additional-name"
                          />
                        </div>
                      </div>

                      {/* Last Name / Surname */}
                      <div className={errors.lastName ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="last-name"
                          >
                            Last Name / Surname <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="last-name"
                            name="lastName"
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Surname"
                            autoComplete="family-name"
                          />
                        </div>
                        {errors.lastName && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="last-name-error"
                            role="alert"
                          >
                            {errors.lastName}
                          </p>
                        )}
                      </div>

                      {/* Suffix */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="suffix"
                          >
                            Suffix <span className="text-[#A83B4D] text-xs">(Optional)</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="suffix"
                            name="suffix"
                            type="text"
                            value={suffix}
                            onChange={(e) => setSuffix(e.target.value)}
                            placeholder="Jr., III"
                          />
                        </div>
                      </div>

                      {/* Sex */}
                      <div className={errors.sex ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="sex"
                          >
                            Sex <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <Users className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <select
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm appearance-none cursor-pointer focus:outline-none"
                            id="sex"
                            name="sex"
                            value={sex}
                            onChange={(e) => setSex(e.target.value)}
                          >
                            <option value="" className="bg-[#F7F1EA] text-[#670626]">Select Sex</option>
                            <option value="Male" className="bg-[#F7F1EA] text-[#670626]">Male</option>
                            <option value="Female" className="bg-[#F7F1EA] text-[#670626]">Female</option>
                            <option value="Other" className="bg-[#F7F1EA] text-[#670626]">Other</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-[#A83B4D] ml-auto shrink-0 pointer-events-none" />
                        </div>
                        {errors.sex && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="sex-error"
                            role="alert"
                          >
                            {errors.sex}
                          </p>
                        )}
                      </div>

                      {/* Date of Birth */}
                      <div className={errors.dateOfBirth ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="dob"
                          >
                            Date of Birth <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <Calendar className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
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
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="dob-error"
                            role="alert"
                          >
                            {errors.dateOfBirth}
                          </p>
                        )}
                      </div>

                      {/* Age */}
                      <div className={errors.age ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="age"
                          >
                            Age (18&ndash;100) <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <Calendar className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="age"
                            name="age"
                            type="number"
                            min={18}
                            max={100}
                            value={age}
                            onChange={(e) => setAge(e.target.value)}
                            placeholder="18-100"
                          />
                        </div>
                        {errors.age && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="age-error"
                            role="alert"
                          >
                            {errors.age}
                          </p>
                        )}
                      </div>

                      {/* Contact Number */}
                      <div className={errors.phoneNumber ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="phone-number"
                          >
                            Contact Number <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <Phone className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="phone-number"
                            name="phoneNumber"
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="09XX XXX XXXX"
                            autoComplete="tel"
                          />
                        </div>
                        {errors.phoneNumber && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="phone-error"
                            role="alert"
                          >
                            {errors.phoneNumber}
                          </p>
                        )}
                      </div>

                      {/* Province */}
                      <div className={errors.province ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="province"
                          >
                            Province <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <MapPin className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="province"
                            name="province"
                            type="text"
                            value={province}
                            onChange={(e) => setProvince(e.target.value)}
                            placeholder="Zamboanga del Norte"
                          />
                        </div>
                        {errors.province && (
                          <p className="font-mono text-xs mt-1 text-[#670626] font-semibold" role="alert">
                            {errors.province}
                          </p>
                        )}
                      </div>

                      {/* City / Municipality */}
                      <div className={errors.cityOrMunicipality ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="city"
                          >
                            City / Municipality <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <MapPin className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="city"
                            name="cityOrMunicipality"
                            type="text"
                            value={cityOrMunicipality}
                            onChange={(e) => setCityOrMunicipality(e.target.value)}
                            placeholder="Katipunan"
                          />
                        </div>
                        {errors.cityOrMunicipality && (
                          <p className="font-mono text-xs mt-1 text-[#670626] font-semibold" role="alert">
                            {errors.cityOrMunicipality}
                          </p>
                        )}
                      </div>

                      {/* Barangay */}
                      <div className={errors.barangay ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="barangay"
                          >
                            Barangay <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <MapPin className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="barangay"
                            name="barangay"
                            type="text"
                            value={barangay}
                            onChange={(e) => setBarangay(e.target.value)}
                            placeholder="Barangay"
                          />
                        </div>
                        {errors.barangay && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="barangay-error"
                            role="alert"
                          >
                            {errors.barangay}
                          </p>
                        )}
                      </div>

                      {/* Street / Purok */}
                      <div className={errors.streetOrPurok ? 'is-invalid' : ''}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="street-purok"
                          >
                            Street / Purok <span className="text-[#A83B4D]">*</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <MapPin className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="street-purok"
                            name="streetOrPurok"
                            type="text"
                            value={streetOrPurok}
                            onChange={(e) => setStreetOrPurok(e.target.value)}
                            placeholder="Purok / Street"
                          />
                        </div>
                        {errors.streetOrPurok && (
                          <p
                            className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                            id="street-error"
                            role="alert"
                          >
                            {errors.streetOrPurok}
                          </p>
                        )}
                      </div>

                      {/* Optional Weight & Height */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="weight"
                          >
                            Weight <span className="text-[#A83B4D] text-xs">(Optional)</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="weight"
                            name="weight"
                            type="text"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="65 kg"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label
                            className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                            htmlFor="height"
                          >
                            Height <span className="text-[#A83B4D] text-xs">(Optional)</span>
                          </label>
                        </div>
                        <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                          <input
                            className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                            id="height"
                            name="height"
                            type="text"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            placeholder="1.70 m"
                          />
                        </div>
                      </div>

                      {/* Responder-Specific Required Fields */}
                      {selectedRole === 'Responder' && (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label
                                className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                                htmlFor="agency-unit"
                              >
                                Agency Unit <span className="text-[#A83B4D]">*</span>
                              </label>
                            </div>
                            <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                              <Shield className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                              <select
                                className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm appearance-none cursor-pointer focus:outline-none"
                                id="agency-unit"
                                value={agencyUnit}
                                onChange={(e) =>
                                  handleAgencyUnitChange(e.target.value as 'RHU' | 'FIRE' | 'PNP')
                                }
                              >
                                <option value="RHU" className="bg-[#F7F1EA] text-[#670626]">RHU Medical</option>
                                <option value="FIRE" className="bg-[#F7F1EA] text-[#670626]">BFP Fire</option>
                                <option value="PNP" className="bg-[#F7F1EA] text-[#670626]">PNP Police</option>
                              </select>
                              <ChevronDown className="w-4 h-4 text-[#A83B4D] ml-auto shrink-0 pointer-events-none" />
                            </div>
                          </div>

                          <div className={errors.employeeId ? 'is-invalid' : ''}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label
                                className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                                htmlFor="employee-id"
                              >
                                Badge / Employee ID <span className="text-[#A83B4D]">*</span>
                              </label>
                            </div>
                            <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                              <CreditCard className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                              <input
                                className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                                id="employee-id"
                                type="text"
                                value={employeeId}
                                onChange={(e) => setEmployeeId(e.target.value)}
                                placeholder="BFP-ZN-2026-089"
                              />
                            </div>
                            {errors.employeeId && (
                              <p
                                className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                                id="employee-error"
                                role="alert"
                              >
                                {errors.employeeId}
                              </p>
                            )}
                          </div>

                          <div className={`md:col-span-2 ${errors.rankOrTitle ? 'is-invalid' : ''}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label
                                className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                                htmlFor="rank-title"
                              >
                                Rank / Position <span className="text-[#A83B4D]">*</span>
                              </label>
                            </div>
                            <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                              <Award className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                              <input
                                className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                                id="rank-title"
                                type="text"
                                value={rankOrTitle}
                                onChange={(e) => setRankOrTitle(e.target.value)}
                                placeholder="Rank or title"
                              />
                            </div>
                            {errors.rankOrTitle && (
                              <p
                                className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                                id="rank-error"
                                role="alert"
                              >
                                {errors.rankOrTitle}
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </section>
                )}

                <div className="flex gap-2.5 mt-6">
                  <button
                    className="!h-[46px] !w-32 font-mono text-sm font-semibold rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] text-[#670626] hover:bg-[#DFC9BE] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    type="button"
                    id="btn-phase2-back"
                    onClick={() => handleNavigatePhase(0)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    className={`flex-1 !h-[46px] text-sm sm:text-base bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold tracking-wider uppercase rounded-xl shadow-md shadow-[#4A041A]/25 flex items-center justify-center gap-2 transition-all ${
                      isPhase2ReadyForNext
                        ? 'cursor-pointer'
                        : 'opacity-45 saturate-50 cursor-not-allowed'
                    }`}
                    type="button"
                    id="btn-phase2-next"
                    disabled={!isPhase2ReadyForNext}
                    onClick={() => handleNavigatePhase(2)}
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 3 (step === 2): FACIAL RECORD & FACE-TO-ID PORTRAIT MATCH
               ===================================================================== */}
            {step === 2 && (
              <div className="step" data-step="2" id="phase-3-facial-record">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E9D9D0] border border-[#D5BEB3] font-mono text-xs text-[#670626] font-bold uppercase tracking-widest mb-1.5">
                    <Camera className="w-4 h-4 text-[#A83B4D]" />
                    PHASE 3/5 // FACIAL RECORD
                  </div>
                  <h3 className="font-mono text-base sm:text-lg font-bold text-[#670626] uppercase tracking-wider">
                    Face Scan &amp; ID Match
                  </h3>
                </div>

                <ManualFacialCapturePanel
                  capturedDataUrl={faceShot}
                  isConfirmed={faceConfirmed}
                  consentAccepted={faceConsentAccepted}
                  frontIdCaptureDataUrl={idFrontShot}
                  idVerificationToken={idVerification.idVerificationToken}
                  onFacialTokenIssued={handleFacialTokenIssued}
                  onConfirmCapture={(_bestCenterFrame, metadata) => {
                    if (metadata.geometricSignatureJson) {
                      setFacialGeometricSignatureJson(metadata.geometricSignatureJson);
                    }
                    if (metadata.poseFramesJson) {
                      setFacialPoseFramesJson(metadata.poseFramesJson);
                    }
                    if (metadata.descriptorVector && metadata.descriptorVector.length > 0) {
                      setBiometricDescriptorVector(metadata.descriptorVector);
                    }
                  }}
                  onCaptureConfirmed={(dataUrl, dims) => {
                    setFaceShot(dataUrl);
                    setFaceConfirmed(true);
                    setFaceMeta(dims);
                    if (dims.geometricSignatureJson) {
                      setFacialGeometricSignatureJson(dims.geometricSignatureJson);
                    } else if (dims.metadata?.geometricSignatureJson) {
                      setFacialGeometricSignatureJson(dims.metadata.geometricSignatureJson);
                    }
                    if (dims.poseFramesJson) {
                      setFacialPoseFramesJson(dims.poseFramesJson);
                    } else if (dims.metadata?.poseFramesJson) {
                      setFacialPoseFramesJson(dims.metadata.poseFramesJson);
                    }
                    if (dims.descriptorVector && dims.descriptorVector.length > 0) {
                      setBiometricDescriptorVector(dims.descriptorVector);
                    } else if (
                      dims.metadata?.descriptorVector &&
                      dims.metadata.descriptorVector.length > 0
                    ) {
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
                    setFacialGeometricSignatureJson('');
                    setFacialPoseFramesJson('');
                    setFacialVerificationToken(null);
                    setFaceToIdSimilarity(null);
                    setIsFaceMatchedToId(false);
                    setFacialRequiresPendingManualReview(false);
                    setFacialStatusMessage('');
                    persistStandbyFacialToken(null);
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

                <div className="flex gap-2.5 mt-6">
                  <button
                    className="!h-[46px] !w-32 font-mono text-sm font-semibold rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] text-[#670626] hover:bg-[#DFC9BE] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    type="button"
                    id="btn-phase3-back"
                    onClick={() => handleNavigatePhase(1)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    className={`flex-1 !h-[46px] text-sm sm:text-base bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold tracking-wider uppercase rounded-xl shadow-md shadow-[#4A041A]/25 cursor-pointer flex items-center justify-center gap-2 transition-all ${
                      faceConfirmed && faceConsentAccepted ? '' : 'opacity-50 saturate-50'
                    }`}
                    type="button"
                    id="btn-phase3-next"
                    onClick={() => handleNavigatePhase(3)}
                  >
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 4 (step === 3): ACCOUNT CREDENTIALS
               ===================================================================== */}
            {step === 3 && (
              <div className="step" data-step="3" id="phase-4-credentials">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E9D9D0] border border-[#D5BEB3] font-mono text-xs text-[#670626] font-bold uppercase tracking-widest mb-1.5">
                    <Lock className="w-4 h-4 text-[#A83B4D]" />
                    PHASE 4/5 // CREDENTIALS
                  </div>
                  <h3 className="font-mono text-base sm:text-lg font-bold text-[#670626] uppercase tracking-wider">
                    Display Name, Login Email &amp; Password
                  </h3>
                </div>

                <div className="form-grid">
                  {/* Display Name / Username (Presentation Only) */}
                  <div className={errors.displayName ? 'is-invalid' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                        htmlFor="display-name"
                      >
                        Display Name <span className="text-[#A83B4D]">*</span>
                      </label>
                    </div>
                    <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                      <User className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                      <input
                        className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                        id="display-name"
                        name="displayName"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="UI display only"
                        autoComplete="nickname"
                      />
                    </div>
                    {errors.displayName && (
                      <p
                        className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                        id="display-name-error"
                        role="alert"
                      >
                        {errors.displayName}
                      </p>
                    )}
                  </div>

                  {/* Email Address (Sole Login Identifier) */}
                  <div className={errors.email ? 'is-invalid' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                        htmlFor="email"
                      >
                        Login Email <span className="text-[#A83B4D]">*</span>
                      </label>
                    </div>
                    <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                      <Mail className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                      <input
                        className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                        id="email"
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Login identifier"
                        autoComplete="email"
                      />
                    </div>
                    {errors.email && (
                      <p
                        className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                        id="email-error"
                        role="alert"
                      >
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className={errors.password ? 'is-invalid' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                        htmlFor="password"
                      >
                        Password (Min 12 Chars) <span className="text-[#A83B4D]">*</span>
                      </label>
                    </div>
                    <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                      <Lock className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                      <input
                        className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
                        id="password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 12 characters"
                        autoComplete="new-password"
                      />
                      <button
                        className="text-[#A83B4D] hover:text-[#670626] ml-auto p-1 cursor-pointer"
                        type="button"
                        id="pw-toggle"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {!showPassword ? (
                          <Eye className="w-4 h-4" />
                        ) : (
                          <EyeOff className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {password && (
                      <p
                        className={`font-mono text-xs mt-1.5 font-bold ${
                          strengthTone === 'ok'
                            ? 'text-emerald-700'
                            : strengthTone === 'warn'
                            ? 'text-amber-700'
                            : 'text-[#670626]'
                        }`}
                        id="strength"
                        data-tone={strengthTone}
                      >
                        {password.length} chars &middot; {strengthLabel}
                      </p>
                    )}
                    {errors.password && (
                      <p
                        className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                        id="password-error"
                        role="alert"
                      >
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className={errors.confirm ? 'is-invalid' : ''}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        className="font-mono text-xs sm:text-sm uppercase tracking-wider text-[#670626] font-bold"
                        htmlFor="confirm"
                      >
                        Confirm Password <span className="text-[#A83B4D]">*</span>
                      </label>
                    </div>
                    <div className="bg-[#E9D9D0] border border-[#D5BEB3] rounded-xl focus-within:ring-2 focus-within:ring-[#670626]/35 focus-within:border-[#670626] transition-all flex items-center px-3 min-h-[44px]">
                      <Lock className="w-4 h-4 text-[#A83B4D] shrink-0 mr-2" />
                      <input
                        className="w-full py-2 bg-transparent font-sans text-[#670626] text-sm placeholder:text-[#A83B4D]/70 focus:outline-none"
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
                      <p
                        className="font-mono text-xs mt-1 text-[#670626] font-semibold"
                        id="confirm-error"
                        role="alert"
                      >
                        {errors.confirm}
                      </p>
                    )}
                  </div>
                </div>

                {/* Show Password Checkbox Control */}
                <div className="mt-3.5 flex items-center">
                  <label
                    className="inline-flex items-center gap-2 cursor-pointer font-mono text-xs sm:text-sm text-[#670626] font-semibold"
                    htmlFor="show-password-check"
                  >
                    <input
                      type="checkbox"
                      id="show-password-check"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="w-4 h-4 accent-[#670626] cursor-pointer"
                    />
                    <span>Show password</span>
                  </label>
                </div>

                {/* Required Legal Certifications */}
                <div
                  className="mt-5 p-4 rounded-2xl bg-[#EFE4DD] border border-[#D5BEB3] space-y-3"
                  id="phase4-legal-certifications"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs sm:text-sm text-[#670626] font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#A83B4D]" />
                      <span>Legal Certifications</span>
                    </span>
                    <button
                      type="button"
                      id="btn-accept-both-consents"
                      onClick={() => {
                        const nextVal = !(consent1 && consent2);
                        setConsent1(nextVal);
                        setConsent2(nextVal);
                        if (nextVal) {
                          setErrors((prev) => {
                            const n = { ...prev };
                            delete n.consent;
                            return n;
                          });
                          setStatusMessage('');
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] hover:bg-[#DFC9BE] active:scale-[0.98] text-[#670626] font-mono text-xs font-bold cursor-pointer transition-colors"
                    >
                      {consent1 && consent2 ? 'Deselect All' : 'Accept Both'}
                    </button>
                  </div>

                  {/* Certification 1: Affidavit */}
                  <label
                    htmlFor="consent-1"
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      consent1
                        ? 'bg-[#E9D9D0] border-[#670626] shadow-sm'
                        : 'bg-[#F7F1EA] border-[#D5BEB3] hover:border-[#A83B4D]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="consent-1"
                      checked={consent1}
                      onChange={(e) => {
                        setConsent1(e.target.checked);
                        if (e.target.checked && consent2) {
                          setErrors((prev) => {
                            const n = { ...prev };
                            delete n.consent;
                            return n;
                          });
                          setStatusMessage('');
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded accent-[#670626] cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-xs sm:text-sm leading-relaxed text-[#591529]">
                      <strong className="text-[#670626]">[AFFIDAVIT]</strong> Information and IDs are
                      genuine.
                    </span>
                  </label>

                  {/* Certification 2: Emergency Protocol */}
                  <label
                    htmlFor="consent-2"
                    className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                      consent2
                        ? 'bg-[#E9D9D0] border-[#670626] shadow-sm'
                        : 'bg-[#F7F1EA] border-[#D5BEB3] hover:border-[#A83B4D]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      id="consent-2"
                      checked={consent2}
                      onChange={(e) => {
                        setConsent2(e.target.checked);
                        if (consent1 && e.target.checked) {
                          setErrors((prev) => {
                            const n = { ...prev };
                            delete n.consent;
                            return n;
                          });
                          setStatusMessage('');
                        }
                      }}
                      className="mt-0.5 w-4 h-4 rounded accent-[#670626] cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-xs sm:text-sm leading-relaxed text-[#591529]">
                      <strong className="text-[#670626]">[PROTOCOL]</strong> Agree to emergency dispatch
                      &amp; RA 10173 privacy terms.
                    </span>
                  </label>

                  {errors.consent && (
                    <p
                      className="font-mono text-xs sm:text-sm text-[#670626] font-semibold flex items-center gap-1.5 pt-1"
                      role="alert"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errors.consent}</span>
                    </p>
                  )}
                </div>

                <div className="flex gap-2.5 mt-6">
                  <button
                    className="!h-[46px] !w-32 font-mono text-sm font-semibold rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] text-[#670626] hover:bg-[#DFC9BE] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    type="button"
                    id="btn-phase4-back"
                    onClick={() => handleNavigatePhase(2)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    className="flex-1 !h-[46px] text-sm sm:text-base bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold tracking-wider uppercase rounded-xl shadow-md shadow-[#4A041A]/25 cursor-pointer flex items-center justify-center gap-2 transition-all"
                    type="button"
                    id="btn-phase4-next"
                    onClick={() => handleNavigatePhase(4)}
                  >
                    <span>Review &amp; Submit</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}

            {/* =====================================================================
                PHASE 5 (step === 4): REVIEW & REGISTRATION SUBMISSION
               ===================================================================== */}
            {step === 4 && (
              <div className="step" data-step="4" id="phase-5-review">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#E9D9D0] border border-[#D5BEB3] font-mono text-xs text-[#670626] font-bold uppercase tracking-widest mb-1.5">
                    <FileCheck className="w-4 h-4 text-[#A83B4D]" />
                    PHASE 5/5 // REVIEW
                  </div>
                  <h3 className="font-mono text-base sm:text-lg font-bold text-[#670626] uppercase tracking-wider">
                    Review Summary
                  </h3>
                </div>

                <div className="space-y-4 font-mono text-sm">
                  {/* Section 1: Role & Account Credentials Summary */}
                  <div className="p-4 rounded-2xl bg-[#EFE4DD] border border-[#D5BEB3]">
                    <div className="flex items-center justify-between border-b border-[#D5BEB3] pb-2.5 mb-3">
                      <span className="font-bold uppercase tracking-wider text-[#670626] text-sm">
                        1. Role &amp; Account
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="review-edit-phase1"
                          onClick={() => handleNavigatePhase(0)}
                          className="px-3 py-1 rounded-lg border border-[#D5BEB3] bg-[#F7F1EA] hover:bg-[#E9D9D0] text-[#670626] text-xs font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#A83B4D]" />
                          <span>Edit Role</span>
                        </button>
                        <button
                          type="button"
                          id="review-edit-phase4"
                          onClick={() => handleNavigatePhase(3)}
                          className="px-3 py-1 rounded-lg border border-[#D5BEB3] bg-[#F7F1EA] hover:bg-[#E9D9D0] text-[#670626] text-xs font-semibold cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#A83B4D]" />
                          <span>Edit Auth</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[#7D2B3D]">Role:</span>{' '}
                        <strong className="text-[#670626]" id="review-role">
                          {selectedRole === 'Responder'
                            ? `Responder (${agencyUnit})`
                            : 'Civilian'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#7D2B3D]">Display Name:</span>{' '}
                        <strong className="text-[#670626]" id="review-display-name">
                          {displayName}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#7D2B3D]">Login Email:</span>{' '}
                        <strong className="text-[#670626]" id="review-email">
                          {email}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#7D2B3D]">Mode:</span>{' '}
                        <span
                          id="review-verification-mode"
                          className={`px-2.5 py-0.5 rounded-md border text-xs font-bold ${
                            isAiAutoApproveReady
                              ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                              : 'bg-amber-50 border-amber-600/40 text-amber-800'
                          }`}
                        >
                          {isAiAutoApproveReady
                            ? 'AI Auto-Approve'
                            : 'Manual Review'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Government ID & Personal Information Summary (Unified Phase 2) */}
                  <div className="p-4 rounded-2xl bg-[#EFE4DD] border border-[#D5BEB3]">
                    <div className="flex items-center justify-between border-b border-[#D5BEB3] pb-2.5 mb-3">
                      <span className="font-bold uppercase tracking-wider text-[#670626] text-sm">
                        2. Gov ID &amp; Profile
                      </span>
                      <button
                        type="button"
                        id="review-edit-phase2"
                        onClick={() => handleNavigatePhase(1)}
                        className="px-3 py-1 rounded-lg border border-[#D5BEB3] bg-[#F7F1EA] hover:bg-[#E9D9D0] text-[#670626] text-xs font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#A83B4D]" />
                        <span>Edit ID</span>
                      </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <span className="text-[#7D2B3D]">ID Type:</span>{' '}
                        <strong className="text-[#670626]" id="review-id-type">
                          {selectedIdLabel || 'Not Selected'}
                        </strong>
                        {licenseNumber && (
                          <span className="text-[#591529] ml-2">({licenseNumber})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span
                          className={`px-2.5 py-0.5 rounded-md border font-bold ${
                            idVerification.idVerificationToken
                              ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                              : 'bg-amber-50 border-amber-600/40 text-amber-800'
                          }`}
                        >
                          {idVerification.idVerificationToken
                            ? 'ID: AI_VERIFIED'
                            : 'ID: PENDING_REVIEW'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl border border-[#D5BEB3] bg-[#F7F1EA] p-2.5 text-center">
                        <div className="text-xs text-[#670626] font-bold uppercase mb-1.5">
                          Front ID
                        </div>
                        {idFrontShot && (
                          <img
                            src={idFrontShot}
                            alt="Review Front ID"
                            id="review-front-id-img"
                            className="w-full h-28 object-cover rounded-lg border border-[#D5BEB3]"
                          />
                        )}
                      </div>
                      <div className="rounded-xl border border-[#D5BEB3] bg-[#F7F1EA] p-2.5 text-center">
                        <div className="text-xs text-[#670626] font-bold uppercase mb-1.5">
                          Back ID
                        </div>
                        {idBackShot && (
                          <img
                            src={idBackShot}
                            alt="Review Back ID"
                            id="review-back-id-img"
                            className="w-full h-28 object-cover rounded-lg border border-[#D5BEB3]"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-3 border-t border-[#D5BEB3]">
                      <div>
                        <span className="text-[#7D2B3D]">Name:</span>{' '}
                        <strong className="text-[#670626]" id="review-fullname">
                          {fullname}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#7D2B3D]">Sex / DOB / Age:</span>{' '}
                        <strong className="text-[#670626]">
                          {sex} &bull; {dateOfBirth} ({age} yrs)
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#7D2B3D]">Contact:</span>{' '}
                        <strong className="text-[#670626]" id="review-phone">
                          {phoneNumber}
                        </strong>
                      </div>
                      {selectedRole === 'Responder' && (
                        <div>
                          <span className="text-[#7D2B3D]">Badge / Rank:</span>{' '}
                          <strong className="text-[#670626]">
                            {employeeId} &bull; {rankOrTitle}
                          </strong>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <span className="text-[#7D2B3D]">Address:</span>{' '}
                        <strong className="text-[#670626]" id="review-address">
                          {fullAddressPreview}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Facial Biometric Record Summary */}
                  <div className="p-4 rounded-2xl bg-[#EFE4DD] border border-[#D5BEB3]">
                    <div className="flex items-center justify-between border-b border-[#D5BEB3] pb-2.5 mb-3">
                      <span className="font-bold uppercase tracking-wider text-[#670626] text-sm">
                        3. Facial Record
                      </span>
                      <button
                        type="button"
                        id="review-edit-phase3"
                        onClick={() => handleNavigatePhase(2)}
                        className="px-3 py-1 rounded-lg border border-[#D5BEB3] bg-[#F7F1EA] hover:bg-[#E9D9D0] text-[#670626] text-xs font-semibold cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[#A83B4D]" />
                        <span>Edit Face</span>
                      </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div className="text-[#591529]">
                        Capture {faceMeta ? `(${faceMeta.width}x${faceMeta.height})` : ''}
                        {faceToIdSimilarity !== null && (
                          <span className="ml-2 text-emerald-700 font-bold">
                            (Match: {Math.round(faceToIdSimilarity * 100)}%)
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-md border font-bold text-xs ${
                          facialVerificationToken && isFaceMatchedToId
                            ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                            : 'bg-amber-50 border-amber-600/40 text-amber-800'
                        }`}
                      >
                        {facialVerificationToken && isFaceMatchedToId
                          ? 'FACIAL: AI_MATCHED'
                          : 'FACIAL: PENDING_REVIEW'}
                      </span>
                    </div>

                    {facialStatusMessage && (
                      <div className="mb-3 text-xs sm:text-sm text-[#670626]">
                        {facialStatusMessage}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 max-w-xs">
                      <div className="rounded-xl border border-[#D5BEB3] bg-[#F7F1EA] p-2.5 text-center">
                        <div className="text-xs text-[#670626] font-bold uppercase mb-1.5">
                          Facial Capture {faceMeta ? `(${faceMeta.width}x${faceMeta.height})` : ''}
                        </div>
                        {faceShot && (
                          <img
                            src={faceShot}
                            alt="Review Facial Capture"
                            id="review-face-img"
                            className="w-full h-28 object-cover rounded-lg border border-[#D5BEB3]"
                          />
                        )}
                      </div>
                    </div>

                    {(biometricDescriptorVector || faceConfirmed) && (
                      <div
                        className="mt-3 p-3 rounded-xl bg-[#F7F1EA] border border-[#D5BEB3] flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-[#670626] font-mono"
                        id="review-biometric-training-status"
                      >
                        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                          <Cpu className="w-4 h-4 text-[#A83B4D]" />
                          <span>
                            {facialRequiresPendingManualReview
                              ? 'Biometric Staged · Pending Review'
                              : 'Biometric Ready · 4-Pose Cached'}
                          </span>
                        </span>
                        <span className="text-[#670626] font-bold">
                          128-D Vector Ready for 1:1 Login
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase 5 Submit & Back Buttons */}
                <div className="flex gap-2.5 mt-6">
                  <button
                    className="!h-[46px] !w-32 font-mono text-sm font-semibold rounded-xl border border-[#D5BEB3] bg-[#E9D9D0] text-[#670626] hover:bg-[#DFC9BE] cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                    type="button"
                    id="btn-phase5-back"
                    onClick={() => handleNavigatePhase(3)}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>

                  <button
                    className={`flex-1 !h-[46px] text-sm sm:text-base bg-[#670626] hover:bg-[#4A041A] text-[#F7F1EA] font-bold tracking-wider uppercase rounded-xl shadow-md shadow-[#4A041A]/25 cursor-pointer flex items-center justify-center gap-2 transition-all ${
                      isLoading ? 'opacity-80 cursor-progress' : ''
                    } ${isSuccess ? '!bg-emerald-700' : ''}`}
                    type="submit"
                    id="submit"
                    disabled={isLoading}
                  >
                    <span>
                      {isLoading
                        ? 'Submitting…'
                        : isSuccess
                        ? 'Registration Complete'
                        : isAiAutoApproveReady
                        ? 'Submit & Auto-Activate'
                        : 'Submit for Review'}
                    </span>
                    {isSuccess ? (
                      <Check className="w-4 h-4 ml-1" />
                    ) : (
                      <ArrowRight className="w-4 h-4 ml-1" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Multi-Frame Persistence Confirmation & 5-Min AI Learning Banner */}
            {isSuccess && persistenceConfirmation && (
              <div
                id="registration-persistence-banner"
                role="status"
                aria-live="polite"
                className="mt-4 p-4 rounded-2xl bg-[#EFE4DD] border-2 border-[#670626] text-[#670626] space-y-2 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-[#A83B4D]" />
                    <span>Multi-Frame Biometric Persistence Confirmed</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md bg-[#670626] text-[#F7F1EA]">
                    {persistenceConfirmation.biometricTrainingStatus || 'AI_LEARNING_5MIN'}
                    {typeof persistenceConfirmation.trainedFrameCount === 'number'
                      ? ` · ${persistenceConfirmation.trainedFrameCount} frames`
                      : ''}
                  </span>
                </div>
                <p className="font-sans text-xs sm:text-sm font-medium text-[#591529] leading-relaxed m-0">
                  {AI_LEARNING_REMINDER_TEXT}
                </p>
              </div>
            )}

            {/* Status Messages */}
            {statusMessage && (
              <p
                className={`font-mono text-xs sm:text-sm font-semibold my-3 text-center p-2.5 rounded-xl border ${
                  statusTone === 'ok'
                    ? 'bg-emerald-50 border-emerald-600/40 text-emerald-800'
                    : statusTone === 'bad'
                    ? 'bg-[#670626] border-[#4A041A] text-[#F7F1EA]'
                    : 'bg-[#E9D9D0] border-[#D5BEB3] text-[#670626]'
                }`}
                id="status"
                role="status"
                aria-live="polite"
                data-tone={statusTone || undefined}
              >
                {statusMessage}
              </p>
            )}

            <div className="mt-4 pt-3 border-t border-[#D5BEB3] flex items-center justify-center font-mono text-xs sm:text-sm">
              <span className="text-[#7D2B3D]">Already have an emergency account?</span>
              <Link
                className="text-[#670626] hover:text-[#A83B4D] font-bold underline underline-offset-4 ml-1.5"
                to="/login"
              >
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
