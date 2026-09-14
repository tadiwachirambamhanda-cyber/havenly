import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/tokens';
import { useUnreadMessages } from '@/lib/useUnreadMessages';

const INACTIVE_COLOR = '#8D8977';

const TAB_CONFIG: Record<string, { icon: keyof typeof Feather.glyphMap }> = {
  Feed: { icon: 'home' },
  Discover: { icon: 'search' },
  Inbox: { icon: 'inbox' },
  Profile: { icon: 'user' },
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const hasUnread = useUnreadMessages();

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const config = TAB_CONFIG[route.name];
    if (!config) return null;
    const isFocused = state.index === index;

    return (
      <Pressable
        key={route.key}
        style={[styles.pillItem, isFocused && styles.pillItemActive]}
        onPress={() => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <Feather name={config.icon} size={18} color={isFocused ? 'white' : INACTIVE_COLOR} />
        {route.name === 'Inbox' && hasUnread && <View style={styles.unreadDot} />}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { bottom: insets.bottom + 14 }]}>
      <View style={styles.pill}>{state.routes.map(renderTab)}</View>
      <Pressable style={styles.fab} onPress={() => navigation.getParent()?.navigate('CreatePost')}>
        <Feather name="plus" size={20} color="white" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.ink,
    borderRadius: 100, padding: 6,
    shadowColor: '#000', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  pillItem: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pillItemActive: { backgroundColor: colors.coral },
  unreadDot: {
    position: 'absolute', top: 6, right: '30%', width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: 'white', borderWidth: 1.5, borderColor: colors.coral,
  },
  fab: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: colors.coral, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.coral, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
});
