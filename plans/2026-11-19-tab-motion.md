# Plan: fix the tab motion that overshoots and wobbles

Branch: `fix/tab-motion`. Reported by the owner: the swipe between tabs is too fast or overextends, on the Housing and Profile tabs; check everywhere else.

## What was wrong (measured in the browser)
The sliding highlight in the tab bar used a spring. With React Native 0.88 and Reanimated 4.7 that spring was badly underdamped: going Housing to Profile, the highlight shot about 90 px past its target (to 516 px on a 430 px screen, well outside the bar, so on the first and last tabs it left the bar) and then swung back and forth for more than 1.4 seconds. Button presses used the same kind of spring and dipped, overshot to 1.012 and jiggled for about a second.

## Fix
All springs are replaced by short timed moves with an ease-out, in one place, `src/theme/motion.ts`: the tab highlight (260 ms), button and card presses (90 ms in, 150 ms out), the heart pop when saving a place (110 ms up to 1.28, 170 ms back to exactly 1), the sheets that slide up (ActionSheet, ReportModal: 260 ms), the toast and the swipe-to-act rows (React Native's own Animated, 200 to 240 ms). A test now fails if a spring is added back anywhere in `src/`.

## Files
Create `src/theme/motion.ts`, `src/theme/motion.test.ts`. Change `TabBar.tsx`, `AnimatedPressable.tsx`, `BurstHeart.tsx`, `ActionSheet.tsx`, `ReportModal.tsx`, `SwipeToAction.tsx`, `ToastContext.tsx`.

## Verification
1. typecheck, lint, tests (one new), expo-doctor, export pass.
2. Browser, same probe before and after. **Before:** Housing to Profile: highlight path went 22, 72, 206, 337, 411, 421 (target 315), right edge 516 against a bar edge of 414, still moving after 1.4 s. **After:** Housing to Profile: 22, 107, 215, 277, 306, 313, 315; never beyond the target, right edge at most 409 (inside the bar), settled in 337 ms. Profile to Housing: 315 down to exactly 22, settled in 305 ms, never below 22. Button press: dips to 0.97, back to exactly 1, no overshoot, done about 100 ms after release (before: min 0.977, max 1.012, still wobbling at 1.2 s).
3. The other springs (sheets, toast, swipe rows, heart pop) are timed moves that cannot overshoot by construction; the heart pop is the one deliberate bounce. Not tested on a phone: native rendering of the timed moves.
