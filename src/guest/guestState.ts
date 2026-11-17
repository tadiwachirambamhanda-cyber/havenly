// Guest mode is an in-memory flag, on purpose: nothing is written to the device,
// so a reload always returns to the sign-in screen and a demo can never be
// mistaken for a real session.
type Listener = () => void;

let active = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

export function isGuestMode(): boolean {
  return active;
}

export function enterGuestMode(): void {
  if (active) return;
  active = true;
  notify();
}

export function exitGuestMode(): void {
  if (!active) return;
  active = false;
  notify();
}

export function subscribeGuestMode(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// A separate signal for "the visitor tried to change something". The banner uses
// it to say so on any screen, whatever error text that screen shows itself.
const blockedListeners = new Set<Listener>();

export function notifyGuestBlocked(): void {
  blockedListeners.forEach((l) => l());
}

export function subscribeGuestBlocked(listener: Listener): () => void {
  blockedListeners.add(listener);
  return () => {
    blockedListeners.delete(listener);
  };
}
