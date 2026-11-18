import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, type ScrollViewInstance, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import ActionSheet from '@/components/ActionSheet';
import Skeleton from '@/components/Skeleton';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Notice, OutlineButton, PrimaryButton } from '@/components/housing/parts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { deleteMyCard, fetchMyCard, saveMyCard } from '@/lib/housematesApi';
import {
  AREA_MAX, LIFESTYLE_OPTIONS, MAX_SPOTS, MAX_TAGS, NOTE_MAX, cardProblem, visibilityExplainer,
  type LifestyleKey, type MyCard,
} from '@/lib/housemates';
import { preferenceSummary } from '@/lib/profilePrefs';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'MyHousemateCard'>;

interface HomeOption { id: string; name: string; area: string }

// Keyed by the account, so the form starts fresh if the signed-in account ever changes while it is open.
export default function MyHousemateCardScreen() {
  const { session } = useAuth();
  return <MyHousemateCardForm key={session?.user.id ?? 'signed-out'} />;
}

function MyHousemateCardForm() {
  const navigation = useNavigation<Nav>();
  const startHome = useRoute<Route>().params?.residenceId ?? null;
  const insets = useSafeAreaInsets();
  const { session, profile, isGuest } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [loaded, setLoaded] = useState(false);
  const [card, setCard] = useState<MyCard | null>(null);
  const [homes, setHomes] = useState<HomeOption[]>([]);
  const [active, setActive] = useState(true);
  const [area, setArea] = useState('');
  const [lifestyle, setLifestyle] = useState<LifestyleKey[]>([]);
  const [note, setNote] = useState('');
  const [homeId, setHomeId] = useState<string | null>(startHome);
  const [spots, setSpots] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  // Show a problem at the top of the form and bring it into view (the Publish button is at the bottom).
  const fail = (message: string) => { setError(message); scrollRef.current?.scrollTo({ y: 0, animated: true }); };

  const missingPrefs = profile?.budget_aed == null || !profile?.move_in_month;

  useEffect(() => {
    supabase.from('residences').select('id, name, area').eq('is_active', true).eq('listing_type', 'home')
      .then(({ data }) => setHomes((data as HomeOption[]) ?? []));
  }, []);

  useFocusEffect(useCallback(() => {
    if (!myId) return;
    fetchMyCard(myId).then((c) => {
      setCard(c);
      if (c) {
        setActive(c.active); setArea(c.area ?? ''); setLifestyle(c.lifestyle); setNote(c.note ?? '');
        setHomeId(c.residence_id ?? startHome); setSpots(c.spots_needed ?? 1);
      }
      setLoaded(true);
    }).catch(() => { setLoaded(true); setError('We could not load your card. Check your connection and try again.'); });
  }, [myId, startHome]));

  const toggleTag = (k: LifestyleKey) => {
    haptics.tap();
    setLifestyle((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= MAX_TAGS ? prev : [...prev, k]));
  };

  const save = async () => {
    setError(null);
    if (!myId) return;
    if (isGuest) return fail('Demo mode shows this screen only. Make an account to publish a card.');
    if (missingPrefs) return fail('Set your monthly budget and move-in month in Edit profile first.');
    const problem = cardProblem({ area, lifestyle, note, residenceId: homeId, spots: homeId ? spots : null });
    if (problem) return fail(problem);
    setSaving(true);
    try {
      await saveMyCard(myId, { area, lifestyle, note, residenceId: homeId, spots: homeId ? spots : null }, active);
      haptics.success();
      const fresh = await fetchMyCard(myId);
      setCard(fresh);
      showToast(fresh?.status === 'approved' ? 'Saved' : 'Saved. The team checks new cards before they appear.');
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '';
      fail(msg || 'We could not save your card. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!myId) return;
    try {
      await deleteMyCard(myId);
      setCard(null); setArea(''); setLifestyle([]); setNote(''); setHomeId(null); setSpots(1);
      showToast('Your card was removed.');
    } catch {
      showToast('Couldn’t remove your card. Try again.', 'error');
    }
  };

  const statusNotice = () => {
    if (!card) return null;
    if (card.status === 'approved') return <Notice kind="note">{card.active ? 'Your card is live on the board.' : 'Your card is approved but switched off, so nobody sees it.'}</Notice>;
    if (card.status === 'hidden') return <Notice>{`The team hid your card${card.review_note ? `: ${card.review_note}` : '.'} Edit it and save to send it back for review.`}</Notice>;
    return <Notice kind="note">Waiting for the team to check your card. It appears on the board once approved.</Notice>;
  };

  if (!loaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]} accessibilityLabel="Loading your card">
        <Skeleton style={{ height: 40, width: '50%', marginHorizontal: spacing.lg }} />
        <Skeleton style={{ height: 200, marginHorizontal: spacing.lg, marginTop: 16, borderRadius: 14 }} />
      </View>
    );
  }

  const prefs = profile ? preferenceSummary(profile) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 60, paddingTop: insets.top + 8 }} keyboardShouldPersistTaps="handled">
        <View style={styles.top}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title} accessibilityRole="header">My housemate card</Text>
        </View>

        <View style={styles.pad}>
          {error ? <Notice style={{ marginBottom: 12 }}>{error}</Notice> : null}
          {statusNotice()}

          {missingPrefs ? (
            <View style={{ gap: 10, marginTop: 12 }}>
              <Notice>Your card shows your budget and move-in month. Set them first.</Notice>
              <OutlineButton label="Edit profile" onPress={() => navigation.navigate('EditProfile')} height={44} style={{ alignSelf: 'flex-start' }} />
            </View>
          ) : (
            <Text style={styles.fromProfile}>From your profile: {prefs}</Text>
          )}

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchTitle}>Show my card on the board</Text>
              <Text style={styles.hint}>Switch off any time and nobody sees it.</Text>
            </View>
            <Switch
              value={active}
              onValueChange={(v) => { haptics.tap(); setActive(v); }}
              trackColor={{ false: '#BDB6A8', true: colors.coralFill }}
              thumbColor="#FFFFFF"
              {...({ activeThumbColor: '#FFFFFF' } as object)}
              accessibilityLabel="Show my card on the board"
            />
          </View>

          <Text style={styles.label}>Area you want to live in</Text>
          <TextInput style={styles.field} value={area} onChangeText={setArea} placeholder="For example Dubai Marina" placeholderTextColor="#6B655A" maxLength={AREA_MAX} accessibilityLabel="Area you want to live in" />

          <Text style={styles.label}>About me (pick up to {MAX_TAGS})</Text>
          <View style={styles.chips}>
            {LIFESTYLE_OPTIONS.map((o) => {
              const on = lifestyle.includes(o.key);
              return (
                <Pressable key={o.key} style={[styles.chip, on && styles.chipOn]} onPress={() => toggleTag(o.key)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>A short note (optional)</Text>
          <TextInput
            style={[styles.field, styles.noteField]}
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="Your course, your routine, what you are looking for"
            placeholderTextColor="#6B655A"
            maxLength={NOTE_MAX}
            accessibilityLabel="A short note"
          />
          <Text style={styles.counter}>{note.length} / {NOTE_MAX}</Text>
          <Text style={styles.hint}>Do not put a phone number or email here. People message you through Havenly first.</Text>

          <Text style={styles.label}>Looking for housemates for a home? (optional)</Text>
          {homes.length === 0 ? (
            <Text style={styles.hint}>No whole homes are listed yet.</Text>
          ) : (
            <View style={styles.chips}>
              <Pressable style={[styles.chip, homeId == null && styles.chipOn]} onPress={() => setHomeId(null)} accessibilityRole="button" accessibilityState={{ selected: homeId == null }}>
                <Text style={[styles.chipText, homeId == null && styles.chipTextOn]}>No, any home</Text>
              </Pressable>
              {homes.map((h) => {
                const on = homeId === h.id;
                return (
                  <Pressable key={h.id} style={[styles.chip, on && styles.chipOn]} onPress={() => setHomeId(h.id)} accessibilityRole="button" accessibilityState={{ selected: on }}>
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{h.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {homeId ? (
            <View style={styles.stepper}>
              <Text style={styles.switchTitle}>Housemates I still need</Text>
              <View style={styles.stepperBtns}>
                <AnimatedPressable style={styles.stepBtn} onPress={() => setSpots((n) => Math.max(1, n - 1))} accessibilityRole="button" accessibilityLabel="Fewer"><Text style={styles.stepText}>−</Text></AnimatedPressable>
                <Text style={styles.stepValue}>{spots}</Text>
                <AnimatedPressable style={styles.stepBtn} onPress={() => setSpots((n) => Math.min(MAX_SPOTS, n + 1))} accessibilityRole="button" accessibilityLabel="More"><Text style={styles.stepText}>+</Text></AnimatedPressable>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>Who will see my card</Text>
          <Notice kind="note">{visibilityExplainer(profile?.gender, profile?.housemate_pref)}</Notice>
          <OutlineButton label="Change gender or who I would live with" onPress={() => navigation.navigate('EditProfile')} height={44} style={{ alignSelf: 'flex-start', marginTop: 10 }} />

          <Text style={styles.legal}>
            Housemates are for friends and students taking a whole home together on one lease, with the landlord’s agreement. Havenly does not
            list bed spaces or sublets. You must be 18 or over.
          </Text>

          <PrimaryButton label={card ? 'Save my card' : 'Publish my card'} onPress={save} loading={saving} style={{ marginTop: 16 }} />
          {card ? (
            <Pressable onPress={() => setRemoveConfirm(true)} accessibilityRole="button" style={styles.removeBtn}><Text style={styles.removeText}>Remove my card</Text></Pressable>
          ) : null}
        </View>
      </ScrollView>
      <ActionSheet
        visible={removeConfirm}
        onClose={() => setRemoveConfirm(false)}
        title="Remove your card?"
        message="It disappears from the board. You can make a new one later."
        actions={[{ label: 'Remove card', destructive: true, onPress: remove }]}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, letterSpacing: -0.4, color: colors.ink, flex: 1 },
    pad: { paddingHorizontal: spacing.lg },
    fromProfile: { fontSize: 14, color: colors.inkBody, marginTop: 12 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
    switchTitle: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    hint: { fontSize: 13, color: colors.inkSoft, marginTop: 4, lineHeight: 18 },
    label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.inkSoft, marginTop: 22, marginBottom: 8 },
    field: { minHeight: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
    noteField: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
    counter: { fontSize: 12, color: colors.inkMuted, textAlign: 'right', marginTop: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white },
    chipOn: { backgroundColor: colors.coralFill, borderColor: colors.coralFill },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
    chipTextOn: { color: '#FFFFFF' },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14 },
    stepperBtns: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.fieldLine, alignItems: 'center', justifyContent: 'center' },
    stepText: { fontSize: 22, color: colors.ink, lineHeight: 24 },
    stepValue: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 20, color: colors.ink, minWidth: 20, textAlign: 'center' },
    legal: { fontSize: 12.5, lineHeight: 18, color: colors.inkMuted, marginTop: 22 },
    removeBtn: { alignSelf: 'center', marginTop: 18, minHeight: 44, justifyContent: 'center' },
    removeText: { fontSize: 14, fontWeight: '700', color: colors.errorText },
  });
}
