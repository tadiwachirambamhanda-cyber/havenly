import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { formatAed, formatMonth, PERIOD_LABEL, upcomingMonths } from '@/lib/housing';
import AnimatedPressable from '@/components/AnimatedPressable';
import { Notice, PrimaryButton } from '@/components/housing/parts';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { EnquiryKind, Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'HousingEnquiry'>;

const DURATIONS = [3, 6, 10, 12];
const VIEWING_TIMES = ['Weekday mornings', 'Weekday evenings', 'Weekends', 'Any time'];
const PHONE_RE = /^\+?[\d\s()-]{8,20}$/;

export default function HousingEnquiryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const { residenceId } = route.params;
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;
  const months = useMemo(() => upcomingMonths(9), []);

  const [residence, setResidence] = useState<Residence | null>(null);
  const [kind, setKind] = useState<EnquiryKind>(route.params.kind);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [moveIn, setMoveIn] = useState<string>(months[1]);
  const [duration, setDuration] = useState(12);
  const [budget, setBudget] = useState('');
  const [phone, setPhone] = useState('');
  const [viewingTime, setViewingTime] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    supabase.from('residences').select('*, room_types(*)').eq('id', residenceId).maybeSingle()
      .then(({ data, error: loadErr }) => {
        if (loadErr) setLoadError(true);
        else setResidence(data as Residence | null);
      });
    // Saves retyping a phone number on every enquiry after the first.
    if (myId) {
      supabase.from('housing_enquiries').select('contact_phone').eq('user_id', myId)
        .order('created_at', { ascending: false }).limit(1)
        .then(({ data }) => {
          const last = (data as { contact_phone: string }[] | null)?.[0]?.contact_phone;
          if (last) setPhone((cur) => cur || last);
        });
    }
  }, [residenceId, myId]);

  const allowLeave = useConfirmDiscard(!sent && (message.trim() !== '' || budget.trim() !== ''));

  const availableRooms = (residence?.room_types ?? []).filter((r) => r.is_available);

  const send = async () => {
    setError(null);
    if (!myId) return;
    const cleanPhone = phone.trim();
    if (!PHONE_RE.test(cleanPhone)) return setError('Add a phone or WhatsApp number so the residence can reach you, e.g. +971 50 123 4567.');
    if (kind === 'question' && !message.trim()) return setError('Write your question so the residence knows what to answer.');
    if (kind === 'viewing' && !viewingTime) return setError('Pick when you’re free for a viewing.');
    let budgetValue: number | null = null;
    if (budget.trim()) {
      const cleanBudget = budget.trim();
      // Whole AED only: digits, or digits grouped with commas. A minus sign or decimal is refused, not rewritten.
      budgetValue = /^(\d+|\d{1,3}(,\d{3})+)$/.test(cleanBudget) ? Number(cleanBudget.replace(/,/g, '')) : NaN;
      if (!Number.isFinite(budgetValue) || budgetValue <= 0 || budgetValue > 10_000_000) return setError('Budget should be a number in AED per year, e.g. 45000.');
    }

    setSending(true);
    const { error: insertError } = await supabase.from('housing_enquiries').insert({
      user_id: myId,
      residence_id: residenceId,
      room_type_id: roomTypeId,
      kind,
      move_in_month: moveIn,
      duration_months: duration,
      budget_aed: budgetValue,
      contact_phone: cleanPhone,
      message: message.trim() || null,
      preferred_viewing: kind === 'viewing' ? viewingTime : null,
    });
    setSending(false);

    if (insertError) {
      setError('Couldn’t send your enquiry. Check your connection and try again.');
      return;
    }
    haptics.success();
    setSent(true);
    allowLeave();
    // Replaces this form with a confirmation that says what happens next;
    // going back from there returns to the residence.
    navigation.replace('HousingEnquirySent', { residenceName: residence?.name ?? 'the residence', kind, moveIn });
  };

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <AnimatedPressable key={key} style={[styles.chip, selected && styles.chipSelected]} onPress={() => { haptics.tap(); onPress(); }}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </AnimatedPressable>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <AnimatedPressable onPress={() => navigation.goBack()} accessibilityLabel="Cancel"><Text style={styles.headerBtn}>Cancel</Text></AnimatedPressable>
          <Text style={styles.headerTitle} numberOfLines={1}>{residence?.name ?? 'Enquiry'}</Text>
          <View style={{ width: 50 }} />
        </View>

        <View style={styles.segment}>
          {(['viewing', 'question'] as EnquiryKind[]).map((k) => (
            <AnimatedPressable
              key={k}
              style={[styles.segmentItem, kind === k && styles.segmentItemActive]}
              onPress={() => { haptics.tap(); setKind(k); }}
            >
              <Text style={[styles.segmentText, kind === k && styles.segmentTextActive]}>
                {k === 'viewing' ? 'Book a viewing' : 'Ask a question'}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        {availableRooms.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Room</Text>
            <View style={styles.chipGrid}>
              {chip('any', 'Not sure yet', roomTypeId === null, () => setRoomTypeId(null))}
              {availableRooms.map((r) => chip(
                r.id,
                `${r.name} · ${formatAed(r.price_aed)}/${PERIOD_LABEL[r.billing_period]}`,
                roomTypeId === r.id,
                () => setRoomTypeId(r.id),
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Moving in</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {months.map((m) => chip(m, formatMonth(m), moveIn === m, () => setMoveIn(m)))}
        </ScrollView>

        <Text style={styles.sectionLabel}>Staying for</Text>
        <View style={styles.chipGrid}>
          {DURATIONS.map((d) => chip(String(d), `${d} months`, duration === d, () => setDuration(d)))}
        </View>

        {kind === 'viewing' && (
          <>
            <Text style={styles.sectionLabel}>Free for a viewing</Text>
            <View style={styles.chipGrid}>
              {VIEWING_TIMES.map((t) => chip(t, t, viewingTime === t, () => setViewingTime(t)))}
            </View>
          </>
        )}

        <Text style={styles.sectionLabel}>Phone or WhatsApp</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="+971 50 123 4567"
          placeholderTextColor={colors.inkSoft}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={20}
        />

        <Text style={styles.sectionLabel}>Budget per year (optional)</Text>
        <TextInput
          style={styles.fieldInput}
          placeholder="e.g. 45000"
          placeholderTextColor={colors.inkSoft}
          value={budget}
          onChangeText={setBudget}
          keyboardType="number-pad"
          maxLength={9}
        />

        <Text style={styles.sectionLabel}>{kind === 'question' ? 'Your question' : 'Anything else (optional)'}</Text>
        <TextInput
          style={styles.bodyInput}
          placeholder={kind === 'question' ? 'e.g. Is there a shuttle to my campus?' : 'e.g. I’d like to see a twin room'}
          placeholderTextColor={colors.inkSoft}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={600}
        />

        <Text style={styles.consent}>
          We’ll share your name, phone number and these details with {residence?.provider_name ?? 'the residence'} so they can contact you. Havenly is free for students.
        </Text>

        {loadError ? <Notice style={styles.noticeGap}>We could not load this place. You can still send your enquiry, or go back and try again.</Notice> : null}
        {error ? <Notice style={styles.noticeGap}>{error}</Notice> : null}

        <PrimaryButton
          label={kind === 'viewing' ? 'Request viewing' : 'Send question'}
          onPress={send}
          loading={sending}
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.lg }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: spacing.md,
    },
    headerTitle: { flex: 1, textAlign: 'center', fontFamily: 'SchibstedGrotesk_600SemiBold', fontSize: 17, color: colors.ink },
    headerBtn: { width: 60, fontSize: 15, fontWeight: '600', color: colors.ink, minHeight: 44, lineHeight: 44 },
    segment: {
      flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: 4,
      backgroundColor: colors.sandDeep, borderRadius: radius.pill,
    },
    segmentItem: { flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center' },
    segmentItemActive: { backgroundColor: colors.coralFill },
    segmentText: { fontSize: 13, fontWeight: '600', color: colors.inkSoft },
    segmentTextActive: { color: '#FFFFFF', fontWeight: '700' },
    sectionLabel: {
      fontFamily: 'HankenGrotesk_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 10,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.lg },
    chipRow: { gap: 8, paddingHorizontal: spacing.lg },
    chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white },
    chipSelected: { backgroundColor: colors.coralFill, borderColor: colors.coralFill },
    chipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
    chipTextSelected: { color: '#FFFFFF' },
    fieldInput: {
      marginHorizontal: spacing.lg, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.fieldLine, borderRadius: radius.md, paddingHorizontal: 14, height: 52, fontSize: 16, color: colors.ink,
    },
    bodyInput: {
      marginHorizontal: spacing.lg, minHeight: 90, backgroundColor: colors.white, borderWidth: 1,
      borderColor: colors.fieldLine, borderRadius: radius.md, padding: 14, fontSize: 16, color: colors.ink, textAlignVertical: 'top',
    },
    consent: { fontSize: 13, color: colors.inkMuted, lineHeight: 17, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
    noticeGap: { marginHorizontal: spacing.lg, marginTop: 14 },
  });
}
