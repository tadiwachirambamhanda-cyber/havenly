import React, { useMemo, useState } from 'react';
import { Modal, View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import { filterCommunities } from '@/lib/community';
import type { Community } from '@/types';
import type { ColorTokens } from '@/theme/tokens';
import { BOLD, CONTENT_MAX, TITLE_FONT } from './ui';

// For the team: pick one community for an event, or "Everyone".
export default function CommunityPicker({ visible, onClose, communities, selectedId, onPick }: {
  visible: boolean; onClose: () => void; communities: Community[]; selectedId: string | null; onPick: (id: string | null) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => styles(colors), [colors]);
  const [query, setQuery] = useState('');
  const rows: { id: string | null; name: string }[] = [{ id: null, name: 'Everyone (all communities)' }, ...filterCommunities(communities, query)];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { paddingTop: insets.top + 12 }]}>
        <View style={s.inner}>
          <View style={s.head}>
            <Text style={s.title} accessibilityRole="header">Which community?</Text>
            <AnimatedPressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close"><Icon name="x" size={18} color={colors.ink} /></AnimatedPressable>
          </View>
          <TextInput style={s.search} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.inkSoft} accessibilityLabel="Search communities" />
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id ?? 'all'}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            renderItem={({ item }) => (
              <Pressable style={s.row} onPress={() => { onPick(item.id); onClose(); }} accessibilityRole="button" accessibilityState={{ selected: item.id === selectedId }}>
                <Text style={s.name}>{item.name}</Text>
                {item.id === selectedId ? <Icon name="check" size={16} color={colors.mintText} /> : null}
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: colors.sand },
    inner: { flex: 1, width: '100%', maxWidth: CONTENT_MAX, alignSelf: 'center', paddingHorizontal: 20 },
    head: { flexDirection: 'row', alignItems: 'center' },
    title: { fontFamily: TITLE_FONT, fontSize: 24, color: colors.ink, flex: 1 },
    close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    search: { height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 16, fontSize: 16, color: colors.ink, marginVertical: 14 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.line },
    name: { flex: 1, fontFamily: BOLD, fontSize: 15, color: colors.ink },
  });
}
