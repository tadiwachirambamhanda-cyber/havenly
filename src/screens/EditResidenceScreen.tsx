import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { AMENITIES, GENDER_POLICY_LABEL, PERIOD_LABEL, uploadResidencePhoto } from '@/lib/housing';
import { UNIVERSITIES } from '@/constants/universities';
import AnimatedPressable from '@/components/AnimatedPressable';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { BillingPeriod, GenderPolicy, Residence, ResidencePartnerTerms, RoomType } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'EditResidence'>;

interface RoomDraft {
  key: string;
  id?: string;
  name: string;
  price: string;
  period: BillingPeriod;
  occupancy: number;
  isAvailable: boolean;
}

const PERIODS: BillingPeriod[] = ['year', 'semester', 'month'];
const OCCUPANCIES = [1, 2, 3, 4];
const POLICIES: GenderPolicy[] = ['mixed', 'female_only', 'male_only'];
// Well above any real student room (even a yearly price), low enough to
// catch a doubled-up or extra-zero typo before it's saved.
const MAX_ROOM_PRICE = 500000;

let draftCounter = 0;
const newRoom = (): RoomDraft => ({
  key: `new-${draftCounter++}`, name: '', price: '', period: 'year', occupancy: 1, isAvailable: true,
});

// Admin-only. Residences are added by the Havenly team for now (no
// provider logins), so this one screen covers the listing, its rooms, and
// the private commercial terms students never see.
export default function EditResidenceScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const residenceId = route.params?.residenceId;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(!!residenceId);
  const [name, setName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [genderPolicy, setGenderPolicy] = useState<GenderPolicy>('mixed');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [universities, setUniversities] = useState<string[]>([]);
  const [uniQuery, setUniQuery] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [rooms, setRooms] = useState<RoomDraft[]>([newRoom()]);
  const [feePercent, setFeePercent] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowLeave = useConfirmDiscard(dirty && !saved);
  // Wraps every setter the form uses so any edit marks the form dirty,
  // without threading a flag through each onChange by hand.
  const edit = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };

  useEffect(() => {
    if (!residenceId) return;
    (async () => {
      const [{ data: residenceRow }, { data: termsRow }] = await Promise.all([
        supabase.from('residences').select('*, room_types(*)').eq('id', residenceId).maybeSingle(),
        supabase.from('residence_partner_terms').select('*').eq('residence_id', residenceId).maybeSingle(),
      ]);
      const r = residenceRow as Residence | null;
      if (r) {
        setName(r.name);
        setProviderName(r.provider_name);
        setArea(r.area);
        setAddress(r.address ?? '');
        setLatitude(r.latitude != null ? String(r.latitude) : '');
        setLongitude(r.longitude != null ? String(r.longitude) : '');
        setDescription(r.description ?? '');
        setGenderPolicy(r.gender_policy);
        setAmenities(r.amenities);
        setUniversities(r.nearby_universities);
        setPhotos(r.photo_urls);
        setIsActive(r.is_active);
        const sortedRooms = [...(r.room_types ?? [])].sort((a, b) => a.sort_order - b.sort_order);
        setRooms(sortedRooms.length ? sortedRooms.map((rt: RoomType) => ({
          key: rt.id, id: rt.id, name: rt.name, price: String(rt.price_aed), period: rt.billing_period,
          occupancy: rt.occupancy, isAvailable: rt.is_available,
        })) : [newRoom()]);
      }
      const t = termsRow as ResidencePartnerTerms | null;
      if (t) {
        setFeePercent(String(Number(t.referral_fee_percent)));
        setContactName(t.contact_name ?? '');
        setContactEmail(t.contact_email ?? '');
        setContactPhone(t.contact_phone ?? '');
        setNotes(t.notes ?? '');
      }
      setLoading(false);
    })();
  }, [residenceId]);

  const toggleIn = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const addPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10 });
    if (result.canceled) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const asset of result.assets) urls.push(await uploadResidencePhoto(asset.uri));
      setPhotos((prev) => [...prev, ...urls]);
      setDirty(true);
    } catch {
      showToast('Some photos didn’t upload. Try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const updateRoom = (key: string, patch: Partial<RoomDraft>) => {
    setRooms((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const matchingUniversities = useMemo(() => {
    const q = uniQuery.trim().toLowerCase();
    const list = q ? UNIVERSITIES.filter((u) => u.name.toLowerCase().includes(q)) : UNIVERSITIES.filter((u) => u.emirate === 'Dubai');
    return list.filter((u) => !universities.includes(u.name));
  }, [uniQuery, universities]);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Add the residence’s name.');
    if (!providerName.trim()) return setError('Add who runs it: the operator or agency students sign with.');
    if (!area.trim()) return setError('Add the area, e.g. Dubai International Academic City.');
    const fee = Number(feePercent);
    if (!feePercent.trim() || !Number.isFinite(fee) || fee < 0 || fee > 100) return setError('Set the referral fee as a % between 0 and 100.');
    let lat: number | null = null;
    let lng: number | null = null;
    if (latitude.trim() || longitude.trim()) {
      lat = Number(latitude.trim());
      lng = Number(longitude.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return setError('Latitude/longitude must both be numbers, e.g. 25.1236, 55.4142.');
    }
    const filledRooms = rooms.filter((r) => r.name.trim() || r.price.trim());
    for (const r of filledRooms) {
      const price = Number(r.price.replace(/[^\d]/g, ''));
      if (!r.name.trim()) return setError('Every room type needs a name, e.g. "Studio".');
      if (!Number.isFinite(price) || price <= 0) return setError(`Add a price for "${r.name.trim()}".`);
      if (price > MAX_ROOM_PRICE) return setError(`"${r.name.trim()}" is priced at ${price.toLocaleString('en-US')} AED. That looks like a typo.`);
    }

    setSaving(true);
    const { error: saveError } = await supabase.rpc('save_residence', {
      residence_id_input: residenceId ?? null,
      residence: {
        name: name.trim(),
        provider_name: providerName.trim(),
        area: area.trim(),
        address: address.trim() || null,
        latitude: lat,
        longitude: lng,
        description: description.trim() || null,
        gender_policy: genderPolicy,
        amenities,
        nearby_universities: universities,
        photo_urls: photos,
        is_active: isActive,
      },
      rooms: filledRooms.map((r) => ({
        id: r.id ?? null,
        name: r.name.trim(),
        price_aed: Number(r.price.replace(/[^\d]/g, '')),
        billing_period: r.period,
        occupancy: r.occupancy,
        is_available: r.isAvailable,
      })),
      terms: {
        referral_fee_percent: fee,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        notes: notes.trim() || null,
      },
    });
    setSaving(false);
    if (saveError) {
      console.error('save_residence failed:', saveError.message);
      setError('Couldn’t save the residence, so nothing was changed. Check your connection and try again.');
      return;
    }
    setSaved(true);
    allowLeave();
    haptics.success();
    showToast(residenceId ? 'Residence updated' : 'Residence added', 'success');
    navigation.goBack();
  };

  if (loading) {
    return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.coral} /></View>;
  }

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <AnimatedPressable key={key} style={[styles.chip, selected && styles.chipSelected]} onPress={() => { haptics.tap(); onPress(); setDirty(true); }}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></AnimatedPressable>
          <Text style={styles.headerTitle}>{residenceId ? 'Edit residence' : 'New residence'}</Text>
          <AnimatedPressable onPress={save} disabled={saving || uploading} accessibilityLabel="Save residence">
            {saving ? <ActivityIndicator color={colors.coral} /> : <Text style={[styles.headerBtn, styles.saveBtn]}>Save</Text>}
          </AnimatedPressable>
        </View>

        <Text style={styles.sectionLabel}>Listing</Text>
        <TextInput style={styles.titleInput} placeholder="Residence name…" placeholderTextColor={colors.inkSoft} value={name} onChangeText={edit(setName)} maxLength={80} />
        <TextInput style={styles.fieldInput} placeholder="Run by (operator or agency)…" placeholderTextColor={colors.inkSoft} value={providerName} onChangeText={edit(setProviderName)} maxLength={80} />
        <TextInput style={styles.fieldInput} placeholder="Area, e.g. Dubai International Academic City…" placeholderTextColor={colors.inkSoft} value={area} onChangeText={edit(setArea)} maxLength={80} />
        <TextInput style={styles.fieldInput} placeholder="Address (optional)…" placeholderTextColor={colors.inkSoft} value={address} onChangeText={edit(setAddress)} />
        <View style={styles.row2}>
          <TextInput style={[styles.fieldInput, styles.half]} placeholder="Latitude (optional)" placeholderTextColor={colors.inkSoft} value={latitude} onChangeText={edit(setLatitude)} keyboardType="numbers-and-punctuation" />
          <TextInput style={[styles.fieldInput, styles.half]} placeholder="Longitude (optional)" placeholderTextColor={colors.inkSoft} value={longitude} onChangeText={edit(setLongitude)} keyboardType="numbers-and-punctuation" />
        </View>
        <TextInput style={styles.bodyInput} placeholder="About the residence (optional)…" placeholderTextColor={colors.inkSoft} value={description} onChangeText={edit(setDescription)} multiline />

        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchTitle}>Show to students</Text>
            <Text style={styles.hint}>Turn off to hide it without losing its enquiries.</Text>
          </View>
          <Switch value={isActive} onValueChange={edit(setIsActive)} trackColor={{ true: colors.teal, false: colors.line }} />
        </View>

        <Text style={styles.sectionLabel}>Photos (the first one is the cover)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((url, i) => (
            <View key={url} style={styles.photo}>
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <AnimatedPressable hitSlop={8}
                style={styles.photoRemove}
                onPress={() => { setPhotos((prev) => prev.filter((p) => p !== url)); setDirty(true); }}
                accessibilityLabel="Remove photo"
              >
                <Icon name="x" size={12} color="white" />
              </AnimatedPressable>
              {i > 0 && (
                <AnimatedPressable
                  style={styles.photoCover}
                  onPress={() => { setPhotos((prev) => [url, ...prev.filter((p) => p !== url)]); setDirty(true); }}
                  accessibilityLabel="Make cover photo"
                >
                  <Text style={styles.photoCoverText}>Cover</Text>
                </AnimatedPressable>
              )}
            </View>
          ))}
          <AnimatedPressable style={[styles.photo, styles.photoAdd]} onPress={addPhotos} disabled={uploading} accessibilityLabel="Add photos">
            {uploading ? <ActivityIndicator color={colors.coral} /> : <Icon name="plus" size={20} color={colors.inkSoft} />}
          </AnimatedPressable>
        </ScrollView>

        <Text style={styles.sectionLabel}>Room types</Text>
        {rooms.map((room) => (
          <View key={room.key} style={styles.roomCard}>
            <View style={styles.row2}>
              <TextInput
                style={[styles.fieldInput, styles.half, { flex: 1.4 }]}
                placeholder="Name, e.g. Studio"
                placeholderTextColor={colors.inkSoft}
                value={room.name}
                onChangeText={(v) => updateRoom(room.key, { name: v })}
              />
              <TextInput
                style={[styles.fieldInput, styles.half]}
                placeholder="Price AED"
                placeholderTextColor={colors.inkSoft}
                value={room.price}
                onChangeText={(v) => updateRoom(room.key, { price: v })}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.inlineChips}>
              {PERIODS.map((p) => chip(`${room.key}-${p}`, `per ${PERIOD_LABEL[p]}`, room.period === p, () => updateRoom(room.key, { period: p })))}
            </View>
            <View style={styles.inlineChips}>
              {OCCUPANCIES.map((o) => chip(`${room.key}-o${o}`, o === 1 ? 'Private' : `${o} sharing`, room.occupancy === o, () => updateRoom(room.key, { occupancy: o })))}
            </View>
            <View style={styles.roomFoot}>
              <View style={styles.roomAvail}>
                <Switch value={room.isAvailable} onValueChange={(v) => updateRoom(room.key, { isAvailable: v })} trackColor={{ true: colors.teal, false: colors.line }} />
                <Text style={styles.hint}>{room.isAvailable ? 'Available' : 'Full'}</Text>
              </View>
              <AnimatedPressable onPress={() => { setRooms((prev) => prev.filter((r) => r.key !== room.key)); setDirty(true); }} accessibilityLabel="Remove room type">
                <Text style={styles.removeText}>Remove</Text>
              </AnimatedPressable>
            </View>
          </View>
        ))}
        <AnimatedPressable style={styles.addRoomBtn} onPress={() => { setRooms((prev) => [...prev, newRoom()]); setDirty(true); }}>
          <Icon name="plus" size={14} color={colors.ink} />
          <Text style={styles.addRoomText}>Add room type</Text>
        </AnimatedPressable>

        <Text style={styles.sectionLabel}>Who it’s for</Text>
        <View style={styles.chipGrid}>
          {POLICIES.map((p) => chip(p, GENDER_POLICY_LABEL[p], genderPolicy === p, () => setGenderPolicy(p)))}
        </View>

        <Text style={styles.sectionLabel}>What’s included</Text>
        <View style={styles.chipGrid}>
          {AMENITIES.map((a) => chip(a.key, a.key, amenities.includes(a.key), () => setAmenities((prev) => toggleIn(prev, a.key))))}
        </View>

        <Text style={styles.sectionLabel}>Close to</Text>
        {universities.length > 0 && (
          <View style={[styles.chipGrid, { marginBottom: 10 }]}>
            {universities.map((u) => chip(u, `${u}  ×`, true, () => setUniversities((prev) => prev.filter((x) => x !== u))))}
          </View>
        )}
        <TextInput
          style={[styles.fieldInput, { marginTop: 0 }]}
          placeholder="Search universities…"
          placeholderTextColor={colors.inkSoft}
          value={uniQuery}
          onChangeText={setUniQuery}
        />
        <View style={[styles.chipGrid, { marginTop: 10 }]}>
          {matchingUniversities.slice(0, 14).map((u) => chip(u.name, u.name, false, () => setUniversities((prev) => [...prev, u.name])))}
        </View>

        <Text style={styles.sectionLabel}>Partner terms (private, never shown to students)</Text>
        <TextInput
          style={[styles.fieldInput, { marginTop: 0 }]}
          placeholder="Referral fee % of contract value, e.g. 8"
          placeholderTextColor={colors.inkSoft}
          value={feePercent}
          onChangeText={edit(setFeePercent)}
          keyboardType="decimal-pad"
        />
        <TextInput style={styles.fieldInput} placeholder="Contact name…" placeholderTextColor={colors.inkSoft} value={contactName} onChangeText={edit(setContactName)} />
        <TextInput style={styles.fieldInput} placeholder="Contact email…" placeholderTextColor={colors.inkSoft} value={contactEmail} onChangeText={edit(setContactEmail)} keyboardType="email-address" autoCapitalize="none" />
        <TextInput style={styles.fieldInput} placeholder="Contact phone…" placeholderTextColor={colors.inkSoft} value={contactPhone} onChangeText={edit(setContactPhone)} keyboardType="phone-pad" />
        <TextInput style={styles.bodyInput} placeholder="Notes, e.g. invoice terms (optional)…" placeholderTextColor={colors.inkSoft} value={notes} onChangeText={edit(setNotes)} multiline />

        {error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
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
    saveBtn: { color: colors.coral, fontWeight: '700' },
    sectionLabel: {
      fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
    },
    titleInput: {
      marginHorizontal: spacing.lg, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.sm, padding: 14, fontSize: 15, fontWeight: '600', color: colors.ink,
    },
    fieldInput: {
      marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.sm, padding: 13, fontSize: 14, color: colors.ink,
    },
    bodyInput: {
      marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 80, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.line, borderRadius: radius.sm, padding: 13, fontSize: 14, color: colors.ink, textAlignVertical: 'top',
    },
    row2: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg },
    half: { flex: 1, marginHorizontal: 0 },
    hint: { fontSize: 11.5, color: colors.inkSoft },
    switchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: spacing.lg, marginTop: spacing.md,
      backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 13,
    },
    switchTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
    photoRow: { gap: 10, paddingHorizontal: spacing.lg },
    photo: { width: 96, height: 72, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: colors.sandDeep },
    photoAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line },
    photoRemove: {
      position: 'absolute', top: 5, right: 5, width: 20, height: 20, borderRadius: 10,
      backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
    },
    photoCover: {
      position: 'absolute', left: 5, bottom: 5, paddingHorizontal: 6, paddingVertical: 2,
      borderRadius: radius.tag, backgroundColor: 'rgba(0,0,0,0.6)',
    },
    photoCoverText: { color: 'white', fontSize: 10, fontWeight: '700' },
    roomCard: {
      marginHorizontal: spacing.lg, marginBottom: 10, paddingBottom: 12, backgroundColor: colors.sandDeep,
      borderRadius: radius.md, paddingTop: 4,
    },
    inlineChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, marginTop: 10 },
    roomFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginTop: 10 },
    roomAvail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    removeText: { fontSize: 12.5, fontWeight: '700', color: colors.coral },
    addRoomBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: spacing.lg,
      paddingVertical: 11, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line,
    },
    addRoomText: { fontSize: 13, fontWeight: '700', color: colors.ink },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg },
    chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white },
    chipSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.ink },
    chipTextSelected: { color: colors.sand },
    error: { color: colors.coral, fontSize: 13, marginTop: 16, marginHorizontal: spacing.lg },
  });
}
