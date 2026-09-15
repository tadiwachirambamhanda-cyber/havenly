import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { sendPing } from '@/lib/checkIns';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { CheckIn, HavenlyEvent, Offer, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Dubai city-center fallback when location is denied/unavailable, so the
// map still opens to somewhere sensible instead of the middle of the ocean.
const DUBAI_FALLBACK: Coords = { latitude: 25.2048, longitude: 55.2708 };

interface MapCheckIn extends CheckIn { user: Profile; place?: Offer | HavenlyEvent | null }

// Builds the whole page as one string — markers, popups and the message
// bridge back to RN are all defined here since there's nothing to reuse
// this HTML for elsewhere. Positron tiles (no API key needed) keep the
// basemap quiet and neutral so the brand-colored pins are what stands out.
function buildMapHtml(params: {
  center: Coords; offers: Offer[]; events: HavenlyEvent[]; checkIns: MapCheckIn[]; myId: string | undefined;
}): string {
  const { center, offers, events, checkIns, myId } = params;
  const offerPins = offers
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({ id: o.id, lat: o.latitude, lng: o.longitude, title: o.title, sub: o.brand?.name ?? '', discount: o.discount_label }));
  const eventPins = events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({ id: e.id, lat: e.latitude, lng: e.longitude, title: e.title, sub: e.location }));
  const checkInPins = checkIns
    .filter((c) => {
      const place = c.place;
      return place && place.latitude != null && place.longitude != null;
    })
    .map((c) => ({
      id: c.id, lat: (c.place as Offer | HavenlyEvent).latitude, lng: (c.place as Offer | HavenlyEvent).longitude,
      name: c.user.display_name, avatar: c.user.avatar_url, mine: c.user_id === myId,
      placeTitle: c.place_type === 'offer' ? (c.place as Offer).title : (c.place as HavenlyEvent).title,
    }));

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: #EDEAE2; }
    .havenly-pin { border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white; }
    .havenly-pin span { transform: rotate(45deg); font-size: 15px; }
    .checkin-pin { border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35); background-size: cover; background-position: center; background-color: #FF5A3C; }
    .popup-title { font-family: -apple-system, sans-serif; font-weight: 700; font-size: 13px; margin-bottom: 2px; }
    .popup-sub { font-family: -apple-system, sans-serif; font-size: 11.5px; color: #5B6459; margin-bottom: 8px; }
    .popup-btn { font-family: -apple-system, sans-serif; font-size: 12px; font-weight: 700; color: white; background: #FF5A3C; border: none; border-radius: 100px; padding: 7px 14px; }
    .leaflet-popup-content-wrapper { border-radius: 14px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([${center.latitude}, ${center.longitude}], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 19,
    }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }

    L.marker([${center.latitude}, ${center.longitude}], {
      icon: L.divIcon({ className: '', html: '<div style="width:16px;height:16px;border-radius:50%;background:#0F8B82;border:3px solid white;box-shadow:0 0 0 3px rgba(15,139,130,0.3)"></div>', iconSize: [16, 16] }),
      zIndexOffset: -100,
    }).addTo(map);

    ${offerPins.map((p) => `
      L.marker([${p.lat}, ${p.lng}], {
        icon: L.divIcon({ className: '', iconSize: [34, 34], iconAnchor: [17, 34], html: '<div class="havenly-pin" style="width:34px;height:34px;background:#FF5A3C"><span>🎁</span></div>' }),
      }).addTo(map).bindPopup(
        '<div class="popup-title">${escapeJs(p.title)}</div><div class="popup-sub">${escapeJs(p.sub)} · ${escapeJs(p.discount)}</div><button class="popup-btn" onclick=\\'post({type:"openOffer",id:"${p.id}"})\\'>View offer</button>'
      );
    `).join('\n')}

    ${eventPins.map((p) => `
      L.marker([${p.lat}, ${p.lng}], {
        icon: L.divIcon({ className: 'havenly-pin', iconSize: [34, 34], iconAnchor: [17, 34], html: '<div class="havenly-pin" style="width:34px;height:34px;background:#0F8B82"><span>📅</span></div>' }),
      }).addTo(map).bindPopup(
        '<div class="popup-title">${escapeJs(p.title)}</div><div class="popup-sub">${escapeJs(p.sub)}</div><button class="popup-btn" onclick=\\'post({type:"openEvent",id:"${p.id}"})\\'>View event</button>'
      );
    `).join('\n')}

    ${checkInPins.map((p) => `
      L.marker([${p.lat}, ${p.lng}], {
        icon: L.divIcon({
          className: '', iconSize: [36, 36], iconAnchor: [18, 18],
          html: '<div class="checkin-pin" style="width:36px;height:36px;${p.avatar ? `background-image:url(${escapeJs(p.avatar)})` : ''}"></div>',
        }),
      }).addTo(map).bindPopup(
        '<div class="popup-title">${escapeJs(p.name)}${p.mine ? ' (you)' : ''}</div><div class="popup-sub">Checked in at ${escapeJs(p.placeTitle)}</div>' +
        ${p.mine ? "''" : `'<button class="popup-btn" onclick=\\'post({type:"ping",id:"${p.id}"})\\'>Ping 👋</button>'`}
      );
    `).join('\n')}
  </script>
</body>
</html>`;
}

// Names/titles here are user- or admin-controlled text that ends up as HTML
// inside the popup (via bindPopup's string argument, not a text node) — so
// this has to neutralize markup (a display_name of "<img onerror=...>"
// would otherwise execute in the WebView), not just make the value safe to
// sit inside the JS template literal it's embedded in.
function escapeHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(s: string): string {
  return escapeHtml(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

export default function MapScreen() {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const webviewRef = useRef<WebView>(null);

  const [center, setCenter] = useState<Coords | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [events, setEvents] = useState<HavenlyEvent[]>([]);
  const [checkIns, setCheckIns] = useState<MapCheckIn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const load = useCallback(async () => {
    const loc = await getCurrentLocation();
    setLocationDenied(!loc);
    setCenter(loc ?? DUBAI_FALLBACK);

    const [{ data: offerData }, { data: eventData }, { data: checkInData }] = await Promise.all([
      supabase.from('offers').select('*, brand:brands(*)').eq('is_active', true).not('latitude', 'is', null),
      supabase.from('events').select('*').not('latitude', 'is', null).gt('event_date', new Date().toISOString()),
      supabase.from('check_ins').select('*, user:profiles(*)').gt('expires_at', new Date().toISOString()),
    ]);

    const offerList = (offerData as unknown as Offer[]) ?? [];
    const eventList = (eventData as HavenlyEvent[]) ?? [];
    const offerById = new Map(offerList.map((o) => [o.id, o]));
    const eventById = new Map(eventList.map((e) => [e.id, e]));

    const checkInList = ((checkInData as unknown as CheckIn[]) ?? []).map((c): MapCheckIn => ({
      ...(c as CheckIn & { user: Profile }),
      place: c.place_type === 'offer' ? offerById.get(c.place_id) ?? null : eventById.get(c.place_id) ?? null,
    }));

    setOffers(offerList);
    setEvents(eventList);
    setCheckIns(checkInList);
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handlePing = async (checkInId: string) => {
    haptics.tap();
    try {
      await sendPing(checkInId);
      haptics.success();
      showToast('Ping sent 👋');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t send ping.', 'error');
    }
  };

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'openOffer') navigation.navigate('OfferDetail', { offerId: msg.id });
      else if (msg.type === 'openEvent') showToast('Open Discover to see this event.');
      else if (msg.type === 'ping') handlePing(msg.id);
    } catch {
      // Ignore malformed messages from the page.
    }
  };

  const html = useMemo(() => {
    if (!center) return null;
    return buildMapHtml({ center, offers, events, checkIns, myId });
  }, [center, offers, events, checkIns, myId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Map</Text>
      </View>
      {locationDenied && loaded && (
        <View style={styles.locationNotice}>
          <Feather name="map-pin" size={12} color={colors.inkSoft} />
          <Text style={styles.locationNoticeText}>Location off — showing Dubai. Enable it for pins near you.</Text>
        </View>
      )}
      {!loaded || !html ? (
        <View style={styles.centered}><ActivityIndicator color={colors.coral} /></View>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ html }}
          style={{ flex: 1 }}
          onMessage={onMessage}
          originWhitelist={['*']}
        />
      )}
      <View style={styles.legend}>
        <View style={styles.legendItem}><Text style={styles.legendEmoji}>🎁</Text><Text style={styles.legendText}>Offers</Text></View>
        <View style={styles.legendItem}><Text style={styles.legendEmoji}>📅</Text><Text style={styles.legendText}>Events</Text></View>
        <View style={styles.legendItem}><View style={styles.legendDot} /><Text style={styles.legendText}>Checked in</Text></View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 54, paddingBottom: 12,
    paddingHorizontal: spacing.lg, backgroundColor: colors.sand, zIndex: 1,
  },
  back: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 19, color: colors.ink },
  locationNotice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, paddingBottom: 10,
    backgroundColor: colors.sand,
  },
  locationNoticeText: { flex: 1, fontSize: 11.5, color: colors.inkSoft },
  legend: {
    position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', gap: 14, backgroundColor: colors.white,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.line,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendEmoji: { fontSize: 12 },
  legendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral },
  legendText: { fontSize: 10.5, fontWeight: '600', color: colors.inkSoft },
  });
}
