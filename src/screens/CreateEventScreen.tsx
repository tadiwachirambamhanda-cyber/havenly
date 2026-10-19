import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { TAG_GROUPS, TAG_OPTIONS } from '@/constants/tags';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// No date/time picker library — Expo Go doesn't bundle one, and this is an
// admin-only utility screen used by a handful of people, not a polished
// consumer flow, so plain "YYYY-MM-DD" / "HH:MM" text fields with real
// validation are the right amount of effort here.
export default function CreateEventScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [tag, setTag] = useState(TAG_OPTIONS[0]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const allowLeave = useConfirmDiscard(!created && (
    title.trim() !== '' || location.trim() !== '' || description.trim() !== '' || date !== '' || time !== ''
    || latitude !== '' || longitude !== ''
  ));

  const create = async () => {
    setError(null);
    if (!title.trim()) return setError('Give the event a title.');
    if (!location.trim()) return setError('Add a location.');
    if (!DATE_RE.test(date)) return setError('Date must be in YYYY-MM-DD format, e.g. 2026-09-20.');
    if (!TIME_RE.test(time)) return setError('Time must be in 24-hour HH:MM format, e.g. 19:00.');

    const eventDate = new Date(`${date}T${time}:00`);
    if (Number.isNaN(eventDate.getTime())) return setError('That date and time isn’t valid.');
    if (eventDate.getTime() <= Date.now()) return setError('Pick a future date. Discover only shows upcoming events.');

    let lat: number | null = null;
    let lng: number | null = null;
    if (latitude.trim() || longitude.trim()) {
      lat = Number(latitude.trim());
      lng = Number(longitude.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError('Latitude/longitude must both be numbers, e.g. 25.2048, 55.2708.');
    }

    setCreating(true);
    const { error: insertError } = await supabase.from('events').insert({
      title: title.trim(),
      location: location.trim(),
      description: description.trim() || null,
      tag,
      event_date: eventDate.toISOString(),
      latitude: lat,
      longitude: lng,
    });
    setCreating(false);

    if (insertError) {
      setError('Couldn’t create the event. Please try again.');
      return;
    }
    setCreated(true);
    allowLeave();
    showToast('Event created!', 'success');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></AnimatedPressable>
        <Text style={styles.headerTitle}>New event</Text>
        <AnimatedPressable onPress={create} disabled={creating} accessibilityLabel="Create event">
          {creating ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.createBtn]}>Create</Text>}
        </AnimatedPressable>
      </View>

      <TextInput
        style={styles.titleInput}
        placeholder="Event title…"
        placeholderTextColor={colors.inkSoft}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />
      <TextInput
        style={styles.fieldInput}
        placeholder="Location…"
        placeholderTextColor={colors.inkSoft}
        value={location}
        onChangeText={setLocation}
        maxLength={120}
      />
      <TextInput
        style={styles.bodyInput}
        placeholder="Description (optional)…"
        placeholderTextColor={colors.inkSoft}
        value={description}
        onChangeText={setDescription}
        multiline
      />

      <Text style={styles.sectionLabel}>Date & time</Text>
      <View style={styles.dateRow}>
        <TextInput
          style={[styles.fieldInput, styles.dateInput, { marginTop: 0 }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.inkSoft}
          value={date}
          onChangeText={setDate}
          maxLength={10}
          keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={[styles.fieldInput, styles.timeInput, { marginTop: 0 }]}
          placeholder="HH:MM"
          placeholderTextColor={colors.inkSoft}
          value={time}
          onChangeText={setTime}
          maxLength={5}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <Text style={styles.sectionLabel}>Location on map (optional)</Text>
      <Text style={styles.hint}>Right-click the spot on Google Maps and tap the coordinates to copy them.</Text>
      <View style={[styles.dateRow, { marginTop: spacing.sm }]}>
        <TextInput
          style={[styles.fieldInput, styles.dateInput, { marginTop: 0 }]}
          placeholder="Latitude, e.g. 25.2048" placeholderTextColor={colors.inkSoft}
          value={latitude} onChangeText={setLatitude} keyboardType="numbers-and-punctuation"
        />
        <TextInput
          style={[styles.fieldInput, styles.dateInput, { marginTop: 0 }]}
          placeholder="Longitude, e.g. 55.2708" placeholderTextColor={colors.inkSoft}
          value={longitude} onChangeText={setLongitude} keyboardType="numbers-and-punctuation"
        />
      </View>

      <Text style={styles.sectionLabel}>Tag</Text>
      {TAG_GROUPS.map((group) => (
        <View key={group.label}>
          <Text style={styles.groupLabel}>{group.label}</Text>
          <View style={styles.chipGrid}>
            {group.tags.map((opt) => {
              const isSelected = tag === opt;
              return (
                <AnimatedPressable key={opt} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => { haptics.tap(); setTag(opt); }}>
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md,
  },
  headerTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink },
  headerBtn: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  createBtn: { color: colors.coral, fontWeight: '700' },
  titleInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 15, fontWeight: '600', color: colors.ink,
  },
  fieldInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink,
  },
  bodyInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 90, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink, textAlignVertical: 'top',
  },
  groupLabel: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: 10, marginBottom: 6 },
  sectionLabel: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
  hint: { fontSize: 11.5, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: -4 },
  dateRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
  dateInput: { flex: 1.3, marginHorizontal: 0 },
  timeInput: { flex: 1, marginHorizontal: 0 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: spacing.lg },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  error: { color: colors.coral, fontSize: 13, marginTop: 16, marginHorizontal: spacing.lg },
  });
}
