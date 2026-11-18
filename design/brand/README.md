# Havenly logo

Chosen 2026-11-18: option B (roof-h icon) with the plain wordmark. It stays separate from the Havenly tees brand and should not be mixed with it.

## The pieces
- **Mark (the roof-h):** a lowercase "h" whose arch is a pitched roof, drawn as two rounded strokes. Master: `logo-mark.svg`. In the app: `RoofH` in `src/components/Brand.tsx`.
- **Wordmark:** lowercase `havenly` in Schibsted Grotesk ExtraBold, ink `#1F1B16`, with a full stop in oxblood `#7A2433`. In the app: `Wordmark` in `src/components/Brand.tsx`.
- **App icon:** the mark in cream `#FBF5EA` on oxblood `#7A2433`, filling the square (the phone rounds the corners). Files: `assets/icon.png` (1024), `assets/adaptive-icon.png` (Android foreground, mark inside the safe zone, background colour set in `app.json`), `assets/favicon.png` (256, rounded). Splash: `assets/splash.png` (the wordmark on the stone ground `#F3F0EA`).
- **Dark theme:** wordmark in cream `#F3ECDC` with a rose full stop `#D4788A`; mark in rose `#D4788A` (`logo-mark-dark.svg`). Inside the app `RoofH` and `Wordmark` switch by themselves. Dark splash: `assets/splash-dark.png` on `#151310`. The app icon stays the same in both themes.
- Overview: `logo-sheet.png`.

## Use
- Mark and wordmark can sit side by side or alone. Give each clear space equal to the mark's stroke width.
- Do not recolour, outline, stretch, add shadows or gradients, or place it on a busy photo.
- Do not combine it with the tees brand's logo.
- The mark reads down to 32 px (browser tab). Below that use the wordmark only.

## Still to do
- The app store listing images, once developer accounts exist.
- The old coral and script logo may still appear in places outside this repo (Instagram profile picture, documents, Vercel project icon).
