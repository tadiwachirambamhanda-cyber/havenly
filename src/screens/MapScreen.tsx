import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, Keyboard } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
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
import { getCurrentLocation, requestLocationAccess, openLocationSettings, type Coords } from '@/lib/location';
import { sendPing } from '@/lib/checkIns';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import { toggleInterest } from '@/lib/interests';
import type { CheckIn, HavenlyEvent, Offer, PlaceInterest, Profile } from '@/types';
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
const ICON_THUMB = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>';

interface MapCheckIn extends CheckIn { user: Profile; place?: Offer | HavenlyEvent | null }

interface SearchResult {
  key: string; // 'offer:<id>' / 'event:<id>' / 'checkin:<id>' — matches the WebView's marker registry
  type: 'offer' | 'event' | 'person';
  title: string;
  subtitle: string;
}

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
  center: Coords; offers: Offer[]; events: HavenlyEvent[]; checkIns: MapCheckIn[]; interests: PlaceInterest[]; myId: string | undefined;
  mapboxToken: string; colors: ColorTokens;
}): string {
  const { center, offers, events, checkIns, interests, myId, mapboxToken, colors } = params;
  const palette = paletteFor(colors);
  // Every Mapbox dark preset (dark-v11, navigation-night-v1) is a stripped
  // "driving at night" style with far fewer building/POI labels than
  // streets-v12 — that's what was making dark mode show noticeably less
  // than light mode. streets-v12 carries the full label set either way;
  // recolor() below is what actually makes it look dark, by retinting
  // every layer to Havenly's palette, so both themes get identical data.
  const baseStyle = 'mapbox://styles/mapbox/streets-v12';

  const interestCountByKey = new Map<string, number>();
  const myInterestKeys = new Set<string>();
  for (const i of interests) {
    const key = `${i.place_type}:${i.place_id}`;
    interestCountByKey.set(key, (interestCountByKey.get(key) ?? 0) + 1);
    if (i.user_id === myId) myInterestKeys.add(key);
  }

  const offerPins = offers
    .filter((o) => o.latitude != null && o.longitude != null)
    .map((o) => ({
      id: o.id, lat: o.latitude, lng: o.longitude, title: o.title, sub: o.brand?.name ?? '', discount: o.discount_label,
      interestCount: interestCountByKey.get(`offer:${o.id}`) ?? 0, mine: myInterestKeys.has(`offer:${o.id}`),
    }));
  const eventPins = events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => ({
      id: e.id, lat: e.latitude, lng: e.longitude, title: e.title, sub: e.location,
      interestCount: interestCountByKey.get(`event:${e.id}`) ?? 0, mine: myInterestKeys.has(`event:${e.id}`),
    }));
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
    .cluster-pin {
      width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.35); cursor: pointer;
      font-family: -apple-system, sans-serif; font-weight: 800; color: white; font-size: 14px;
    }
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
    .popup-row { display: flex; gap: 6px; align-items: center; }
    .interest-btn {
      display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: #20261F;
      background: #EDEAE2; border: 1.5px solid #E7DDC9; border-radius: 100px; padding: 6px 12px; cursor: pointer;
    }
    .interest-btn-active { color: #B8791E; background: #FBEBCF; border-color: #E3A23A; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"></script>
  <script>
    mapboxgl.accessToken = '${escapeJs(mapboxToken)}';
    var map = new mapboxgl.Map({
      container: 'map', style: '${baseStyle}', center: [${center.longitude}, ${center.latitude}], zoom: 16.5,
      attributionControl: false, pitchWithRotate: false, dragRotate: false, touchPitch: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }));
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

    function post(msg) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    }

    // Names/titles here are user- or admin-controlled text landing in a
    // popup's innerHTML (via setHTML), not a text node — has to neutralize
    // markup (a display_name of "<img onerror=...>" would otherwise
    // execute in the WebView), not just be embeddable in a JS string.
    function escapeHtml(s) {
      return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    var offerData = ${embedJson(offerPins)};
    var eventData = ${embedJson(eventPins)};
    var checkInData = ${embedJson(checkInPins)};

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
            map.setPaintProperty(id, 'line-opacity', 0.3);
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

    // Offer/event popups render from a rebuild function (captured over the
    // pin's title/sub/discount) rather than a fixed HTML string, so
    // toggling "down to go" can patch just that popup's content in place —
    // reloading the whole map for one count would reset the user's pan/zoom.
    var popupBuilders = {};
    var popupsById = {};
    // Every point's data stays here by key regardless of whether it's
    // currently rendered as its own marker or folded into a cluster —
    // search's flyTo needs a target location even when clustered, and a
    // toggled interest count has to survive a re-cluster/de-cluster cycle.
    var pointDataById = {};
    offerData.forEach(function (p) { pointDataById['offer:' + p.id] = p; });
    eventData.forEach(function (p) { pointDataById['event:' + p.id] = p; });
    checkInData.forEach(function (p) { pointDataById['checkin:' + p.id] = p; });

    window.setInterest = function (key, count, mine) {
      var popup = popupsById[key];
      var build = popupBuilders[key];
      if (popup && build) popup.setHTML(build(count, mine));
      var data = pointDataById[key];
      if (data) { data.interestCount = count; data.mine = mine; }
    };
    function toggleInterestClick(type, id) {
      post({ type: 'toggleInterest', placeType: type, id: id });
    }

    function offerPopupHtml(p, count, mine) {
      return '<div class="popup-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="popup-sub">' + escapeHtml(p.sub) + ' · ' + escapeHtml(p.discount) + '</div>' +
        '<div class="popup-row"><button class="popup-btn" onclick=\\'post({type:"openOffer",id:"' + p.id + '"})\\'>View offer</button>' +
        '<button class="interest-btn' + (mine ? ' interest-btn-active' : '') + '" onclick=\\'toggleInterestClick("offer","' + p.id + '")\\'>${ICON_THUMB} ' +
        (mine ? 'I\\'m in' : 'I\\'m down') + ' · ' + count + '</button></div>';
    }
    function eventPopupHtml(p, count, mine) {
      return '<div class="popup-title">' + escapeHtml(p.title) + '</div>' +
        '<div class="popup-sub">' + escapeHtml(p.sub) + '</div>' +
        '<div class="popup-row"><button class="popup-btn" onclick=\\'post({type:"openEvent",id:"' + p.id + '"})\\'>View event</button>' +
        '<button class="interest-btn' + (mine ? ' interest-btn-active' : '') + '" onclick=\\'toggleInterestClick("event","' + p.id + '")\\'>${ICON_THUMB} ' +
        (mine ? 'I\\'m in' : 'I\\'m down') + ' · ' + count + '</button></div>';
    }

    // Every individually-rendered marker is registered here under a
    // 'offer:<id>' / 'event:<id>' / 'checkin:<id>' key so RN's search bar
    // can jump the map to a result via injectJavaScript. A clustered point
    // has no entry until it's zoomed in enough to stand on its own.
    var markersById = {};
    window.flyTo = function (key) {
      var data = pointDataById[key];
      if (!data) return;
      var targetZoom = Math.max(map.getZoom(), 17);
      map.flyTo({ center: [data.lng, data.lat], zoom: targetZoom, essential: true });
      function tryOpenPopup(attemptsLeft) {
        var m = markersById[key];
        if (m) {
          var popup = m.getPopup();
          if (popup && !popup.isOpen()) m.togglePopup();
        } else if (attemptsLeft > 0) {
          setTimeout(function () { tryOpenPopup(attemptsLeft - 1); }, 150);
        }
      }
      map.once('moveend', function () { tryOpenPopup(8); });
    };

    // Legend taps toggle a whole pin category. typeVisible drives every
    // (re)render below rather than just adding/removing existing markers,
    // since which markers exist can itself change on zoom (clustering).
    var typeVisible = { offer: true, event: true, checkin: true };
    window.setTypeVisible = function (type, visible) {
      typeVisible[type] = visible;
      if (type === 'offer') renderOfferMarkers();
      else if (type === 'event') renderEventMarkers();
      else if (type === 'checkin') {
        Object.keys(markersById).forEach(function (key) {
          if (key.indexOf('checkin:') !== 0) return;
          var m = markersById[key];
          if (visible) m.addTo(map); else m.remove();
        });
      }
    };

    // Greedy screen-space clustering: two points land in the same cluster
    // once they're within pixelRadius of each other at the CURRENT zoom —
    // not a spatial index, but points/events realistically number in the
    // dozens here, so an O(n^2) pass is negligible.
    function clusterPoints(points, pixelRadius) {
      var proj = points.map(function (p) {
        var pt = map.project([p.lng, p.lat]);
        return { p: p, x: pt.x, y: pt.y };
      });
      var used = new Array(proj.length).fill(false);
      var clusters = [];
      for (var i = 0; i < proj.length; i++) {
        if (used[i]) continue;
        var group = [proj[i]];
        used[i] = true;
        for (var j = i + 1; j < proj.length; j++) {
          if (used[j]) continue;
          var dx = proj[i].x - proj[j].x, dy = proj[i].y - proj[j].y;
          if (Math.sqrt(dx * dx + dy * dy) < pixelRadius) { group.push(proj[j]); used[j] = true; }
        }
        var lng = 0, lat = 0;
        group.forEach(function (g) { lng += g.p.lng; lat += g.p.lat; });
        clusters.push({ lng: lng / group.length, lat: lat / group.length, points: group.map(function (g) { return g.p; }) });
      }
      return clusters;
    }

    var renderedOffer = [];
    var renderedEvent = [];

    function renderTypeMarkers(list, opts) {
      list.forEach(function (m) { m.remove(); });
      list.length = 0;
      if (!typeVisible[opts.type]) return;
      var clusters = clusterPoints(opts.data, 50);
      clusters.forEach(function (cluster) {
        if (cluster.points.length === 1) {
          var p = cluster.points[0];
          var el = document.createElement('div');
          el.className = 'havenly-pin';
          el.style.background = opts.color;
          el.innerHTML = opts.icon;
          var key = opts.type + ':' + p.id;
          var build = function (count, mine) { return opts.popupHtml(p, count, mine); };
          popupBuilders[key] = build;
          var popup = new mapboxgl.Popup({ offset: 26, closeButton: false }).setHTML(build(p.interestCount, p.mine));
          popupsById[key] = popup;
          var marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
          markersById[key] = marker;
          list.push(marker);
        } else {
          var cEl = document.createElement('div');
          cEl.className = 'cluster-pin';
          cEl.style.background = opts.color;
          cEl.textContent = String(cluster.points.length);
          cEl.addEventListener('click', function () {
            map.flyTo({ center: [cluster.lng, cluster.lat], zoom: Math.min(map.getZoom() + 3, 19), essential: true });
          });
          var clusterMarker = new mapboxgl.Marker({ element: cEl, anchor: 'center' }).setLngLat([cluster.lng, cluster.lat]).addTo(map);
          list.push(clusterMarker);
        }
      });
    }

    function renderOfferMarkers() {
      renderTypeMarkers(renderedOffer, { type: 'offer', data: offerData, color: '${palette.coral}', icon: '${ICON_GIFT}', popupHtml: offerPopupHtml });
    }
    function renderEventMarkers() {
      renderTypeMarkers(renderedEvent, { type: 'event', data: eventData, color: '${palette.teal}', icon: '${ICON_CALENDAR}', popupHtml: eventPopupHtml });
    }

    function addCheckinMarkers() {
      checkInData.forEach(function (p) {
        var el = document.createElement('div');
        el.className = 'checkin-wrap';
        el.innerHTML = '<div class="checkin-pulse"></div><div class="checkin-pin"' +
          (p.avatar ? ' style="background-image:url(' + escapeHtml(p.avatar) + ')"' : '') + '></div>';
        checkinEls[p.id] = el;
        var popup = new mapboxgl.Popup({ offset: 22, closeButton: false }).setHTML(
          '<div class="popup-title">' + escapeHtml(p.name) + (p.mine ? ' (you)' : '') + '</div>' +
          '<div class="popup-sub">Checked in at ' + escapeHtml(p.placeTitle) + '</div>' +
          (p.mine ? '' : '<button class="popup-btn" onclick=\\'pingClick("' + p.id + '")\\'>${ICON_RADIO} Ping</button>')
        );
        var marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lng, p.lat]).setPopup(popup).addTo(map);
        markersById['checkin:' + p.id] = marker;
      });
    }

    function addMarkers() {
      var userEl = document.createElement('div');
      userEl.className = 'user-dot';
      userEl.innerHTML = '<div class="user-dot-pulse"></div><div class="user-dot-core"></div>';
      new mapboxgl.Marker({ element: userEl, anchor: 'center' }).setLngLat([${center.longitude}, ${center.latitude}]).addTo(map);

      renderOfferMarkers();
      renderEventMarkers();
      addCheckinMarkers();
    }

    map.on('load', function () {
      recolor();
      addMarkers();
    });
    // Screen-space clustering is zoom-dependent, not pan-dependent, so only
    // re-cluster when the zoom level actually changes.
    map.on('zoomend', function () {
      renderOfferMarkers();
      renderEventMarkers();
    });
  </script>
</body>
</html>`;
}

// Only used for the mapbox token now (a fixed string, not user data) — the
// actual user/admin-controlled text (titles, names) is escaped at runtime
// inside the WebView's own escapeHtml() instead, since popups are now built
// there from plain JSON data rather than generated per-pin as JS source.
function escapeHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeJs(s: string): string {
  return escapeHtml(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

// Embeds a value as JSON inside a <script> block safely — a naive
// JSON.stringify could contain the literal sequence "</script", which would
// prematurely close the tag when the browser parses the HTML (this can
// happen with ordinary user data, e.g. a display_name or title containing
// that text) — escaping every "<" to < neutralizes that regardless of
// what the value contains.
function embedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
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
  const [interests, setInterests] = useState<PlaceInterest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenTypes, setHiddenTypes] = useState<{ offer: boolean; event: boolean; checkin: boolean }>({
    offer: false, event: false, checkin: false,
  });

  const load = useCallback(async () => {
    const loc = await getCurrentLocation();
    setLocationDenied(!loc);
    setCenter(loc ?? DUBAI_FALLBACK);

    const [{ data: offerData }, { data: eventData }, { data: checkInData }, { data: interestData }] = await Promise.all([
      supabase.from('offers').select('*, brand:brands(*)').eq('is_active', true).not('latitude', 'is', null),
      supabase.from('events').select('*').not('latitude', 'is', null).gt('event_date', new Date().toISOString()),
      supabase.from('check_ins').select('*, user:profiles(*)').gt('expires_at', new Date().toISOString()),
      supabase.from('interests').select('*'),
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
    setInterests((interestData as unknown as PlaceInterest[]) ?? []);
    setLoaded(true);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleEnableLocation = async () => {
    haptics.tap();
    const result = await requestLocationAccess();
    if (result === 'granted') {
      haptics.success();
      await load();
    } else if (result === 'blocked') {
      openLocationSettings();
    }
  };

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

  // Patches the popup in place via window.setInterest rather than reloading
  // the map — reloading (a whole new WebView source={{html}}) would reset
  // the user's current pan/zoom just to update one count.
  const handleToggleInterest = async (placeType: 'offer' | 'event', placeId: string) => {
    if (!myId) return;
    haptics.tap();
    try {
      const nowMine = await toggleInterest(placeType, placeId);
      const filtered = interests.filter((i) => !(i.user_id === myId && i.place_type === placeType && i.place_id === placeId));
      const nextInterests = nowMine
        ? [...filtered, { id: `local-${placeType}-${placeId}`, user_id: myId, place_type: placeType, place_id: placeId, created_at: new Date().toISOString() }]
        : filtered;
      setInterests(nextInterests);
      const count = nextInterests.filter((i) => i.place_type === placeType && i.place_id === placeId).length;
      const key = `${placeType}:${placeId}`;
      if (typeof webviewRef.current?.injectJavaScript === 'function') {
        webviewRef.current.injectJavaScript(`window.setInterest && window.setInterest(${JSON.stringify(key)}, ${count}, ${nowMine}); true;`);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t update — try again.', 'error');
    }
  };

  // All client-side — offers/events/check-ins are already loaded for the
  // map itself, and check-ins are already filtered server-side by
  // can_see_checkin() (mutual follows + shared groups/communities), so
  // searching this list can never surface a person the user isn't already
  // allowed to see on the map.
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchResult[] = [];
    for (const o of offers) {
      if (o.latitude == null || o.longitude == null) continue;
      const hay = `${o.title} ${o.brand?.name ?? ''} ${o.discount_label}`.toLowerCase();
      if (hay.includes(q)) results.push({ key: `offer:${o.id}`, type: 'offer', title: o.title, subtitle: o.brand?.name ?? 'Offer' });
    }
    for (const e of events) {
      if (e.latitude == null || e.longitude == null) continue;
      const hay = `${e.title} ${e.location} ${e.tag}`.toLowerCase();
      if (hay.includes(q)) results.push({ key: `event:${e.id}`, type: 'event', title: e.title, subtitle: e.location });
    }
    for (const c of checkIns) {
      const place = c.place;
      if (!place || place.latitude == null || place.longitude == null) continue;
      const hay = `${c.user.display_name} ${c.user.username}`.toLowerCase();
      if (hay.includes(q)) {
        const placeTitle = c.place_type === 'offer' ? (place as Offer).title : (place as HavenlyEvent).title;
        results.push({ key: `checkin:${c.id}`, type: 'person', title: c.user.display_name, subtitle: `Nearby at ${placeTitle}` });
      }
    }
    return results.slice(0, 8);
  }, [offers, events, checkIns, searchQuery]);

  const filterTypeFor = (t: 'offer' | 'event' | 'person'): 'offer' | 'event' | 'checkin' => (t === 'person' ? 'checkin' : t);

  const toggleTypeFilter = (type: 'offer' | 'event' | 'checkin') => {
    haptics.tap();
    const nextHidden = !hiddenTypes[type];
    setHiddenTypes((prev) => ({ ...prev, [type]: nextHidden }));
    if (typeof webviewRef.current?.injectJavaScript === 'function') {
      webviewRef.current.injectJavaScript(`window.setTypeVisible && window.setTypeVisible(${JSON.stringify(type)}, ${!nextHidden}); true;`);
    }
  };

  const handleSelectResult = (result: SearchResult) => {
    haptics.tap();
    Keyboard.dismiss();
    setSearchQuery('');
    // A hidden category's markers are removed from the map, so flying to
    // one would land on nothing — make sure this result's type is visible
    // first rather than leaving a confusing dead tap.
    const filterType = filterTypeFor(result.type);
    if (hiddenTypes[filterType]) {
      setHiddenTypes((prev) => ({ ...prev, [filterType]: false }));
      if (typeof webviewRef.current?.injectJavaScript === 'function') {
        webviewRef.current.injectJavaScript(`window.setTypeVisible && window.setTypeVisible(${JSON.stringify(filterType)}, true); true;`);
      }
    }
    if (typeof webviewRef.current?.injectJavaScript === 'function') {
      webviewRef.current.injectJavaScript(`window.flyTo && window.flyTo(${JSON.stringify(result.key)}); true;`);
    }
  };

  const onMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'openOffer') navigation.navigate('OfferDetail', { offerId: msg.id });
      else if (msg.type === 'openEvent') navigation.navigate('EventDetail', { eventId: msg.id });
      else if (msg.type === 'ping') handlePing(msg.id);
      else if (msg.type === 'toggleInterest') handleToggleInterest(msg.placeType, msg.id);
    } catch {
      // Ignore malformed messages from the page.
    }
  };

  // Deliberately NOT depending on `interests` here — after the map first
  // loads, toggling "down to go" patches the open popup directly via
  // window.setInterest() (see handleToggleInterest) instead of rebuilding
  // this whole HTML string, which would remount the WebView and reset
  // whatever the user had panned/zoomed to just to update one count.
  const html = useMemo(() => {
    if (!center || !MAPBOX_TOKEN) return null;
    return buildMapHtml({ center, offers, events, checkIns, interests, myId, mapboxToken: MAPBOX_TOKEN, colors });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center, offers, events, checkIns, myId, colors]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AnimatedPressable style={styles.back} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
          <Feather name="arrow-left" size={17} color={colors.ink} />
        </AnimatedPressable>
        <Text style={styles.title}>Map</Text>
      </View>
      {locationDenied && loaded && (
        <View style={styles.locationNotice}>
          <Feather name="map-pin" size={12} color={colors.inkSoft} />
          <Text style={styles.locationNoticeText}>Location off — showing Dubai.</Text>
          <AnimatedPressable style={styles.locationEnableBtn} onPress={handleEnableLocation} accessibilityLabel="Enable location">
            <Text style={styles.locationEnableBtnText}>Enable</Text>
          </AnimatedPressable>
        </View>
      )}
      <View style={styles.searchBar}>
        <Feather name="search" size={15} color={colors.inkSoft} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events, offers, friends nearby…"
          placeholderTextColor={colors.inkSoft}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <AnimatedPressable onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
            <Feather name="x" size={15} color={colors.inkSoft} />
          </AnimatedPressable>
        )}
      </View>
      {searchQuery.trim().length > 0 && (
        <View style={styles.searchResults}>
          {searchResults.length === 0 ? (
            <Text style={styles.searchEmptyText}>No matches nearby.</Text>
          ) : (
            searchResults.map((r, i) => (
              <AnimatedPressable key={r.key} style={[styles.searchResultRow, i === 0 && { borderTopWidth: 0 }]} onPress={() => handleSelectResult(r)}>
                <View
                  style={[
                    styles.searchResultIcon,
                    { backgroundColor: r.type === 'offer' ? colors.coralSoft : r.type === 'event' ? colors.tealSoft : colors.sandDeep },
                  ]}
                >
                  <Feather
                    name={r.type === 'offer' ? 'gift' : r.type === 'event' ? 'calendar' : 'user'}
                    size={13}
                    color={r.type === 'offer' ? colors.coral : r.type === 'event' ? colors.teal : colors.inkSoft}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.searchResultSubtitle} numberOfLines={1}>{r.subtitle}</Text>
                </View>
              </AnimatedPressable>
            ))
          )}
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
        <AnimatedPressable
          style={[styles.legendItem, hiddenTypes.offer && styles.legendItemOff]}
          onPress={() => toggleTypeFilter('offer')}
          accessibilityLabel={hiddenTypes.offer ? 'Show offers' : 'Hide offers'}
        >
          <Feather name="gift" size={12} color={hiddenTypes.offer ? colors.inkSoft : colors.coral} />
          <Text style={[styles.legendText, hiddenTypes.offer && styles.legendTextOff]}>Offers</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.legendItem, hiddenTypes.event && styles.legendItemOff]}
          onPress={() => toggleTypeFilter('event')}
          accessibilityLabel={hiddenTypes.event ? 'Show events' : 'Hide events'}
        >
          <Feather name="calendar" size={12} color={hiddenTypes.event ? colors.inkSoft : colors.teal} />
          <Text style={[styles.legendText, hiddenTypes.event && styles.legendTextOff]}>Events</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={[styles.legendItem, hiddenTypes.checkin && styles.legendItemOff]}
          onPress={() => toggleTypeFilter('checkin')}
          accessibilityLabel={hiddenTypes.checkin ? 'Show checked in' : 'Hide checked in'}
        >
          <View style={[styles.legendDot, hiddenTypes.checkin && { backgroundColor: colors.inkSoft }]} />
          <Text style={[styles.legendText, hiddenTypes.checkin && styles.legendTextOff]}>Checked in</Text>
        </AnimatedPressable>
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
  locationEnableBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.tealSoft },
  locationEnableBtnText: { fontSize: 11, fontWeight: '700', color: colors.teal },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: spacing.lg, marginBottom: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.white,
    borderWidth: 1, borderColor: colors.line,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.ink, padding: 0 },
  searchResults: {
    marginHorizontal: spacing.lg, marginBottom: 10, backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.line, overflow: 'hidden',
  },
  searchEmptyText: { fontSize: 12.5, color: colors.inkSoft, padding: 14, textAlign: 'center' },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  searchResultIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  searchResultTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  searchResultSubtitle: { fontSize: 11, color: colors.inkSoft, marginTop: 1 },
  legend: {
    position: 'absolute', bottom: 16, left: 16, flexDirection: 'row', gap: 14, backgroundColor: colors.white,
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.line,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendItemOff: { opacity: 0.45 },
  legendDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.coral },
  legendText: { fontSize: 10.5, fontWeight: '600', color: colors.inkSoft },
  legendTextOff: { textDecorationLine: 'line-through' },
  });
}
