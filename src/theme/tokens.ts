export const lightColors = {
  sand: '#FBF5EA', sandDeep: '#F2E8D8', ink: '#20261F', inkSoft: '#5B6459',
  coral: '#FF5A3C', coralSoft: '#FFE4DB', teal: '#0F8B82', tealSoft: '#DCF2EF',
  gold: '#E3A23A', white: '#FFFFFF', line: '#E7DDC9',
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
export const radius = { lg: 26, md: 16, sm: 10, pill: 100 };
export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28 };
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

// Stand-in backgrounds for posts and spots without a photo, picked by id.
export const gradients: [string, string][] = [
  [...tones.coral], [...tones.teal], [...tones.gold], [...tones.olive],
  ['#FFB8A3', '#FF8466'], ['#8FD3C9', '#2BA597'],
];
