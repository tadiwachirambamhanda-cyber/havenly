import { Linking } from 'react-native';

// Opens a place in the phone's maps app (or Google Maps in a new tab on the
// web). With coordinates it drops a pin there; without them it searches the
// text, so any typed place name or address works.
export function openInMaps(place: { label?: string | null; latitude?: number | null; longitude?: number | null }) {
  const hasCoords = place.latitude != null && place.longitude != null;
  const query = hasCoords ? `${place.latitude},${place.longitude}` : (place.label ?? '').trim();
  if (!query) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  Linking.openURL(url).catch(() => {});
}
