# ResQTrack Biometric Lockout Removal, Instant Post-Registration Learning, Enlarged Typography & Minimal Glassmorphism Design

## 1. Goals
1. **Remove 15-Minute Lockout from Biometric Login**: Eliminate `"Account temporarily locked due to repeated failed sign-in attempts. Please wait 15 minutes."` enforcement and biometric failure lockout accumulation in `AuthService.BiometricLoginAsync` and `BiometricLoginModal.tsx`; purge stale `LoginAttempts` on fresh registration so newly registered Civilians and Responders (`RHU` / `FIRE` / `PNP`) can sign in via biometrics immediately on first attempt.
2. **Fast & Restart-Free Biometric Learning**:
   - Clear `biometricFrameCache` on registration completion so old session frames never persist without restart.
   - Parallelize multi-pose 128-D feature extraction (`Promise.all` in `biometricFrameCache.ts`), remove duplicate double-extraction during Phase 3 confirm, and streamline pose capture pacing.
   - Add `.AsNoTracking()` on `BiometricEnrollments` lookups, always prioritize/include freshest enrollments in `1:N` candidate selection, and run `1:N` Claude pose evaluations concurrently via `Task.WhenAll`.
3. **Larger, High-Legibility Typography & Minimal Glassmorphism Across All Portals**:
   - Upgrade CSS base typography scales and replace cramped `9px`–`11px` utility sizes with legible `>= 12px` labels/badges, `>= 14px` body/controls, and prominent headings/KPIs across Landing Page, Login/Register, Admin (`AdminsPanel`), Responders (`RespondersPanel` — RHU/PNP/FIRE), Civilians (`CiviliansPanel`), `LayoutBars`, and `Shared`.
   - Apply unified frosted dark glassmorphism preserving primary crimson/navy and semantic emerald/amber/sky/purple colors without altering API endpoints, handlers, routes, or business logic.

## 2. Guardrails
- Zero `any`, zero Unicode emojis (`lucide-react` icons only), universal `=>` arrow lambdas, SQL Server 2022 compatibility preserved, zero test-only bypasses.
