import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Notice, PrimaryButton, StateBlock } from '@/components/housing/parts';
import { BOLD, Card, CardSkeletons, ChoiceChip, Content, Field, GUTTER, Pill, ScreenTop, SectionLabel } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { brandProblem, friendlyError, isHiddenSampleBrand, parseEventWhen, perkProblem, type PerkInput } from '@/lib/community';
import { createBrand, createPerk, fetchAllBrands, fetchAllPerks, setPerkActive, type PerkRow } from '@/lib/communityApi';
import type { Brand } from '@/types';
import type { ColorTokens } from '@/theme/tokens';

// For the team (F23): add a brand, add a perk for a brand, and switch a perk on or off.
// The old sample perks and the Veldemers brand are marked: students never see them.
const BLANK_PERK: PerkInput = { title: '', discountLabel: '', description: '', address: '', endsOn: '' };

export default function ManagePerksScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const s = useMemo(() => styles(colors), [colors]);
  const [brands, setBrands] = useState<Brand[] | null | 'failed'>(null);
  const [perks, setPerks] = useState<PerkRow[]>([]);
  const [mode, setMode] = useState<'list' | 'brand' | 'perk'>('list');
  const [brandName, setBrandName] = useState('');
  const [brandCategory, setBrandCategory] = useState('');
  const [brandAbout, setBrandAbout] = useState('');
  const [perkBrand, setPerkBrand] = useState<string | null>(null);
  const [perk, setPerk] = useState<PerkInput>(BLANK_PERK);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([fetchAllBrands(), fetchAllPerks()]);
      setBrands(b);
      setPerks(p);
    } catch {
      setBrands('failed');
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const go = (m: typeof mode) => { setError(null); setMode(m); };

  const saveBrand = async () => {
    const problem = brandProblem(brandName, brandCategory);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      const id = await createBrand({ name: brandName.trim(), category: brandCategory.trim(), description: brandAbout.trim() || null });
      showToast('Brand added. Now add its perk.');
      setBrandName(''); setBrandCategory(''); setBrandAbout('');
      setPerkBrand(id);
      await load();
      go('perk');
    } catch (e) {
      setError(friendlyError(e, 'Couldn’t add the brand. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const savePerk = async () => {
    if (!perkBrand) { setError('Choose the brand first.'); return; }
    const problem = perkProblem(perk);
    if (problem) { setError(problem); return; }
    const ends = perk.endsOn.trim() ? parseEventWhen(perk.endsOn, '23:59') : null;
    setSaving(true);
    try {
      await createPerk({
        brand_id: perkBrand, title: perk.title.trim(), discount_label: perk.discountLabel.trim(),
        description: perk.description.trim() || null, address: perk.address.trim() || null,
        ends_at: ends && 'iso' in ends ? ends.iso : null,
      });
      showToast('Perk added. Students can get a code now.');
      setPerk(BLANK_PERK);
      await load();
      go('list');
    } catch (e) {
      setError(friendlyError(e, 'Couldn’t add the perk. Try again.'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: PerkRow, on: boolean) => {
    setSwitching(p.id);
    try {
      await setPerkActive(p.id, on);
      setPerks((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: on } : x)));
      showToast(on ? 'Perk switched on.' : 'Perk switched off. Students no longer see it.');
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t change the perk. Try again.'), 'error');
    } finally {
      setSwitching(null);
    }
  };

  const top = (title: string, right?: React.ReactNode, back = true) => <View style={{ paddingTop: insets.top + 10 }}><ScreenTop title={title} right={right} back={back} /></View>;

  if (!profile?.is_admin) {
    return <View style={s.container}><Content>{top('Manage perks')}<StateBlock icon="lock" title="For the Havenly team" body="Only the team can add perks." /></Content></View>;
  }

  if (mode === 'brand') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Content>
          {top('New brand', <Pill label="Cancel" onPress={() => go('list')} height={44} />, false)}
          <View style={s.form}>
            <Field label="Brand name" value={brandName} onChangeText={setBrandName} maxLength={80} />
            <Field label="Category" value={brandCategory} onChangeText={setBrandCategory} placeholder="Cafe, gym, books…" maxLength={40} />
            <Field label="About the brand (optional)" value={brandAbout} onChangeText={setBrandAbout} multiline maxLength={300} />
            {error ? <Notice>{error}</Notice> : null}
            <PrimaryButton label="Add brand" onPress={saveBrand} loading={saving} height={54} style={{ borderRadius: 27 }} />
          </View>
        </Content>
      </ScrollView>
    );
  }

  const brandList = Array.isArray(brands) ? brands : [];

  if (mode === 'perk') {
    return (
      <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
        <Content>
          {top('New perk', <Pill label="Cancel" onPress={() => go('list')} height={44} />, false)}
          <View style={s.form}>
            <Text style={s.label}>Brand</Text>
            <View style={s.chips}>
              {brandList.filter((b) => b.is_active && !isHiddenSampleBrand(b.name)).map((b) => (
                <ChoiceChip key={b.id} label={b.name} on={perkBrand === b.id} onPress={() => setPerkBrand(b.id)} />
              ))}
              <Pill label="New brand" icon="plus" onPress={() => go('brand')} />
            </View>
            <Field label="Title" value={perk.title} onChangeText={(t) => setPerk((p) => ({ ...p, title: t }))} placeholder="Coffee at Knowledge Park" maxLength={120} />
            <Field label="The deal" value={perk.discountLabel} onChangeText={(t) => setPerk((p) => ({ ...p, discountLabel: t }))} placeholder="15% off" maxLength={40} />
            <Field label="Details (optional)" value={perk.description} onChangeText={(t) => setPerk((p) => ({ ...p, description: t }))} multiline maxLength={500} />
            <Field label="Address (optional)" value={perk.address} onChangeText={(t) => setPerk((p) => ({ ...p, address: t }))} maxLength={160} />
            <Field label="Ends on (YYYY-MM-DD, optional)" value={perk.endsOn} onChangeText={(t) => setPerk((p) => ({ ...p, endsOn: t }))} keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={10} />
            {error ? <Notice>{error}</Notice> : null}
            <PrimaryButton label="Add perk" onPress={savePerk} loading={saving} height={54} style={{ borderRadius: 27 }} />
          </View>
        </Content>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
      <Content>
        {top('Manage perks')}
        <View style={s.actions}>
          <Pill label="Add a perk" icon="plus" tone="berry" onPress={() => go('perk')} height={44} />
          <Pill label="Add a brand" icon="plus" onPress={() => go('brand')} height={44} />
        </View>
        {brands === null ? <CardSkeletons count={3} height={90} /> : brands === 'failed' ? (
          <StateBlock icon="alert-circle" kind="error" title="We could not load perks" body="Check your connection and try again." primary={{ label: 'Try again', onPress: () => { setBrands(null); load(); } }} />
        ) : (
          <>
            <SectionLabel>Perks</SectionLabel>
            {perks.length === 0 ? <Text style={s.empty}>No perks yet. Add a brand, then its perk.</Text> : null}
            {perks.map((p) => {
              const sample = isHiddenSampleBrand(p.brand?.name);
              return (
                <Card key={p.id} style={{ marginBottom: 10 }}>
                  <View style={s.row}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.title}>{p.discount_label} · {p.title}</Text>
                      <Text style={s.meta}>{p.brand?.name ?? 'Unknown brand'}{p.ends_at ? ` · ends ${p.ends_at.slice(0, 10)}` : ''}</Text>
                      {sample ? <Text style={s.sample}>Old sample: hidden from students until the owner decides</Text> : null}
                    </View>
                    <Switch
                      value={p.is_active} disabled={switching === p.id} onValueChange={(v) => toggle(p, v)}
                      accessibilityLabel={`${p.title} is ${p.is_active ? 'on' : 'off'}`}
                      trackColor={{ true: colors.mintFill, false: colors.fieldLine }}
                    />
                  </View>
                </Card>
              );
            })}
            <SectionLabel>Brands</SectionLabel>
            <Text style={s.brands}>{brandList.map((b) => `${b.name}${isHiddenSampleBrand(b.name) ? ' (hidden from students)' : ''}`).join(' · ') || 'No brands yet.'}</Text>
          </>
        )}
      </Content>
    </ScrollView>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    form: { paddingHorizontal: GUTTER, gap: 14 },
    label: { fontFamily: BOLD, fontSize: 14, color: colors.ink },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: GUTTER },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    title: { fontFamily: BOLD, fontSize: 15, color: colors.ink },
    meta: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    sample: { fontSize: 12.5, color: colors.errorText, marginTop: 4 },
    empty: { fontSize: 14, color: colors.inkSoft, paddingHorizontal: GUTTER },
    brands: { fontSize: 14, lineHeight: 21, color: colors.inkBody, paddingHorizontal: GUTTER },
  });
}
