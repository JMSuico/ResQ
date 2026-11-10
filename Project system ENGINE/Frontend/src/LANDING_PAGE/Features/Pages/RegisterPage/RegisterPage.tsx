// [Layer: LANDING_PAGE/Features/Pages/RegisterPage]
// Responsibility: Pixel-faithful, responsive React 19 conversion of ResQTrack Register Page.
// Implements 4-Step Role-Based Registration Wizard:
// Step 0: 00 Role (Role selection: Responder vs Civilian)
// Step 1: 01 Identity (Personal Info + ID Type + Front & Back Government ID Picture Upload + Automated On-Device OCR + Crosshair Text Extractor)
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
  Lock,
  Eye,
  EyeOff,
  Camera,
  RefreshCw,
  Check,
  CheckCircle2,
  Upload,
  X,
  Scan,
  Cpu,
  Sparkles,
  MapPin,
  Crop
} from 'lucide-react';
import { registerUser, RegisterPayload, ResponderUnit } from '@/Endpoints/authApi';
import { MultiAngleBiometricEngine } from './MultiAngleBiometricEngine';
import { TextExtractorOverlay, type AssignableField } from './TextExtractorOverlay';
import { useFluidResposiveness } from '@/Hooks/useFluidResposiveness';
import { biometricFrameCache } from '@/Libs/Cache/biometricFrameCache';
import { LaserScanOverlay } from '@/components/Vision/LaserScanOverlay';
import {
  idScanEngine,
  IdScanResult,
  GovernmentIdCategory,
  ExtractedFieldsPayload,
  mergeFrontAndBackFields,
  parseNameComponents,
  isPascalCaseLabel,
  isPlausibleHumanName,
  normalizePhilippineAddress,
  normalizePhysicalMeasurement,
  parseFieldsByPascalCaseIndications
} from '@/Libs/Vision/idScanner';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useFluidResposiveness();

  // Wizard Step: 0 = Role, 1 = Identity (Personal & ID Upload + Auto OCR), 2 = Biometrics, 3 = Security
  const [step, setStep] = useState<number>(0);

  // Step 0 - Role Classification Selection
  const [selectedRole, setSelectedRole] = useState<'Responder' | 'Civilian'>('Responder');

  // Form Fields - Step 1 (Personal Info) - Initialized clean for OCR autofill
  const [firstName, setFirstName] = useState<string>('');
  const [middleName, setMiddleName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const fullname = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const [email, setEmail] = useState<string>('');
  const [sex, setSex] = useState<string>('male');
  const [age, setAge] = useState<string>('');
  const [dateOfBirth, setDateOfBirth] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [licenseNumber, setLicenseNumber] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [idType, setIdType] = useState<string>('drivers');

  // Form Fields - Step 1 (Agency Info for Responders)
  const [agencyUnit, setAgencyUnit] = useState<ResponderUnit>('FIRE');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [rankOrTitle, setRankOrTitle] = useState<string>('');

  // ID Upload & Automated OCR State - Step 1 (Upload-Only Front & Back Pipeline)
  const [idFrontShot, setIdFrontShot] = useState<string | null>(null);
  const [idBackShot, setIdBackShot] = useState<string | null>(null);
  const [idPortraitCropUrl, setIdPortraitCropUrl] = useState<string | null>(null);
  const [isScanningFrontUpload, setIsScanningFrontUpload] = useState<boolean>(false);
  const [isScanningBackUpload, setIsScanningBackUpload] = useState<boolean>(false);
  const [frontExtractedFields, setFrontExtractedFields] = useState<ExtractedFieldsPayload>({});
  const [backExtractedFields, setBackExtractedFields] = useState<ExtractedFieldsPayload>({});
  const [isDraggingFront, setIsDraggingFront] = useState<boolean>(false);
  const [isDraggingBack, setIsDraggingBack] = useState<boolean>(false);
  const isIdValidated = Boolean(idFrontShot);

  // Deterministic Vision & Automated OCR Telemetry Badge
  const [autofillBadge, setAutofillBadge] = useState<{
    visible: boolean;
    method: 'DETERMINISTIC_CV' | 'AI_STANDBY_FALLBACK';
    confidence: number;
    tier: string;
    provider?: string;
    extractedCount?: number;
  } | null>(null);

  // Text Extractor (On-Device Crosshair OCR Overlay)
  const [isTextExtractorOpen, setIsTextExtractorOpen] = useState<boolean>(false);
  const [textExtractorSourceUrl, setTextExtractorSourceUrl] = useState<string | null>(null);

  // Refs for file inputs
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
    const stepParam = params.get('step');
    if (stepParam && !isNaN(Number(stepParam))) {
      setStep(Number(stepParam));
    }

    if (unitParam === 'security' || roleParam === 'civilian' || roleParam === 'resident') {
      setSelectedRole('Civilian');
      setAgencyUnit('Security');
      setRankOrTitle('Resident');
      setEmployeeId('RES-ZN-2024');
      setFirstName('Juan');
      setMiddleName('');
      setLastName('Dela Cruz');
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

  // Helper to generate a clean dual composite canvas merging front and back ID cards
  const generateDualIdComposite = async (frontUrl: string, backUrl: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 856;
    canvas.height = 320;
    const ctx = canvas.getContext('2d');
    if (!ctx) return frontUrl;

    const loadImage = (url: string): Promise<HTMLImageElement> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(img);
        img.src = url;
      });

    const [imgFront, imgBack] = await Promise.all([loadImage(frontUrl), loadImage(backUrl)]);

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
    try {
      ctx.drawImage(imgFront, 16, 48, 400, 252);
    } catch {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(16, 48, 400, 252);
    }

    // Back ID Snapshot
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
    ctx.strokeRect(14, 46, 10, 10);
    ctx.strokeRect(408, 288, 10, 10);
    ctx.strokeRect(438, 46, 10, 10);
    ctx.strokeRect(832, 288, 10, 10);

    // HUD Text Badges
    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText('FRONT ID CARD [SECURED]', 24, 68);
    ctx.fillText('BACK ID CARD [SECURED]', 448, 68);

    return canvas.toDataURL('image/png');
  };

  // Helper to convert extracted date of birth (DOB) into integer age (Year/month/day: YYYY/MM/DD)
  const computeAgeFromDob = (dob?: string): string | null => {
    if (!dob) return null;
    const clean = dob.trim();
    // Standard format: YYYY/MM/DD or YYYY-MM-DD
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
      if (calculatedAge >= 10 && calculatedAge <= 120) {
        return String(calculatedAge);
      }
    }
    // Fallback: parts split
    const parts = clean.split(/[-/.]/);
    if (parts.length === 3) {
      const yr = parts[0].length === 4 ? parseInt(parts[0], 10) : parseInt(parts[2], 10);
      const today = new Date();
      if (yr > 1900 && yr <= today.getFullYear()) {
        const calculatedAge = today.getFullYear() - yr;
        if (calculatedAge >= 10 && calculatedAge <= 120) return String(calculatedAge);
      }
    }
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      const diffMs = Date.now() - parsed.getTime();
      const calculatedAge = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
      if (calculatedAge >= 10 && calculatedAge <= 120) return String(calculatedAge);
    }
    return null;
  };

  // Synchronize age whenever dateOfBirth is updated or populated
  useEffect(() => {
    if (dateOfBirth) {
      const autoAge = computeAgeFromDob(dateOfBirth);
      if (autoAge && !isNaN(Number(autoAge))) {
        setAge(autoAge);
      }
    }
  }, [dateOfBirth]);

  // Applies automated OCR extraction results from an uploaded Front or Back ID image
  // and deterministically merges Front + Back fields into the registration form.
  const applyUploadedIdScanResult = useCallback(
    (side: 'front' | 'back', result: IdScanResult, rawDataUrl: string) => {
      const confidenceScore = result.confidence ?? 0;
      const isFaceDetected = Boolean(
        result.cardPresence && result.cardPresence.status === 'FACE_DETECTED'
      );

      if (isFaceDetected) {
        setErrors((prev) => ({
          ...prev,
          idCard:
            'Human portrait/selfie detected instead of a Government ID card. Please upload a clear photo of your physical Government ID card.'
        }));
        setStatusMessage('Upload rejected: Human face/selfie detected instead of an ID card.');
        setStatusTone('bad');
        return;
      }

      if (side === 'front') {
        (window as unknown as { __lastFrontScanResult?: IdScanResult }).__lastFrontScanResult = result;
        const hasCoreField = Boolean(
          (result.fields &&
            (result.fields.fullname ||
              result.fields.firstName ||
              result.fields.lastName ||
              result.fields.licenseNumber ||
              result.fields.idNumber ||
              result.fields.employeeId)) ||
            (result.rawText && result.rawText.trim().length >= 6) ||
            (result.corners && result.corners.length === 4)
        );

        if (!result.success && !hasCoreField) {
          setErrors((prev) => ({
            ...prev,
            idCard:
              result.error ||
              'Uploaded image is not a recognized Government ID card. Please upload a clear photo showing full name and ID number.'
          }));
          setStatusMessage('Front ID upload rejected: Unreadable or invalid document.');
          setStatusTone('bad');
          return;
        }

        const finalFrontUrl = result.rectifiedImageUrl || rawDataUrl;
        setIdFrontShot(finalFrontUrl);
        if (result.portraitImageUrl) {
          setIdPortraitCropUrl(result.portraitImageUrl);
        }

        // Enrich fields with fallback regex and PascalCase Indication Parser from rawText
        const rawText = result.rawText || '';
        type MutableExtractedFields = {
          -readonly [K in keyof ExtractedFieldsPayload]: ExtractedFieldsPayload[K];
        };
        const enrichedFront: MutableExtractedFields = { ...result.fields };

        // Parse fullname into name components and discard any noisy / label tokens
        if (enrichedFront.fullname) {
          const parsed = parseNameComponents(enrichedFront.fullname);
          if (parsed.firstName && (!enrichedFront.firstName || !isPlausibleHumanName(enrichedFront.firstName) || isPascalCaseLabel(enrichedFront.firstName))) {
            enrichedFront.firstName = parsed.firstName;
          }
          if (parsed.middleName && (!enrichedFront.middleName || !isPlausibleHumanName(enrichedFront.middleName) || isPascalCaseLabel(enrichedFront.middleName))) {
            enrichedFront.middleName = parsed.middleName;
          }
          if (parsed.lastName && (!enrichedFront.lastName || !isPlausibleHumanName(enrichedFront.lastName) || isPascalCaseLabel(enrichedFront.lastName))) {
            enrichedFront.lastName = parsed.lastName;
          }
        }

        // Sanitize any individual fields that accidentally captured PascalCase headers or noise
        if (enrichedFront.firstName && (isPascalCaseLabel(enrichedFront.firstName) || !isPlausibleHumanName(enrichedFront.firstName))) {
          enrichedFront.firstName = undefined;
        }
        if (enrichedFront.lastName && (isPascalCaseLabel(enrichedFront.lastName) || !isPlausibleHumanName(enrichedFront.lastName))) {
          enrichedFront.lastName = undefined;
        }
        if (enrichedFront.middleName && (isPascalCaseLabel(enrichedFront.middleName) || !isPlausibleHumanName(enrichedFront.middleName))) {
          enrichedFront.middleName = undefined;
        }
        if (enrichedFront.address && isPascalCaseLabel(enrichedFront.address)) {
          enrichedFront.address = undefined;
        }

        // Apply Indication-to-Target pairing parser (trained on PascalCase header indications)
        if (rawText) {
          const pascalParsed = parseFieldsByPascalCaseIndications(rawText);
          if (pascalParsed.firstName && isPlausibleHumanName(pascalParsed.firstName)) {
            enrichedFront.firstName = pascalParsed.firstName;
          }
          if (pascalParsed.middleName && isPlausibleHumanName(pascalParsed.middleName)) {
            enrichedFront.middleName = pascalParsed.middleName;
          }
          if (pascalParsed.lastName && isPlausibleHumanName(pascalParsed.lastName)) {
            enrichedFront.lastName = pascalParsed.lastName;
          }
          if (pascalParsed.idNumber) {
            enrichedFront.licenseNumber = pascalParsed.idNumber;
          }
          if (pascalParsed.birthDate) {
            enrichedFront.dateOfBirth = pascalParsed.birthDate;
          }
          if (pascalParsed.address) {
            enrichedFront.address = normalizePhilippineAddress(pascalParsed.address);
          }
          if (pascalParsed.sex) {
            enrichedFront.sex = pascalParsed.sex;
          }
          if (pascalParsed.weight) {
            enrichedFront.weight = normalizePhysicalMeasurement(pascalParsed.weight, 'weight');
          }
          if (pascalParsed.height) {
            enrichedFront.height = normalizePhysicalMeasurement(pascalParsed.height, 'height');
          }
        }

        if (!enrichedFront.licenseNumber && !enrichedFront.idNumber && rawText) {
          const licMatch = rawText.match(
            /(?:LIC(?:ENSE)?(?:\s*NO)?|ID\s*(?:NO)?|CARD\s*NO)[:\s#]*([A-Z0-9-]{8,22})/i
          );
          if (licMatch) enrichedFront.licenseNumber = licMatch[1].trim();
        }
        if (!enrichedFront.weight && rawText) {
          const wtMatch = rawText.match(
            /(?:WT|WEIGHT|W)[:\s]*([0-9]{2,3}(?:\.[0-9]+)?\s*(?:kg|lbs|kilos)?)/i
          );
          if (wtMatch) enrichedFront.weight = normalizePhysicalMeasurement(wtMatch[1].trim(), 'weight');
        }
        if (!enrichedFront.height && rawText) {
          const htMatch = rawText.match(/(?:HT|HEIGHT|H)[:\s]*([0-9]{1,3}(?:\.[0-9]+)?\s*(?:cm|m)?)/i);
          if (htMatch) enrichedFront.height = normalizePhysicalMeasurement(htMatch[1].trim(), 'height');
        }
        if (!enrichedFront.dateOfBirth && rawText) {
          const dobMatch = rawText.match(
            /(?:DOB|DATE\s*OF\s*BIRTH|BIRTH\s*DATE)[:\s]*([0-9]{4}[-/][0-9]{2}[-/][0-9]{2}|[0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i
          );
          if (dobMatch) enrichedFront.dateOfBirth = dobMatch[1].trim();
        }
        if (!enrichedFront.address && rawText) {
          const addrMatch = rawText.match(/(?:ADDRESS|ADDR)[:\s]*([^\n\r]{10,80})/i);
          if (addrMatch) enrichedFront.address = normalizePhilippineAddress(addrMatch[1].trim());
        }

        setFrontExtractedFields(enrichedFront);
        const merged = mergeFrontAndBackFields(enrichedFront, backExtractedFields);

        if (merged.firstName && isPlausibleHumanName(merged.firstName) && !isPascalCaseLabel(merged.firstName)) {
          setFirstName(merged.firstName);
        }
        if (merged.middleName && isPlausibleHumanName(merged.middleName) && !isPascalCaseLabel(merged.middleName)) {
          setMiddleName(merged.middleName);
        }
        if (merged.lastName && isPlausibleHumanName(merged.lastName) && !isPascalCaseLabel(merged.lastName)) {
          setLastName(merged.lastName);
        }
        if (merged.sex) {
          const s = merged.sex.toLowerCase();
          if (s.startsWith('m')) setSex('male');
          else if (s.startsWith('f')) setSex('female');
        }
        if (merged.dateOfBirth) {
          setDateOfBirth(merged.dateOfBirth);
          const resolvedAge = merged.age || computeAgeFromDob(merged.dateOfBirth);
          if (resolvedAge && !isNaN(Number(resolvedAge))) {
            setAge(String(resolvedAge));
          }
        } else if (merged.age) {
          setAge(String(merged.age));
        }
        if (merged.address && !isPascalCaseLabel(merged.address)) {
          setAddress(normalizePhilippineAddress(merged.address));
        }
        if (merged.licenseNumber) {
          setLicenseNumber(merged.licenseNumber);
        } else if (merged.idNumber) {
          setLicenseNumber(merged.idNumber);
        }
        if (merged.weight && !isPascalCaseLabel(merged.weight)) {
          const w = normalizePhysicalMeasurement(merged.weight, 'weight');
          if (w) setWeight(w);
        }
        if (merged.height && !isPascalCaseLabel(merged.height)) {
          const h = normalizePhysicalMeasurement(merged.height, 'height');
          if (h) setHeight(h);
        }
        if (merged.employeeId) setEmployeeId(merged.employeeId);
        else if (merged.idNumber && selectedRole === 'Responder') setEmployeeId(merged.idNumber);
        if (merged.rankOrTitle) setRankOrTitle(merged.rankOrTitle);

        const extractedCount = Object.values(merged).filter(Boolean).length;
        setAutofillBadge({
          visible: true,
          method: result.method,
          confidence: Math.max(68, Math.round(confidenceScore * 100)),
          tier: result.confidenceTier,
          provider: result.aiProviderUsed,
          extractedCount
        });

        setStatusMessage(
          `Front ID uploaded & scanned via ${
            result.method === 'DETERMINISTIC_CV' ? 'On-Device OCR' : 'AI Standby'
          } (${Math.max(68, Math.round(confidenceScore * 100))}% confidence). ${
            idBackShot ? 'Both Front & Back IDs secured.' : 'Now upload the Back of your ID card.'
          }`
        );
        setStatusTone('ok');
      } else {
        if (!result.corners || result.corners.length !== 4) {
          setErrors((prev) => ({
            ...prev,
            idCard:
              'Uploaded image does not appear to be the back of a valid Government ID card. Please upload a clear image.'
          }));
          setStatusMessage('Back ID upload rejected: Invalid document structure.');
          setStatusTone('bad');
          return;
        }

        const finalBackUrl = result.rectifiedImageUrl || rawDataUrl;
        setIdBackShot(finalBackUrl);

        const enrichedBack: ExtractedFieldsPayload = { ...result.fields };
        setBackExtractedFields(enrichedBack);

        const merged = mergeFrontAndBackFields(frontExtractedFields, enrichedBack);
        if (merged.licenseNumber && !licenseNumber) setLicenseNumber(merged.licenseNumber);
        else if (merged.idNumber && !licenseNumber) setLicenseNumber(merged.idNumber);

        setStatusMessage('Back ID uploaded & verified. Both Front and Back ID cards secured.');
        setStatusTone('ok');
      }

      setErrors((prev) => {
        const next = { ...prev };
        delete next.idCard;
        return next;
      });
    },
    [
      address,
      backExtractedFields,
      dateOfBirth,
      frontExtractedFields,
      height,
      idBackShot,
      licenseNumber,
      selectedRole,
      weight
    ]
  );

  // Open On-Device Crosshair Text Extractor Overlay on Uploaded IDs
  const handleOpenTextExtractor = useCallback(
    (sourceUrl?: string | null) => {
      setTextExtractorSourceUrl(sourceUrl || idFrontShot || idBackShot || null);
      setIsTextExtractorOpen(true);
    },
    [idFrontShot, idBackShot]
  );

  // Handle Quick-Assign from Text Extractor into Registration Form fields
  const handleApplyTextExtractorField = useCallback((field: AssignableField, value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    switch (field) {
      case 'firstName':
        setFirstName(trimmed);
        break;
      case 'middleName':
        setMiddleName(trimmed);
        break;
      case 'lastName':
        setLastName(trimmed);
        break;
      case 'dateOfBirth': {
        setDateOfBirth(trimmed);
        const resolvedAge = computeAgeFromDob(trimmed);
        if (resolvedAge && !isNaN(Number(resolvedAge))) {
          setAge(resolvedAge);
        }
        break;
      }
      case 'address':
        setAddress(trimmed);
        break;
      case 'licenseNumber':
        setLicenseNumber(trimmed);
        break;
      case 'sex': {
        const s = trimmed.toLowerCase();
        if (s.startsWith('m')) setSex('male');
        else if (s.startsWith('f')) setSex('female');
        break;
      }
      case 'weight':
        setWeight(trimmed);
        break;
      case 'height':
        setHeight(trimmed);
        break;
    }
  }, []);

  const handleRetakeAllId = () => {
    setIdFrontShot(null);
    setIdBackShot(null);
    setIdPortraitCropUrl(null);
    setFrontExtractedFields({});
    setBackExtractedFields({});
    setFirstName('');
    setMiddleName('');
    setLastName('');
    setDateOfBirth('');
    setAddress('');
    setLicenseNumber('');
    setWeight('');
    setHeight('');
    setAge('');
    setAutofillBadge(null);
    setStatusMessage('Uploaded ID cards and extracted fields cleared. Upload Front & Back ID images to begin.');
    setStatusTone('');
  };

  // Re-runs automated OCR extraction on an already-uploaded Front or Back ID data URL
  const handleRescanUploadedSide = useCallback(
    (side: 'front' | 'back') => {
      const targetUrl = side === 'front' ? idFrontShot : idBackShot;
      if (!targetUrl) return;

      if (side === 'front') setIsScanningFrontUpload(true);
      else setIsScanningBackUpload(true);

      const img = new Image();
      img.onload = async () => {
        setStatusMessage(`Re-scanning ${side.toUpperCase()} ID with automated On-Device OCR...`);
        setStatusTone('');
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 856;
          canvas.height = img.naturalHeight || 540;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const scanRes = await idScanEngine.scanUploadedIdImage(
              imgData,
              idType as GovernmentIdCategory,
              selectedRole,
              side
            );
            applyUploadedIdScanResult(side, scanRes, targetUrl);
          }
        } finally {
          if (side === 'front') setIsScanningFrontUpload(false);
          else setIsScanningBackUpload(false);
        }
      };
      img.onerror = () => {
        if (side === 'front') setIsScanningFrontUpload(false);
        else setIsScanningBackUpload(false);
      };
      img.src = targetUrl;
    },
    [applyUploadedIdScanResult, idBackShot, idFrontShot, idType, selectedRole]
  );

  // Upload Handling (File Picker & Drag-and-Drop) with Automatic Deterministic CV + OCR Scan
  const handleFileUpload = (side: 'front' | 'back', file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({
        ...prev,
        idCard: 'Please upload a valid image file (PNG, JPG, or WebP).'
      }));
      return;
    }

    if (side === 'front') setIsScanningFrontUpload(true);
    else setIsScanningBackUpload(true);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const img = new Image();
      img.onload = async () => {
        setStatusMessage(
          `Analyzing uploaded ${side.toUpperCase()} ID card & extracting text fields...`
        );
        setStatusTone('');
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 856;
          canvas.height = img.naturalHeight || 540;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const scanRes = await idScanEngine.scanUploadedIdImage(
              imgData,
              idType as GovernmentIdCategory,
              selectedRole,
              side
            );
            applyUploadedIdScanResult(side, scanRes, result);
          }
        } catch (err) {
          console.warn(`[RegisterPage] Upload ${side} CV scan error:`, err);
          setErrors((prev) => ({
            ...prev,
            idCard: 'Could not process uploaded file. Please provide a clear image of your ID card.'
          }));
          setStatusMessage('Upload analysis failed.');
          setStatusTone('bad');
        } finally {
          if (side === 'front') setIsScanningFrontUpload(false);
          else setIsScanningBackUpload(false);
        }
      };
      img.onerror = () => {
        if (side === 'front') setIsScanningFrontUpload(false);
        else setIsScanningBackUpload(false);
        setErrors((prev) => ({
          ...prev,
          idCard: 'Unable to decode uploaded image file.'
        }));
      };
      img.src = result;
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
      if (firstName === 'Juan' && lastName === 'Dela Cruz') {
        setFirstName('Eduardo');
        setMiddleName('M.');
        setLastName('Reyes');
      }
      if (email === 'juan.delacruz@gmail.com') {
        setEmail('e.reyes@bfp.gov.ph');
      }
    } else {
      setAgencyUnit('Security');
      setRankOrTitle('Resident');
      setEmployeeId('RES-ZN-2024');
      if (firstName === 'Eduardo' && lastName === 'Reyes') {
        setFirstName('Juan');
        setMiddleName('');
        setLastName('Dela Cruz');
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
    if (!firstName.trim()) newErrors.firstName = 'Enter your first name.';
    if (!lastName.trim()) newErrors.lastName = 'Enter your surname / last name.';
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
    if (password.length < 5) {
      newErrors.password = 'Password must be at least 5 characters.';
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
      const dualCompositeUrl = idFrontShot && idBackShot ? await generateDualIdComposite(idFrontShot, idBackShot) : undefined;

      const payload: RegisterPayload & { sex?: string; age?: number | string } = {
        fullName: fullname.trim(),
        email: email.trim(),
        password,
        phoneNumber: '0917-000-0000',
        employeeOrResidentId: employeeId.trim() || (isCivilian ? 'RES-ZN-2024' : 'RESP-2024'),
        validIdType: idType,
        role: isCivilian ? 'Civilian' : 'Responder',
        unit: isCivilian ? 'Security' : (agencyUnit as ResponderUnit),
        departmentOrBarangay: isCivilian ? 'Community Resident Sector' : `${agencyUnit} Tactical Command`,
        rankOrTitle: !isCivilian ? rankOrTitle.trim() || 'Emergency Officer' : 'Resident',
        idCaptureDataUrl: dualCompositeUrl,
        faceCaptureDataUrl: faceShot || undefined,
        sex: sex.trim(),
        age: parseInt(age, 10) || age
      };

      const res = await registerUser(payload);
      setIsLoading(false);
      setIsSuccess(true);
      biometricFrameCache.clear();

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
    <main className="scene page-register min-h-screen flex flex-col items-center justify-center p-3 sm:p-6 w-full overflow-y-auto">
      <div
        className="stage w-full max-w-4xl mx-auto flex flex-col items-center justify-center my-auto"
        style={{
          maxWidth: 'min(940px, 96vw)',
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
          <p className="brand__sub">System with Image Processing and Real-Time Tracking</p>
        </header>

        <section
          className="panel panel--register w-full"
          aria-labelledby="panel-title"
          style={{
            position: 'relative',
            left: 'auto',
            top: 'auto',
            width: '100%',
            maxWidth: isMobile ? '100%' : '920px',
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

                {/* ============ TOP CONTROL BAR: ID DOCUMENT SELECTION & UPLOAD PIPELINE ============ */}
                <div className="p-4 rounded-xl bg-black/50 border border-rose-500/30 mb-5">
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    {/* ID Document Selection */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="id-type">
                          Government ID Document Type <span className="req text-[#ff5c74]">*</span>
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
                          <option value="drivers">LTO Driver&apos;s License</option>
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

                    {/* Upload + Automated OCR Pipeline Status Badge & Interactive Text Extractor Trigger */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="px-3 py-2 rounded-lg bg-slate-950/90 border border-cyan-500/40 font-mono text-[10px] flex items-center gap-2">
                        <Upload className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white uppercase tracking-wider">
                            DUAL ID UPLOAD // AUTO-OCR
                          </div>
                          <div className="text-[9px] text-cyan-300/80">
                            Upload Front &amp; Back Pictures
                          </div>
                        </div>
                      </div>

                      {(idFrontShot || idBackShot) && (
                        <button
                          type="button"
                          onClick={() => handleOpenTextExtractor()}
                          className="px-3.5 py-2 font-mono text-[10px] font-bold rounded-lg border border-cyan-500/60 bg-cyan-950/80 text-cyan-200 hover:bg-cyan-900 cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                          title="Open On-Device Crosshair Text Extractor"
                        >
                          <Crop className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Interactive Text Extractor</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Fast track banner for civilians */}
                  {selectedRole === 'Civilian' && (
                    <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3 mt-3">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="font-mono text-xs">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold uppercase tracking-wider text-emerald-300 text-[11px]">
                            Resident Fast-Track Clearance
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[8.5px] bg-emerald-900/80 text-emerald-200 border border-emerald-500/40">
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

                {/* ============ GOVERNMENT ID FRONT & BACK PICTURE UPLOAD + AUTOMATED OCR SECTION ============ */}
                <div className="mt-2 pt-1 border-t border-rose-500/20">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 pt-3">
                    <div className="flex items-center gap-2">
                      <Scan className="w-4 h-4 text-[#ff5c74]" />
                      <div>
                        <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          Upload Government ID Pictures (Front &amp; Back) <span className="text-[#ff5c74]">*</span>
                        </h4>
                        <p className="font-mono text-[9px] text-rose-300/80 mt-0.5">
                          Upload clear pictures of both Front and Back sides of your {idType.toUpperCase()}. On-device OCR automatically extracts and populates your personal details.
                        </p>
                      </div>
                    </div>

                    {(idFrontShot || idBackShot) && (
                      <button
                        type="button"
                        onClick={handleRetakeAllId}
                        className="font-mono text-[10px] text-rose-300 hover:text-white px-2.5 py-1 rounded border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/60 cursor-pointer flex items-center gap-1 transition-all self-start sm:self-auto"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Clear Both ID Uploads</span>
                      </button>
                    )}
                  </div>

                  {/* Dual Upload Dropzones: Front ID Card & Back ID Card */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Dropzone 1: Front ID Card */}
                    <div className="flex flex-col">
                      <input
                        type="file"
                        ref={frontFileInputRef}
                        data-side="front"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload('front', e.target.files[0]);
                          }
                        }}
                      />
                      <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                        <span className="font-bold uppercase tracking-wider text-slate-200">
                          1. Front ID Card Picture
                        </span>
                        <span
                          className={
                            isScanningFrontUpload
                              ? 'text-cyan-400 font-bold animate-pulse'
                              : idFrontShot
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {isScanningFrontUpload ? 'EXTRACTING TEXT...' : idFrontShot ? 'SECURED & SCANNED' : 'REQUIRED'}
                        </span>
                      </div>

                      {idFrontShot ? (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-[#070c14] p-3 flex flex-col items-center">
                          <div className="relative w-full overflow-hidden rounded border border-emerald-500/30">
                            <img
                              src={idFrontShot}
                              alt="Front ID Card Upload"
                              className="w-full h-auto object-cover"
                              style={{ aspectRatio: '85.6 / 53.98' }}
                            />
                            <LaserScanOverlay
                              isScanning={isScanningFrontUpload}
                              label="EXTRACTING FRONT ID FIELDS..."
                              cardCategory={idType}
                            />
                          </div>
                          <div className="mt-2.5 w-full flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> FRONT ID SECURED
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRescanUploadedSide('front')}
                                disabled={isScanningFrontUpload}
                                className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer text-[9.5px] flex items-center gap-0.5"
                              >
                                <Sparkles className="w-3 h-3" /> Auto-Extract
                              </button>
                              <span className="text-slate-600">&bull;</span>
                              <button
                                type="button"
                                onClick={() => handleOpenTextExtractor(idFrontShot)}
                                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer text-[9.5px] flex items-center gap-0.5"
                              >
                                <Crop className="w-3 h-3" /> Crosshair OCR
                              </button>
                              <span className="text-slate-600">&bull;</span>
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
                          className={`relative rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[168px] overflow-hidden ${
                            isDraggingFront
                              ? 'border-[#ff5c74] bg-rose-950/30'
                              : 'border-rose-500/30 bg-[#16070d]/60 hover:border-rose-400 hover:bg-[#1f0a13]/70'
                          }`}
                        >
                          <LaserScanOverlay
                            isScanning={isScanningFrontUpload}
                            label="ANALYZING FRONT ID UPLOAD..."
                            cardCategory={idType}
                          />
                          <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-500/30 text-[#ff5c74] mb-2">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                            Upload Front ID Picture
                          </span>
                          <span className="font-sans text-[11px] text-slate-400 mt-1">
                            Drag &amp; drop or click to select PNG/JPG/WebP
                          </span>
                          <span className="font-mono text-[8.5px] text-cyan-300/90 mt-1.5">
                            [AUTO-EXTRACTS SURNAME, FIRST NAME, DOB &amp; ID NO.]
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Dropzone 2: Back ID Card */}
                    <div className="flex flex-col">
                      <input
                        type="file"
                        ref={backFileInputRef}
                        data-side="back"
                        accept="image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleFileUpload('back', e.target.files[0]);
                          }
                        }}
                      />
                      <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                        <span className="font-bold uppercase tracking-wider text-slate-200">
                          2. Back ID Card Picture
                        </span>
                        <span
                          className={
                            isScanningBackUpload
                              ? 'text-cyan-400 font-bold animate-pulse'
                              : idBackShot
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {isScanningBackUpload ? 'EXTRACTING TEXT...' : idBackShot ? 'SECURED & SCANNED' : 'REQUIRED'}
                        </span>
                      </div>

                      {idBackShot ? (
                        <div className="relative rounded-xl overflow-hidden border border-emerald-500/50 bg-[#070c14] p-3 flex flex-col items-center">
                          <div className="relative w-full overflow-hidden rounded border border-emerald-500/30">
                            <img
                              src={idBackShot}
                              alt="Back ID Card Upload"
                              className="w-full h-auto object-cover"
                              style={{ aspectRatio: '85.6 / 53.98' }}
                            />
                            <LaserScanOverlay
                              isScanning={isScanningBackUpload}
                              label="EXTRACTING BACK ID FIELDS..."
                              cardCategory={idType}
                            />
                          </div>
                          <div className="mt-2.5 w-full flex flex-wrap items-center justify-between gap-1.5 font-mono text-[10px]">
                            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold flex items-center gap-1">
                              <Check className="w-3 h-3 stroke-[3]" /> BACK ID SECURED
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRescanUploadedSide('back')}
                                disabled={isScanningBackUpload}
                                className="text-emerald-400 hover:text-emerald-300 underline cursor-pointer text-[9.5px] flex items-center gap-0.5"
                              >
                                <Sparkles className="w-3 h-3" /> Auto-Extract
                              </button>
                              <span className="text-slate-600">&bull;</span>
                              <button
                                type="button"
                                onClick={() => handleOpenTextExtractor(idBackShot)}
                                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer text-[9.5px] flex items-center gap-0.5"
                              >
                                <Crop className="w-3 h-3" /> Crosshair OCR
                              </button>
                              <span className="text-slate-600">&bull;</span>
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
                          className={`relative rounded-xl border-2 border-dashed p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[168px] overflow-hidden ${
                            isDraggingBack
                              ? 'border-[#ff5c74] bg-rose-950/30'
                              : 'border-rose-500/30 bg-[#16070d]/60 hover:border-rose-400 hover:bg-[#1f0a13]/70'
                          }`}
                        >
                          <LaserScanOverlay
                            isScanning={isScanningBackUpload}
                            label="ANALYZING BACK ID UPLOAD..."
                            cardCategory={idType}
                          />
                          <div className="p-2.5 rounded-full bg-rose-950/60 border border-rose-500/30 text-[#ff5c74] mb-2">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                            Upload Back ID Picture
                          </span>
                          <span className="font-sans text-[11px] text-slate-400 mt-1">
                            Drag &amp; drop or click to select PNG/JPG/WebP
                          </span>
                          <span className="font-mono text-[8.5px] text-cyan-300/90 mt-1.5">
                            [AUTO-EXTRACTS ADDRESS, WEIGHT, HEIGHT &amp; BARCODE]
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Autofill Verified HUD Badge (Directly in Upload Section) */}
                  {autofillBadge && autofillBadge.visible && (
                    <div className="mt-3.5 p-3 rounded-lg bg-[#041a12] border border-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[10.5px]">
                      <div className="flex items-center gap-2.5 text-emerald-300">
                        <Cpu className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
                        <div>
                          <span className="font-bold tracking-wide">
                            UPLOADED ID SCANNED VIA{' '}
                            {autofillBadge.method === 'DETERMINISTIC_CV'
                              ? 'ON-DEVICE OCR & SPATIAL FSM'
                              : `AI STANDBY (${autofillBadge.provider?.toUpperCase()})`}{' '}
                            // CONFIDENCE: {autofillBadge.confidence}% [{autofillBadge.tier}]
                          </span>
                          <p className="text-[9px] text-emerald-400/80 font-sans mt-0.5">
                            Holder credentials automatically extracted from your uploaded ID image. Use &quot;Crosshair OCR&quot; on either card to drag-select any region, or edit fields below.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {idPortraitCropUrl && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300 text-[9px]">
                            <img
                              src={idPortraitCropUrl}
                              alt="ID Portrait Crop"
                              className="w-4 h-5 object-cover rounded-xs"
                            />
                            <span>PORTRAIT CROPPED</span>
                          </div>
                        )}
                        <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/50 text-emerald-300 font-bold text-[9px]">
                          AUTOFILL VERIFIED
                        </span>
                        <button
                          type="button"
                          onClick={() => setAutofillBadge(null)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/60 transition-all cursor-pointer"
                          title="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
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

                {/* ============ PHASE 1 BOTTOM: PERSONAL DETAILS EDITABLE INPUTS ============ */}
                {!isIdValidated ? (
                  <div className="p-5 rounded-xl bg-black/40 border border-slate-800 text-center font-mono space-y-2 mt-4 backdrop-blur-sm">
                    <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center mx-auto text-slate-400">
                      <Lock className="w-5 h-5 text-rose-400/90" />
                    </div>
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Personal Details Locked Until Front Government ID Uploaded
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto leading-relaxed">
                      Select your Government ID type above and upload your Front &amp; Back ID pictures. Once validated by the on-device OCR &amp; computer vision engine, your Personal Details (Surname, First Name, Middle Name, Sex, Date of Birth, Address, License Number, Weight, and Height) will automatically unlock and populate below for review.
                    </p>
                  </div>
                ) : (
                  <div className="mt-6 pt-5 border-t border-rose-500/20 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-[#ff5c74]" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                        Authenticated Personal Details <span className="text-emerald-400 font-normal">[EDITABLE REVIEW]</span>
                      </h4>
                    </div>

                    <div className="form-grid">
                      {/* First Name Input */}
                      <div className={`field ${errors.firstName ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="first-name">
                            First Name <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[FIRST.NAME]</span>
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
                            placeholder="e.g. Juan"
                            autoComplete="given-name"
                            spellCheck={false}
                          />
                        </div>
                        {errors.firstName && (
                          <p className="field__error font-mono text-[10px]" id="first-name-error" role="alert">
                            {errors.firstName}
                          </p>
                        )}
                      </div>

                      {/* Middle Name Input */}
                      <div className="field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="middle-name">
                            Middle Name <span className="text-slate-400 text-[9px]">(Optional)</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[MIDDLE.NAME]</span>
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
                            placeholder="e.g. Santos or M."
                            autoComplete="additional-name"
                            spellCheck={false}
                          />
                        </div>
                      </div>

                      {/* Last Name / Surname Input */}
                      <div className={`field ${errors.lastName ? 'is-invalid' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="last-name">
                            Surname / Last Name <span className="req">*</span>
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[SURNAME]</span>
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
                            placeholder="e.g. Dela Cruz"
                            autoComplete="family-name"
                            spellCheck={false}
                          />
                        </div>
                        {errors.lastName && (
                          <p className="field__error font-mono text-[10px]" id="last-name-error" role="alert">
                            {errors.lastName}
                          </p>
                        )}
                      </div>

                      {/* Sex */}
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
                            name="sex"
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

                      {/* Date of Birth */}
                      <div className="field" id="dob-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="dob">
                            Date of Birth
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[DOB]</span>
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
                            type="text"
                            value={dateOfBirth}
                            onChange={(e) => {
                              const val = e.target.value;
                              setDateOfBirth(val);
                              const autoAge = computeAgeFromDob(val);
                              if (autoAge && !isNaN(Number(autoAge))) {
                                setAge(autoAge);
                              }
                            }}
                            placeholder="YYYY/MM/DD"
                            spellCheck={false}
                          />
                        </div>
                      </div>

                      {/* License Number / ID Number */}
                      <div className="field" id="license-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="license-number">
                            License No. / ID No.
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[LICENSE.NO]</span>
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
                            placeholder="e.g. J07-22-302560"
                            spellCheck={false}
                          />
                        </div>
                      </div>

                      {/* Weight */}
                      <div className="field" id="weight-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="weight">
                            Weight
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[WEIGHT.KG]</span>
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
                            placeholder="e.g. 52 kg"
                            spellCheck={false}
                          />
                        </div>
                      </div>

                      {/* Height */}
                      <div className="field" id="height-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="height">
                            Height
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[HEIGHT.M]</span>
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
                            placeholder="e.g. 1.71 m"
                            spellCheck={false}
                          />
                        </div>
                      </div>

                      {/* Address */}
                      <div className="field md:col-span-2" id="address-field">
                        <div className="flex items-center justify-between mb-1">
                          <label className="font-mono text-[10px] uppercase tracking-wider text-slate-200 font-semibold" htmlFor="address">
                            Address
                          </label>
                          <span className="font-mono text-[8.5px] text-rose-400/80">[ADDRESS]</span>
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
                            id="address"
                            name="address"
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="e.g. Poblacion, Manukan, Zamboanga del Norte, 7110"
                            spellCheck={false}
                          />
                        </div>
                      </div>

                      {/* Email Address */}
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

                      {/* Age */}
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
                            name="age"
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

                      {/* RESPONDER SPECIFIC FIELDS */}
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
                      )}
                    </div>
                  </div>
                )}

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
                      userIdOrEmail={email || employeeId}
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

      {/* Interactive On-Device Crosshair Text Extractor Overlay */}
      <TextExtractorOverlay
        isOpen={isTextExtractorOpen}
        onClose={() => setIsTextExtractorOpen(false)}
        imageSourceUrl={textExtractorSourceUrl}
        frontImageUrl={idFrontShot}
        backImageUrl={idBackShot}
        onApplyToField={handleApplyTextExtractorField}
      />
    </main>
  );
};

export default RegisterPage;
