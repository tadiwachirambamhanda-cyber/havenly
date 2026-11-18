// Switches the Chief Architect owns. A lane never edits this file; it asks.

// When true, a signed-out visitor lands on the real Housing screen and can open a
// listing and the rent split without an account (docs/prd.md requirement 2, F6). The
// sign-in prompt appears only when they save, enquire or compare. Turned on
// on 2026-11-18, after Lane A made HousingScreen and ResidenceDetailScreen safe for a
// signed-out visitor.
// While false, a signed-out visitor sees the login screen as before.
export const PUBLIC_BROWSING = true;
