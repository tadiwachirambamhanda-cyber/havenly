import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon, { type IconName } from '@/components/Icon';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { TAB_SLIDE } from '@/theme/motion';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';
import { useUnreadMessages } from '@/lib/useUnreadMessages';
import { useUnreadNotifications } from '@/lib/useUnreadNotifications';
import { haptics } from '@/lib/haptics';

// Every tab shows its name under the icon: icons alone (a key for Housing,
// a tray for Inbox) have to be guessed, words don't.
const TAB_CONFIG: Record<string, { icon: IconName; label: string }> = {
  Housing: { icon: 'home', label: 'Housing' },
  Community: { icon: 'users', label: 'Community' },
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
  // The first time the active tab is measured the highlight is placed there at once (otherwise it would slide in
  // from the left edge when the app opens); after that every change slides.
  const placed = useRef(false);
  React.useEffect(() => {
    if (!activeLayout) return;
    if (!placed.current) {
      placed.current = true;
      indicatorX.value = activeLayout.x;
      indicatorWidth.value = activeLayout.width;
      return;
    }
    indicatorX.value = withTiming(activeLayout.x, TAB_SLIDE);
    indicatorWidth.value = withTiming(activeLayout.width, TAB_SLIDE);
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
        {/* v2: the active tab is berry with white; inactive tabs use tabInk on the tabBg pill. */}
        <View style={styles.tabContent}>
          <Icon name={config.icon} size={19} color={isFocused ? '#FFFFFF' : colors.tabInk} weight={isFocused ? 'fill' : 'bold'} />
          <Text style={[styles.tabLabel, { color: isFocused ? '#FFFFFF' : colors.tabInk }]} numberOfLines={1}>{config.label}</Text>
        </View>
        {/* Messages now open from Community, so their dot shows there; notifications show on Profile. */}
        {((route.name === 'Community' && hasUnread) || (route.name === 'Profile' && hasUnreadNotifs)) && <View style={styles.unreadDot} />}
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
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.tabBg,
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
    // v2 handoff: the active tab is a berry pill with white icon and label.
    position: 'absolute', top: 6, bottom: 6, left: 0, borderRadius: 24, backgroundColor: colors.coralFill,
  },
  pillItem: { flex: 1, height: 52, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tabContent: { alignItems: 'center', gap: 2 },
  tabLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.1 },
  // A berry dot ringed in the pill's own colour, so it reads on both the light and dark pill.
  unreadDot: {
    position: 'absolute', top: 6, right: '24%', width: 9, height: 9, borderRadius: 4.5,
    backgroundColor: colors.coralFill, borderWidth: 2, borderColor: colors.tabBg,
  },
  fab: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coralFill, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  });
}
