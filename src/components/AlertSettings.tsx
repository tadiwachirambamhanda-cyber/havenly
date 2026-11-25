import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Switch } from 'react-native';
import { Text } from '@/components/Text';
import { Notice, OutlineButton } from '@/components/housing/parts';
import { useTheme } from '@/lib/ThemeContext';
import { useToast } from '@/lib/ToastContext';
import { haptics } from '@/lib/haptics';
import { saveOwnRow } from '@/lib/ownRow';
import { newPlaceAlertProblem, switchesOf, type AlertSwitches, type SavedSwitches } from '@/lib/alerts';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';

// The off track of a switch, the same grey the other switches in the app use.
const SWITCH_OFF = '#BDB6A8';

interface Props {
  userId: string;
  isGuest: boolean;
  // From the student's private profile: their saved budget, gender and the two switches.
  budgetAed: number | null | undefined;
  gender: string | null | undefined;
  saved: SavedSwitches | null | undefined;
  onEditProfile: () => void;
}

// The Alerts block on Profile. Each switch saves on its own; a failed save puts the switch back.
export default function AlertSettings({ userId, isGuest, budgetAed, gender, saved, onEditProfile }: Props) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [switches, setSwitches] = useState<AlertSwitches>(() => switchesOf(saved));
  const [saving, setSaving] = useState<keyof AlertSwitches | null>(null);

  const change = async (key: keyof AlertSwitches, value: boolean) => {
    haptics.tap();
    const before = switches[key];
    setSwitches((s) => ({ ...s, [key]: value }));
    setSaving(key);
    try {
      await saveOwnRow('profile_private', userId, { [key]: value });
    } catch {
      setSwitches((s) => ({ ...s, [key]: before }));
      // Demo mode already shows its own "Create an account to do this." banner.
      if (!isGuest) showToast('Couldn’t save your alert setting. Check your connection and try again.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const problem = switches.alert_new_places ? newPlaceAlertProblem({ budget_aed: budgetAed }) : null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Price drops on saved places</Text>
          <Text style={styles.hint}>We tell you in Notifications when a place you saved gets cheaper.</Text>
        </View>
        <Switch
          value={switches.alert_price_drops}
          onValueChange={(v) => change('alert_price_drops', v)}
          disabled={saving === 'alert_price_drops'}
          trackColor={{ false: SWITCH_OFF, true: colors.coralFill }}
          thumbColor="#FFFFFF"
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          accessibilityLabel="Price drops on saved places"
        />
      </View>

      <View style={[styles.row, styles.divider]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>New places that fit you</Text>
          <Text style={styles.hint}>
            Within your budget and near your university.
            {gender ? '' : ' Women-only and men-only places are included only if you set your gender in Edit profile.'}
          </Text>
        </View>
        <Switch
          value={switches.alert_new_places}
          onValueChange={(v) => change('alert_new_places', v)}
          disabled={saving === 'alert_new_places'}
          trackColor={{ false: SWITCH_OFF, true: colors.coralFill }}
          thumbColor="#FFFFFF"
          {...({ activeThumbColor: '#FFFFFF' } as object)}
          accessibilityLabel="New places that fit you"
        />
      </View>

      {problem ? (
        <View style={styles.problem}>
          <Notice kind="note">{problem}</Notice>
          <OutlineButton label="Edit profile" onPress={onEditProfile} height={44} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: { backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.line, marginHorizontal: spacing.lg, overflow: 'hidden' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12 },
    divider: { borderTopWidth: 1, borderTopColor: colors.line },
    title: { fontFamily: 'HankenGrotesk_700Bold', fontSize: 15, color: colors.ink },
    hint: { fontSize: 13, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
    problem: { gap: 10, paddingHorizontal: 16, paddingBottom: 16 },
  });
}
