import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// Off until a Sentry DSN is added to app.json (expo.extra.sentryDsn) — with
// no DSN nothing is initialised and nothing leaves the device.
const dsn: string = Constants.expoConfig?.extra?.sentryDsn ?? '';
export const crashReportingEnabled = dsn.length > 0;

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const PHONE_RE = /\+?\d[\d\s()-]{7,}\d/g;

function scrub(text: string | undefined): string | undefined {
  return text?.replace(EMAIL_RE, '[email]').replace(PHONE_RE, '[phone]');
}

export function initCrashReporting(): void {
  if (!crashReportingEnabled) return;
  Sentry.init({
    dsn,
    // Crash reports only: no session replay, no performance tracing, and no
    // IP address, cookies or request bodies (privacy policy: no trackers).
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: false,
    beforeSend(event) {
      // Errors are tied to an account id at most, never an email or name.
      if (event.user) event.user = event.user.id ? { id: event.user.id } : undefined;
      delete event.request;
      if (event.message) event.message = scrub(event.message);
      event.exception?.values?.forEach((value) => { value.value = scrub(value.value); });
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Network and console breadcrumbs can carry URLs with ids, message text
      // or phone numbers; navigation and UI breadcrumbs are enough to debug.
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr' || breadcrumb.category === 'console') return null;
      return breadcrumb;
    },
  });
}

export function setCrashReportingUser(userId: string | null): void {
  if (!crashReportingEnabled) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
