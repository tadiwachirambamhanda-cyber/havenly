import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import { OutlineButton, PrimaryButton, StateBlock } from '@/components/housing/parts';
import { BOLD, CardSkeletons, Content, GUTTER, ScreenTop } from '@/components/community/ui';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { friendlyError, reasonLabel, reportedTimes, timeAgo } from '@/lib/community';
import { decideReport, fetchReviewQueue } from '@/lib/communityApi';
import type { ReviewItem } from '@/types';
import type { ColorTokens } from '@/theme/tokens';

// The team's review queue (F24). Reporters are never shown. Hide or Keep shows its result with Undo at once;
// the decision is sent after 6 seconds, or straight away when the team member leaves this screen.
const UNDO_MS = 6000;
const KIND: Record<ReviewItem['target_type'], string> = { post: 'Post', comment: 'Comment', event: 'Event' };

type Decision = 'hide' | 'keep';
interface Decided { decision: Decision; sent: boolean }

const keyOf = (it: Pick<ReviewItem, 'target_type' | 'target_id'>) => `${it.target_type}:${it.target_id}`;

export default function ReviewQueueScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const s = useMemo(() => styles(colors), [colors]);
  const [items, setItems] = useState<ReviewItem[] | null | 'failed'>(null);
  const [decided, setDecided] = useState<Record<string, Decided>>({});
  const [refreshing, setRefreshing] = useState(false);
  const timers = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; item: ReviewItem; decision: Decision }>());

  const load = useCallback(async () => {
    try { setItems(await fetchReviewQueue()); } catch { setItems('failed'); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = useCallback(async (item: ReviewItem, decision: Decision) => {
    const k = keyOf(item);
    timers.current.delete(k);
    try {
      await decideReport(item.target_type, item.target_id, decision);
      setDecided((prev) => (prev[k] ? { ...prev, [k]: { decision, sent: true } } : prev));
    } catch (e) {
      setDecided((prev) => { const n = { ...prev }; delete n[k]; return n; });
      showToast(friendlyError(e, 'Couldn’t save the decision. Try again.'), 'error');
    }
  }, [showToast]);

  // Leaving the screen sends every decision still waiting.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const { timer, item, decision } of pending.values()) {
        clearTimeout(timer);
        decideReport(item.target_type, item.target_id, decision).catch(() => undefined);
      }
      pending.clear();
    };
  }, []);

  const decide = (item: ReviewItem, decision: Decision) => {
    const k = keyOf(item);
    setDecided((prev) => ({ ...prev, [k]: { decision, sent: false } }));
    const timer = setTimeout(() => send(item, decision), UNDO_MS);
    timers.current.set(k, { timer, item, decision });
  };

  const undo = (item: ReviewItem) => {
    const k = keyOf(item);
    const t = timers.current.get(k);
    if (t) { clearTimeout(t.timer); timers.current.delete(k); }
    setDecided((prev) => { const n = { ...prev }; delete n[k]; return n; });
  };

  const open = Array.isArray(items) ? items.filter((it) => !decided[keyOf(it)]?.sent).length : 0;

  let empty: React.ReactNode = null;
  if (!profile?.is_admin) empty = <StateBlock icon="lock" title="For the Havenly team" body="Only the team can review reports." />;
  else if (items === null) empty = <CardSkeletons count={3} height={170} />;
  else if (items === 'failed') empty = <StateBlock icon="alert-circle" kind="error" title="We could not load the queue" body="Check your connection and try again." primary={{ label: 'Try again', onPress: () => { setItems(null); load(); } }} />;
  else if (!items.length) empty = <StateBlock icon="check-circle" title="Nothing to review" body="New reports show up here." />;

  return (
    <View style={s.container}>
      <FlatList
        data={profile?.is_admin && Array.isArray(items) ? items : []}
        keyExtractor={keyOf}
        ListHeaderComponent={
          <Content style={{ paddingTop: insets.top + 10 }}>
            <ScreenTop title="Review queue" sub={Array.isArray(items) ? (open === 1 ? '1 to review' : `${open} to review`) : undefined} />
            <Text style={s.intro}>Reported posts, comments and events. Anything reported by 3 different students is hidden until you decide. Reporters are never shown to the person reported.</Text>
          </Content>
        }
        ListEmptyComponent={empty ? <Content>{empty}</Content> : undefined}
        renderItem={({ item }) => {
          const d = decided[keyOf(item)];
          return (
            <Content>
              <View style={s.card}>
                <View style={s.tags}>
                  <Text style={s.kind}>{KIND[item.target_type]}</Text>
                  <View style={s.reported}><Icon name="alert-triangle" size={13} color={colors.errorText} /><Text style={s.reportedText}>{reportedTimes(item.reports)}</Text></View>
                  {item.hidden_at ? <View style={s.hiddenTag}><Text style={s.hiddenText}>Hidden by reports</Text></View> : null}
                </View>
                <Text style={s.where}>
                  {[item.community_name ? `In ${item.community_name}` : null, item.author_name ? `by ${item.author_name}` : item.target_type === 'event' ? 'by the Havenly team' : null, `first reported ${timeAgo(item.first_reported)} ago`].filter(Boolean).join(' · ')}
                </Text>
                <Text style={s.text} numberOfLines={8}>{item.content ?? '(no text)'}</Text>
                <Text style={s.reasons}>Reasons: {item.reasons.map(reasonLabel).join(', ')}</Text>
                {d ? (
                  <View style={s.done}>
                    <Icon name="check" size={16} color={colors.mintText} />
                    <Text style={s.doneText}>{d.decision === 'hide' ? 'Hidden for everyone' : 'Kept and visible'}{d.sent ? '' : ' · saving in a moment'}</Text>
                    {!d.sent ? (
                      <Pressable onPress={() => undo(item)} accessibilityRole="button" accessibilityLabel="Undo" style={s.undo}>
                        <Text style={s.undoText}>Undo</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <View style={s.buttons}>
                    <PrimaryButton label="Hide" onPress={() => decide(item, 'hide')} height={48} style={{ flex: 1, borderRadius: 24 }} />
                    <OutlineButton label="Keep" onPress={() => decide(item, 'keep')} height={48} style={{ flex: 1, borderRadius: 24 }} />
                  </View>
                )}
              </View>
            </Content>
          );
        }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.coral} />}
      />
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand },
    intro: { fontSize: 14, lineHeight: 20, color: colors.inkSoft, paddingHorizontal: GUTTER, marginBottom: 14 },
    card: { backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 16, marginHorizontal: GUTTER, marginBottom: 12, gap: 8 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    kind: { fontFamily: BOLD, fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.inkSoft },
    reported: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.errorBg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
    reportedText: { fontFamily: BOLD, fontSize: 12.5, color: colors.errorText },
    hiddenTag: { backgroundColor: colors.ink, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
    hiddenText: { fontFamily: BOLD, fontSize: 12.5, color: colors.sand },
    where: { fontSize: 13, color: colors.inkSoft },
    text: { fontSize: 15, lineHeight: 22, color: colors.ink },
    reasons: { fontSize: 13.5, color: colors.inkBody },
    buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
    done: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.mintBg, borderRadius: 14, paddingLeft: 12, minHeight: 48, marginTop: 4 },
    doneText: { flex: 1, fontFamily: BOLD, fontSize: 14, color: colors.mintText },
    undo: { minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center' },
    undoText: { fontFamily: BOLD, fontSize: 14, color: colors.mintText, textDecorationLine: 'underline' },
  });
}
