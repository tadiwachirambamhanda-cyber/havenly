import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { Brand } from '@/types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// Same milestones useStreakBump celebrates — keeps the gate values a user
// might actually be sitting at, rather than arbitrary round numbers.
const STREAK_OPTIONS = [0, 3, 7, 14, 30];

// Admin-only utility screen (see ManageBrandsScreen) — no date/time picker
// library, plain "YYYY-MM-DD" text fields with real validation, same
// reasoning as CreateEventScreen.
export default function CreateOfferScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [minStreak, setMinStreak] = useState(0);
  const [endsAt, setEndsAt] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    supabase.from('brands').select('*').eq('is_active', true).order('name')
      .then(({ data }) => {
        const list = (data as Brand[]) ?? [];
        setBrands(list);
        setBrandId((prev) => prev ?? list[0]?.id ?? null);
      });
  }, []);

  const allowLeave = useConfirmDiscard(!created && (
    title.trim() !== '' || description.trim() !== '' || discountLabel.trim() !== '' || imageUrl.trim() !== '' || endsAt !== ''
    || address.trim() !== '' || latitude !== '' || longitude !== ''
  ));

  const create = async () => {
    setError(null);
    if (!brandId) return setError('Add a brand first, in Manage brands.');
    if (!title.trim()) return setError('Give the offer a title.');
    if (!discountLabel.trim()) return setError('Describe the discount, e.g. "20% off".');

    let endsAtIso: string | null = null;
    if (endsAt) {
      if (!DATE_RE.test(endsAt)) return setError('End date must be in YYYY-MM-DD format, e.g. 2026-12-31.');
      const parsed = new Date(`${endsAt}T23:59:59`);
      if (Number.isNaN(parsed.getTime())) return setError('That end date isn’t valid.');
      endsAtIso = parsed.toISOString();
    }

    let lat: number | null = null;
    let lng: number | null = null;
    if (latitude.trim() || longitude.trim()) {
      lat = Number(latitude.trim());
      lng = Number(longitude.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError('Latitude/longitude must both be numbers, e.g. 25.2048, 55.2708.');
    }

    setCreating(true);
    const { error: insertError } = await supabase.from('offers').insert({
      brand_id: brandId,
      title: title.trim(),
      description: description.trim() || null,
      image_url: imageUrl.trim() || null,
      discount_label: discountLabel.trim(),
      min_streak: minStreak,
      ends_at: endsAtIso,
      address: address.trim() || null,
      latitude: lat,
      longitude: lng,
    });
    setCreating(false);

    if (insertError) {
      setError('Couldn’t create the offer. Please try again.');
      return;
    }
    setCreated(true);
    allowLeave();
    showToast('Offer created!', 'success');
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></AnimatedPressable>
        <Text style={styles.headerTitle}>New offer</Text>
        <AnimatedPressable onPress={create} disabled={creating} accessibilityLabel="Create offer">
          {creating ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.createBtn]}>Create</Text>}
        </AnimatedPressable>
      </View>

      <Text style={styles.sectionLabel}>Brand</Text>
      {brands.length === 0 ? (
        <Text style={styles.emptyText}>No active brands yet — add one in Manage brands first.</Text>
      ) : (
        <View style={styles.chipGrid}>
          {brands.map((brand) => {
            const isSelected = brandId === brand.id;
            return (
              <AnimatedPressable key={brand.id} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => { haptics.tap(); setBrandId(brand.id); }}>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{brand.name}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      )}

      <TextInput style={styles.titleInput} placeholder="Offer title…" placeholderTextColor={colors.inkSoft} value={title} onChangeText={setTitle} maxLength={120} />
      <TextInput style={styles.fieldInput} placeholder={'Discount, e.g. "20% off"…'} placeholderTextColor={colors.inkSoft} value={discountLabel} onChangeText={setDiscountLabel} maxLength={60} />
      <TextInput style={styles.bodyInput} placeholder="Description (optional)…" placeholderTextColor={colors.inkSoft} value={description} onChangeText={setDescription} multiline />
      <TextInput style={styles.fieldInput} placeholder="Image URL (optional)…" placeholderTextColor={colors.inkSoft} value={imageUrl} onChangeText={setImageUrl} autoCapitalize="none" />

      <Text style={styles.sectionLabel}>Streak required to unlock</Text>
      <View style={styles.chipGrid}>
        {STREAK_OPTIONS.map((opt) => {
          const isSelected = minStreak === opt;
          return (
            <AnimatedPressable key={opt} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => { haptics.tap(); setMinStreak(opt); }}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt === 0 ? 'Everyone' : `${opt}-day`}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Ends (optional)</Text>
      <TextInput
        style={[styles.fieldInput, { marginTop: 0 }]}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.inkSoft}
        value={endsAt}
        onChangeText={setEndsAt}
        maxLength={10}
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.sectionLabel}>Location (optional — lets it show on the map)</Text>
      <Text style={styles.hint}>Right-click the spot on Google Maps and tap the coordinates to copy them.</Text>
      <TextInput style={[styles.fieldInput, { marginTop: spacing.sm }]} placeholder="Address (optional)…" placeholderTextColor={colors.inkSoft} value={address} onChangeText={setAddress} />
      <View style={styles.dateRow}>
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
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
  emptyText: { color: colors.inkSoft, fontSize: 13, paddingHorizontal: spacing.lg },
  titleInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 15, fontWeight: '600', color: colors.ink,
  },
  fieldInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink,
  },
  bodyInput: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 80, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink, textAlignVertical: 'top',
  },
  hint: { fontSize: 11.5, color: colors.inkSoft, paddingHorizontal: spacing.lg, marginTop: -4 },
  dateRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  dateInput: { flex: 1, marginHorizontal: 0 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: spacing.lg },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  error: { color: colors.coral, fontSize: 13, marginTop: 16, marginHorizontal: spacing.lg },
  });
}
