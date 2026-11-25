import { SHEET_IN } from '@/theme/motion';
import React, { useCallback, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { Text } from '@/components/Text';
import Icon from '@/components/Icon';
import ActionSheet, { type ActionSheetAction } from '@/components/ActionSheet';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { blockUser } from '@/lib/safety';
import { REPORT_REASONS, friendlyError } from '@/lib/community';
import { reportItem } from '@/lib/communityApi';
import type { ReportableType, ReportReason } from '@/types';
import type { ColorTokens } from '@/theme/tokens';
import { BOLD } from './ui';

// The ⋯ menu on a post, comment or event: Report (with a reason) and Block <name> where there is a person;
// Delete on your own post or comment. One sheet per screen, opened with open(target).

export interface MenuTarget {
  type: ReportableType;
  id: string;
  authorId?: string | null;
  authorName?: string | null;
  onDelete?: () => Promise<void> | void;
}

export function ReportSheet({ visible, onClose, onPick, what }: { visible: boolean; onClose: () => void; onPick: (r: ReportReason) => void; what: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => sheetStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Animated.View entering={SlideInDown.duration(SHEET_IN.duration).easing(SHEET_IN.easing)} style={s.wrap}>
          <Pressable style={s.card} onPress={(e) => e.stopPropagation()}>
            <Text style={s.title}>Why are you reporting this {what}?</Text>
            <Text style={s.note}>The person you report is never told who reported them.</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r.key} style={s.option} onPress={() => onPick(r.key)} accessibilityRole="button">
                <Text style={s.optionText}>{r.label}</Text>
                <Icon name="chevron-right" size={14} color={colors.inkSoft} />
              </Pressable>
            ))}
            <Pressable style={s.cancel} onPress={onClose} accessibilityRole="button"><Text style={s.cancelText}>Cancel</Text></Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function sheetStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    wrap: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    card: { backgroundColor: colors.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 34 },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 19, color: colors.ink },
    note: { fontSize: 13, color: colors.inkSoft, marginTop: 4, marginBottom: 10 },
    option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.line },
    optionText: { fontFamily: BOLD, fontSize: 15, color: colors.ink },
    cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
    cancelText: { fontFamily: BOLD, fontSize: 15, color: colors.inkSoft },
  });
}

// iOS cannot open a sheet while the previous one is still closing.
const later = (f: () => void) => (Platform.OS === 'ios' ? setTimeout(f, 350) : f());

const WHAT: Record<ReportableType, string> = { post: 'post', comment: 'comment', event: 'event' };

export function useSafetyMenu({ onBlocked, onReported }: { onBlocked?: (userId: string) => void; onReported?: (t: MenuTarget) => void } = {}) {
  const { session } = useAuth();
  const myId = session?.user.id;
  const { showToast } = useToast();
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const [report, setReport] = useState<MenuTarget | null>(null);
  const [block, setBlock] = useState<MenuTarget | null>(null);
  const [del, setDel] = useState<MenuTarget | null>(null);

  const open = useCallback((t: MenuTarget) => setMenu(t), []);

  const mine = !!menu?.authorId && menu.authorId === myId;
  const actions: ActionSheetAction[] = [];
  if (menu) {
    if (mine && menu.onDelete) actions.push({ label: `Delete ${WHAT[menu.type]}`, destructive: true, onPress: () => later(() => setDel(menu)) });
    if (!mine) actions.push({ label: `Report ${WHAT[menu.type]}`, destructive: true, onPress: () => later(() => setReport(menu)) });
    if (!mine && menu.authorId && menu.authorName) actions.push({ label: `Block ${menu.authorName}`, onPress: () => later(() => setBlock(menu)) });
  }

  const sendReport = async (reason: ReportReason) => {
    const t = report;
    setReport(null);
    if (!t) return;
    try {
      await reportItem(t.type, t.id, reason);
      showToast('Thanks. The team will look at this.');
      onReported?.(t);
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t send the report. Try again.'), 'error');
    }
  };

  const confirmBlock = async () => {
    const t = block;
    if (!t?.authorId || !myId) return;
    try {
      await blockUser(myId, t.authorId);
      showToast(`Blocked ${t.authorName ?? ''}. You will not see each other’s posts.`.replace('  ', ' '));
      onBlocked?.(t.authorId);
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t block. Try again.'), 'error');
    }
  };

  const confirmDelete = async () => {
    const t = del;
    if (!t?.onDelete) return;
    try {
      await t.onDelete();
      showToast(t.type === 'post' ? 'Post deleted.' : 'Comment deleted.');
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t delete. Try again.'), 'error');
    }
  };

  const element = (
    <View>
      <ActionSheet visible={!!menu} onClose={() => setMenu(null)} actions={actions} />
      <ReportSheet visible={!!report} onClose={() => setReport(null)} onPick={sendReport} what={report ? WHAT[report.type] : 'post'} />
      <ActionSheet
        visible={!!block}
        onClose={() => setBlock(null)}
        title={`Block ${block?.authorName ?? 'this student'}?`}
        message="You will not see each other’s posts or comments, and they cannot message you."
        actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
      />
      <ActionSheet
        visible={!!del}
        onClose={() => setDel(null)}
        title={del?.type === 'post' ? 'Delete this post?' : 'Delete this comment?'}
        message="It is removed for everyone. This cannot be undone."
        actions={[{ label: 'Delete', destructive: true, onPress: confirmDelete }]}
      />
    </View>
  );

  return { open, element };
}
