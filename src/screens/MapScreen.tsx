import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
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

const MAPBOX_TOKEN: string = Constants.expoConfig?.extra?.mapboxToken ?? '';

// Dubai city-center fallback when location is denied/unavailable, so the
// map still opens to somewhere sensible instead of the middle of the ocean.
const DUBAI_FALLBACK: Coords = { latitude: 25.2048, longitude: 55.2708 };

// Feather's own outline icons, inlined as raw SVG so the web map (a plain
// HTML string, not RN) matches the exact same icon language the rest of the
// app already uses via @expo/vector-icons — no emoji anywhere on the map.
const ICON_GIFT = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"></polyline><rect x="2" y="7" width="20" height="5"></rect><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path></svg>';
const ICON_CALENDAR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>';
const ICON_RADIO = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>';

interface MapCheckIn extends CheckIn { user: Profile; place?: Offer | HavenlyEvent | null }

interface MapPalette {
  land: string; landuse: string; water: string; roadMinor: string; roadMajor: string;
  building: string; label: string; labelHalo: string; boundary: string; teal: string; coral: string;
}

function paletteFor(colors: ColorTokens): MapPalette {
  return {
    land: colors.sand, landuse: colors.sandDeep, water: colors.tealSoft,
    roadMinor: colors.line, roadMajor: colors.coral, building: colors.sandDeep,
    label: colors.inkSoft, labelHalo: colors.sand, boundary: colors.line,
    teal: colors.teal, coral: colors.coral,
  };
}

// Builds the whole page as one string — markers, popups and the message
// bridge back to RN are all defined here since there's nothing to reuse this
// HTML for elsewhere. Base style is one of Mapbox's own (dark-v11/light-v11,
// matching the app's current theme), then every layer is recolored to
// Havenly's own palette so it reads as a branded map, not a generic one.
function buildMapHtml(params: {
  center: Coords; offers: Offer[]; events: HavenlyEvent[]; checkIns: MapCheckIn[]; myId: string | undefined;
  mapboxToken: string; scheme: 'light' | 'dark'; colors: ColorTokens;
}): string {
  const { center, offers, events, checkIns, myId, mapboxToken, scheme, colors } = params;
  const palette = paletteFor(colors);
  // dark-v11/light-v11 are Mapbox's minimal "data backdrop" styles — barely
  // any street names, business labels, or points of interest, which read as
  // an empty map next to Google/Apple Maps. The navigation/streets styles
  // carry the full POI + road-label set instead; recolor() below still
  // retints everything to Havenly's palette on top of that richer base.
  const baseStyle = scheme === 'dark' ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/streets-v12';

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
  <link rel="stylesheet" href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" />
  <style>
    html, body, #map { height: 100%; margin: 0; background: ${palette.land}; }
    .havenly-pin {
      width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white; cursor: pointer;
    }
    .havenly-pin svg { transform: rotate(45deg); }
    .checkin-wrap { position: relative; width: 36px; height: 36px; cursor: pointer; }
    .checkin-pulse {
      position: absolute; inset: -9px; border-radius: 50%;
      background: ${palette.teal}59; animation: livePulse 2.2s ease-in-out infinite;
    }
    .checkin-pin {
      position: absolute; inset: 0; border-radius: 50%; border: 2.5px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35); background-size: cover; background-position: center;
      background-color: ${palette.coral};
    }
    .ping-burst {
      position: absolute; top: 50%; left: 50%; width: 36px; height: 36px; margin: -18px 0 0 -18px;
      border-radius: 50%; border: 2.5px solid ${palette.coral}; animation: pingBurst 0.7s ease-out forwards;
      pointer-events: none;
    }
    @keyframes pingBurst { from { transform: scale(0.5); opacity: 0.9; } to { transform: scale(2.4); opacity: 0; } }
    @keyframes livePulse { 0%, 100% { transform: scale(0.8); opacity: 0.5; } 50% { transform: scale(1.3); opacity: 0; } }
    .user-dot { position: relative; width: 16px; height: 16px; }
    .user-dot-pulse { position: absolute; inset: -10px; border-radius: 50%; background: ${palette.teal}4d; animation: livePulse 2.6s ease-in-out infinite; }
    .user-dot-core { position: absolute; inset: 0; border-radius: 50%; background: ${palette.teal}; border: 3px solid white; box-shadow: 0 0 0 3px ${palette.teal}4d; }
    .mapboxgl-popup-content { border-radius: 14px; padding: 12px 14px; font-family: -apple-system, sans-serif; }
    .popup-title { font-weight: 700; font-size: 13px; margin-bottom: 2px; color: #20261F; }
    .popup-sub { font-size: 11.5px; color: #5B6459; margin-bottom: 8px; }
    .popup-btn {
      display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; color: white;
      background: ${palette.coral}; border: none; border-radius: 100px; padding: 7px 14px; cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <script>
    mapboxgl.accessToken = '${escapeJs(mapboxToken)}';
    var map = new mapboxgl.Map({
      container: 'map', style: '${baseStyle}', center: [${center.longitude}, ${center.latitude}], zoom: 13,
      attributionControl: false, pitchWithRotate: false, dragRotate: false, touchPitch: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }

    // Recolors every layer of the stock Mapbox style to Havenly's own
    // palette instead of the default blue-grey basemap. Matched loosely by
    // layer type + id keyword (not exact ids) since Mapbox occasionally
    // renames layers between style versions — each attempt is wrapped so an
    // unsupported property on one layer never breaks the rest.
    function recolor() {
      var layers = map.getStyle().layers || [];
      layers.forEach(function (layer) {
        var id = layer.id;
        try {
          if (layer.type === 'background') {
            map.setPaintProperty(id, 'background-color', '${palette.land}');
          } else if (layer.type === 'fill' && /water/i.test(id)) {
            map.setPaintProperty(id, 'fill-color', '${palette.water}');
          } else if (layer.type === 'fill' && /building/i.test(id)) {
            map.setPaintProperty(id, 'fill-color', '${palette.building}');
            map.setPaintProperty(id, 'fill-opacity', 0.5);
          } else if (layer.type === 'fill' && /park|landuse|landcover|pitch/i.test(id)) {
            map.setPaintProperty(id, 'fill-color', '${palette.landuse}');
          } else if (layer.type === 'line' && /admin|boundary/i.test(id)) {
            map.setPaintProperty(id, 'line-color', '${palette.boundary}');
          } else if (layer.type === 'line' && /motorway|trunk|primary/i.test(id)) {
            map.setPaintProperty(id, 'line-color', '${palette.roadMajor}');
            map.setPaintProperty(id, 'line-opacity', 0.55);
          } else if (layer.type === 'line' && /road|street|secondary|tertiary|bridge|tunnel/i.test(id)) {
            map.setPaintProperty(id, 'line-color', '${palette.roadMinor}');
          } else if (layer.type === 'symbol') {
            try { map.setPaintProperty(id, 'text-color', '${palette.label}'); } catch (e2) {}
            try { map.setPaintProperty(id, 'text-halo-color', '${palette.labelHalo}'); } catch (e2) {}
          }
        } catch (e) {
          // Property not supported on this layer/style version — skip it.
        }
      });
    }

    // Marker elements are kept by check-in id so the ping button (which
    // lives inside a Mapbox popup, a separate DOM subtree) can trigger a
    // ripple burst on the marker itself when tapped.
    var checkinEls = {};
    function ripple(id) {
      var el = checkinEls[id];
      if (!el) return;
      var burst = document.createElement('div');
      burst.className = 'ping-burst';
      el.appendChild(burst);
      setTimeout(function () { burst.remove(); }, 700);
    }
    function pingClick(id) {
      ripple(id);
      post({ type: 'ping', id: id });
    }

    function addMarkers() {
      var userEl = document.createElement('div');
      userEl.className = 'user-dot';
      userEl.innerHTML = '<div class="user-dot-pulse"></div><div class="user-dot-core"></div>';
      new mapboxgl.Marker({ element: userEl, anchor: 'center' }).setLngLat([${center.longitude}, ${center.latitude}]).addTo(map);

      ${offerPins.map((p) => `
      (function () {
        var el = document.createElement('div');
        el.className = 'havenly-pin';
        el.style.background = '${palette.coral}';
        el.innerHTML = '${ICON_GIFT}';
        var popup = new mapboxgl.Popup({ offset: 26, closeButton: false }).setHTML(
          '<div class="popup-title">${escapeJs(p.title)}</div><div class="popup-sub">${escapeJs(p.sub)} · ${escapeJs(p.discount)}</div><button class="popup-btn" onclick=\\'post({type:"openOffer",id:"${p.id}"})\\'>View offer</button>'
        );
        new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([${p.lng}, ${p.lat}]).setPopup(popup).addTo(map);
      })();
      `).join('\n')}

      ${eventPins.map((p) => `
      (function () {
        var el = document.createElement('div');
        el.className = 'havenly-pin';
        el.style.background = '${palette.teal}';
        el.innerHTML = '${ICON_CALENDAR}';
        var popup = new mapboxgl.Popup({ offset: 26, closeButton: false }).setHTML(
          '<div class="popup-title">${escapeJs(p.title)}</div><div class="popup-sub">${escapeJs(p.sub)}</div><button class="popup-btn" onclick=\\'post({type:"openEvent",id:"${p.id}"})\\'>View event</button>'
        );
        new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([${p.lng}, ${p.lat}]).setPopup(popup).addTo(map);
      })();
      `).join('\n')}

      ${checkInPins.map((p) => `
      (function () {
        var el = document.createElement('div');
        el.className = 'checkin-wrap';
        el.innerHTML = '<div class="checkin-pulse"></div><div class="checkin-pin"${p.avatar ? ` style="background-image:url(${escapeJs(p.avatar)})"` : ''}></div>';
        checkinEls['${p.id}'] = el;
        var popup = new mapboxgl.Popup({ offset: 22, closeButton: false }).setHTML(
          '<div class="popup-title">${escapeJs(p.name)}${p.mine ? ' (you)' : ''}</div><div class="popup-sub">Checked in at ${escapeJs(p.placeTitle)}</div>' +
          ${p.mine ? "''" : `'<button class="popup-btn" onclick=\\'pingClick("${p.id}")\\'>${ICON_RADIO} Ping</button>'`}
        );
        new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([${p.lng}, ${p.lat}]).setPopup(popup).addTo(map);
      })();
      `).join('\n')}
    }

    map.on('load', function () {
      recolor();
      addMarkers();
    });
  </script>
</body>
</html>`;
}

// Names/titles here are user- or admin-controlled text that ends up as HTML
// inside the popup (via setHTML's string argument, not a text node) — so
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
  const { colors, scheme } = useTheme();
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
    if (!center || !MAPBOX_TOKEN) return null;
    return buildMapHtml({ center, offers, events, checkIns, myId, mapboxToken: MAPBOX_TOKEN, scheme, colors });
  }, [center, offers, events, checkIns, myId, scheme, colors]);

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
      {!MAPBOX_TOKEN ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={22} color={colors.inkSoft} />
          <Text style={styles.missingTokenText}>Map isn’t configured yet.</Text>
        </View>
      ) : !loaded || !html ? (
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
        <View style={styles.legendItem}><Feather name="gift" size={12} color={colors.coral} /><Text style={styles.legendText}>Offers</Text></View>
        <View style={styles.legendItem}><Feather name="calendar" size={12} color={colors.teal} /><Text style={styles.legendText}>Events</Text></View>
        <View style={styles.legendItem}><View style={styles.legendDot} /><Text style={styles.legendText}>Checked in</Text></View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  missingTokenText: { fontSize: 13, color: colors.inkSoft },
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
  legendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral },
  legendText: { fontSize: 10.5, fontWeight: '600', color: colors.inkSoft },
  });
}
