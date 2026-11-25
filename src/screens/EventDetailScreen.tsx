import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { StateBlock } from '@/components/housing/parts';
import { DateBlock, GoingButton, useGoing } from '@/components/community/EventCard';
import { useSafetyMenu } from '@/components/community/SafetyMenu';
import { BOLD, Card, CardSkeletons, Content, ScreenTop, TITLE_FONT } from '@/components/community/ui';
import { useTheme } from '@/lib/ThemeContext';
import { eventWhen, goingLine, isUpcoming } from '@/lib/community';
import { fetchEvent, type EventRow } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'EventDetail'>;

// One event (F22): when and where, Going (+1, tap again to take it back) and Report.
export default function EventDetailScreen() {
  const { eventId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  const [event, setEvent] = useState<EventRow | null | undefined | 'failed'>(undefined);

  const load = useCallback(async () => {
    try { setEvent(await fetchEvent(eventId)); } catch { setEvent('failed'); }
  }, [eventId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setList = useCallback((u: (prev: EventRow[]) => EventRow[]) => {
    setEvent((prev) => (prev && prev !== 'failed' ? u([prev])[0] ?? prev : prev));
  }, []);
  const going = useGoing(setList);
  const menu = useSafetyMenu();

  const more = event && event !== 'failed' ? (
    <AnimatedPressable onPress={() => menu.open({ type: 'event', id: event.id })} style={s.more} accessibilityRole="button" accessibilityLabel="More options for this event">
      <Icon name="more-horizontal" size={20} color={colors.ink} />
    </AnimatedPressable>
  ) : undefined;

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }}>
        <Content>
          <ScreenTop title="Event" right={more} />
          {event === undefined ? <CardSkeletons count={1} height={220} /> : event === 'failed' ? (
            <StateBlock icon="alert-circle" kind="error" title="We could not load this event" body="Check your connection and try again."
              primary={{ label: 'Try again', onPress: () => { setEvent(undefined); load(); } }} />
          ) : event === null ? (
            <StateBlock icon="calendar" title="This event is no longer available" body="It may have been removed by the team." />
          ) : (
            <Card style={{ gap: 14 }}>
              <View style={s.row}>
                <DateBlock iso={event.event_date} large />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.title} accessibilityRole="header">{event.title}</Text>
                  <Text style={s.meta}>{event.community?.name ?? 'Havenly team'}</Text>
                </View>
              </View>
              <View style={s.line}><Icon name="calendar" size={16} color={colors.inkSoft} /><Text style={s.lineText}>{eventWhen(event.event_date)} (Dubai time)</Text></View>
              <View style={s.line}><Icon name="map-pin" size={16} color={colors.inkSoft} /><Text style={s.lineText}>{event.location}</Text></View>
              <View style={s.line}><Icon name="users" size={16} color={colors.inkSoft} /><Text style={s.lineText}>{goingLine(event.going_count)}</Text></View>
              {event.description ? <Text style={s.body}>{event.description}</Text> : null}
              {isUpcoming(event.event_date) ? (
                <GoingButton on={going.going.has(event.id)} onPress={() => going.toggle(event)} />
              ) : <Text style={s.meta}>This event has finished.</Text>}
            </Card>
          )}
        </Content>
      </ScrollView>
      {menu.element}
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    more: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    title: { fontFamily: TITLE_FONT, fontSize: 22, letterSpacing: -0.4, color: colors.ink },
    meta: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
    line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    lineText: { flex: 1, fontFamily: BOLD, fontSize: 14, color: colors.ink },
    body: { fontSize: 15, lineHeight: 22, color: colors.inkBody },
  });
}
