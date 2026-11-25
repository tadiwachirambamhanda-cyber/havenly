import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text } from '@/components/Text';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { friendlyError } from '@/lib/community';
import { claimPerk, fetchMyCodes, type PerkRow } from '@/lib/communityApi';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { BOLD, GUTTER } from './ui';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// My personal codes. "Get code" asks claim_offer, which gives the same code every time.
export function usePerkCodes() {
  const { session } = useAuth();
  const myId = session?.user.id;
  const { showToast } = useToast();
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchMyCodes(myId).then((c) => { if (alive) setCodes(c); });
    return () => { alive = false; };
  }, [myId]);

  const getCode = useCallback(async (offerId: string) => {
    setBusy(offerId);
    haptics.tap();
    try {
      const code = await claimPerk(offerId);
      setCodes((prev) => ({ ...prev, [offerId]: code }));
    } catch (e) {
      showToast(friendlyError(e, 'Couldn’t get the code. Try again.'), 'error');
    } finally {
      setBusy(null);
    }
  }, [showToast]);

  return { codes, busy, getCode };
}

export function CodeBox({ code }: { code: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: colors.dealText, borderRadius: 14, paddingVertical: 12, alignItems: 'center', marginTop: 10 }}
      accessibilityLabel={`Your code is ${code.split('').join(' ')}`}
    >
      <Text style={{ fontFamily: 'JetBrainsMono_500Medium', fontSize: 24, letterSpacing: 3, color: colors.dealText }} selectable>{code}</Text>
      <Text style={{ fontSize: 12, color: colors.dealText, marginTop: 2 }}>Show this at the counter</Text>
    </View>
  );
}

export function GetCodeButton({ loading, onPress, shown }: { loading: boolean; onPress: () => void; shown: boolean }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress} disabled={loading} accessibilityRole="button" accessibilityLabel={shown ? 'Show my code again' : 'Get code'}
      style={{ alignSelf: 'flex-start', height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: colors.dealText, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
    >
      {loading ? <ActivityIndicator color={colors.dealBg} /> : null}
      <Text style={{ fontFamily: BOLD, fontSize: 15, color: colors.dealBg }}>{shown ? 'Show my code' : 'Get code'}</Text>
    </AnimatedPressable>
  );
}

export default function PerkCard({ perk, code, loading, onGetCode, showCode = true }: {
  perk: PerkRow; code?: string; loading: boolean; onGetCode: () => void; showCode?: boolean;
}) {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const s = useMemo(() => styles(colors), [colors]);
  return (
    <View style={s.card}>
      <AnimatedPressable onPress={() => navigation.navigate('PerkDetail', { perkId: perk.id })} accessibilityRole="button" accessibilityLabel={`Open perk ${perk.title}`}>
        <Text style={s.kicker}>STUDENT PERK · {perk.brand.name.toUpperCase()}</Text>
        <Text style={s.title}>{perk.discount_label} · {perk.title}</Text>
        {perk.address ? <Text style={s.meta} numberOfLines={1}>{perk.address}</Text> : null}
      </AnimatedPressable>
      {code && showCode ? <CodeBox code={code} /> : (
        <View style={{ marginTop: 10 }}>
          <GetCodeButton loading={loading} shown={!!code} onPress={() => (code ? navigation.navigate('PerkDetail', { perkId: perk.id }) : onGetCode())} />
        </View>
      )}
    </View>
  );
}

function styles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.dealBg, borderRadius: 22, padding: 16, marginHorizontal: GUTTER, marginBottom: 12 },
    kicker: { fontFamily: BOLD, fontSize: 12, letterSpacing: 0.6, color: colors.dealText },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 18, color: colors.dealText, marginTop: 4 },
    meta: { fontSize: 13, color: colors.dealText, marginTop: 2 },
  });
}
