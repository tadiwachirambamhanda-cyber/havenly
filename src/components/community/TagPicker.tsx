import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from '@/components/Text';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import { AREAS } from '@/constants/areas';
import { fetchListingsForTag } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import { BOLD, CONTENT_MAX, ChoiceChip, TITLE_FONT } from './ui';

export type PostTag = { kind: 'area'; area: string } | { kind: 'listing'; id: string; name: string; area: string };

// "Tag an area or a listing": an area from AREAS, or one of the live listings.
export default function TagPicker({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (t: PostTag) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => styles(colors), [colors]);
  const [mode, setMode] = useState<'area' | 'listing'>('area');
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<{ id: string; name: string; area: string }[] | null | 'failed'>(null);

  useEffect(() => {
    if (!visible || mode !== 'listing' || listings !== null) return;
    let alive = true;
    fetchListingsForTag().then((l) => { if (alive) setListings(l); }).catch(() => { if (alive) setListings('failed'); });
    return () => { alive = false; };
  }, [visible, mode, listings]);

  const q = query.trim().toLowerCase();
  const areaRows = AREAS.filter((a) => !q || a.toLowerCase().includes(q));
  const listingRows = Array.isArray(listings) ? listings.filter((l) => !q || l.name.toLowerCase().includes(q) || l.area.toLowerCase().includes(q)) : [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={[s.wrap, { paddingTop: insets.top + 12 }]}>
        <View style={s.inner}>
          <View style={s.head}>
            <Text style={s.title} accessibilityRole="header">Tag your post</Text>
            <AnimatedPressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="x" size={18} color={colors.ink} />
            </AnimatedPressable>
          </View>
          <View style={s.modes}>
            <ChoiceChip label="An area" on={mode === 'area'} onPress={() => setMode('area')} />
            <ChoiceChip label="A listing" on={mode === 'listing'} onPress={() => setMode('listing')} />
          </View>
          <View style={s.search}>
            <Icon name="search" size={18} color={colors.inkSoft} />
            <TextInput
              style={s.searchInput} value={query} onChangeText={setQuery} maxLength={60}
              placeholder={mode === 'area' ? 'Search an area' : 'Search a listing or area'} placeholderTextColor={colors.inkSoft}
              accessibilityLabel={mode === 'area' ? 'Search an area' : 'Search a listing'}
            />
          </View>
          {mode === 'listing' && listings === null ? <ActivityIndicator color={colors.coral} style={{ marginTop: 20 }} /> : null}
          {mode === 'listing' && listings === 'failed' ? <Text style={s.empty}>We could not load the listings. Close and try again.</Text> : null}
          <FlatList
            data={mode === 'area' ? areaRows.map((a) => ({ key: a, title: a, sub: '' })) : listingRows.map((l) => ({ key: l.id, title: l.name, sub: l.area }))}
            keyExtractor={(r) => r.key}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
            ListEmptyComponent={mode === 'area' || Array.isArray(listings) ? <Text style={s.empty}>Nothing matches “{query.trim()}”.</Text> : undefined}
            renderItem={({ item }) => (
              <Pressable
                style={s.row} accessibilityRole="button"
                onPress={() => {
                  if (mode === 'area') onPick({ kind: 'area', area: item.title });
                  else onPick({ kind: 'listing', id: item.key, name: item.title, area: item.sub });
                }}
              >
                <Icon name={mode === 'area' ? 'map-pin' : 'home'} size={16} color={colors.mintText} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>{item.title}</Text>
                  {item.sub ? <Text style={s.rowSub}>{item.sub}</Text> : null}
                </View>
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
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontFamily: TITLE_FONT, fontSize: 27, letterSpacing: -0.6, color: colors.ink, flex: 1 },
    close: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    modes: { flexDirection: 'row', gap: 8, marginTop: 14 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.fieldLine, backgroundColor: colors.white, paddingHorizontal: 16, marginVertical: 14 },
    searchInput: { flex: 1, fontSize: 16, color: colors.ink },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 },
    rowTitle: { fontFamily: BOLD, fontSize: 15, color: colors.ink },
    rowSub: { fontSize: 13, color: colors.inkSoft },
    empty: { fontSize: 14, color: colors.inkSoft, textAlign: 'center', marginTop: 24 },
  });
}
