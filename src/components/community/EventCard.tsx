import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { eventDateBlock, friendlyError, goingLine } from '@/lib/community';
import { fetchMyGoing, setGoing, type EventRow } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { BOLD, GUTTER, Pill } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Which events I said I am going to, and the toggle that keeps the counts in step (+1, then back).
export function useGoing(setEvents: (update: (prev: EventRow[]) => EventRow[]) => void) {
  const { session } = useAuth();
  const myId = session?.user.id;
  const { showToast } = useToast();
  const [going, setGoingIds] = useState<Set<string>>(new Set());
  const busy = useRef(new Set<string>());

  const reload = useCallback(async () => {
    if (!myId) return;
    setGoingIds(await fetchMyGoing(myId));
  }, [myId]);
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchMyGoing(myId).then((ids) => { if (alive) setGoingIds(ids); });
    return () => { alive = false; };
  }, [myId]);

  const toggle = useCallback(async (event: EventRow) => {
    if (!myId || busy.current.has(event.id)) return;
    busy.current.add(event.id);
    haptics.tap();
    const on = !going.has(event.id);
    const apply = (to: boolean) => {
      setGoingIds((prev) => { const n = new Set(prev); if (to) n.add(event.id); else n.delete(event.id); return n; });
      setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, going_count: Math.max(0, (e.going_count ?? 0) + (to ? 1 : -1)) } : e)));
    };
    apply(on);
    try {
      await setGoing(myId, event.id, on);
    } catch (e) {
      apply(!on);
      showToast(friendlyError(e, 'Couldn’t update. Try again.'), 'error');
    } finally {
      busy.current.delete(event.id);
    }
  }, [myId, going, setEvents, showToast]);

  return { going, toggle, reload };
}

export function GoingButton({ on, onPress }: { on: boolean; onPress: () => void }) {
  return (
    <Pill
      label={on ? 'Going' : 'I’m going'} icon={on ? 'check' : undefined} tone={on ? 'mintFill' : 'plain'} selected={on}
      onPress={onPress} accessibilityLabel={on ? 'Going. Tap to take it back' : 'I’m going'} style={{ alignSelf: 'flex-start' }}
    />
  );
}

export function DateBlock({ iso, large }: { iso: string; large?: boolean }) {
  const { colors } = useTheme();
  const b = eventDateBlock(iso);
  return (
    <View style={{ width: large ? 74 : 62, borderRadius: 16, backgroundColor: colors.coralFill, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}>
      <Text style={{ fontFamily: BOLD, fontSize: 12, letterSpacing: 0.6, color: '#FFFFFF' }}>{b.day}</Text>
      <Text style={{ fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: large ? 30 : 25, color: '#FFFFFF', lineHeight: large ? 34 : 29 }}>{b.date}</Text>
      <Text style={{ fontSize: 12, color: '#FFFFFF' }}>{large ? `${b.month} · ${b.time}` : b.time}</Text>
    </View>
  );
}

export default function EventCard({ event, going, onToggle, onMenu }: { event: EventRow; going: boolean; onToggle: () => void; onMenu?: () => void }) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={s.card}>
      <AnimatedPressable
        style={s.row} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}
        accessibilityRole="button" accessibilityLabel={`Open event ${event.title}`}
      >
        <DateBlock iso={event.event_date} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={s.title} numberOfLines={2}>{event.title}</Text>
          <Text style={s.meta} numberOfLines={1}>{event.location}</Text>
          <Text style={s.meta} numberOfLines={1}>{event.community?.name ?? 'Havenly team'} · {goingLine(event.going_count)}</Text>
        </View>
      </AnimatedPressable>
      <View style={s.foot}>
        <GoingButton on={going} onPress={onToggle} />
        {onMenu ? (
          <AnimatedPressable onPress={onMenu} style={s.more} accessibilityRole="button" accessibilityLabel={`More options for ${event.title}`}>
            <Icon name="more-horizontal" size={20} color={colors.inkSoft} />
          </AnimatedPressable>
        ) : null}
      </View>
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 14, marginHorizontal: GUTTER, marginBottom: 12, gap: 12 },
    row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    title: { fontFamily: BOLD, fontSize: 16, color: colors.ink },
    meta: { fontSize: 13, color: colors.inkSoft },
    foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    more: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  });
}
