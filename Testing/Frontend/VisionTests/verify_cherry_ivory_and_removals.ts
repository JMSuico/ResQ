// [Layer: Testing/Frontend/VisionTests]
// RED -> GREEN Verification Contract for:
//   1. Official Cherry (#670626), Warm Ivory (#F7F1EA), Muted Cherry (#A83B4D), Soft Beige (#E9D9D0) Stitch Clay System
//   2. Complete Removal of all tel: links, Hotlines pages/menus, Warnings page, Apparatus/Crew/Patrol Roster/Dispatches
//   3. Required Renames (Identity -> Profile, Hazmat & 2-Alarm -> Reports, Fleet Roster -> Responders, Incidents & Triage -> Dispatch Manager)
//   4. Civilian Evacuation Safe Zones left + Report Emergency right + ENLARGE TO REDIRECT button
//   5. Biometric 5-minute AI learning UI/toast indicator

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FRONTEND_SRC = join(process.cwd(), 'Project system ENGINE', 'Frontend', 'src');
const failures: string[] = [];

const check = (cond: boolean, message: string): void => {
  if (!cond) {
    failures.push(message);
    console.error(`[FAIL] ${message}`);
  } else {
    console.log(`[PASS] ${message}`);
  }
};

const walkFiles = (dir: string): string[] => {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkFiles(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.css')) {
      results.push(full);
    }
  }
  return results;
};

const indexCss = readFileSync(join(FRONTEND_SRC, 'LayoutStyles', 'index.css'), 'utf8');
check(indexCss.toLowerCase().includes('#670626'), 'LayoutStyles/index.css defines Cherry #670626 token');
check(indexCss.toLowerCase().includes('#f7f1ea'), 'LayoutStyles/index.css defines Warm Ivory #F7F1EA token');
check(indexCss.toLowerCase().includes('#a83b4d'), 'LayoutStyles/index.css defines Muted Cherry #A83B4D token');
check(indexCss.toLowerCase().includes('#e9d9d0'), 'LayoutStyles/index.css defines Soft Beige #E9D9D0 token');
check(indexCss.includes('.clay-surface'), 'LayoutStyles/index.css defines Stitch .clay-surface card utility');

const allSrcFiles = walkFiles(FRONTEND_SRC);
const telHits = allSrcFiles.filter((f) => readFileSync(f, 'utf8').includes('href={`tel:') || readFileSync(f, 'utf8').includes('href="tel:'));
check(telHits.length === 0, `Zero tel: click-to-dial links remain across Frontend/src (found ${telHits.length})`);

check(
  !existsSync(join(FRONTEND_SRC, 'UserRoles', 'Features', 'Pages', 'CiviliansPanel', 'EmergencyHotlinesUnits.tsx')),
  'EmergencyHotlinesUnits.tsx removed'
);
check(
  !existsSync(join(FRONTEND_SRC, 'UserRoles', 'Features', 'Pages', 'CiviliansPanel', 'EmergencyNumbersPage.tsx')),
  'EmergencyNumbersPage.tsx removed'
);

const sidebarSrc = readFileSync(join(FRONTEND_SRC, 'LayoutBars', 'Sidebar.tsx'), 'utf8');
check(!sidebarSrc.includes('/civilian/hotlines'), 'Sidebar removes Civilian Hotlines menu');
check(!sidebarSrc.includes('/civilian/warnings') && !sidebarSrc.includes("label: 'Warnings'"), 'Sidebar removes Civilian Warnings menu');
check(sidebarSrc.includes("label: 'Profile'") || sidebarSrc.includes('label: "Profile"'), 'Sidebar renames Identity -> Profile for Civilians');
check(!sidebarSrc.includes('Hazmat & 2-Alarm'), 'Sidebar renames FIRE Hazmat & 2-Alarm -> Reports');
check(!sidebarSrc.includes('Crew Roster') && !sidebarSrc.includes('Patrol Roster'), 'Sidebar removes Crew Roster and Patrol Roster');
check(!sidebarSrc.includes('Apparatus'), 'Sidebar removes FIRE Apparatus menu');
check(sidebarSrc.includes('Dispatch Manager'), 'Sidebar renames Incidents & Triage -> Dispatch Manager');

const civDashSrc = readFileSync(join(FRONTEND_SRC, 'UserRoles', 'Features', 'Pages', 'CiviliansPanel', 'CivilianDashboard.tsx'), 'utf8');
check(civDashSrc.includes('ENLARGE TO REDIRECT'), 'CivilianDashboard renders ENLARGE TO REDIRECT button');
check(!civDashSrc.includes('View All ('), 'CivilianDashboard removes View All (25) floating banner');
check(!civDashSrc.includes('Emergency Hotlines'), 'CivilianDashboard removes Emergency Hotlines strip');

const civMapSrc = readFileSync(join(FRONTEND_SRC, 'UserRoles', 'Features', 'Pages', 'CiviliansPanel', 'CivilianLiveMapPage.tsx'), 'utf8');
check(!civMapSrc.includes('Emergency Stations'), 'CivilianLiveMapPage removes Emergency Stations panel');

const registerSrc = readFileSync(join(FRONTEND_SRC, 'LANDING_PAGE', 'Features', 'Pages', 'RegisterPage', 'RegisterPage.tsx'), 'utf8');
check(
  registerSrc.toLowerCase().includes('5 min') || registerSrc.toLowerCase().includes('5 minutes'),
  'RegisterPage includes 5-minute AI facial learning toast/indication'
);

if (failures.length > 0) {
  console.error(`\n[RED BASELINE] ${failures.length} contract check(s) failed as expected before Wave 2.`);
  process.exit(1);
}
console.log('\nALL CHERRY/IVORY STITCH, REMOVAL, AND BIOMETRIC CONTRACT CHECKS PASSED!');
