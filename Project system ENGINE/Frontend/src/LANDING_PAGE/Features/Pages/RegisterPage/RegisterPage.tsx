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
import { generateDeterministicBiometricVector } from '@/Libs/Cache/biometricFrameCache';
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
        biometricDescriptorVector:
          biometricDescriptorVector && biometricDescriptorVector.length === 128
            ? biometricDescriptorVector
            : faceConfirmed
            ? generateDeterministicBiometricVector(email.trim())
            : undefined,
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
      idVerification.clearStandbyToken();
      setFacialVerificationToken(null);
      clearStandbyRegistrationTokens();

      setIsLoading(false);
      setIsSuccess(true);

      const summaryMsg =
        res.message ||
        (res.autoApprovedByAi
          ? `${displayName.trim()} (${email.trim()}) verified and auto-approved by AI! Account Status: ${res.status || 'Verified'}. Redirecting to sign in...`
          : `${displayName.trim()} (${email.trim()}) registration submitted. Account Status: ${res.status || 'Pending'}, ID Status: ${res.identityVerificationStatus || 'PendingReview'}, Facial Status: ${res.facialVerificationStatus || 'PendingReview'}. Redirecting to sign in...`);

      setStatusMessage(summaryMsg);
      setStatusTone('ok');

      setTimeout(() => {
        navigate('/login');
      }, 1800);
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
      return { text: 'REQUIRED', className: 'text-slate-400' };
    }
    if (idVerification.status === 'VERIFIED_GENUINE') {
      return { text: 'AI VERIFIED', className: 'text-[#5fe0a4] font-bold' };
    }
    if (idVerification.status === 'VERIFYING') {
      return { text: 'VERIFYING...', className: 'text-rose-300 font-bold' };
    }
    if (idVerification.status === 'REJECTED_LOCAL' || idVerification.status === 'REJECTED_AI') {
      return { text: 'ACTION REQUIRED', className: 'text-[#ff5c74] font-bold' };
    }
    if (idVerification.status === 'PENDING_MANUAL_REVIEW') {
      return { text: 'PENDING REVIEW', className: 'text-amber-300 font-bold' };
    }
    return { text: 'UPLOADED', className: 'text-rose-200 font-bold' };
  };

  const frontSlotBadge = resolveSlotBadge(Boolean(idFrontShot));
  const backSlotBadge = resolveSlotBadge(Boolean(idBackShot));

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

        <header
          className="brand text-center mb-4 w-full"
          style={{ position: 'relative', margin: '0 auto 16px', left: 'auto', top: 'auto' }}
        >
          <h1 className="brand__mark">RESQTRACK</h1>
          <p className="brand__lead">Account Registration</p>
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
          <div
            className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#ff5c74]/70 pointer-events-none rounded-tl-[3px] z-20"
            aria-hidden="true"
          />
          <div
            className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#ff5c74]/70 pointer-events-none rounded-tr-[3px] z-20"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#ff5c74]/70 pointer-events-none rounded-bl-[3px] z-20"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#ff5c74]/70 pointer-events-none rounded-br-[3px] z-20"
            aria-hidden="true"
          />

          <span className="panel__rule" aria-hidden="true"></span>
          <h2 className="visually-hidden" id="panel-title">
            Create account
          </h2>

          <form className="panel__body" id="register-form" onSubmit={handleSubmit} noValidate>
            {/* Live Telemetry Status Header */}
            <div className="flex items-center justify-between font-mono text-[9px] tracking-wider text-rose-300/80 border-b border-rose-500/20 pb-2 mb-2">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="inline-block w-2 h-2 rounded-full bg-[#ff5c74] animate-pulse shadow-[0_0_8px_#ff5c74]" />
                5-PHASE REGISTRATION
              </span>
              <span className="text-slate-400 tracking-widest hidden sm:inline">
                {isAiAutoApproveReady ? 'AI AUTO-APPROVE' : 'MANUAL REVIEW'}
              </span>
            </div>

            {/* 5-Phase Navigation Stepper with Layered Progress Line */}
            <div
              className="relative w-full my-3 px-1 sm:px-2"
              aria-label="Account creation 5-phase progress"
            >
              {/* Background connector line spanning from first circle to last circle */}
              <div
                className="absolute top-[14px] h-[2px] -translate-y-1/2 z-0 pointer-events-none"
                style={{
                  left: 'calc(100% / 10)',
                  right: 'calc(100% / 10)'
                }}
                aria-hidden="true"
              >
                <div className="w-full h-full bg-[rgba(255,92,116,0.2)] rounded-full" />
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#ff5c74] to-rose-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_8px_rgba(255,92,116,0.6)]"
                  style={{ width: `${(Math.min(Math.max(step, 0), 4) / 4) * 100}%` }}
                />
              </div>

              {/* 5 Evenly Distributed Step Columns */}
              <ol className="steps relative z-10 grid grid-cols-5 gap-1 w-full m-0 p-0 list-none">
                {STEPS.map((phase) => (
                  <li
                    key={phase.idx}
                    className={`steps__item ${
                      step === phase.idx ? 'is-active' : step > phase.idx ? 'is-done' : ''
                    }`}
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
                    <span className="steps__label font-mono text-[9px] sm:text-[10px]">
                      {phase.label}
                    </span>
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
                    PHASE 1/5 // ROLE
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Select Role <span className="text-[#ff5c74]">*</span>
                  </h3>
                </div>

                {/* Sliding Role Selector Segmented Bar */}
                <div className="relative p-1 bg-black/50 backdrop-blur-md rounded-xl border border-rose-500/25 mb-6 max-w-md mx-auto">
                  <div
                    className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-300 ease-out pointer-events-none shadow-lg ${
                      selectedRole === 'Responder'
                        ? 'left-1 bg-gradient-to-r from-[#a5002e] via-[#d9093e] to-[#ff2b4a] border border-[#ff5c74] shadow-[0_0_16px_rgba(232,17,76,0.4)]'
                        : 'left-[calc(50%+2px)] bg-gradient-to-r from-[#a5002e] via-[#d9093e] to-[#ff2b4a] border border-rose-500/60 shadow-[0_0_16px_rgba(232,17,76,0.4)]'
                    }`}
                  />
                  <div className="grid grid-cols-2 relative z-10">
                    <button
                      type="button"
                      id="role-btn-responder"
                      onClick={() => handleSelectRole('Responder')}
                      className={`py-2 px-3 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        selectedRole === 'Responder'
                          ? 'text-white'
                          : 'text-slate-400 hover:text-slate-200'
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
                        selectedRole === 'Civilian'
                          ? 'text-white'
                          : 'text-slate-400 hover:text-slate-200'
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

                      <h4 className="font-mono text-sm font-bold text-white uppercase tracking-wider mb-2">
                        Responders
                      </h4>

                      <div className="space-y-1.5 pt-2 border-t border-rose-500/20 font-mono text-[10px]">
                        <div className="flex items-center gap-2 text-slate-300">
                          <HeartPulse className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span>RHU &middot; Medical</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>BFP &middot; Fire</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Siren className="w-3.5 h-3.5 text-[#ff5c74] shrink-0" />
                          <span>PNP &middot; Police</span>
                        </div>
                      </div>
                    </div>

                    {selectedRole === 'Responder' && (
                      <div
                        className="mt-4 pt-3 border-t border-rose-500/30"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <label
                          className="block font-mono text-[10px] uppercase tracking-wider text-rose-200 font-bold mb-1.5"
                          htmlFor="phase1-agency-unit"
                        >
                          Unit <span className="text-[#ff5c74]">*</span>
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
                        ? 'bg-[#16030b]/90 border-2 border-rose-500 shadow-[0_0_24px_rgba(232,17,76,0.3)] ring-1 ring-rose-400/50'
                        : 'bg-[#14020a]/80 border border-rose-950/60 hover:border-rose-500/50 hover:bg-[#16030b]/60'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className={`p-2.5 rounded-lg border ${
                            selectedRole === 'Civilian'
                              ? 'bg-rose-950/80 border-rose-500/60 text-rose-300'
                              : 'bg-[#14020a] border-rose-950/60 text-rose-400 group-hover:text-rose-300'
                          }`}
                        >
                          <Users className="w-5 h-5 text-[#ff5c74]" />
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider font-bold">
                          <span className="px-2 py-0.5 rounded border bg-rose-950 border-rose-500/50 text-rose-300">
                            TIER-3 CITIZEN
                          </span>
                          {selectedRole === 'Civilian' && (
                            <span className="w-4 h-4 rounded-full bg-[#ff5c74] text-white flex items-center justify-center">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                        Civilians
                      </h4>
                      <p className="font-mono text-[10px] text-rose-300/90 font-medium mb-2">
                        Community Resident
                      </p>
                    </div>

                    <div className="mt-4 pt-2.5 border-t border-rose-500/20 font-mono text-[9px] text-rose-300/80 flex items-center justify-between">
                      <span>Req: Gov ID &middot; Profile &middot; Face Match</span>
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
                <div className="flex items-center justify-between p-2.5 rounded-lg border mb-4 font-mono text-[10.5px] bg-rose-950/40 border-rose-500/30 text-rose-200">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#ff5c74] shrink-0" />
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
                    className="underline text-[10px] hover:text-white cursor-pointer ml-2"
                  >
                    Change
                  </button>
                </div>

                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <CreditCard className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 2/5 // GOV ID &amp; PROFILE
                  </div>
                  <p className="font-sans text-xs text-slate-300/80 mt-1 max-w-xl mx-auto">
                    Upload Front &amp; Back ID photos (PNG/JPG/WebP, max 5 MB).
                  </p>
                </div>

                {/* Government ID Document Type Selector */}
                <div
                  className={`field p-4 rounded-xl bg-black/50 border mb-5 ${
                    errors.idType ? 'is-invalid border-rose-500/70' : 'border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                      htmlFor="id-type"
                    >
                      Government ID Type <span className="req text-[#ff5c74]">*</span>
                    </label>
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
                      className="field__input field__select select__input font-sans text-white text-[13px]"
                      id="id-type"
                      name="idType"
                      aria-invalid={Boolean(errors.idType)}
                      aria-describedby={errors.idType ? 'id-type-error' : undefined}
                      value={idType}
                      onChange={(e) => handleIdTypeChange(e.target.value)}
                    >
                      <option value="">Choose ID Type</option>
                      {visibleGovernmentIdOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                  </div>
                  {errors.idType && (
                    <p
                      className="field__error font-mono text-[10px] mt-2 text-[#ff5c74] flex items-center gap-1.5"
                      id="id-type-error"
                      role="alert"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
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
                    className="id-upload-locked-notice rounded-xl border p-4 sm:p-5 flex items-start gap-3"
                  >
                    <div className="id-upload-locked-notice__icon p-2 rounded-lg border shrink-0">
                      <ShieldAlert className="w-5 h-5 text-[#ff5c74]" />
                    </div>
                    <div className="space-y-1">
                      <div className="font-mono text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-[#ff5c74] shrink-0" />
                        <span>ID Upload Locked</span>
                      </div>
                      <p className="font-sans text-xs text-slate-300/90 leading-relaxed m-0">
                        Select an ID type above to enable upload.
                      </p>
                    </div>
                  </div>
                ) : (
                  <section id="id-upload-section" aria-label="Government ID Upload">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                        Front &amp; Back ID <span className="text-[#ff5c74]">*</span>
                      </span>
                      {(idFrontShot || idBackShot) && (
                        <button
                          type="button"
                          id="btn-clear-both-ids"
                          onClick={handleClearBothIds}
                          className="font-mono text-[10px] text-rose-300 hover:text-white px-2.5 py-1 rounded border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
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
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                          <span className="font-bold uppercase tracking-wider text-slate-200">
                            Front ID <span className="text-[#ff5c74]">*</span>
                          </span>
                          <span className={frontSlotBadge.className}>{frontSlotBadge.text}</span>
                        </div>

                        {idFrontShot ? (
                          <div className="relative rounded-xl overflow-hidden border border-rose-500/50 bg-[#14020a] p-3 flex flex-col items-center">
                            <div className="relative w-full overflow-hidden rounded border border-rose-500/30">
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
                                  {idFrontMeta.width}x{idFrontMeta.height}px &bull;{' '}
                                  {(idFrontMeta.sizeBytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            )}
                            <div className="mt-2.5 w-full flex items-center justify-between gap-2 font-mono text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${
                                  idVerification.status === 'VERIFIED_GENUINE'
                                    ? 'bg-emerald-950/80 border-emerald-500/45 text-[#5fe0a4]'
                                    : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" /> {frontSlotBadge.text}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  id="btn-replace-front-id"
                                  onClick={() => frontFileInputRef.current?.click()}
                                  className="text-[#ff5c74] hover:text-rose-300 underline cursor-pointer text-[10px]"
                                >
                                  Replace
                                </button>
                                <span className="text-slate-600">&bull;</span>
                                <button
                                  type="button"
                                  id="btn-remove-front-id"
                                  onClick={() => handleRemoveSingleIdSide('front')}
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
                              Front ID <span className="text-[#ff5c74]">*</span>
                            </span>
                            <span className="font-sans text-[11px] text-slate-400 mt-1">
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
                        <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                          <span className="font-bold uppercase tracking-wider text-slate-200">
                            Back ID <span className="text-[#ff5c74]">*</span>
                          </span>
                          <span className={backSlotBadge.className}>{backSlotBadge.text}</span>
                        </div>

                        {idBackShot ? (
                          <div className="relative rounded-xl overflow-hidden border border-rose-500/50 bg-[#14020a] p-3 flex flex-col items-center">
                            <div className="relative w-full overflow-hidden rounded border border-rose-500/30">
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
                                  {idBackMeta.width}x{idBackMeta.height}px &bull;{' '}
                                  {(idBackMeta.sizeBytes / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            )}
                            <div className="mt-2.5 w-full flex items-center justify-between gap-2 font-mono text-[10px]">
                              <span
                                className={`px-2 py-0.5 rounded border font-bold flex items-center gap-1 ${
                                  idVerification.status === 'VERIFIED_GENUINE'
                                    ? 'bg-emerald-950/80 border-emerald-500/45 text-[#5fe0a4]'
                                    : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" /> {backSlotBadge.text}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  id="btn-replace-back-id"
                                  onClick={() => backFileInputRef.current?.click()}
                                  className="text-[#ff5c74] hover:text-rose-300 underline cursor-pointer text-[10px]"
                                >
                                  Replace
                                </button>
                                <span className="text-slate-600">&bull;</span>
                                <button
                                  type="button"
                                  id="btn-remove-back-id"
                                  onClick={() => handleRemoveSingleIdSide('back')}
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
                              Back ID <span className="text-[#ff5c74]">*</span>
                            </span>
                            <span className="font-sans text-[11px] text-slate-400 mt-1">
                              Drop or click (PNG/JPG/WebP, &lt;= 5 MB)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {errors.idCard && (
                      <p
                        className="field__error font-mono text-[10.5px] mt-3 text-rose-400 flex items-center gap-1.5"
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
                    className="mt-5 pt-4 border-t border-rose-500/25"
                  >
                    <div className="p-3.5 rounded-xl bg-black/55 border border-rose-500/25 mb-4 font-mono text-[10.5px] text-slate-200">
                      {idVerification.status === 'VERIFIED_GENUINE'
                        ? 'Visible ID fields auto-filled. Complete required (*) fields.'
                        : 'AI unavailable — enter details for manual review.'}
                    </div>

                    <div className="form-grid">
                      {/* ID / Document Serial Number */}
                      <div className="field md:col-span-2">
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="license-number"
                          >
                            ID / Document Number{' '}
                            <span className="text-slate-400 text-[9px]">(Optional)</span>
                          </label>
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
                            className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                      <div className={`field ${errors.firstName ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="first-name"
                          >
                            First Name <span className="req">*</span>
                          </label>
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
                            className="field__error font-mono text-[10px]"
                            id="first-name-error"
                            role="alert"
                          >
                            {errors.firstName}
                          </p>
                        )}
                      </div>

                      {/* Middle Name */}
                      <div className="field">
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="middle-name"
                          >
                            Middle Name{' '}
                            <span className="text-slate-400 text-[9px]">(Optional)</span>
                          </label>
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
                      <div className={`field ${errors.lastName ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="last-name"
                          >
                            Last Name / Surname <span className="req">*</span>
                          </label>
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
                            className="field__error font-mono text-[10px]"
                            id="last-name-error"
                            role="alert"
                          >
                            {errors.lastName}
                          </p>
                        )}
                      </div>

                      {/* Suffix */}
                      <div className="field">
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="suffix"
                          >
                            Suffix <span className="text-slate-400 text-[9px]">(Optional)</span>
                          </label>
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
                      <div className={`field ${errors.sex ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="sex"
                          >
                            Sex <span className="req">*</span>
                          </label>
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
                            name="sex"
                            value={sex}
                            onChange={(e) => setSex(e.target.value)}
                          >
                            <option value="">Select Sex</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                          </select>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                        </div>
                        {errors.sex && (
                          <p
                            className="field__error font-mono text-[10px]"
                            id="sex-error"
                            role="alert"
                          >
                            {errors.sex}
                          </p>
                        )}
                      </div>

                      {/* Date of Birth */}
                      <div className={`field ${errors.dateOfBirth ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="dob"
                          >
                            Date of Birth <span className="req">*</span>
                          </label>
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
                          <p
                            className="field__error font-mono text-[10px]"
                            id="dob-error"
                            role="alert"
                          >
                            {errors.dateOfBirth}
                          </p>
                        )}
                      </div>

                      {/* Age */}
                      <div className={`field ${errors.age ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="age"
                          >
                            Age (18&ndash;100) <span className="req">*</span>
                          </label>
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
                            className="field__error font-mono text-[10px]"
                            id="age-error"
                            role="alert"
                          >
                            {errors.age}
                          </p>
                        )}
                      </div>

                      {/* Contact Number */}
                      <div className={`field ${errors.phoneNumber ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="phone-number"
                          >
                            Contact Number <span className="req">*</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <Phone className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                            className="field__error font-mono text-[10px]"
                            id="phone-error"
                            role="alert"
                          >
                            {errors.phoneNumber}
                          </p>
                        )}
                      </div>

                      {/* Province */}
                      <div className={`field ${errors.province ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="province"
                          >
                            Province <span className="req">*</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
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
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="city"
                          >
                            City / Municipality <span className="req">*</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
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
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="barangay"
                          >
                            Barangay <span className="req">*</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <MapPin className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                            className="field__error font-mono text-[10px]"
                            id="barangay-error"
                            role="alert"
                          >
                            {errors.barangay}
                          </p>
                        )}
                      </div>

                      {/* Street / Purok */}
                      <div className={`field ${errors.streetOrPurok ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="street-purok"
                          >
                            Street / Purok <span className="req">*</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <MapPin className="w-4 h-4 text-[#ff5c74] shrink-0 mr-2" />
                          <input
                            className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                            className="field__error font-mono text-[10px]"
                            id="street-error"
                            role="alert"
                          >
                            {errors.streetOrPurok}
                          </p>
                        )}
                      </div>

                      {/* Optional Weight & Height */}
                      <div className="field">
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="weight"
                          >
                            Weight <span className="text-slate-400 text-[9px]">(Optional)</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <input
                            className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
                            id="weight"
                            name="weight"
                            type="text"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            placeholder="65 kg"
                          />
                        </div>
                      </div>

                      <div className="field">
                        <div className="flex items-center justify-between mb-1">
                          <label
                            className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                            htmlFor="height"
                          >
                            Height <span className="text-slate-400 text-[9px]">(Optional)</span>
                          </label>
                        </div>
                        <div
                          className="field__box focus-within:ring-2 focus-within:ring-rose-500/50 focus-within:border-rose-400 transition-all flex items-center px-3"
                          style={{
                            background: 'rgba(46, 10, 22, 0.85)',
                            border: '1px solid rgba(255, 92, 116, 0.22)',
                            borderRadius: '6px'
                          }}
                        >
                          <input
                            className="field__input font-sans text-white text-[13px] placeholder:text-slate-400/60"
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
                          <div className="field">
                            <div className="flex items-center justify-between mb-1">
                              <label
                                className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                                htmlFor="agency-unit"
                              >
                                Agency Unit <span className="req">*</span>
                              </label>
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
                                onChange={(e) =>
                                  handleAgencyUnitChange(e.target.value as 'RHU' | 'FIRE' | 'PNP')
                                }
                              >
                                <option value="RHU">RHU Medical</option>
                                <option value="FIRE">BFP Fire</option>
                                <option value="PNP">PNP Police</option>
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />
                            </div>
                          </div>

                          <div className={`field ${errors.employeeId ? 'is-invalid' : ''}`}>
                            <div className="flex items-center justify-between mb-1">
                              <label
                                className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                                htmlFor="employee-id"
                              >
                                Badge / Employee ID <span className="req">*</span>
                              </label>
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
                                placeholder="BFP-ZN-2026-089"
                              />
                            </div>
                            {errors.employeeId && (
                              <p
                                className="field__error font-mono text-[10px]"
                                id="employee-error"
                                role="alert"
                              >
                                {errors.employeeId}
                              </p>
                            )}
                          </div>

                          <div
                            className={`field md:col-span-2 ${
                              errors.rankOrTitle ? 'is-invalid' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <label
                                className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                                htmlFor="rank-title"
                              >
                                Rank / Position <span className="req">*</span>
                              </label>
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
                                placeholder="Rank or title"
                              />
                            </div>
                            {errors.rankOrTitle && (
                              <p
                                className="field__error font-mono text-[10px]"
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
                    className={`btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 flex items-center justify-center gap-2 transition-all ${
                      isPhase2ReadyForNext
                        ? 'hover:!brightness-110 cursor-pointer'
                        : 'opacity-45 saturate-50 cursor-not-allowed'
                    }`}
                    type="button"
                    id="btn-phase2-next"
                    disabled={!isPhase2ReadyForNext}
                    onClick={() => handleNavigatePhase(2)}
                  >
                    <span className="btn__label">Continue</span>
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
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 3/5 // FACIAL RECORD
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
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
                    className={`btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2 transition-all ${
                      faceConfirmed && faceConsentAccepted ? '' : 'opacity-50 saturate-50'
                    }`}
                    type="button"
                    id="btn-phase3-next"
                    onClick={() => handleNavigatePhase(3)}
                  >
                    <span className="btn__label">Continue</span>
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
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/30 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 4/5 // CREDENTIALS
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Display Name, Login Email &amp; Password
                  </h3>
                </div>

                <div className="form-grid">
                  {/* Display Name / Username (Presentation Only) */}
                  <div className={`field ${errors.displayName ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                        htmlFor="display-name"
                      >
                        Display Name <span className="req">*</span>
                      </label>
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
                        className="field__error font-mono text-[10px]"
                        id="display-name-error"
                        role="alert"
                      >
                        {errors.displayName}
                      </p>
                    )}
                  </div>

                  {/* Email Address (Sole Login Identifier) */}
                  <div className={`field ${errors.email ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                        htmlFor="email"
                      >
                        Login Email <span className="req">*</span>
                      </label>
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
                        placeholder="Login identifier"
                        autoComplete="email"
                      />
                    </div>
                    {errors.email && (
                      <p
                        className="field__error font-mono text-[10px]"
                        id="email-error"
                        role="alert"
                      >
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div className={`field field--password ${errors.password ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                        htmlFor="password"
                      >
                        Password (Min 12 Chars) <span className="req">*</span>
                      </label>
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
                        {!showPassword ? (
                          <Eye className="w-4 h-4 text-slate-400" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                    {password && (
                      <p
                        className="strength font-mono text-[9px] mt-1.5"
                        id="strength"
                        data-tone={strengthTone}
                      >
                        {password.length} chars &middot; {strengthLabel}
                      </p>
                    )}
                    {errors.password && (
                      <p
                        className="field__error font-mono text-[10px]"
                        id="password-error"
                        role="alert"
                      >
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className={`field field--password ${errors.confirm ? 'is-invalid' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold"
                        htmlFor="confirm"
                      >
                        Confirm Password <span className="req">*</span>
                      </label>
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
                        className="field__error font-mono text-[10px]"
                        id="confirm-error"
                        role="alert"
                      >
                        {errors.confirm}
                      </p>
                    )}
                  </div>
                </div>

                {/* Show Password Checkbox Control */}
                <div className="mt-3 flex items-center">
                  <label
                    className="inline-flex items-center gap-2 cursor-pointer font-mono text-[11px] text-slate-300"
                    htmlFor="show-password-check"
                  >
                    <input
                      type="checkbox"
                      id="show-password-check"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="accent-[#ff5c74] cursor-pointer"
                    />
                    <span>Show password</span>
                  </label>
                </div>

                {/* Required Legal Certifications */}
                <div
                  className="mt-5 p-4 rounded-xl bg-black/60 border border-rose-500/30 space-y-3"
                  id="phase4-legal-certifications"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-rose-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[#ff5c74]" />
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
                      className="px-2.5 py-1 rounded border border-rose-500/40 bg-rose-950/50 hover:bg-rose-900/60 active:scale-[0.98] text-rose-200 font-mono text-[10px] font-bold cursor-pointer transition-colors"
                    >
                      {consent1 && consent2 ? 'Deselect All' : 'Accept Both'}
                    </button>
                  </div>

                  {/* Certification 1: Affidavit */}
                  <label
                    htmlFor="consent-1"
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      consent1
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-sm shadow-rose-950/50'
                        : 'bg-black/40 border-rose-500/25 hover:border-rose-500/40 hover:bg-rose-950/20'
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
                      className="mt-0.5 w-4 h-4 rounded accent-[#ff5c74] cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-[11px] leading-relaxed text-rose-100">
                      <strong className="text-white">[AFFIDAVIT]</strong> Information and IDs are
                      genuine.
                    </span>
                  </label>

                  {/* Certification 2: Emergency Protocol */}
                  <label
                    htmlFor="consent-2"
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer select-none ${
                      consent2
                        ? 'bg-rose-950/40 border-rose-500/60 shadow-sm shadow-rose-950/50'
                        : 'bg-black/40 border-rose-500/25 hover:border-rose-500/40 hover:bg-rose-950/20'
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
                      className="mt-0.5 w-4 h-4 rounded accent-[#ff5c74] cursor-pointer shrink-0"
                    />
                    <span className="font-mono text-[11px] leading-relaxed text-rose-100">
                      <strong className="text-white">[PROTOCOL]</strong> Agree to emergency dispatch
                      &amp; RA 10173 privacy terms.
                    </span>
                  </label>

                  {errors.consent && (
                    <p
                      className="font-mono text-[10.5px] text-[#ff5c74] font-semibold flex items-center gap-1.5 pt-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errors.consent}</span>
                    </p>
                  )}
                </div>

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
                    <span className="btn__label">Review &amp; Submit</span>
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
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 font-mono text-[10px] text-rose-300 font-bold uppercase tracking-widest mb-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-[#ff5c74]" />
                    PHASE 5/5 // REVIEW
                  </div>
                  <h3 className="font-mono text-sm sm:text-base font-bold text-white uppercase tracking-wider">
                    Review Summary
                  </h3>
                </div>

                <div className="space-y-4 font-mono text-xs">
                  {/* Section 1: Role & Account Credentials Summary */}
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                      <span className="font-bold uppercase tracking-wider text-rose-300">
                        1. Role &amp; Account
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="review-edit-phase1"
                          onClick={() => handleNavigatePhase(0)}
                          className="px-2.5 py-1 rounded border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Role</span>
                        </button>
                        <button
                          type="button"
                          id="review-edit-phase4"
                          onClick={() => handleNavigatePhase(3)}
                          className="px-2.5 py-1 rounded border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 text-[10px] cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Auth</span>
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
                      <div>
                        <span className="text-slate-400">Role:</span>{' '}
                        <strong className="text-white" id="review-role">
                          {selectedRole === 'Responder'
                            ? `Responder (${agencyUnit})`
                            : 'Civilian'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Display Name:</span>{' '}
                        <strong className="text-rose-200" id="review-display-name">
                          {displayName}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Login Email:</span>{' '}
                        <strong className="text-rose-200" id="review-email">
                          {email}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Mode:</span>{' '}
                        <span
                          id="review-verification-mode"
                          className={`px-2 py-0.5 rounded border text-[9.5px] font-bold ${
                            isAiAutoApproveReady
                              ? 'bg-emerald-950 border-emerald-500/45 text-[#5fe0a4]'
                              : 'bg-amber-950 border-amber-500/40 text-amber-300'
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
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                      <span className="font-bold uppercase tracking-wider text-rose-300">
                        2. Gov ID &amp; Profile
                      </span>
                      <button
                        type="button"
                        id="review-edit-phase2"
                        onClick={() => handleNavigatePhase(1)}
                        className="px-2.5 py-1 rounded border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit ID</span>
                      </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-400">ID Type:</span>{' '}
                        <strong className="text-white" id="review-id-type">
                          {selectedIdLabel || 'Not Selected'}
                        </strong>
                        {licenseNumber && (
                          <span className="text-slate-300 ml-2">({licenseNumber})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9.5px]">
                        <span
                          className={`px-2 py-0.5 rounded border font-bold ${
                            idVerification.idVerificationToken
                              ? 'bg-emerald-950 border-emerald-500/45 text-[#5fe0a4]'
                              : 'bg-amber-950 border-amber-500/40 text-amber-300'
                          }`}
                        >
                          {idVerification.idVerificationToken
                            ? 'ID: AI_VERIFIED'
                            : 'ID: PENDING_REVIEW'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-center">
                        <div className="text-[9.5px] text-slate-300 font-bold uppercase mb-1">
                          Front ID
                        </div>
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
                        <div className="text-[9.5px] text-slate-300 font-bold uppercase mb-1">
                          Back ID
                        </div>
                        {idBackShot && (
                          <img
                            src={idBackShot}
                            alt="Review Back ID"
                            id="review-back-id-img"
                            className="w-full h-28 object-cover rounded border border-slate-800"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] pt-3 border-t border-rose-500/20">
                      <div>
                        <span className="text-slate-400">Name:</span>{' '}
                        <strong className="text-white" id="review-fullname">
                          {fullname}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Sex / DOB / Age:</span>{' '}
                        <strong className="text-white">
                          {sex} &bull; {dateOfBirth} ({age} yrs)
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Contact:</span>{' '}
                        <strong className="text-white" id="review-phone">
                          {phoneNumber}
                        </strong>
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
                        <span className="text-slate-400">Address:</span>{' '}
                        <strong className="text-white" id="review-address">
                          {fullAddressPreview}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Facial Biometric Record Summary */}
                  <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30">
                    <div className="flex items-center justify-between border-b border-rose-500/20 pb-2 mb-3">
                      <span className="font-bold uppercase tracking-wider text-rose-300">
                        3. Facial Record
                      </span>
                      <button
                        type="button"
                        id="review-edit-phase3"
                        onClick={() => handleNavigatePhase(2)}
                        className="px-2.5 py-1 rounded border border-rose-500/40 bg-rose-950/40 hover:bg-rose-900/60 text-rose-200 text-[10px] cursor-pointer flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Face</span>
                      </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="text-slate-300">
                        Capture {faceMeta ? `(${faceMeta.width}x${faceMeta.height})` : ''}
                        {faceToIdSimilarity !== null && (
                          <span className="ml-2 text-emerald-300">
                            (Match: {Math.round(faceToIdSimilarity * 100)}%)
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded border font-bold text-[9.5px] ${
                          facialVerificationToken && isFaceMatchedToId
                            ? 'bg-emerald-950 border-emerald-500/45 text-[#5fe0a4]'
                            : 'bg-amber-950 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {facialVerificationToken && isFaceMatchedToId
                          ? 'FACIAL: AI_MATCHED'
                          : 'FACIAL: PENDING_REVIEW'}
                      </span>
                    </div>

                    {facialStatusMessage && (
                      <div className="mb-3 text-[10.5px] text-rose-200/85">
                        {facialStatusMessage}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 max-w-xs">
                      <div className="rounded-lg border border-slate-700 bg-slate-950 p-2 text-center">
                        <div className="text-[9.5px] text-slate-300 font-bold uppercase mb-1">
                          Facial Capture {faceMeta ? `(${faceMeta.width}x${faceMeta.height})` : ''}
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

                    {(biometricDescriptorVector || faceConfirmed) && (
                      <div
                        className="mt-3 p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 flex items-center justify-between text-[11px] text-rose-300 font-mono"
                        id="review-biometric-training-status"
                      >
                        <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
                          <Cpu className="w-3.5 h-3.5 text-[#ff5c74]" />
                          <span>
                            {facialRequiresPendingManualReview
                              ? 'Biometric Staged · Pending Review'
                              : 'Biometric Ready · 4-Pose Cached'}
                          </span>
                        </span>
                        <span className="text-rose-300 font-bold">
                          128-D Vector Ready for 1:1 Login
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Phase 5 Submit & Back Buttons */}
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
                    className={`btn flex-1 !h-[44px] !bg-gradient-to-r !from-[#a5002e] !via-[#d9093e] !to-[#ff2b4a] hover:!brightness-110 !text-white !font-bold !tracking-wider !uppercase rounded-lg shadow-lg shadow-[#e8114c]/30 cursor-pointer flex items-center justify-center gap-2 ${
                      isLoading ? 'is-loading' : ''
                    } ${isSuccess ? 'is-ok' : ''}`}
                    type="submit"
                    id="submit"
                    disabled={isLoading}
                  >
                    <span className="btn__label">
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

            <div
              className="row font-mono text-[11.5px]"
              style={{ marginTop: '14px', justifyContent: 'center' }}
            >
              <span className="check__text text-slate-400">Already have an emergency account?</span>
              <Link
                className="link text-rose-400 hover:text-rose-300 font-bold"
                to="/login"
                style={{ marginLeft: '6px' }}
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
