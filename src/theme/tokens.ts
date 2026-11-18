export const lightColors = {
  // Surfaces and text. The names are historical (sand is the screen ground, coral is the
  // primary accent); the values follow design/handoff/README.md (oxblood and stone).
  sand: '#F3F0EA', sandDeep: '#ECE8DF', ink: '#1F1B16', inkSoft: '#5A544B',
  coral: '#7A2433', coralSoft: '#F1E9E4',
  // coral is the accent as text, icons and outlines; coralFill is the accent as a solid fill
  // (buttons, selected chips, dots) that carries white text. Same in light; they differ in dark.
  coralFill: '#7A2433',
  white: '#FFFFFF', line: '#E2DDD2',
  // Housing redesign tokens.
  inkBody: '#3A342D', inkMuted: '#655F55',
  // Edge of a form field, chip or outline button: 3:1 or better against white.
  fieldLine: '#8B8477',
  // Student deal tag. Never share these with Verified (which is solid ink).
  dealBg: '#F5E2C6', dealText: '#7A4300',
  // Quiet tag (Bills included) and the each-person-pays panel.
  tintBg: '#E8E2D6', tintText: '#4A4036',
  // Errors always carry an icon and words, never colour alone.
  errorBg: '#FCE8E6', errorLine: '#E7B5B0', errorText: '#8E1B12',
};

// Same keys as lightColors, values flipped — every screen keeps referencing
// colors.ink for text and colors.sand/white for surfaces unchanged, only
// what those resolve to changes. A few spots intentionally use colors.ink as
// an "always-dark" accent pill background (send buttons, selected chips) —
// those still read correctly here since the paired foreground color on top
// of them flips too (colors.sand/white), preserving the same contrast.
// Dark theme: oxblood is too dark to read as text or icons on the dark ground, so the accent
// as text is a lighter rose (coral, 6.1:1) and the accent as a fill is a mid rose (coralFill,
// 3.65:1 against the ground, and 5.1:1 under white text).
export const darkColors: typeof lightColors = {
  sand: '#151310', sandDeep: '#1D1A15', ink: '#F3ECDC', inkSoft: '#B7AC93',
  coral: '#D4788A', coralSoft: '#3A2429',
  coralFill: '#BA4660',
  white: '#211D17', line: '#332D22',
  inkBody: '#E6DFCC', inkMuted: '#9C9279',
  fieldLine: '#7A715F',
  dealBg: '#3A2D18', dealText: '#F3C46D',
  tintBg: '#2A251C', tintText: '#D8CFB8',
  errorBg: '#3A1F1B', errorLine: '#6E352E', errorText: '#FFB4A8',
};

export type ColorTokens = typeof lightColors;
// Default export used by any file not yet migrated to useTheme() — kept as
// the light palette so nothing breaks mid-migration.
export const colors = lightColors;
// pill is for things you tap to toggle (filter chips, segments) and the
// floating tab bar/toast; buttons and inputs use button; read-only labels
// (status, amenities, badges) use tag, so shape alone says "tappable" or not.
// Kept tight on purpose: large soft radii on every card read as a generic
// template. lg is for sheets and the hero card, md for cards, sm for
// thumbnails and small tiles.
export const radius = { lg: 16, md: 12, sm: 8, button: 10, tag: 4, pill: 100 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };
// Small uppercase labels use bodyBold with ~0.8 letter spacing. mono is only
// for things that must be read character by character (a perk's redeem
// code), not for labels or handles.
export const fonts = {
  display: 'SchibstedGrotesk_600SemiBold', displayItalic: 'SchibstedGrotesk_500Medium_Italic',
  body: 'HankenGrotesk_400Regular', bodySemiBold: 'HankenGrotesk_600SemiBold',
  bodyBold: 'HankenGrotesk_700Bold', mono: 'JetBrainsMono_500Medium',
};
// Tonal pair: light to deep within the one brand colour (oxblood), used for gradients. They
// stay inside the brand palette: no teal, purple, blue or pink.
export const tones = {
  coral: ['#A8465A', '#5E1824'],
} as const satisfies Record<string, readonly [string, string]>;
