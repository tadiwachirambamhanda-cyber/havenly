# Plan: dark-mode accent contrast

## Goal
White text on the dark-theme rose buttons reaches at least 4.5:1 (it was 3.1:1).

## Feature
Follow-up to the colour sweep (PR 28). Not a feature ID.

## Steps
1. Add a `coralFill` token to both palettes: light `#7A2433` (same as coral, so light mode is unchanged), dark `#BA4660` (white on it is 5.1:1).
2. Use `coralFill` for every solid fill and its same-line border (buttons, selected chips, FAB, bubbles). `coral` stays for text, icons and outlines, where the lighter rose `#D4788A` reads well on dark.
3. Check light and dark in the browser.

## Files
`src/theme/tokens.ts` and 25 screens and components that had `backgroundColor: colors.coral`.

## Checks
typecheck, lint, 85 tests pass; dark Housing, Log in button and FAB show the deeper rose with white text; light mode looks the same.

## What could break
A fill left on `coral` in dark would stay at 3.1:1 (cosmetic only). Translucent `${coral}26` tints were left on purpose.

## Not doing
No change to the light palette, no new dark logo.
