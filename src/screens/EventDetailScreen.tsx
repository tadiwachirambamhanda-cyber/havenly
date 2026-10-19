import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Text';
import BackButton from '@/components/BackButton';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import InitialsAvatar from '@/components/InitialsAvatar';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { createCheckIn, deleteCheckIn, sendPing } from '@/lib/checkIns';
import { toggleInterest } from '@/lib/interests';
import AnimatedPressable from '@/components/AnimatedPressable';
import ActionSheet from '@/components/ActionSheet';
import Skeleton from '@/components/Skeleton';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { CheckIn, HavenlyEvent, PlaceInterest, Profile } from '@/types';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type VisibleCheckIn = CheckIn & { user: Profile };
type VisibleInterest = PlaceInterest & { user: Profile };

type Route = RouteProp<RootStackParamList, 'EventDetail'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function EventDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { eventId } = route.params;
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);


  const [event, setEvent] = useState<HavenlyEvent | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [checkIns, setCheckIns] = useState<VisibleCheckIn[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [interests, setInterests] = useState<VisibleInterest[]>([]);
  const [togglingInterest, setTogglingInterest] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  const load = useCallback(async () => {
    const now = new Date().toISOString();
    const [{ data: eventData }, { data: checkInData }, { data: interestData }] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
      supabase.from('check_ins').select('*, user:profiles(*)').eq('place_type', 'event').eq('place_id', eventId).gt('expires_at', now),
      supabase.from('interests').select('*, user:profiles(*)').eq('place_type', 'event').eq('place_id', eventId),
    ]);
    setEvent(eventData as HavenlyEvent | null);
    setCheckIns((checkInData as unknown as VisibleCheckIn[]) ?? []);
    setInterests((interestData as unknown as VisibleInterest[]) ?? []);
    setLoaded(true);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const myCheckIn = checkIns.find((c) => c.user_id === profile?.id) ?? null;
  const myInterest = interests.find((i) => i.user_id === profile?.id) ?? null;

  const toggleGoing = async () => {
    if (!profile || togglingInterest) return;
    setTogglingInterest(true);
    haptics.tap();
    try {
      await toggleInterest('event', eventId);
      await load();
    } catch {
      showToast('Couldn’t update. Try again.', 'error');
    } finally {
      setTogglingInterest(false);
    }
  };

  const toggleCheckIn = async () => {
    if (!profile || checkingIn) return;
    setCheckingIn(true);
    haptics.tap();
    try {
      if (myCheckIn) await deleteCheckIn(myCheckIn.id);
      else await createCheckIn(profile.id, 'event', eventId);
      await load();
    } catch {
      showToast('Couldn’t update your check-in. Try again.', 'error');
    } finally {
      setCheckingIn(false);
    }
  };

  const ping = async (checkIn: VisibleCheckIn) => {
    setPingingId(checkIn.id);
    try {
      await sendPing(checkIn.id);
      haptics.success();
      showToast(`Pinged ${checkIn.user.display_name}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Couldn’t send ping.', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!event) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      showToast('Couldn’t delete this event.', 'error');
      return;
    }
    haptics.success();
    showToast('Event deleted');
    navigation.goBack();
  };

  if (!loaded) {
    return (
      <View style={styles.container}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Skeleton style={{ height: 200, borderRadius: 0 }} />
        <View style={styles.body}>
          <Skeleton style={{ height: 11, width: '25%' }} />
          <Skeleton style={{ height: 22, width: '75%', marginTop: 8 }} />
          <Skeleton style={{ height: 14, width: '55%', marginTop: 14 }} />
          <Skeleton style={{ height: 14, width: '40%', marginTop: 8 }} />
          <Skeleton style={{ height: 48, width: '100%', marginTop: 20, borderRadius: radius.button }} />
        </View>
      </View>
    );
  }
  if (!event) {
    return (
      <View style={styles.notFound}>
        <BackButton style={styles.back}>
          <Icon name="arrow-left" size={17} color={colors.ink} />
        </BackButton>
        <Text style={styles.notFoundText}>This event isn’t available.</Text>
      </View>
    );
  }

  const date = new Date(event.event_date);
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const monthLabel = date.toLocaleDateString('en-US', { month: 'short' });

  return (
    <Animated.ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <BackButton style={styles.back}>
        <Icon name="arrow-left" size={17} color={colors.ink} />
      </BackButton>
      {profile?.is_admin && (
        <Pressable hitSlop={8} style={styles.overflow} onPress={() => setDeleteConfirmVisible(true)} accessibilityLabel="More options">
          <Icon name="more-horizontal" size={17} color={colors.ink} />
        </Pressable>
      )}
      {/* Events have no photo, so the top of the page is the date itself
          rather than a decorative colour block. */}
      <View style={styles.dateHeader}>
        <View style={styles.datePlaque}>
          <Text style={styles.dateMonth}>{monthLabel}</Text>
          <Text style={styles.dateDay}>{date.getDate()}</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.tag}>{event.tag}</Text>
        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.metaRow}>
          <Icon name="calendar" size={13} color={colors.teal} />
          <Text style={styles.metaText}>{dateLabel} · {timeLabel}</Text>
        </View>
        <View style={styles.metaRow}>
          <Icon name="map-pin" size={13} color={colors.teal} />
          <Text style={styles.metaText}>{event.location}</Text>
        </View>

        {event.description ? <Text style={styles.description}>{event.description}</Text> : null}

        <View style={styles.section}>
          <AnimatedPressable
            style={[styles.goingBtn, myInterest && styles.goingBtnActive]}
            onPress={toggleGoing}
            disabled={togglingInterest}
            accessibilityLabel={myInterest ? "Not down to go anymore" : "I'm down to go"}
          >
            {togglingInterest ? (
              <ActivityIndicator size="small" color={myInterest ? colors.gold : colors.ink} />
            ) : (
              <>
                <Icon name="thumbs-up" size={14} color={myInterest ? colors.gold : colors.ink} weight={myInterest ? 'fill' : undefined} />
                <Text style={[styles.goingBtnText, myInterest && styles.goingBtnTextActive]}>
                  {myInterest ? "You're down to go" : "I'm down to go"}
                </Text>
              </>
            )}
          </AnimatedPressable>
          {interests.length > 0 && (
            <View style={styles.goingList}>
              {interests.slice(0, 8).map((i) => (
                i.user.avatar_url ? (
                  <Image key={i.id} source={{ uri: i.user.avatar_url }} style={styles.goingAvatar} transition={200} />
                ) : (
                  <InitialsAvatar key={i.id} name={i.user.display_name} style={styles.goingAvatar} />
                )
              ))}
              <Text style={styles.goingListText}>
                {interests.length} {interests.length === 1 ? 'person' : 'people'} down to go
              </Text>
            </View>
          )}

          {event.latitude != null && event.longitude != null && (
            <>
              <AnimatedPressable
                style={[styles.checkInBtn, myCheckIn && styles.checkInBtnActive]}
                onPress={toggleCheckIn}
                disabled={checkingIn}
                accessibilityLabel={myCheckIn ? 'Check out' : 'Check in here'}
              >
                {checkingIn ? (
                  <ActivityIndicator size="small" color={myCheckIn ? colors.coral : 'white'} />
                ) : (
                  <>
                    <Icon name="map-pin" size={14} color={myCheckIn ? colors.coral : 'white'} />
                    <Text style={[styles.checkInBtnText, myCheckIn && styles.checkInBtnTextActive]}>
                      {myCheckIn ? 'You’re checked in' : 'Check in here'}
                    </Text>
                  </>
                )}
              </AnimatedPressable>

              {checkIns.length > 0 && (
                <View style={styles.checkInList}>
                  <Text style={styles.checkInListLabel}>{checkIns.length} checked in nearby</Text>
                  {checkIns.map((c) => (
                    <View key={c.id} style={styles.checkInRow}>
                      {c.user.avatar_url ? (
                        <Image source={{ uri: c.user.avatar_url }} style={styles.checkInAvatar} transition={200} />
                      ) : (
                        <InitialsAvatar name={c.user.display_name} style={styles.checkInAvatar} />
                      )}
                      <Text style={styles.checkInName}>{c.user.display_name}{c.user_id === profile?.id ? ' (you)' : ''}</Text>
                      {c.user_id !== profile?.id && (
                        <Pressable
                          style={styles.pingBtn}
                          onPress={() => ping(c)}
                          disabled={pingingId === c.id}
                          accessibilityLabel={`Ping ${c.user.display_name}`}
                        >
                          {pingingId === c.id ? (
                            <ActivityIndicator size="small" color={colors.ink} />
                          ) : (
                            <>
                              <Icon name="hand-waving" size={13} color={colors.ink} />
                              <Text style={styles.pingBtnText}>Ping</Text>
                            </>
                          )}
                        </Pressable>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </View>
      <ActionSheet
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        title="Delete this event?"
        message="This can't be undone."
        actions={[{ label: 'Delete', destructive: true, onPress: confirmDelete }]}
      />
    </Animated.ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  centered: { flex: 1, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  notFound: { flex: 1, backgroundColor: colors.sand, paddingTop: 60, paddingHorizontal: spacing.lg },
  notFoundText: { color: colors.inkSoft, textAlign: 'center', marginTop: 100 },
  back: {
    position: 'absolute', top: 50, left: 16, zIndex: 1, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  overflow: {
    position: 'absolute', top: 50, right: 16, zIndex: 1, width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
  },
  dateHeader: { paddingTop: 96, paddingHorizontal: spacing.lg },
  datePlaque: {
    alignSelf: 'flex-start', minWidth: 64, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white,
  },
  dateMonth: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.coral },
  dateDay: { fontFamily: 'Fraunces_600SemiBold', fontSize: 30, color: colors.ink, lineHeight: 34 },
  body: { padding: spacing.lg },
  tag: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.teal },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 22, color: colors.ink, marginTop: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  metaText: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  description: { fontSize: 13.5, color: colors.inkSoft, lineHeight: 20, marginTop: 14 },
  section: { marginTop: 24, paddingTop: 20, borderTopWidth: 1, borderColor: colors.line },
  goingBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.sandDeep,
    paddingVertical: 13, borderRadius: radius.button, borderWidth: 1.5, borderColor: colors.line,
  },
  goingBtnActive: { backgroundColor: `${colors.gold}26`, borderColor: colors.gold },
  goingBtnText: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  goingBtnTextActive: { color: colors.gold },
  goingList: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  goingAvatar: { width: 24, height: 24, borderRadius: 12, marginLeft: -8, borderWidth: 2, borderColor: colors.sand },
  goingListText: { marginLeft: 6, fontSize: 11.5, color: colors.inkSoft, fontWeight: '600' },
  checkInBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.teal,
    paddingVertical: 13, borderRadius: radius.button, marginTop: 20,
  },
  checkInBtnActive: { backgroundColor: colors.tealSoft, borderWidth: 1.5, borderColor: colors.teal },
  checkInBtnText: { color: 'white', fontWeight: '700', fontSize: 13.5 },
  checkInBtnTextActive: { color: colors.teal },
  checkInList: { marginTop: 18 },
  checkInListLabel: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, marginBottom: 10,
  },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  checkInAvatar: { width: 32, height: 32, borderRadius: 16 },
  checkInName: { flex: 1, fontSize: 12.5, fontWeight: '600', color: colors.ink },
  pingBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.button, backgroundColor: colors.sandDeep, borderWidth: 1, borderColor: colors.line },
  pingBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.ink },
  });
}
