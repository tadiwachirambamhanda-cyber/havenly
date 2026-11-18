import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';
import { useUnreadMessages } from '@/lib/useUnreadMessages';
import { useUnreadNotifications } from '@/lib/useUnreadNotifications';
import { haptics } from '@/lib/haptics';

// Every tab shows its name under the icon: icons alone (a key for Housing,
// a tray for Inbox) have to be guessed, words don't.
const TAB_CONFIG: Record<string, { icon: IconName; label: string }> = {
  Saved: { icon: 'heart', label: 'Saved' },
  Housing: { icon: 'key', label: 'Housing' },
  Inbox: { icon: 'inbox', label: 'Inbox' },
  Profile: { icon: 'user', label: 'Profile' },
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasUnread = useUnreadMessages();
  const hasUnreadNotifs = useUnreadNotifications();
  // Measured per-tab, not computed from the pill's total width divided
  // evenly — the pill has its own padding and a gap between items, so a
  // formula-based width would drift out of alignment with the real icons
  // by a few px per step. Measuring each item directly is exact regardless.
  const [itemLayouts, setItemLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  const activeLayout = itemLayouts[state.index];
  React.useEffect(() => {
    if (!activeLayout) return;
    indicatorX.value = withSpring(activeLayout.x, { damping: 18, stiffness: 220 });
    indicatorWidth.value = withSpring(activeLayout.width, { damping: 18, stiffness: 220 });
  }, [activeLayout, indicatorX, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
  }));

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const config = TAB_CONFIG[route.name];
    if (!config) return null;
    const isFocused = state.index === index;

    return (
      <AnimatedPressable
        key={route.key}
        style={styles.pillItem}
        scaleTo={0.92}
        accessibilityLabel={config.label}
        onLayout={(e) => {
          const { x, width } = e.nativeEvent.layout;
          setItemLayouts((prev) => ({ ...prev, [index]: { x, width } }));
        }}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            haptics.tap();
            navigation.navigate(route.name);
          }
        }}
      >
        {/* Inactive tabs are the pill's text colour (sand) at reduced opacity,
            so they stay readable on both the dark and the dark-mode pill. */}
        <View style={[styles.tabContent, { opacity: isFocused ? 1 : 0.65 }]}>
          <Icon name={config.icon} size={19} color={isFocused ? colors.ink : colors.sand} weight={isFocused ? 'fill' : 'bold'} />
          <Text style={[styles.tabLabel, { color: isFocused ? colors.ink : colors.sand }]} numberOfLines={1}>{config.label}</Text>
        </View>
        {((route.name === 'Inbox' && hasUnread) || (route.name === 'Profile' && hasUnreadNotifs)) && <View style={styles.unreadDot} />}
      </AnimatedPressable>
    );
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 14 }]}>
      <View style={styles.pill}>
        {activeLayout && (
          <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />
        )}
        {state.routes.map(renderTab)}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: {
    position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ink,
    borderRadius: 100, padding: 6,
    // One soft shadow, only here: the bar floats over scrolling content and
    // needs to separate from it. Nothing else in the app casts one.
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  // Slides between tabs instead of each item flipping its own background on
  // and off — the continuous motion is what reads as premium rather than a
  // plain state toggle.
  // left:0 — position comes entirely from the measured translateX/width in
  // indicatorStyle, not a fixed offset, so it lines up exactly with icons
  // regardless of the pill's own padding/gap.
  indicator: {
    // Sand, not coral: the + button is the one coral thing in the bar, so
    // it's the one that stands out (Von Restorff). Sand/ink flip together
    // with the pill in dark mode, so contrast holds both ways.
    position: 'absolute', top: 6, bottom: 6, left: 0, borderRadius: 18, backgroundColor: colors.sand,
  },
  pillItem: { flex: 1, height: 48, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  tabContent: { alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.1 },
  // colors.sand, not literal white — this dot sits on the ink-colored pill,
  // which flips to cream in dark mode, so the dot must flip the other way
  // to stay visible against it.
  unreadDot: {
    position: 'absolute', top: 4, right: '26%', width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: colors.sand, borderWidth: 1.5, borderColor: colors.coral,
  },
  fab: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coralFill, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  });
}
