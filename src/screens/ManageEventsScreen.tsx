import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import ActionSheet from '@/components/ActionSheet';
import { Notice, OutlineButton, PrimaryButton, StateBlock } from '@/components/housing/parts';
import { DateBlock } from '@/components/community/EventCard';
import CommunityPicker from '@/components/community/CommunityPicker';
import { BOLD, Card, CardSkeletons, Content, Field, GUTTER, Pill, ScreenTop } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { eventInputFromIso, eventProblem, friendlyError, goingLine, isUpcoming, parseEventWhen, type EventInput } from '@/lib/community';
import { deleteEvent, fetchAllEvents, fetchCommunities, saveEvent, type EventRow } from '@/lib/communityApi';
import type { Community } from '@/types';
import type { ColorTokens } from '@/theme/tokens';

// For the team (F22): add, edit and delete events, optionally for one community. Times are Dubai time.
const BLANK: EventInput = { title: '', location: '', description: '', date: '', time: '' };

export default function ManageEventsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const s = useMemo(() => styles(colors), [colors]);
  const [events, setEvents] = useState<EventRow[] | null | 'failed'>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; input: EventInput; communityId: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [toDelete, setToDelete] = useState<EventRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([fetchAllEvents(), fetchCommunities()]);
      setEvents(e);
      setCommunities(c);
    } catch {
      setEvents('failed');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = (e: EventRow | null) => {
    setError(null);
    setEditing(e
      ? { id: e.id, input: { title: e.title, location: e.location, description: e.description ?? '', ...eventInputFromIso(e.event_date) }, communityId: e.community_id ?? null }
      : { id: null, input: BLANK, communityId: null });
  };
  const set = (k: keyof EventInput) => (v: string) => setEditing((prev) => (prev ? { ...prev, input: { ...prev.input, [k]: v } } : prev));

  const save = async () => {
    if (!editing) return;
    const problem = eventProblem(editing.input);
    if (problem) { setError(problem); return; }
    const when = parseEventWhen(editing.input.date, editing.input.time);
    if (!('iso' in when)) return;
    setSaving(true);
    try {
      await saveEvent(editing.id, {
        title: editing.input.title.trim(), location: editing.input.location.trim(),
        description: editing.input.description.trim() || null, event_date: when.iso, community_id: editing.communityId,
      });
      showToast(editing.id ? 'Event saved.' : 'Event added.');
      setEditing(null);
      load();
    } catch (e) {
      setError(friendlyError(e, 'Couldn’t save the event. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const e = toDelete;
    if (!e) return;
    try {
      await deleteEvent(e.id);
      setEvents((prev) => (Array.isArray(prev) ? prev.filter((x) => x.id !== e.id) : prev));
      showToast('Event deleted.');
    } catch (err) {
      showToast(friendlyError(err, 'Couldn’t delete the event. Try again.'), 'error');
    }
  };

  const communityName = (id: string | null) => (id ? communities.find((c) => c.id === id)?.name ?? 'One community' : 'Everyone');

  if (!profile?.is_admin) {
    return <View style={[s.container, { paddingTop: insets.top + 10 }]}><Content><ScreenTop title="Manage events" /><StateBlock icon="lock" title="For the Havenly team" body="Only the team can add events." /></Content></View>;
  }

  if (editing) {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Content>
          <ScreenTop title={editing.id ? 'Edit event' : 'New event'} back={false} right={<Pill label="Cancel" onPress={() => setEditing(null)} height={44} />} />
          <View style={s.form}>
            <Field label="Name" value={editing.input.title} onChangeText={set('title')} placeholder="Move-in day meetup" maxLength={120} />
            <Field label="Where" value={editing.input.location} onChangeText={set('location')} placeholder="Dubai Knowledge Park" maxLength={120} />
            <View style={s.two}>
              <View style={{ flex: 1 }}><Field label="Date (YYYY-MM-DD)" value={editing.input.date} onChangeText={set('date')} placeholder="2026-12-05" keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={10} /></View>
              <View style={{ flex: 1 }}><Field label="Time, Dubai (HH:MM)" value={editing.input.time} onChangeText={set('time')} placeholder="19:00" keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={5} /></View>
            </View>
            <Field label="About it (optional)" value={editing.input.description} onChangeText={set('description')} multiline maxLength={1000} />
            <View style={{ gap: 6 }}>
              <Text style={s.label}>Shown to</Text>
              <Pressable style={s.select} onPress={() => setPickerOpen(true)} accessibilityRole="button" accessibilityLabel={`Shown to ${communityName(editing.communityId)}. Change`}>
                <Text style={s.selectText}>{communityName(editing.communityId)}</Text>
                <Icon name="chevron-right" size={14} color={colors.inkSoft} />
              </Pressable>
            </View>
            {error ? <Notice>{error}</Notice> : null}
            <PrimaryButton label={editing.id ? 'Save event' : 'Add event'} onPress={save} loading={saving} style={{ borderRadius: 27 }} height={54} />
          </View>
        </Content>
        <CommunityPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} communities={communities} selectedId={editing.communityId}
          onPick={(id) => setEditing((prev) => (prev ? { ...prev, communityId: id } : prev))} />
      </ScrollView>
    );
  }

  let empty: React.ReactNode = null;
  if (events === null) empty = <CardSkeletons count={3} height={110} />;
  else if (events === 'failed') empty = <StateBlock icon="alert-circle" kind="error" title="We could not load events" body="Check your connection and try again." primary={{ label: 'Try again', onPress: () => { setEvents(null); load(); } }} />;
  else if (!events.length) empty = <StateBlock icon="calendar" title="No events yet" body="Add the first one. Students see upcoming events in Community." />;

  return (
    <View style={s.container}>
      <FlatList
        data={Array.isArray(events) ? events : []}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={
          <Content style={{ paddingTop: insets.top + 10 }}>
            <ScreenTop title="Manage events" right={<Pill label="Add" icon="plus" tone="berry" onPress={() => startEdit(null)} height={44} accessibilityLabel="Add an event" />} />
          </Content>
        }
        ListEmptyComponent={empty ? <Content>{empty}</Content> : undefined}
        renderItem={({ item }) => (
          <Content>
            <Card style={{ marginBottom: 12, gap: 12 }}>
              <View style={s.row}>
                <DateBlock iso={item.event_date} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.title} numberOfLines={2}>{item.title}</Text>
                  <Text style={s.meta} numberOfLines={1}>{item.location}</Text>
                  <Text style={s.meta} numberOfLines={1}>{communityName(item.community_id ?? null)} · {goingLine(item.going_count)}{isUpcoming(item.event_date) ? '' : ' · finished'}{item.hidden_at ? ' · hidden by reports' : ''}</Text>
                </View>
              </View>
              <View style={s.two}>
                <OutlineButton label="Edit" onPress={() => startEdit(item)} height={44} style={{ flex: 1, borderRadius: 22 }} />
                <OutlineButton label="Delete" onPress={() => setToDelete(item)} height={44} style={{ flex: 1, borderRadius: 22 }} />
              </View>
            </Card>
          </Content>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      />
      <ActionSheet
        visible={!!toDelete} onClose={() => setToDelete(null)} title={`Delete “${toDelete?.title ?? ''}”?`}
        message="It is removed for everyone, with its Going list. This cannot be undone."
        actions={[{ label: 'Delete', destructive: true, onPress: confirmDelete }]}
      />
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    form: { paddingHorizontal: GUTTER, gap: 14 },
    two: { flexDirection: 'row', gap: 10 },
    label: { fontFamily: BOLD, fontSize: 14, color: colors.ink },
    select: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectText: { fontSize: 16, color: colors.ink },
    row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    title: { fontFamily: BOLD, fontSize: 16, color: colors.ink },
    meta: { fontSize: 13, color: colors.inkSoft },
  });
}
