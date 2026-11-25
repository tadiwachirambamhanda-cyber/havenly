import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import { Notice, OutlineButton, PrimaryButton } from '@/components/housing/parts';
import { billsInputOf, priceInfo } from '@/components/housing/listingModel';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { haptics } from '@/lib/haptics';
import { joinGroup, lastEnquiryPhone, previewGroup, type GroupPreview } from '@/lib/groupEnquiryApi';
import { GROUP_MAX, cleanCode, codeProblem, eachPersonLine, groupErrorMessage, phoneProblem } from '@/lib/groupEnquiry';
import { splitRent } from '@/lib/rentSplit';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { Residence } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// A friend joins a group: type the code, see the home and who started it, add a phone number, join.
export default function JoinGroupScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [home, setHome] = useState<Residence | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (myId) lastEnquiryPhone(myId).then((p) => setPhone((cur) => cur || p));
  }, [myId]);

  const find = async () => {
    setError(null);
    setPreview(null);
    setHome(null);
    const problem = codeProblem(code);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const p = await previewGroup(cleanCode(code));
      if (!p) { setError('That code does not match a group. Check it with your friend.'); return; }
      if (p.status !== 'open') { setError('This group is no longer open.'); return; }
      const { data } = await supabase.from('residences').select('*, room_types(*)').eq('id', p.residence_id).maybeSingle();
      setHome((data as Residence | null) ?? null);
      setPreview(p);
    } catch (e) {
      setError(groupErrorMessage(e, 'We could not look that code up. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setError(null);
    const problem = phoneProblem(phone);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const groupId = await joinGroup(cleanCode(code), phone);
      haptics.success();
      navigation.replace('EnquiryGroup', { groupId });
    } catch (e) {
      setError(groupErrorMessage(e, 'We could not add you to the group. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const rent = home ? priceInfo(home).now : null;
  const peopleAfter = preview ? preview.members + 1 : 0;
  const split = home && rent != null && peopleAfter >= 1 && peopleAfter <= 10
    ? splitRent({ rentAed: rent, depositAed: home.deposit_aed, feesAed: home.move_in_fee_aed, bills: billsInputOf(home), people: peopleAfter })
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title} accessibilityRole="header">Join with a code</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text style={styles.label}>Group code</Text>
            <TextInput
              style={[styles.field, styles.codeField]}
              value={code}
              onChangeText={(t) => { setCode(cleanCode(t).slice(0, 6)); setPreview(null); setHome(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="ABC234"
              placeholderTextColor={colors.inkSoft}
              maxLength={7}
              accessibilityLabel="Group code"
              onSubmitEditing={find}
              editable={!preview}
            />
          </View>

          {!preview ? <PrimaryButton label="Find the group" onPress={find} loading={busy} /> : null}

          {preview ? (
            <>
              <View style={styles.card}>
                <Text style={styles.homeName}>{preview.residence_name}</Text>
                {home ? <Text style={styles.meta}>{home.area}</Text> : null}
                <Text style={styles.meta}>Started by {preview.organiser_name}, {preview.members === 1 ? '1 person' : `${preview.members} people`} so far (up to {GROUP_MAX}).</Text>
                <Text style={styles.each}>{eachPersonLine(split, peopleAfter)} with you</Text>
              </View>
              <Notice kind="note">The team sees every member’s name, university and phone number. Other students only see names.</Notice>
              <View>
                <Text style={styles.label}>Your phone or WhatsApp number</Text>
                <TextInput
                  style={styles.field}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="+971 50 123 4567"
                  placeholderTextColor={colors.inkSoft}
                  maxLength={20}
                  accessibilityLabel="Your phone or WhatsApp number"
                />
              </View>
              <PrimaryButton label="Join the group" onPress={join} loading={busy} />
              <OutlineButton label="Use a different code" onPress={() => { setPreview(null); setHome(null); setCode(''); }} />
            </>
          ) : null}

          {error ? <Notice>{error}</Notice> : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 24, letterSpacing: -0.4, color: colors.ink, flex: 1 },
    label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.inkSoft, marginBottom: 8 },
    field: { height: 52, borderRadius: 16, borderWidth: 1.5, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
    codeField: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 26, letterSpacing: 6, textAlign: 'center' },
    card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 4 },
    homeName: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 20, color: colors.ink },
    meta: { fontSize: 13.5, lineHeight: 19, color: colors.inkSoft },
    each: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink, marginTop: 8 },
  });
}
