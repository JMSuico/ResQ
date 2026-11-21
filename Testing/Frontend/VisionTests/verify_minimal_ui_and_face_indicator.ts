import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const loginPagePath = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src', 'LANDING_PAGE', 'Features', 'Pages', 'LoginPage', 'LoginPage.tsx');
const adminLoginPath = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src', 'LANDING_PAGE', 'Features', 'Pages', 'LoginPage', 'AdminLoginPage.tsx');
const bioModalPath = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src', 'LANDING_PAGE', 'Features', 'Pages', 'LoginPage', 'BiometricLoginModal.tsx');
const registerPagePath = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src', 'LANDING_PAGE', 'Features', 'Pages', 'RegisterPage', 'RegisterPage.tsx');
const facialPanelPath = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src', 'LANDING_PAGE', 'Features', 'Pages', 'RegisterPage', 'ManualFacialCapturePanel.tsx');
const idBannerPath = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src', 'LANDING_PAGE', 'Features', 'Pages', 'RegisterPage', 'IdVerificationBanner.tsx');

let failures = 0;

const assert = (cond: boolean, message: string): void => {
  if (cond) {
    console.log(`[PASS] ${message}`);
  } else {
    console.error(`[FAIL] ${message}`);
    failures++;
  }
};

const loginSrc = fs.readFileSync(loginPagePath, 'utf8');
const adminSrc = fs.readFileSync(adminLoginPath, 'utf8');
const bioSrc = fs.readFileSync(bioModalPath, 'utf8');
const regSrc = fs.readFileSync(registerPagePath, 'utf8');
const facialSrc = fs.readFileSync(facialPanelPath, 'utf8');
const bannerSrc = fs.readFileSync(idBannerPath, 'utf8');

console.log('=== Minimal UI & Biometric Face Detection Indicator Contract Audit ===');

// 1. Live face detection indicator in BiometricLoginModal
assert(bioSrc.includes('biometric-face-status-badge'), 'BiometricLoginModal exposes #biometric-face-status-badge');
assert(bioSrc.includes('data-face-detected'), 'BiometricLoginModal exposes data-face-detected attribute');
assert(bioSrc.includes('NO FACE DETECTED'), 'BiometricLoginModal displays NO FACE DETECTED indication');
assert(bioSrc.includes('FACE DETECTED'), 'BiometricLoginModal displays FACE DETECTED indication');

// 2. Live face detection indicator in ManualFacialCapturePanel
assert(facialSrc.includes('facial-capture-face-status'), 'ManualFacialCapturePanel exposes #facial-capture-face-status');
assert(facialSrc.includes('data-face-detected'), 'ManualFacialCapturePanel exposes data-face-detected attribute');
assert(facialSrc.includes('NO FACE DETECTED'), 'ManualFacialCapturePanel displays NO FACE DETECTED indication');
assert(facialSrc.includes('FACE DETECTED'), 'ManualFacialCapturePanel displays HUMAN FACE DETECTED / FACE DETECTED indication');

// 3. Minimal copy audit: remove noisy bracket tags and verbose marketing blocks
assert(!loginSrc.includes('[AUTH.IDENTIFIER]'), 'LoginPage removes [AUTH.IDENTIFIER] noise');
assert(!loginSrc.includes('[ARGON2.KEY]'), 'LoginPage removes [ARGON2.KEY] noise');
assert(!loginSrc.includes('AUTH ENGINE // SYS.ONLINE'), 'LoginPage removes AUTH ENGINE telemetry bar');
assert(!adminSrc.includes('C2-ISOLATE // SEC-GRID'), 'AdminLoginPage removes C2-ISOLATE telemetry noise');
assert(!regSrc.includes('[FIRST.NAME]'), 'RegisterPage removes [FIRST.NAME] bracket noise');
assert(!regSrc.includes('[SURNAME]'), 'RegisterPage removes [SURNAME] bracket noise');
assert(!regSrc.includes('[SOLE.LOGIN.ID]'), 'RegisterPage removes [SOLE.LOGIN.ID] bracket noise');
assert(!regSrc.includes('[PBKDF2.SHA512]'), 'RegisterPage removes [PBKDF2.SHA512] bracket noise');
assert(!regSrc.includes('Verify that all information below is accurate.'), 'RegisterPage Phase 5 trims verbose instructions');
assert(!bannerSrc.includes('Government ID Verified by AI — Review &amp; Complete Details Below'), 'IdVerificationBanner uses concise verified label');

// 4. Hygiene & preserved E2E invariants
const tsFiles = [loginSrc, adminSrc, bioSrc, regSrc, facialSrc, bannerSrc];
assert(tsFiles.every((s) => !/\b:\s*any\b|\bas\s+any\b/.test(s)), 'Zero TypeScript `any` across modified UI files');
assert(regSrc.includes('Choose ID Type'), 'RegisterPage preserves "Choose ID Type" option');
assert(regSrc.includes('Active Role:'), 'RegisterPage preserves "Active Role:" text');
assert(facialSrc.includes('% Trained'), 'ManualFacialCapturePanel preserves "% Trained" text');
assert(facialSrc.includes('128-D Vector') || regSrc.includes('128-D Vector Ready for 1:1 Login'), 'Registration preserves 128-D readiness label');
assert(bioSrc.includes('Activate Live Camera'), 'BiometricLoginModal preserves "Activate Live Camera" button');

const collectTsxFiles = (dir: string): string[] => {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(full));
    } else if (entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
};

// 5. All-module minimalism, zero-emoji & E2E locked selector audit across Landing, LayoutBars, UserRoles, and Shared
const frontendSrcDir = path.join(repoRoot, 'Project system ENGINE', 'Frontend', 'src');
const moduleDirs = ['LANDING_PAGE', 'LayoutBars', 'UserRoles', 'Shared'].map((d) => path.join(frontendSrcDir, d));
const allModuleTsx = moduleDirs.flatMap((d) => collectTsxFiles(d));
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

assert(
  allModuleTsx.every((filePath) => !emojiRegex.test(fs.readFileSync(filePath, 'utf8'))),
  `Zero emojis across all ${allModuleTsx.length} TSX modules (LANDING_PAGE, LayoutBars, UserRoles, Shared)`
);
assert(
  allModuleTsx.every((filePath) => !/\b:\s*any\b|\bas\s+any\b/.test(fs.readFileSync(filePath, 'utf8'))),
  `Zero TypeScript \`any\` across all ${allModuleTsx.length} TSX modules`
);

const headerSrc = fs.readFileSync(path.join(frontendSrcDir, 'LayoutBars', 'Header.tsx'), 'utf8');
assert(headerSrc.includes('btn-alerts') && headerSrc.includes('alerts-panel'), 'Header preserves #btn-alerts and #alerts-panel');

const deployModalSrc = fs.readFileSync(path.join(frontendSrcDir, 'Shared', 'DeployRespondersModal.tsx'), 'utf8');
assert(deployModalSrc.includes('Tactical Responder Deployment & Workload Optimization Deck'), 'DeployRespondersModal preserves title contract');
assert(deployModalSrc.includes('AUTO-DEPLOY OPTIMAL UNIT') && deployModalSrc.includes('DEPLOYMENT ORDER CONFIRMED'), 'DeployRespondersModal preserves E2E deploy buttons/badges');

const responderDashSrc = fs.readFileSync(path.join(frontendSrcDir, 'UserRoles', 'Features', 'Pages', 'RespondersPanel', 'ResponderDashboard.tsx'), 'utf8');
assert(responderDashSrc.includes('REQUEST TO DISPATCH OR DEPLOY'), 'ResponderDashboard preserves REQUEST TO DISPATCH OR DEPLOY contract');

const adminDashSrc = fs.readFileSync(path.join(frontendSrcDir, 'UserRoles', 'Features', 'Pages', 'AdminsPanel', 'AdminDashboard.tsx'), 'utf8');
assert(adminDashSrc.includes('ENLARGE') && adminDashSrc.includes('VIEW ALL'), 'AdminDashboard preserves ENLARGE & VIEW ALL buttons');

const submittedSrc = fs.readFileSync(path.join(frontendSrcDir, 'UserRoles', 'Features', 'Pages', 'AdminsPanel', 'SubmittedReportsPage.tsx'), 'utf8');
assert(!submittedSrc.includes('[LDRRMO EXECUTIVE COMMAND // MUNICIPAL DISPATCH C2]'), 'SubmittedReportsPage removes bracket banner noise');

// 6. Biometric lockout removal, fresh-session frame cache cleanup & enhanced typography contracts
const authServicePath = path.join(repoRoot, 'Project system ENGINE', 'Backend', 'Features', 'Services', 'Implementations', 'AuthService.cs');
const authServiceSrc = fs.readFileSync(authServicePath, 'utf8');
const bioMethodStart = authServiceSrc.indexOf('BiometricLoginAsync(');
const bioMethodSlice = bioMethodStart >= 0 ? authServiceSrc.slice(bioMethodStart) : '';
assert(
  bioMethodStart >= 0 && !bioMethodSlice.includes('GetLockoutErrorMessageAsync'),
  'AuthService.BiometricLoginAsync removes GetLockoutErrorMessageAsync 15-minute lockout check'
);
assert(regSrc.includes('biometricFrameCache.clear()'), 'RegisterPage clears biometricFrameCache after registration');

const globalIndexCss = fs.readFileSync(path.join(frontendSrcDir, 'LayoutStyles', 'index.css'), 'utf8');
assert(globalIndexCss.includes('font-size:') && globalIndexCss.includes('backdrop-filter:'), 'Global index.css defines enhanced typography scale and glassmorphism rules');

if (failures > 0) {
  console.error(`\nContract audit failed with ${failures} violation(s).`);
  process.exit(1);
}

console.log('\nALL MINIMAL UI & FACE INDICATOR CONTRACT CHECKS PASSED!');
