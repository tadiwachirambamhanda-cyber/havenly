import React, { useMemo } from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

export interface ActionSheetAction {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}

// Branded replacement for Alert.alert's title/message/buttons shape — same
// two jobs it was doing (a list of options, or a single confirm/cancel
// choice), just matching the app's own look instead of the OS's generic
// dark action sheet. Modeled directly on ReportModal, which already is this
// pattern with a fixed reason list; this generalizes it. Cancel is always
// implicit (not passed in `actions`) so every call site gets the same
// visually-separated Cancel row without having to say so.
export default function ActionSheet({ visible, onClose, title, message, actions, cancelLabel = 'Cancel' }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Wrapping Animated.View (not the Pressable itself) carries the
            entering animation — the card remounts each time the Modal opens
            (RN unmounts a Modal's children while visible=false), so this
            replays on every open without any manual state tracking. */}
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            {(title || message) && (
              <View style={styles.header}>
                {title ? <Text style={styles.title}>{title}</Text> : null}
                {message ? <Text style={styles.message}>{message}</Text> : null}
              </View>
            )}
            {actions.map((action) => (
              <Pressable
                key={action.label}
                style={styles.option}
                onPress={() => { onClose(); action.onPress(); }}
              >
                <Text style={[styles.optionText, action.destructive && styles.optionTextDestructive]}>{action.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.sand, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 36 },
  header: { marginBottom: 14 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink },
  message: { fontSize: 13, color: colors.inkSoft, marginTop: 4, lineHeight: 19 },
  option: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line },
  optionText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  optionTextDestructive: { color: colors.coral },
  cancel: { paddingVertical: 14, marginTop: 8, alignItems: 'center' },
  cancelText: { fontSize: 14, color: colors.inkSoft, fontWeight: '700' },
  });
}
