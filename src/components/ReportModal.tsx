import React, { useMemo } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useTheme } from '@/lib/ThemeContext';
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

const REASONS = ['Spam', 'Harassment or bullying', 'Inappropriate content', 'Something else'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}

export default function ReportModal({ visible, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View entering={SlideInDown.springify().damping(20).stiffness(220)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>Why are you reporting this?</Text>
            {REASONS.map((reason) => (
              <Pressable key={reason} style={styles.option} onPress={() => onSubmit(reason)}>
                <Text style={styles.optionText}>{reason}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
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
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink, marginBottom: 14 },
  option: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.line },
  optionText: { fontSize: 14, color: colors.ink, fontWeight: '600' },
  cancel: { paddingVertical: 14, marginTop: 8, alignItems: 'center' },
  cancelText: { fontSize: 14, color: colors.inkSoft, fontWeight: '700' },
  });
}
