import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { BRAND_CATEGORIES } from '@/constants/brandCategories';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { Brand } from '@/types';

// Admin-only utility screen (no self-serve brand accounts yet — see the
// brand_offers migration's own note) used by a handful of people, not a
// polished consumer flow, so a plain form is the right amount of effort.
export default function ManageBrandsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState(BRAND_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
    setBrands((data as Brand[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (!name.trim()) { showToast('Give the brand a name.', 'error'); return; }
    setCreating(true);
    const { error } = await supabase.from('brands').insert({
      name: name.trim(), category, description: description.trim() || null,
      contact_email: contactEmail.trim() || null, logo_url: logoUrl.trim() || null,
    });
    setCreating(false);
    if (error) { showToast('Couldn’t create brand.', 'error'); return; }
    haptics.success();
    showToast('Brand added');
    setName(''); setDescription(''); setContactEmail(''); setLogoUrl('');
    load();
  };

  const toggleActive = async (brand: Brand) => {
    haptics.tap();
    await supabase.from('brands').update({ is_active: !brand.is_active }).eq('id', brand.id);
    setBrands((prev) => prev.map((b) => (b.id === brand.id ? { ...b, is_active: !b.is_active } : b)));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Close"><Text style={styles.headerBtn}>Close</Text></AnimatedPressable>
        <Text style={styles.headerTitle}>Manage brands</Text>
        <View style={{ width: 44 }} />
      </View>

      <Text style={styles.sectionLabel}>Add a brand</Text>
      <TextInput style={styles.input} placeholder="Brand name…" placeholderTextColor={colors.inkSoft} value={name} onChangeText={setName} />
      <View style={styles.chipGrid}>
        {BRAND_CATEGORIES.map((opt) => {
          const isSelected = category === opt;
          return (
            <AnimatedPressable key={opt} style={[styles.chip, isSelected && styles.chipSelected]} onPress={() => { haptics.tap(); setCategory(opt); }}>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{opt}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
      <TextInput
        style={[styles.input, styles.bodyInput]} placeholder="Description (optional)…" placeholderTextColor={colors.inkSoft}
        value={description} onChangeText={setDescription} multiline
      />
      <TextInput
        style={styles.input} placeholder="Logo URL (optional)…" placeholderTextColor={colors.inkSoft}
        value={logoUrl} onChangeText={setLogoUrl} autoCapitalize="none"
      />
      <TextInput
        style={styles.input} placeholder="Contact email (optional)…" placeholderTextColor={colors.inkSoft}
        value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address"
      />
      <AnimatedPressable style={styles.createBtn} onPress={create} disabled={creating} accessibilityLabel="Add brand">
        {creating ? <ActivityIndicator color="white" /> : <Text style={styles.createBtnText}>Add brand</Text>}
      </AnimatedPressable>

      <Text style={styles.sectionLabel}>Existing brands</Text>
      {brands.length === 0 && <Text style={styles.emptyText}>No brands yet.</Text>}
      {brands.map((brand) => (
        <View key={brand.id} style={styles.brandRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brandName}>{brand.name}</Text>
            <Text style={styles.brandMeta}>{brand.category}{!brand.is_active ? ' · inactive' : ''}</Text>
          </View>
          <AnimatedPressable
            style={styles.toggleBtn}
            onPress={() => toggleActive(brand)}
            accessibilityLabel={brand.is_active ? `Deactivate ${brand.name}` : `Activate ${brand.name}`}
          >
            <Text style={styles.toggleBtnText}>{brand.is_active ? 'Deactivate' : 'Activate'}</Text>
          </AnimatedPressable>
        </View>
      ))}
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
  sectionLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
  },
  input: {
    marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.white, borderWidth: 1,
    borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 14, color: colors.ink,
  },
  bodyInput: { minHeight: 70, textAlignVertical: 'top' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
  chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12.5, fontWeight: '600', color: colors.ink },
  chipTextSelected: { color: colors.sand },
  createBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.coral,
    paddingVertical: 14, borderRadius: radius.pill, alignItems: 'center',
  },
  createBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  emptyText: { color: colors.inkSoft, fontSize: 13, paddingHorizontal: spacing.lg },
  brandRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: spacing.lg, marginTop: 10,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 12,
  },
  brandName: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  brandMeta: { fontSize: 11.5, color: colors.inkSoft, marginTop: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line },
  toggleBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  });
}
