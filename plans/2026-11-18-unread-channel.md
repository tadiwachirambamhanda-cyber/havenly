# Plan: fix the render error on the Profile tab

Branch: `fix/unread-channel`.

## The bug
On a phone, opening Profile showed a render error: "cannot add `postgres_changes` callbacks for realtime:unread-notifications-badge after `subscribe()`". The unread-notification dot hook is used in two places (the tab bar and, since the Saved/social change, the Profile screen), and both opened a live channel with the same fixed name. The second one tried to add a listener to a channel that was already subscribed.

## Fix
Each use of the hook gets its own channel name (React `useId`). The other live channels (`unread-badge`, `inbox-updates`, `map-live`, per-chat) are each used once, so they are not affected.

## Checks
typecheck, lint, tests; Profile opens with no error in the browser demo; owner checks Profile on the phone.

## Not doing
Sharing one subscription across the app, or changing the other channels.

## Why it was missed
The browser demo's database stand-in does not enforce this rule, and the web tap-through ran in demo mode. Real accounts use the real client.

## Verification
typecheck, lint, 93 tests pass. Reproduced against the real database client: two channels with the same name throw exactly the phone error; two with different names do not. Not yet seen on the phone.

## Codex review
Round 1: VERDICT PASS (no findings). Also checked: the other live channels are each mounted once.
