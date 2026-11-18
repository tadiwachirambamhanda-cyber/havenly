import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from '@/components/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import BackButton from '@/components/BackButton';
import Skeleton from '@/components/Skeleton';
import { OutlineButton, PrimaryButton, StateBlock } from '@/components/housing/parts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { reviewCard } from '@/lib/housematesApi';
import { LIFESTYLE_LABEL, budgetLine, genderLabel, type LifestyleKey } from '@/lib/housemates';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

interface PendingCard {
  user_id: string; display_name: string; university: string | null; gender: 'female' | 'male' | null;
  budget_aed: number | null; move_in_month: string | null; area: string | null; lifestyle: LifestyleKey[];
  note: string | null; active: boolean; residence_name: string | null; spots_needed: number | null;
}

// For the Havenly team: cards wait here until approved. Only admins can read other students' cards or approve them
// (the database refuses everyone else), so this screen is safe to be reachable only from the team section of Settings.
export default function HousemateReviewScreen() {
  const insets = useSafeAreaInsets();
  const { profile: me } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<PendingCard[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('pending_housemate_cards');
    if (error) { setFailed(true); setRows([]); return; }
    setFailed(false);
    setRows((data as PendingCard[]) ?? []);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (card: PendingCard, status: 'approved' | 'hidden') => {
    setBusy(card.user_id);
    try {
      await reviewCard(card.user_id, status, status === 'hidden' ? 'Does not meet the housemate rules.' : undefined);
      setRows((prev) => (prev ? prev.filter((c) => c.user_id !== card.user_id) : prev));
      showToast(status === 'approved' ? 'Approved' : 'Hidden');
    } catch {
      showToast('Couldn’t save that. Try again.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const header = (
    <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
      <BackButton style={styles.back}><Icon name="arrow-left" size={17} color={colors.ink} /></BackButton>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} accessibilityRole="header">Housemate cards to check</Text>
        <Text style={styles.sub}>{rows ? `${rows.length} waiting` : ' '}</Text>
      </View>
    </View>
  );

  let empty: React.ReactNode = null;
  if (!me?.is_admin) empty = <StateBlock icon="lock" title="Team only" body="Only the Havenly team can check housemate cards." />;
  else if (rows === null) empty = <View>{[0, 1].map((i) => <Skeleton key={i} style={{ height: 150, marginHorizontal: 16, marginBottom: 12, borderRadius: 14 }} />)}</View>;
  else if (failed) empty = <StateBlock icon="alert-circle" kind="error" title="We could not load the cards" body="Check your connection and try again." primary={{ label: 'Try again', onPress: () => { setRows(null); load(); } }} />;
  else if (rows.length === 0) empty = <StateBlock icon="check-circle" title="All caught up" body="No housemate cards are waiting for a check." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={me?.is_admin ? rows ?? [] : []}
        keyExtractor={(c) => c.user_id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty ? <View>{empty}</View> : undefined}
        contentContainerStyle={{ paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.coral} />}
        renderItem={({ item }) => {
          return (
            <View style={styles.card}>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.meta}>{[genderLabel(item.gender), item.university].filter(Boolean).join(' · ') || 'No gender or university given'}</Text>
              {item.budget_aed != null && item.move_in_month ? <Text style={styles.line}>{budgetLine({ budget_aed: item.budget_aed, move_in_month: item.move_in_month })}</Text> : <Text style={styles.warn}>No budget or move-in month on the profile</Text>}
              {item.area ? <Text style={styles.meta}>Area: {item.area}</Text> : null}
              {item.residence_name ? <Text style={styles.meta}>{`For ${item.residence_name}${item.spots_needed ? `, needs ${item.spots_needed}` : ''}`}</Text> : null}
              {item.lifestyle.length > 0 ? <Text style={styles.meta}>{item.lifestyle.map((k) => LIFESTYLE_LABEL[k]).join(', ')}</Text> : null}
              {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
              <View style={styles.actions}>
                <PrimaryButton label="Approve" onPress={() => decide(item, 'approved')} loading={busy === item.user_id} height={48} style={{ flex: 1 }} />
                <OutlineButton label="Hide" onPress={() => decide(item, 'hidden')} disabled={busy === item.user_id} height={48} style={{ flex: 1 }} />
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingBottom: 12 },
    back: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    title: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 22, letterSpacing: -0.4, color: colors.ink },
    sub: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginHorizontal: spacing.lg, marginBottom: 14, padding: 16, gap: 4 },
    name: { fontFamily: 'SchibstedGrotesk_700Bold', fontSize: 18, color: colors.ink },
    meta: { fontSize: 13.5, color: colors.inkSoft },
    line: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 14.5, color: colors.ink },
    warn: { fontSize: 13.5, color: colors.errorText },
    note: { fontSize: 14, lineHeight: 20, color: colors.inkBody, marginTop: 4, padding: 10, backgroundColor: colors.sandDeep, borderRadius: radius.sm },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  });
}
