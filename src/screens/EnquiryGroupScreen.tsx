import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Share, Pressable } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import InitialsAvatar from '@/components/InitialsAvatar';
import ActionSheet from '@/components/ActionSheet';
import Skeleton from '@/components/Skeleton';
import { Notice, OutlineButton, PrimaryButton, StateBlock } from '@/components/housing/parts';
import { billsInputOf, priceInfo } from '@/components/housing/listingModel';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { fetchGroup, leaveGroup, type GroupView } from '@/lib/groupEnquiryApi';
import { GROUP_MAX, canSendGroup, eachPersonLine, groupErrorMessage, groupStatusLine, shareMessage } from '@/lib/groupEnquiry';
import { splitRent } from '@/lib/rentSplit';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EnquiryGroup'>;

export default function EnquiryGroupScreen() {
  const navigation = useNavigation<Nav>();
  const { groupId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const myId = session?.user.id;

  const [group, setGroup] = useState<GroupView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      const g = await fetchGroup(groupId);
      setGroup(g);
      setState(g ? 'ready' : 'missing');
    } catch {
      setState('failed');
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const header = (
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
      <Text style={styles.title} accessibilityRole="header">Your group</Text>
    </View>
  );

  if (state === 'loading') {
    return <View style={styles.container} accessibilityLabel="Loading your group">{header}<Skeleton style={{ height: 160, marginHorizontal: 16, borderRadius: 14 }} /></View>;
  }
  if (state !== 'ready' || !group) {
    return (
      <View style={styles.container}>
        {header}
        <StateBlock
          icon="alert-circle" kind={state === 'failed' ? 'error' : 'note'}
          title={state === 'failed' ? 'We could not load this group' : 'This group is not available'}
          body={state === 'failed' ? 'Check your connection and try again.' : 'It may have been closed, or you may no longer be in it.'}
          primary={state === 'failed' ? { label: 'Try again', onPress: () => { setState('loading'); load(); } } : { label: 'Back', onPress: () => navigation.goBack() }}
        />
      </View>
    );
  }

  const isOrganiser = group.organiser_id === myId;
  const organiserName = group.members.find((m) => m.user_id === group.organiser_id)?.display_name ?? 'the organiser';
  const count = group.members.length;
  const rent = group.residence ? priceInfo(group.residence).now : null;
  const split = group.residence && rent != null && count >= 1 && count <= 10
    ? splitRent({ rentAed: rent, depositAed: group.residence.deposit_aed, feesAed: group.residence.move_in_fee_aed, bills: billsInputOf(group.residence), people: count })
    : null;
  const open = group.status === 'open';

  const shareCode = async () => {
    haptics.tap();
    const message = shareMessage(group.invite_code, group.residence?.name ?? 'a home');
    try {
      await Share.share({ message });
    } catch {
      await Clipboard.setStringAsync(message);
      showToast('Copied. Paste it into a message to your friends.');
    }
  };
  const copyCode = async () => { await Clipboard.setStringAsync(group.invite_code); haptics.success(); showToast('Code copied'); };

  const confirmLeave = async () => {
    try {
      await leaveGroup(group.id);
      showToast(isOrganiser ? 'The group was closed.' : 'You left the group.');
      navigation.goBack();
    } catch (e) {
      showToast(groupErrorMessage(e, 'Couldn’t do that. Try again.'), 'error');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.coral} />}
      >
        {header}
        <View style={styles.pad}>
          <View style={styles.card}>
            <Text style={styles.homeName}>{group.residence?.name ?? 'A home'}</Text>
            {group.residence ? <Text style={styles.meta}>{group.residence.area}</Text> : null}
            <Text style={styles.each}>{eachPersonLine(split, count)}</Text>
          </View>

          {open ? (
            <View style={[styles.card, { alignItems: 'center', gap: 10 }]}>
              <Text style={styles.codeLabel}>Invite code</Text>
              <Text style={styles.code} accessibilityLabel={`Invite code ${group.invite_code.split('').join(' ')}`} selectable>{group.invite_code}</Text>
              <View style={styles.codeButtons}>
                <OutlineButton label="Share the code" icon="send" onPress={shareCode} height={44} />
                <OutlineButton label="Copy" icon="copy" onPress={copyCode} height={44} />
              </View>
              <Text style={styles.hint}>Friends join from Profile, “Join with a code”. Up to {GROUP_MAX} people.</Text>
            </View>
          ) : null}

          <Text style={styles.section}>{count === 1 ? '1 person' : `${count} people`} in this group</Text>
          <View style={styles.card}>
            {group.members.map((m, i) => (
              <View key={m.user_id} style={[styles.memberRow, i > 0 && styles.divider]}>
                <InitialsAvatar name={m.display_name} style={styles.avatar} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>{m.display_name}{m.user_id === myId ? ' (you)' : ''}</Text>
                  {m.university ? <Text style={styles.meta} numberOfLines={1}>{m.university}</Text> : null}
                </View>
                {m.user_id === group.organiser_id ? <View style={styles.tag}><Text style={styles.tagText}>Started it</Text></View> : null}
              </View>
            ))}
          </View>

          <Notice kind="note" style={{ marginTop: 14 }}>{groupStatusLine(group.status, isOrganiser, organiserName, count)}</Notice>

          {open && isOrganiser ? (
            <PrimaryButton
              label={canSendGroup(count) ? 'Send the enquiry as a group' : 'Waiting for a friend to join'}
              disabled={!canSendGroup(count)}
              onPress={() => group.residence && navigation.navigate('HousingEnquiry', { residenceId: group.residence_id, kind: 'viewing', groupId: group.id })}
              style={{ marginTop: 14 }}
            />
          ) : null}
          {group.status === 'sent' ? <OutlineButton label="See my enquiries" onPress={() => navigation.navigate('MyEnquiries')} style={{ marginTop: 14 }} /> : null}
          {open ? (
            <Pressable onPress={() => setLeaveConfirm(true)} accessibilityRole="button" style={styles.leaveBtn}>
              <Text style={styles.leaveText}>{isOrganiser ? 'Close this group' : 'Leave this group'}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
      <ActionSheet
        visible={leaveConfirm}
        onClose={() => setLeaveConfirm(false)}
        title={isOrganiser ? 'Close this group?' : 'Leave this group?'}
        message={isOrganiser ? 'The code stops working and nobody else can join. You can start a new group later.' : 'You can join again with the code while the group is open.'}
        actions={[{ label: isOrganiser ? 'Close group' : 'Leave group', destructive: true, onPress: confirmLeave }]}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 26, letterSpacing: -0.5, color: colors.ink, flex: 1 },
    pad: { paddingHorizontal: spacing.lg, gap: 14 },
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 4 },
    homeName: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 20, color: colors.ink },
    meta: { fontSize: 13.5, color: colors.inkSoft },
    each: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 16, color: colors.ink, marginTop: 8 },
    codeLabel: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft },
    code: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 40, letterSpacing: 8, color: colors.ink },
    codeButtons: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
    hint: { fontSize: 13, color: colors.inkSoft, textAlign: 'center', lineHeight: 18 },
    section: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 19, color: colors.ink, marginTop: 8 },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    divider: { borderTopWidth: 1, borderTopColor: colors.line },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    name: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    tag: { backgroundColor: colors.tintBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
    tagText: { fontSize: 12, fontWeight: '700', color: colors.tintText },
    leaveBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 },
    leaveText: { fontSize: 14, fontWeight: '700', color: colors.errorText },
  });
}
