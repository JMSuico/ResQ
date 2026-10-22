// [Layer: LANDING_PAGE/Features/Pages/Register]
// Responsibility: 3-step registration wizard with biometric Government ID and Live Face PNG captures.
// DO NOT bypass mandatory face capture verification before granting immediate Verified status.

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '@/Endpoints/authApi';
import { Button } from '@/Shared/Button';
import { CameraCaptureModal } from '@/Shared/CameraCaptureModal';

export const Register: React.FC = () => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Role & Agency
  const [role, setRole] = useState<'LDRRMO_Admin' | 'Responder' | 'Civilian'>('Civilian');
  const [unit, setUnit] = useState<'None' | 'LDRRMO' | 'RHU' | 'FIRE' | 'PNP' | 'Security'>('None');
  const [fullName, setFullName] = useState('');
  const [employeeOrResidentId, setEmployeeOrResidentId] = useState('');
  const [departmentOrBarangay, setDepartmentOrBarangay] = useState('');
  const [rankOrTitle, setRankOrTitle] = useState('');

  // Step 2: Credentials
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 3: Biometric Captures
  const [idCaptureUrl, setIdCaptureUrl] = useState<string | null>(null);
  const [faceCaptureUrl, setFaceCaptureUrl] = useState<string | null>(null);

  // Modals & Feedback
  const [activeCameraKind, setActiveCameraKind] = useState<'id' | 'face' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ faceVerified: boolean; status: string } | null>(null);

  const navigate = useNavigate();

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName) {
      setErrorMessage('Full name is required.');
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      setErrorMessage('Password must be at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setErrorMessage(null);
    setStep(3);
  };

  const handleSubmitRegistration = async () => {
    if (!idCaptureUrl) {
      setErrorMessage('Government ID capture is mandatory.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await registerUser({
        email,
        password,
        fullName,
        phoneNumber,
        employeeOrResidentId,
        role,
        unit,
        departmentOrBarangay,
        rankOrTitle,
        idCaptureDataUrl: idCaptureUrl || undefined,
        faceCaptureDataUrl: faceCaptureUrl || undefined
      });

      setSuccessInfo({
        faceVerified: res.faceVerified,
        status: res.status
      });

      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-6 bg-command-dark">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8 flex flex-col gap-6">
        {/* Wizard Header & Progress Steps */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Emergency Registration Wizard</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              STEP {step} OF 3
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className={`h-1.5 rounded-full ${step >= 1 ? 'bg-sky-500' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full ${step >= 2 ? 'bg-sky-500' : 'bg-slate-800'}`} />
            <div className={`h-1.5 rounded-full ${step >= 3 ? 'bg-sky-500' : 'bg-slate-800'}`} />
          </div>
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-rose-950/80 border border-rose-600/50 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Success Feedback Banner */}
        {successInfo && (
          <div className="p-4 rounded-xl bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 text-xs flex flex-col gap-2">
            <p className="font-bold text-sm text-emerald-400">✓ Registration Verified!</p>
            <p>
              {successInfo.faceVerified
                ? 'Live face capture verified. Your account is immediately VERIFIED and authorized for operational access.'
                : 'Registration submitted. Account status is PENDING manual LDRRMO administrator review.'}
            </p>
            <p className="font-mono text-[11px] text-emerald-300">Redirecting to login in 3 seconds...</p>
          </div>
        )}

        {/* STEP 1: Unit & Role Assignment */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Operational Role</label>
                <select
                  value={role}
                  onChange={(e) => {
                    const r = e.target.value as any;
                    setRole(r);
                    if (r === 'Civilian') setUnit('None');
                    else if (r === 'LDRRMO_Admin') setUnit('LDRRMO');
                    else setUnit('RHU');
                  }}
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                >
                  <option value="Civilian">Civilian / UG Resident</option>
                  <option value="Responder">Emergency Responder</option>
                  <option value="LDRRMO_Admin">LDRRMO Super Admin</option>
                </select>
              </div>

              {role === 'Responder' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Assigned Agency Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                  >
                    <option value="RHU">RHU (Rural Health / Medical)</option>
                    <option value="FIRE">FIRE (Bureau of Fire Protection)</option>
                    <option value="PNP">PNP (Philippine National Police)</option>
                    <option value="Security">Campus / Facility Security</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Full Legal Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Maria Clara Santos"
                required
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {role === 'Civilian' ? 'Resident / Student ID' : 'Badge / Employee ID'}
                </label>
                <input
                  type="text"
                  value={employeeOrResidentId}
                  onChange={(e) => setEmployeeOrResidentId(e.target.value)}
                  placeholder="e.g. RHU-MEDIC-042"
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {role === 'Civilian' ? 'Barangay / Address' : 'Department / Division'}
                </label>
                <input
                  type="text"
                  value={departmentOrBarangay}
                  onChange={(e) => setDepartmentOrBarangay(e.target.value)}
                  placeholder="e.g. Barangay San Antonio"
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                />
              </div>
            </div>

            <Button type="submit" variant="primary" size="md" className="mt-2">
              Continue to Step 2: Credentials →
            </Button>
          </form>
        )}

        {/* STEP 2: Credentials & Password Policy */}
        {step === 2 && (
          <form onSubmit={handleStep2Next} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Official Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. user@resqtrack.gov.ph"
                required
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Contact Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+63 9XX XXX XXXX"
                className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Password (Min. 12 chars)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  minLength={12}
                  required
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  minLength={12}
                  required
                  className="px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-2">
              <Button type="button" variant="outline" size="md" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button type="submit" variant="primary" size="md">
                Continue to Step 3: Biometrics →
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: Mandatory Biometric Captures */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <p className="text-xs text-slate-400">
              Provide government ID and live face capture. A valid face capture grants immediate account verification; otherwise account defaults to pending admin approval.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ID Capture Card */}
              <div className="tactical-card p-4 flex flex-col items-center justify-between text-center gap-3">
                <div className="w-full aspect-[4/3] bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
                  {idCaptureUrl ? (
                    <img src={idCaptureUrl} alt="Government ID" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-600 gap-1">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                      <span className="text-[11px]">ID Capture Required</span>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" onClick={() => setActiveCameraKind('id')}>
                  {idCaptureUrl ? 'Retake ID' : 'Capture ID Card'}
                </Button>
              </div>

              {/* Face Capture Card */}
              <div className="tactical-card p-4 flex flex-col items-center justify-between text-center gap-3">
                <div className="w-full aspect-[4/3] bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
                  {faceCaptureUrl ? (
                    <img src={faceCaptureUrl} alt="Face Biometric" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center text-slate-600 gap-1">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-[11px]">Live Face Capture</span>
                    </div>
                  )}
                </div>

                <Button variant="outline" size="sm" onClick={() => setActiveCameraKind('face')}>
                  {faceCaptureUrl ? 'Retake Face' : 'Capture Live Face'}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-800">
              <Button variant="outline" size="md" onClick={() => setStep(2)}>
                ← Back
              </Button>
              <Button
                variant="success"
                size="md"
                onClick={handleSubmitRegistration}
                isLoading={isLoading}
                disabled={!idCaptureUrl}
              >
                Complete Registration
              </Button>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="text-sky-400 hover:text-sky-300 font-semibold underline">
            Sign In Here
          </Link>
        </div>
      </div>

      {/* Embedded Live Camera Modal */}
      <CameraCaptureModal
        isOpen={activeCameraKind !== null}
        onClose={() => setActiveCameraKind(null)}
        onCapture={(dataUrl) => {
          if (activeCameraKind === 'id') setIdCaptureUrl(dataUrl);
          if (activeCameraKind === 'face') setFaceCaptureUrl(dataUrl);
        }}
        title={activeCameraKind === 'id' ? 'Capture Government ID' : 'Capture Live Facial Biometric'}
        instructionText={
          activeCameraKind === 'id'
            ? 'Align government ID or employee badge inside the frame.'
            : 'Look straight at the camera with clear lighting for instant biometric verification.'
        }
      />
    </div>
  );
};
