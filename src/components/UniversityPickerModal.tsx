import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';
import { UNIVERSITIES } from '@/constants/universities';

interface Props {
  visible: boolean;
  selected: string | null;
  onClose: () => void;
  onSelect: (name: string | null) => void;
}

export default function UniversityPickerModal({ visible, selected, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const emirates = Array.from(new Set(UNIVERSITIES.map((u) => u.emirate)));

  const pick = (name: string | null) => {
    onSelect(name);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose}><Text style={styles.headerBtn}>Cancel</Text></Pressable>
          <Text style={styles.headerTitle}>Your university</Text>
          <View style={{ width: 50 }} />
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Pressable style={styles.row} onPress={() => pick(null)}>
            <Text style={styles.rowText}>Not listed / prefer not to say</Text>
            {!selected && <Text style={styles.check}>✓</Text>}
          </Pressable>
          {emirates.map((emirate) => (
            <View key={emirate}>
              <Text style={styles.groupLabel}>{emirate}</Text>
              {UNIVERSITIES.filter((u) => u.emirate === emirate).map((u) => (
                <Pressable key={u.name} style={styles.row} onPress={() => pick(u.name)}>
                  <Text style={styles.rowText}>{u.name}</Text>
                  {selected === u.name && <Text style={styles.check}>✓</Text>}
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontFamily: 'Fraunces_600SemiBold', fontSize: 17, color: colors.ink },
  headerBtn: { fontSize: 14, fontWeight: '600', color: colors.inkSoft, width: 50 },
  groupLabel: {
    fontFamily: 'JetBrainsMono_500Medium', fontSize: 11, textTransform: 'uppercase', color: colors.inkSoft,
    fontWeight: '600', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.line,
  },
  rowText: { fontSize: 14, color: colors.ink, flex: 1, paddingRight: 12 },
  check: { fontSize: 15, fontWeight: '700', color: colors.coral },
});
