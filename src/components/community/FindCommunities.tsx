import React, { useMemo, useState } from 'react';
import { Modal, View, StyleSheet, FlatList, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import { communityInitials, filterCommunities, memberLine } from '@/lib/community';
import type { Community } from '@/types';
import type { ColorTokens } from '@/theme/tokens';
import { BOLD, CONTENT_MAX, Pill, TITLE_FONT } from './ui';

// "Find more": every community I have not joined, with a search and Join.
export default function FindCommunities({ visible, onClose, communities, joinedIds, joiningId, onJoin, onOpen }: {
  visible: boolean; onClose: () => void; communities: Community[]; joinedIds: ReadonlySet<string>; joiningId: string | null;
  onJoin: (c: Community) => void; onOpen: (c: Community) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => styles(colors), [colors]);
  const [query, setQuery] = useState('');
  const list = filterCommunities(communities, query);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { paddingTop: insets.top + 12 }]}>
        <View style={s.inner}>
          <View style={s.head}>
            <Text style={s.title} accessibilityRole="header">Find communities</Text>
            <AnimatedPressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="x" size={18} color={colors.ink} />
            </AnimatedPressable>
          </View>
          <Text style={s.sub}>Join any university or interest community, up to 20. Anyone in them can read your posts.</Text>
          <View style={s.search}>
            <Icon name="search" size={18} color={colors.inkSoft} />
            <TextInput
              style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Search a university or interest"
              placeholderTextColor={colors.inkSoft} accessibilityLabel="Search communities" maxLength={60}
            />
          </View>
          <FlatList
            data={list}
            keyExtractor={(c) => c.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            ListEmptyComponent={<Text style={s.empty}>No community matches “{query.trim()}”.</Text>}
            renderItem={({ item }) => {
              const joined = joinedIds.has(item.id);
              return (
                <View style={s.row}>
                  <Pressable style={s.rowMain} onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
                    <View style={s.badge}><Text style={s.badgeText}>{communityInitials(item.name)}</Text></View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.name} numberOfLines={2}>{item.name}</Text>
                      <Text style={s.meta}>{item.category === 'campus' ? 'University' : 'Interest'} · {memberLine(item.member_count)}</Text>
                    </View>
                  </Pressable>
                  <Pill
                    label={joined ? 'Joined' : joiningId === item.id ? 'Joining…' : 'Join'}
                    icon={joined ? 'check' : undefined}
                    tone={joined ? 'mint' : 'berry'}
                    disabled={joined || joiningId === item.id}
                    onPress={() => onJoin(item)}
                    accessibilityLabel={joined ? `Joined ${item.name}` : `Join ${item.name}`}
                  />
                </View>
              );
            }}
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
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: TITLE_FONT, fontSize: 27, letterSpacing: -0.6, color: colors.ink, flex: 1 },
    close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    sub: { fontSize: 14, lineHeight: 20, color: colors.inkSoft, marginTop: 6 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 16, marginVertical: 14 },
    searchInput: { flex: 1, fontSize: 16, color: colors.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
    rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
    badge: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.coralSoft, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontFamily: BOLD, fontSize: 15, color: colors.coral },
    name: { fontFamily: BOLD, fontSize: 15, color: colors.ink },
    meta: { fontSize: 13, color: colors.inkSoft },
    empty: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 24 },
  });
}
