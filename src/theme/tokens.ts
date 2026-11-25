export const lightColors = {
  // Surfaces and text. The names are historical (sand is the screen ground, coral is the
  // primary accent); the values follow design/handoff/README.md (v2: berry, mint and sun).
  sand: '#FBF7F2', sandDeep: '#F3EAE3', ink: '#1C1418', inkSoft: '#6A5E62',
  coral: '#C8234F', coralSoft: '#FCE4EA',
  // coral is the accent as text, icons and outlines; coralFill is the accent as a solid fill
  // (buttons, selected chips, dots) that carries white text. Same in light; they differ in dark.
  coralFill: '#C8234F',
  white: '#FFFFFF', line: '#EDE3DC',
  inkBody: '#33282D', inkMuted: '#6A5E62',
  // Edge of a form field, chip or outline button: 3:1 or better against white.
  fieldLine: '#8E8085',
  // Sun: student deals and perks, and only those. Never share these with Verified.
  dealBg: '#FFE08A', dealText: '#6B4000',
  // Quiet tag (kind of place) and review chips.
  tintBg: '#F2E9E2', tintText: '#4A3D42',
  // Mint: community moments (liked, Going, joined) and the friendly parts of housing (bills
  // included, the rent split). mintFill carries mintOn text.
  mintBg: '#D6F5E8', mintText: '#0B6B4C', mintFill: '#0B6B4C', mintOn: '#FFFFFF',
  // An empty photo box.
  photo: '#EFE3DB',
  // "Verified by Havenly": always ink, never berry, mint or sun, so trust never looks like a promotion.
  verifiedBg: '#1C1418', verifiedText: '#FFFFFF',
  // The floating tab bar and its inactive items; the active item is coralFill with white.
  tabBg: '#1C1418', tabInk: '#CDBFC4',
  // Errors always carry an icon and words, never colour alone.
  errorBg: '#FCE8E6', errorLine: '#E7B5B0', errorText: '#8E1B12',
};

// Same keys as lightColors, values flipped: screens keep referencing colors.ink for text and
// colors.sand/white for surfaces, only what those resolve to changes. Dark: berry as text is a
// lighter pink (coral, 6.9:1 on the ground) and as a fill a deeper berry (coralFill, 4.7:1 under
// white text).
export const darkColors: typeof lightColors = {
  sand: '#141012', sandDeep: '#1C1619', ink: '#F6EEF0', inkSoft: '#B9AAAF',
  coral: '#FF6B8E', coralSoft: '#3D1D27',
  coralFill: '#D92B5A',
  white: '#1F191C', line: '#33292D',
  inkBody: '#E9DDE1', inkMuted: '#A99BA0',
  fieldLine: '#6E5F64',
  dealBg: '#3D3010', dealText: '#FFD45C',
  tintBg: '#2B2226', tintText: '#DCCDD2',
  mintBg: '#123A2D', mintText: '#7DECC3', mintFill: '#5FE0B1', mintOn: '#0B2A20',
  photo: '#2B2226',
  verifiedBg: '#F6EEF0', verifiedText: '#141012',
  tabBg: '#F6EEF0', tabInk: '#3A3034',
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
// Tonal pair: light to deep within the one brand colour (berry), used for gradients. They
// stay inside the brand palette.
export const tones = {
  coral: ['#E0476F', '#8E1538'],
} as const satisfies Record<string, readonly [string, string]>;
