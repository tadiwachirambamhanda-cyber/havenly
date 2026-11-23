import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '@/components/Text';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import { Notice, PrimaryButton } from '@/components/housing/parts';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { createGroup, lastEnquiryPhone } from '@/lib/groupEnquiryApi';
import { groupErrorMessage, phoneProblem } from '@/lib/groupEnquiry';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StartGroup'>;

// Step one for the student who starts a group: confirm the phone number the team can reach them on.
export default function StartGroupScreen() {
  const navigation = useNavigation<Nav>();
  const { residenceId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (myId) lastEnquiryPhone(myId).then((p) => setPhone((cur) => cur || p));
  }, [myId]);

  const start = async () => {
    setError(null);
    const problem = phoneProblem(phone);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      const g = await createGroup(residenceId, phone);
      navigation.replace('EnquiryGroup', { groupId: g.group_id });
    } catch (e) {
      setError(groupErrorMessage(e, 'We could not start the group. Check your connection and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
          <Text style={styles.title} accessibilityRole="header">Enquire with friends</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: 14 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.body}>
            You start a group for this home and get a 6-character code. Your friends join with it, you all see what each person would pay, and you send one enquiry to the Havenly team for the whole group.
          </Text>
          <Notice kind="note">The team sees every member’s name, university and phone number. Other students only see names.</Notice>
          <View>
            <Text style={styles.label}>Your phone or WhatsApp number</Text>
            <TextInput
              style={styles.field}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+971 50 123 4567"
              placeholderTextColor="#6B655A"
              maxLength={20}
              accessibilityLabel="Your phone or WhatsApp number"
              onSubmitEditing={start}
            />
          </View>
          {error ? <Notice>{error}</Notice> : null}
          <PrimaryButton label="Start the group" onPress={start} loading={busy} />
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
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 24, letterSpacing: -0.4, color: colors.ink, flex: 1 },
    body: { fontSize: 15, lineHeight: 22, color: colors.inkBody },
    label: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.inkSoft, marginBottom: 8 },
    field: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  });
}
