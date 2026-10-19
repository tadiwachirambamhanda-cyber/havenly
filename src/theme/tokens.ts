export const lightColors = {
  sand: '#FBF5EA', sandDeep: '#F2E8D8', ink: '#20261F', inkSoft: '#5B6459',
  coral: '#FF5A3C', coralSoft: '#FFE4DB', teal: '#0F8B82', tealSoft: '#DCF2EF',
  gold: '#E3A23A', white: '#FFFCF6', line: '#E7DDC9',
};

// Same keys as lightColors, values flipped — every screen keeps referencing
// colors.ink for text and colors.sand/white for surfaces unchanged, only
// what those resolve to changes. A few spots intentionally use colors.ink as
// an "always-dark" accent pill background (send buttons, selected chips) —
// those still read correctly here since the paired foreground color on top
// of them flips too (colors.sand/white), preserving the same contrast.
export const darkColors: typeof lightColors = {
  sand: '#151310', sandDeep: '#1D1A15', ink: '#F3ECDC', inkSoft: '#B7AC93',
  coral: '#FF5A3C', coralSoft: '#3D2A22', teal: '#2BBBA8', tealSoft: '#173330',
  gold: '#E3A23A', white: '#211D17', line: '#332D22',
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
  display: 'Fraunces_600SemiBold', displayItalic: 'Fraunces_500Medium_Italic',
  body: 'PlusJakartaSans_400Regular', bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold', mono: 'JetBrainsMono_500Medium',
};
// Tonal pairs: light to deep within one brand colour. Gradients never mix
// two different hues (teal into coral made a muddy middle) and stay inside
// the brand palette: no purple, blue or pink.
export const tones = {
  coral: ['#FF9478', '#E8492B'],
  teal: ['#3DB5A9', '#0B6F68'],
  gold: ['#F3C46D', '#CF8B22'],
  olive: ['#7A8577', '#2E372D'],
} as const satisfies Record<string, readonly [string, string]>;
