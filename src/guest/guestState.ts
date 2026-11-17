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
