# Plan: bring every off-palette colour onto the oxblood and stone scheme

Branch: `fix/palette-sweep`. Chief Architect, at the owner's request ("everything without the color scheme we incorporated, change to the colors we are using").

## Goal
No teal, gold or old-coral colours left anywhere in the app.

## Steps
1. Teal: small category tags and eyebrow labels (uppercase) become the quiet ink-soft grey; teal icons, badges, date labels, check-in buttons and the progress bar become the primary oxblood; the success toast icon is ink. The teal and gold tokens are deleted from the theme, so nothing can use them again.
2. Gold ("interested" and "going" states) becomes the primary oxblood. The map's pins stay distinguishable: perks oxblood, events ink, housing a warm brown.
3. Hard-coded old colours: the video progress bar (white), the onboarding hero (ink with stone text), the map popups, and the sign-in field error (the error token).
4. Gradient tones: only the oxblood pair is kept.
5. Dark theme: the old coral accent becomes a lighter oxblood-rose (`#D4788A`), because oxblood itself is too dark to read on dark. Its tint is a dark rose. The dark theme is still not designed in full.

## Files
`src/theme/tokens.ts` and 14 screens and components (colour values only), `src/screens/MapScreen.tsx` (pins and popup colours), `src/screens/OnboardingScreen.tsx`, `src/components/PostVideoPlayer.tsx`, `src/screens/SignInToContinueScreen.tsx`.

## Checks
typecheck (a removed token that is still used fails the build), lint, 85 tests, expo-doctor, web export; Feed, Housing and the demo on screen in light and dark.

## What could break
Contrast on small text: the oxblood is 8.7:1 on stone and passes; the dark rose is 6.1:1 on the dark ground; white text on the dark rose is 3.1:1 (the same as before with the old coral).

## Not doing
A full dark-theme design, and photos or illustrations (they carry their own colours).

## Verification
typecheck, lint and 85 tests pass. On screen in the demo (light): the Feed and Housing show no teal, the category labels are grey and the community badges oxblood. Dark: Housing shows the rose accent. The native-only map was not run (it does not work on web).

## Codex review
Round 1: VERDICT FINDINGS(2).
1. MAJOR, `EventDetailScreen.tsx`: in dark mode the check-in button has white text on the rose accent (3.1:1). **Dismissed:** the same pairing was 3.1:1 with the old coral, so this is not a regression. With one accent colour used both as a fill and as text on the dark ground, 4.5:1 is impossible for both (oxblood-rose light enough to read as text is too light for white text). It needs the proper dark-theme design (separate fill and text accents), which is listed as still to do.
2. MINOR, `MapScreen.tsx`: the search-result icons and the legend used coral for all three types, so colour no longer told them apart. **Fixed:** perks oxblood, events ink, housing warm brown, matching the pins.
