import * as Location from 'expo-location';

export interface Coords { latitude: number; longitude: number }

// Asks for foreground location once, only when a screen that needs "near
// me" sorting or the map actually mounts — never requested eagerly at
// launch, and never anything beyond "when in use" (no background
// tracking). Returns null on denial or failure instead of throwing, so
// every caller can fall back to "no location" (unsorted lists, a map
// centered on Dubai) rather than needing its own try/catch.
export async function getCurrentLocation(): Promise<Coords | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
}

// Haversine distance in kilometers — plenty accurate at city scale, no
// need for anything fancier.
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 0.34 -> "350 m", 2.5 -> "2.5 km", 14.2 -> "14 km".
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
