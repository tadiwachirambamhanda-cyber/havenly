import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import Icon from '@/components/Icon';
import { Chip, ChipRow, Field, Hint, SectionLabel, SwitchRow, Toggle, TwoUp } from '@/components/admin/FormParts';
import ErrorNote from '@/components/admin/ErrorNote';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { AMENITIES, GENDER_POLICY_LABEL, PERIOD_LABEL, uploadResidencePhoto } from '@/lib/housing';
import {
  BEDROOM_OPTIONS, COMMUTE_MODES, LISTING_TYPES, STUDENT_DEAL_OPTIONS,
  checkBills, checkCommutes, checkHousemates, checkListingFields, checkStudentDeal,
} from '@/lib/listing';
import type { ListingField } from '@/lib/listing';
import { UNIVERSITIES } from '@/constants/universities';
import AnimatedPressable from '@/components/AnimatedPressable';
import { radius } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type {
  BillingPeriod, CommuteMode, GenderPolicy, ListingType, Residence, ResidencePartnerTerms, RoomType, StudentDealType,
} from '@/types';
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

interface CommuteDraft {
  key: string;
  university: string;
  minutes: string;
  mode: CommuteMode | null;
}

// The box an error belongs to: a listing field from lib/listing, or one of the
// plain ones checked in this file.
type FormField = ListingField | 'name' | 'provider' | 'area' | 'fee' | 'coords' | 'rooms';
interface FormError { message: string; field?: FormField }

const PERIODS: BillingPeriod[] = ['year', 'semester', 'month'];
const OCCUPANCIES = [1, 2, 3, 4];
const POLICIES: GenderPolicy[] = ['mixed', 'female_only', 'male_only'];
// Well above any real student room (even a yearly price), low enough to
// catch a doubled-up or extra-zero typo before it's saved.
const MAX_ROOM_PRICE = 500000;
const SAVE_FAILED = 'Could not save the listing, so nothing was changed. Check your connection and try again.';

let draftCounter = 0;
const newRoom = (): RoomDraft => ({
  key: `new-${draftCounter++}`, name: '', price: '', period: 'year', occupancy: 1, isAvailable: true,
});
const newCommute = (): CommuteDraft => ({ key: `commute-${draftCounter++}`, university: '', minutes: '', mode: null });

// The four groups of new fields. An existing listing sends a group only when
// the team changed it, so a stored value this form can't express (or a check
// added later) never gets overwritten by an unrelated edit.
interface GroupState {
  billsIncluded: boolean | null;
  billsMin: string;
  billsMax: string;
  dealOn: boolean;
  dealTypes: StudentDealType[];
  studentRate: string;
  housemates: string;
  commutes: CommuteDraft[];
}
const groupKeys = (g: GroupState) => ({
  bills: JSON.stringify([g.billsIncluded, g.billsMin.trim(), g.billsMax.trim()]),
  deal: JSON.stringify([g.dealOn, [...g.dealTypes].sort(), g.studentRate.trim()]),
  housemates: g.housemates.trim(),
  commutes: JSON.stringify(g.commutes.map((c) => [c.university.trim(), c.minutes.trim(), c.mode])),
});

// Admin-only. Listings are added by the Havenly team for now (no provider
// logins), so this one screen covers the listing, its rooms, and the
// private commercial terms students never see. (The table and file are
// still called "residence"; a listing can be any kind of place.)
export default function EditResidenceScreen() {
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const residenceId = route.params?.residenceId;
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(!!residenceId);
  const [name, setName] = useState('');
  const [providerName, setProviderName] = useState('');
  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [description, setDescription] = useState('');
  const [genderPolicy, setGenderPolicy] = useState<GenderPolicy>('mixed');
  const [listingType, setListingType] = useState<ListingType>('residence');
  const [bedrooms, setBedrooms] = useState<number | null>(null);
  const [deposit, setDeposit] = useState('');
  const [moveInFee, setMoveInFee] = useState('');
  const [billsIncluded, setBillsIncluded] = useState<boolean | null>(null);
  const [billsMin, setBillsMin] = useState('');
  const [billsMax, setBillsMax] = useState('');
  const [dealOn, setDealOn] = useState(false);
  const [dealTypes, setDealTypes] = useState<StudentDealType[]>([]);
  const [studentRate, setStudentRate] = useState('');
  const [housemates, setHousemates] = useState('');
  const [commutes, setCommutes] = useState<CommuteDraft[]>([]);
  // What the form held when it opened; null for a new listing (everything is sent).
  const [initialGroups, setInitialGroups] = useState<ReturnType<typeof groupKeys> | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [permit, setPermit] = useState('');
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
  const [error, setError] = useState<FormError | null>(null);

  const allowLeave = useConfirmDiscard(dirty && !saved);
  // Wraps every setter the form uses so any edit marks the form dirty,
  // without threading a flag through each onChange by hand.
  const edit = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setDirty(true); };
  const bad = (field: FormField) => error?.field === field;

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
        setListingType(r.listing_type ?? 'residence');
        setBedrooms(r.bedrooms ?? null);
        setDeposit(r.deposit_aed != null ? String(r.deposit_aed) : '');
        setMoveInFee(r.move_in_fee_aed != null ? String(r.move_in_fee_aed) : '');
        setIsVerified(r.is_verified ?? false);
        setPermit(r.permit_number ?? '');
        setAmenities(r.amenities);
        setUniversities(r.nearby_universities);
        setPhotos(r.photo_urls);
        setIsActive(r.is_active);
        const loaded: GroupState = {
          billsIncluded: r.bills_included ?? null,
          billsMin: r.bills_min_aed != null ? String(r.bills_min_aed) : '',
          billsMax: r.bills_max_aed != null ? String(r.bills_max_aed) : '',
          dealOn: (r.student_deal_types ?? []).length > 0,
          dealTypes: r.student_deal_types ?? [],
          studentRate: r.student_rate_aed != null ? String(r.student_rate_aed) : '',
          housemates: r.housemates != null ? String(r.housemates) : '',
          commutes: (r.commutes ?? []).map((c) => ({
            key: `commute-${draftCounter++}`, university: c.university, minutes: String(c.minutes), mode: c.mode,
          })),
        };
        setBillsIncluded(loaded.billsIncluded);
        setBillsMin(loaded.billsMin);
        setBillsMax(loaded.billsMax);
        setDealOn(loaded.dealOn);
        setDealTypes(loaded.dealTypes);
        setStudentRate(loaded.studentRate);
        setHousemates(loaded.housemates);
        setCommutes(loaded.commutes);
        setInitialGroups(groupKeys(loaded));
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

  const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

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

  const updateCommute = (key: string, patch: Partial<CommuteDraft>) => {
    setCommutes((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
    setDirty(true);
  };

  const matchingUniversities = useMemo(() => {
    const q = uniQuery.trim().toLowerCase();
    const list = q ? UNIVERSITIES.filter((u) => u.name.toLowerCase().includes(q)) : UNIVERSITIES.filter((u) => u.emirate === 'Dubai');
    return list.filter((u) => !universities.includes(u.name));
  }, [uniQuery, universities]);

  // Shows the problem next to Save (under the header and above the bottom
  // button) and scrolls back up so it is in view, wherever the box is.
  const fail = (message: string, field?: FormField) => {
    setError({ message, field });
    haptics.warning();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const save = async () => {
    if (saving || uploading) return;
    setError(null);
    if (!name.trim()) return fail('Add the listing’s name.', 'name');
    if (!providerName.trim()) return fail('Add who runs it: the operator or agency students sign with.', 'provider');
    if (!area.trim()) return fail('Add the area, e.g. Dubai International Academic City.', 'area');
    const listing = checkListingFields({ type: listingType, bedrooms, deposit, moveInFee, permit });
    if (!listing.ok) return fail(listing.error, listing.field);

    const isNew = !residenceId;
    const keys = groupKeys({ billsIncluded, billsMin, billsMax, dealOn, dealTypes, studentRate, housemates, commutes });
    const sendBills = isNew || !initialGroups || keys.bills !== initialGroups.bills;
    const sendDeal = isNew || !initialGroups || keys.deal !== initialGroups.deal;
    const sendHousemates = isNew || !initialGroups || keys.housemates !== initialGroups.housemates;
    const sendCommutes = isNew || !initialGroups || keys.commutes !== initialGroups.commutes;

    const bills = sendBills ? checkBills({ included: billsIncluded, min: billsMin, max: billsMax }) : null;
    if (bills && !bills.ok) return fail(bills.error, bills.field);
    const deal = sendDeal ? checkStudentDeal({ on: dealOn, types: dealTypes, rate: studentRate }) : null;
    if (deal && !deal.ok) return fail(deal.error, deal.field);
    const mates = sendHousemates ? checkHousemates(housemates) : null;
    if (mates && !mates.ok) return fail(mates.error, mates.field);
    const commuteList = sendCommutes ? checkCommutes(commutes) : null;
    if (commuteList && !commuteList.ok) return fail(commuteList.error, commuteList.field);

    const fee = Number(feePercent);
    if (!feePercent.trim() || !Number.isFinite(fee) || fee < 0 || fee > 100) return fail('Set the referral fee as a % between 0 and 100.', 'fee');
    let lat: number | null = null;
    let lng: number | null = null;
    if (latitude.trim() || longitude.trim()) {
      lat = Number(latitude.trim());
      lng = Number(longitude.trim());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return fail('Latitude/longitude must both be numbers, e.g. 25.1236, 55.4142.', 'coords');
    }
    const filledRooms = rooms.filter((r) => r.name.trim() || r.price.trim());
    for (const r of filledRooms) {
      const price = Number(r.price.replace(/[^\d]/g, ''));
      if (!r.name.trim()) return fail('Every room type needs a name, e.g. "Studio".', 'rooms');
      if (!Number.isFinite(price) || price <= 0) return fail(`Add a price for "${r.name.trim()}".`, 'rooms');
      if (price > MAX_ROOM_PRICE) return fail(`"${r.name.trim()}" is priced at ${price.toLocaleString('en-US')} AED. That looks like a typo.`, 'rooms');
    }

    // The keys below are exactly the ones save_residence reads (see
    // supabase/migrations/20261118200000_housing_foundation_fields.sql). A key
    // left out keeps the stored value.
    const residence: Record<string, unknown> = {
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
      listing_type: listing.value.listing_type,
      bedrooms: listing.value.bedrooms,
      deposit_aed: listing.value.deposit_aed,
      move_in_fee_aed: listing.value.move_in_fee_aed,
      is_verified: isVerified,
      permit_number: listing.value.permit_number,
    };
    if (bills?.ok) {
      residence.bills_included = bills.value.bills_included;
      residence.bills_min_aed = bills.value.bills_min_aed;
      residence.bills_max_aed = bills.value.bills_max_aed;
    }
    if (deal?.ok) {
      residence.student_deal_types = deal.value.student_deal_types;
      residence.student_rate_aed = deal.value.student_rate_aed;
    }
    if (mates?.ok) residence.housemates = mates.value;
    if (commuteList?.ok) residence.commutes = commuteList.value;

    setSaving(true);
    const { error: saveError } = await supabase.rpc('save_residence', {
      residence_id_input: residenceId ?? null,
      residence,
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
      fail(SAVE_FAILED);
      return;
    }
    setSaved(true);
    allowLeave();
    haptics.success();
    showToast(residenceId ? 'Listing updated' : 'Listing added', 'success');
    navigation.goBack();
  };

  if (loading) {
    return <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={colors.coral} /></View>;
  }

  const busy = saving || uploading;
  const saveLabel = saving ? 'Saving...' : 'Save';

  const usedCommuteUnis = commutes.map((c) => c.university.trim().toLowerCase());

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AnimatedPressable style={styles.cancelBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Cancel">
            <Text style={styles.cancelText}>Cancel</Text>
          </AnimatedPressable>
          <Text style={styles.headerTitle} accessibilityRole="header">{residenceId ? 'Edit listing' : 'New listing'}</Text>
          <AnimatedPressable
            style={[styles.headerSave, busy && styles.saveDisabled]}
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Save listing"
          >
            <Text style={styles.headerSaveText}>{saveLabel}</Text>
          </AnimatedPressable>
        </View>
        {error ? <ErrorNote message={error.message} /> : null}

        <SectionLabel>Kind of place</SectionLabel>
        <ChipRow>
          {LISTING_TYPES.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              selected={listingType === t.key}
              onPress={() => { setListingType(t.key); if (t.key !== 'home') setBedrooms(null); setDirty(true); }}
            />
          ))}
        </ChipRow>
        {listingType === 'home' && (
          <>
            <SectionLabel>Bedrooms</SectionLabel>
            <ChipRow>
              {BEDROOM_OPTIONS.map((n) => (
                <Chip key={n} label={`${n} bedroom${n === 1 ? '' : 's'}`} selected={bedrooms === n} invalid={bad('bedrooms')} onPress={() => { setBedrooms(n); setDirty(true); }} />
              ))}
            </ChipRow>
          </>
        )}

        <SectionLabel>Listing</SectionLabel>
        <Field label="Listing name" placeholder="Listing name" value={name} onChangeText={edit(setName)} maxLength={80} invalid={bad('name')} />
        <Field label="Run by" placeholder="Run by (operator or agency)" value={providerName} onChangeText={edit(setProviderName)} maxLength={80} invalid={bad('provider')} />
        <Field label="Area" placeholder="Area, for example Dubai International Academic City" value={area} onChangeText={edit(setArea)} maxLength={80} invalid={bad('area')} />
        <Field label="Address" placeholder="Address (optional)" value={address} onChangeText={edit(setAddress)} />
        <TwoUp>
          <Field label="Latitude" placeholder="Latitude (optional)" value={latitude} onChangeText={edit(setLatitude)} keyboardType="numbers-and-punctuation" invalid={bad('coords')} style={styles.half} />
          <Field label="Longitude" placeholder="Longitude (optional)" value={longitude} onChangeText={edit(setLongitude)} keyboardType="numbers-and-punctuation" invalid={bad('coords')} style={styles.half} />
        </TwoUp>
        <Field label="About this place" placeholder="About this place (optional)" value={description} onChangeText={edit(setDescription)} multiline style={{ marginTop: 8 }} />
        <SwitchRow title="Show to students" hint="Turn off to hide it without losing its enquiries." value={isActive} onChange={edit(setIsActive)} />

        <SectionLabel>On top of rent (optional)</SectionLabel>
        <TwoUp>
          <Field label="Deposit AED" placeholder="Deposit AED" value={deposit} onChangeText={edit(setDeposit)} keyboardType="number-pad" invalid={bad('deposit')} style={styles.half} />
          <Field label="One-time fees AED" placeholder="One-time fees AED" value={moveInFee} onChangeText={edit(setMoveInFee)} keyboardType="number-pad" invalid={bad('moveInFee')} style={styles.half} />
        </TwoUp>
        <Hint>One-time fees are things like an agency or admin fee. Leave empty if there are none.</Hint>

        <SectionLabel>Bills</SectionLabel>
        <SwitchRow
          title="Bills are included in the rent"
          hint="Turn off to show students an estimate instead."
          value={billsIncluded === true}
          onChange={edit(setBillsIncluded)}
        />
        {billsIncluded !== true && (
          <>
            <TwoUp>
              <Field label="Estimated bills from AED a month" placeholder="From AED a month" value={billsMin} onChangeText={edit(setBillsMin)} keyboardType="number-pad" invalid={bad('billsMin')} style={styles.half} />
              <Field label="Estimated bills up to AED a month" placeholder="Up to AED a month" value={billsMax} onChangeText={edit(setBillsMax)} keyboardType="number-pad" invalid={bad('billsMax')} style={styles.half} />
            </TwoUp>
            <Hint>For a whole home, enter the bills for the home. Students see them split per person.</Hint>
          </>
        )}

        <SectionLabel>Student deal</SectionLabel>
        <SwitchRow
          title="Offer a student deal"
          hint="Shown as a Student deal tag and helps the listing rank higher."
          value={dealOn}
          onChange={edit(setDealOn)}
        />
        {dealOn && (
          <>
            <ChipRow style={{ paddingBottom: 8 }}>
              {STUDENT_DEAL_OPTIONS.map((o) => (
                <Chip
                  key={o.key}
                  label={o.label}
                  selected={dealTypes.includes(o.key)}
                  invalid={bad('dealTypes')}
                  onPress={() => { setDealTypes((prev) => toggleIn(prev, o.key)); setDirty(true); }}
                />
              ))}
            </ChipRow>
            <Field label="Student rate AED a month" placeholder="Student rate AED a month (if a lower rent)" value={studentRate} onChangeText={edit(setStudentRate)} keyboardType="number-pad" invalid={bad('studentRate')} />
          </>
        )}

        <SectionLabel>Checked by the team</SectionLabel>
        <SwitchRow title="Verified by Havenly" hint="Turn on only after the team has checked this place." value={isVerified} onChange={edit(setIsVerified)} />
        <Field label="Advert permit number" placeholder="Advert permit number (optional)" value={permit} onChangeText={edit(setPermit)} maxLength={40} autoCapitalize="characters" invalid={bad('permit')} />

        <SectionLabel>Photos (the first one is the cover)</SectionLabel>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((url, i) => (
            <View key={url} style={styles.photo}>
              <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <AnimatedPressable
                hitSlop={8}
                style={styles.photoRemove}
                onPress={() => { setPhotos((prev) => prev.filter((p) => p !== url)); setDirty(true); }}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Icon name="x" size={14} color="white" />
              </AnimatedPressable>
              {i > 0 && (
                <AnimatedPressable
                  hitSlop={8}
                  style={styles.photoCover}
                  onPress={() => { setPhotos((prev) => [url, ...prev.filter((p) => p !== url)]); setDirty(true); }}
                  accessibilityRole="button"
                  accessibilityLabel="Make cover photo"
                >
                  <Text style={styles.photoCoverText}>Cover</Text>
                </AnimatedPressable>
              )}
            </View>
          ))}
          <AnimatedPressable style={[styles.photo, styles.photoAdd]} onPress={addPhotos} disabled={uploading} accessibilityRole="button" accessibilityLabel="Add photos">
            {uploading ? <ActivityIndicator color={colors.coral} /> : <Icon name="plus" size={22} color={colors.inkSoft} />}
          </AnimatedPressable>
        </ScrollView>

        <SectionLabel>Room types</SectionLabel>
        {rooms.map((room) => (
          <View key={room.key} style={styles.card}>
            <TwoUp>
              <Field label="Room type name" placeholder="Name" value={room.name} onChangeText={(v) => updateRoom(room.key, { name: v })} invalid={bad('rooms')} style={styles.half} />
              <Field label="Price AED" placeholder="Price AED" value={room.price} onChangeText={(v) => updateRoom(room.key, { price: v })} keyboardType="number-pad" invalid={bad('rooms')} style={styles.half} />
            </TwoUp>
            <ChipRow style={styles.cardRow}>
              {PERIODS.map((p) => <Chip key={p} label={`per ${PERIOD_LABEL[p]}`} selected={room.period === p} onPress={() => updateRoom(room.key, { period: p })} />)}
            </ChipRow>
            <ChipRow style={styles.cardRow}>
              {OCCUPANCIES.map((o) => <Chip key={o} label={o === 1 ? 'Private' : `${o} sharing`} selected={room.occupancy === o} onPress={() => updateRoom(room.key, { occupancy: o })} />)}
            </ChipRow>
            <View style={styles.roomFoot}>
              <View style={styles.roomAvail}>
                <Toggle label="Available" value={room.isAvailable} onChange={(v) => updateRoom(room.key, { isAvailable: v })} />
                <Text style={styles.hintText}>{room.isAvailable ? 'Available' : 'Full'}</Text>
              </View>
              <AnimatedPressable style={styles.textBtn} onPress={() => { setRooms((prev) => prev.filter((r) => r.key !== room.key)); setDirty(true); }} accessibilityRole="button" accessibilityLabel="Remove room type">
                <Text style={styles.removeText}>Remove</Text>
              </AnimatedPressable>
            </View>
          </View>
        ))}
        <AnimatedPressable style={styles.outlineBtn} onPress={() => { setRooms((prev) => [...prev, newRoom()]); setDirty(true); }} accessibilityRole="button">
          <Text style={styles.outlineText}>Add room type</Text>
        </AnimatedPressable>

        <SectionLabel>Who it is for</SectionLabel>
        <ChipRow>
          {POLICIES.map((p) => <Chip key={p} label={GENDER_POLICY_LABEL[p]} selected={genderPolicy === p} onPress={() => { setGenderPolicy(p); setDirty(true); }} />)}
        </ChipRow>

        <SectionLabel>Housemates</SectionLabel>
        <Field label="Housemates" placeholder="Other students already living there (optional)" value={housemates} onChangeText={edit(setHousemates)} keyboardType="number-pad" invalid={bad('housemates')} />
        <Hint>A whole number from 0 to 10. Leave empty if not known.</Hint>

        <SectionLabel>What is included</SectionLabel>
        <ChipRow>
          {AMENITIES.map((a) => <Chip key={a.key} label={a.key} selected={amenities.includes(a.key)} onPress={() => { setAmenities((prev) => toggleIn(prev, a.key)); setDirty(true); }} />)}
        </ChipRow>

        <SectionLabel>Close to</SectionLabel>
        {universities.length > 0 && (
          <ChipRow style={{ marginBottom: 10 }}>
            {universities.map((u) => <Chip key={u} label={`${u}  ×`} selected onPress={() => { setUniversities((prev) => prev.filter((x) => x !== u)); setDirty(true); }} />)}
          </ChipRow>
        )}
        <Field label="Search universities" placeholder="Search universities" value={uniQuery} onChangeText={setUniQuery} />
        <ChipRow style={{ marginTop: 2 }}>
          {matchingUniversities.slice(0, 14).map((u) => <Chip key={u.name} label={u.name} selected={false} onPress={() => { setUniversities((prev) => [...prev, u.name]); setDirty(true); }} />)}
        </ChipRow>

        <SectionLabel>Getting to campus</SectionLabel>
        {commutes.map((c) => (
          <View key={c.key} style={styles.card}>
            <Field label="Commute university" placeholder="University" value={c.university} onChangeText={(v) => updateCommute(c.key, { university: v })} invalid={bad('commutes')} />
            {!c.university.trim() && universities.some((u) => !usedCommuteUnis.includes(u.toLowerCase())) && (
              <ChipRow style={styles.cardRow}>
                {universities.filter((u) => !usedCommuteUnis.includes(u.toLowerCase())).map((u) => (
                  <Chip key={u} label={u} selected={false} onPress={() => updateCommute(c.key, { university: u })} />
                ))}
              </ChipRow>
            )}
            <Field label="Minutes" placeholder="Minutes" value={c.minutes} onChangeText={(v) => updateCommute(c.key, { minutes: v })} keyboardType="number-pad" invalid={bad('commutes')} />
            <ChipRow style={styles.cardRow}>
              {COMMUTE_MODES.map((m) => <Chip key={m.key} label={m.label} selected={c.mode === m.key} invalid={bad('commutes')} onPress={() => updateCommute(c.key, { mode: m.key })} />)}
            </ChipRow>
            <View style={styles.roomFoot}>
              <View />
              <AnimatedPressable style={styles.textBtn} onPress={() => { setCommutes((prev) => prev.filter((x) => x.key !== c.key)); setDirty(true); }} accessibilityRole="button" accessibilityLabel="Remove commute">
                <Text style={styles.removeText}>Remove</Text>
              </AnimatedPressable>
            </View>
          </View>
        ))}
        <AnimatedPressable style={styles.outlineBtn} onPress={() => { setCommutes((prev) => [...prev, newCommute()]); setDirty(true); }} accessibilityRole="button">
          <Text style={styles.outlineText}>Add commute time</Text>
        </AnimatedPressable>
        <Hint>Minutes to a university by bus, metro, walk, taxi or shuttle. One per university.</Hint>

        <SectionLabel>Partner terms (private, never shown to students)</SectionLabel>
        <Field label="Referral fee percent" placeholder="Referral fee % of contract value, for example 8" value={feePercent} onChangeText={edit(setFeePercent)} keyboardType="decimal-pad" invalid={bad('fee')} />
        <Field label="Contact name" placeholder="Contact name" value={contactName} onChangeText={edit(setContactName)} />
        <Field label="Contact email" placeholder="Contact email" value={contactEmail} onChangeText={edit(setContactEmail)} keyboardType="email-address" autoCapitalize="none" />
        <Field label="Contact phone" placeholder="Contact phone" value={contactPhone} onChangeText={edit(setContactPhone)} keyboardType="phone-pad" />
        <Field label="Notes" placeholder="Notes, for example invoice terms (optional)" value={notes} onChangeText={edit(setNotes)} multiline />

        <View style={styles.bottom}>
          {error ? <ErrorNote message={error.message} style={{ marginHorizontal: 0 }} /> : null}
          <AnimatedPressable
            style={[styles.saveBtn, busy && styles.saveDisabled]}
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Save listing"
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save listing'}</Text>
          </AnimatedPressable>
          {uploading ? <Text style={[styles.hintText, { marginTop: 8 }]}>Photos are still uploading. Save will be ready in a moment.</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingTop: Platform.OS === 'web' ? 20 : 60, paddingBottom: 8,
    },
    cancelBtn: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
    cancelText: { fontSize: 15, fontWeight: '600', color: colors.inkSoft },
    headerTitle: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 18, color: colors.ink },
    headerSave: { minHeight: 44, paddingHorizontal: 18, borderRadius: 12, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
    headerSaveText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    saveDisabled: { opacity: 0.85 },
    half: { flex: 1, marginHorizontal: 0 },
    hintText: { fontSize: 13, color: colors.inkSoft },
    photoRow: { gap: 10, paddingHorizontal: 16 },
    photo: { width: 96, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.sandDeep },
    photoAdd: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.fieldLine, backgroundColor: 'transparent' },
    photoRemove: {
      position: 'absolute', top: 4, right: 4, width: 28, height: 28, borderRadius: 14,
      backgroundColor: 'rgba(31,27,22,0.75)', alignItems: 'center', justifyContent: 'center',
    },
    photoCover: {
      position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 8, paddingVertical: 4,
      borderRadius: 6, backgroundColor: 'rgba(31,27,22,0.75)',
    },
    photoCoverText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    card: {
      marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line,
      borderRadius: 12, paddingTop: 12, paddingBottom: 14,
    },
    cardRow: { paddingBottom: 10 },
    roomFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    roomAvail: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    textBtn: { minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
    removeText: { fontSize: 14, fontWeight: '700', color: colors.errorText },
    outlineBtn: {
      marginHorizontal: 16, minHeight: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.fieldLine,
      alignItems: 'center', justifyContent: 'center',
    },
    outlineText: { fontSize: 14, fontWeight: '700', color: colors.ink },
    bottom: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 28 },
    saveBtn: { minHeight: 52, borderRadius: 12, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
    saveBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
}
