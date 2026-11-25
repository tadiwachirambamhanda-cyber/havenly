import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import ReportModal from '@/components/ReportModal';
import ActionSheet from '@/components/ActionSheet';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { findOrCreateConversation } from '@/lib/conversations';
import { blockUser, submitReport } from '@/lib/safety';
import type { BoardCard } from '@/lib/housemates';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// Message, report and block for housemate cards (the board and a university community's Housemates).
// Cards are people, so they are reported as a user, as before.
export function useHousemateActions(onBlocked: (userId: string) => void) {
  const navigation = useNavigation<Nav>();
  const { session } = useAuth();
  const myId = session?.user.id;
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<BoardCard | null>(null);
  const [blockTarget, setBlockTarget] = useState<BoardCard | null>(null);

  const message = async (card: BoardCard) => {
    if (!myId) return;
    haptics.tap();
    setBusyId(card.user_id);
    try {
      const conversationId = await findOrCreateConversation(myId, card.user_id);
      navigation.navigate('Chat', { conversationId, otherUserId: card.user_id });
    } catch (e) {
      showToast(e instanceof Error && e.message ? e.message : 'Couldn’t start the conversation. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmBlock = async () => {
    const target = blockTarget;
    if (!target || !myId) return;
    try {
      await blockUser(myId, target.user_id);
      onBlocked(target.user_id);
      showToast('Blocked. You will not see each other any more.');
    } catch {
      showToast('Couldn’t block. Try again.', 'error');
    }
  };

  const sendReport = async (reason: string) => {
    const target = reportTarget;
    setReportTarget(null);
    if (!target || !myId) return;
    try {
      await submitReport(myId, 'user', target.user_id, reason);
      showToast('Thanks. The team will look at this.');
    } catch {
      showToast('Couldn’t send the report. Try again.', 'error');
    }
  };

  const element = (
    <View>
      <ReportModal visible={!!reportTarget} onClose={() => setReportTarget(null)} onSubmit={sendReport} />
      <ActionSheet
        visible={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        title={`Block ${blockTarget?.display_name ?? 'this student'}?`}
        message="You will not see each other's cards, and they cannot message you."
        actions={[{ label: 'Block', destructive: true, onPress: confirmBlock }]}
      />
    </View>
  );

  return { busyId, message, report: setReportTarget, block: setBlockTarget, element };
}
