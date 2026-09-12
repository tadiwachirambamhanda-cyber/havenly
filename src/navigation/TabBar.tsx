import React from 'react';
import { View, Pressable, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/tokens';
import { useUnreadMessages } from '@/lib/useUnreadMessages';

const BAR_HEIGHT = 82;
const NOTCH_DEPTH = 22;
const INACTIVE_COLOR = '#B9BDB2';

// Straight-line "skyline" scallop across the top edge, matching the
// prototype's clip-path polygon — a fraction-of-width, y(px) pair per point.
// The dip at 0.5 (4px instead of 0px) is where the center create button sits.
const SCALLOP_STOPS: [number, number][] = [
  [0, NOTCH_DEPTH], [0.06, 0], [0.12, NOTCH_DEPTH], [0.2, 0], [0.28, NOTCH_DEPTH], [0.36, 0],
  [0.44, NOTCH_DEPTH], [0.5, 4], [0.56, NOTCH_DEPTH], [0.64, 0], [0.72, NOTCH_DEPTH], [0.8, 0],
  [0.88, NOTCH_DEPTH], [0.94, 0], [1, NOTCH_DEPTH],
];

function scallopPoints(width: number, height: number): string {
  const top = SCALLOP_STOPS.map(([fx, y]) => `${fx * width},${y}`).join(' ');
  return `${top} ${width},${height} 0,${height}`;
}

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  Feed: { label: 'Home', icon: 'home' },
  Discover: { label: 'Discover', icon: 'search' },
  Inbox: { label: 'Inbox', icon: 'inbox' },
  Profile: { label: 'Profile', icon: 'user' },
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const totalHeight = BAR_HEIGHT + insets.bottom;
  const hasUnread = useUnreadMessages();

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const config = TAB_CONFIG[route.name];
    if (!config) return null;
    const isFocused = state.index === index;

    return (
      <Pressable
        key={route.key}
        style={styles.tabItem}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <View>
          <Feather name={config.icon} size={22} color={isFocused ? colors.coral : INACTIVE_COLOR} />
          {route.name === 'Inbox' && hasUnread && <View style={styles.navUnreadDot} />}
        </View>
        <Text style={[styles.tabLabel, { color: isFocused ? colors.coral : INACTIVE_COLOR }]}>{config.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { height: totalHeight }]}>
      <Svg width={width} height={totalHeight} style={StyleSheet.absoluteFill}>
        <Polygon points={scallopPoints(width, totalHeight)} fill={colors.ink} />
      </Svg>
      <View style={styles.row}>
        {state.routes.slice(0, 2).map(renderTab)}
        <View style={styles.centerSpacer} />
        {state.routes.slice(2, 4).map(renderTab)}
      </View>
      <Pressable style={styles.centerBtn} onPress={() => navigation.getParent()?.navigate('CreatePost')}>
        <Feather name="plus" size={22} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 18 },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  navUnreadDot: { position: 'absolute', top: -2, right: -3, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.coral },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  centerSpacer: { width: 46 },
  centerBtn: {
    position: 'absolute', top: -15, left: '50%', marginLeft: -23,
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coral,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.coral, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
});
