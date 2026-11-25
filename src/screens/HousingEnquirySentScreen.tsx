import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/components/Text';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import AnimatedPressable from '@/components/AnimatedPressable';
import { useTheme } from '@/lib/ThemeContext';
import { formatMonth } from '@/lib/housing';
import { spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'HousingEnquirySent'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// The moment a student asks about a room is the one that matters most to the
// housing side of Havenly, so it ends on a screen that says what happened
// and what happens next, instead of a brief pop-up and a silent return.
export default function HousingEnquirySentScreen() {
  const navigation = useNavigation<Nav>();
  const { residenceName, kind, moveIn, groupSize } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isViewing = kind === 'viewing';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.body}>
        <Icon name="check-circle" size={44} color={colors.ink} weight="fill" />
        <Text style={styles.title}>{groupSize ? 'Group enquiry sent' : isViewing ? 'Viewing request sent' : 'Question sent'}</Text>
        <Text style={styles.summary}>
          {residenceName}
          {isViewing ? ` · move-in ${formatMonth(moveIn)}` : ''}
        </Text>

        <Text style={styles.nextLabel}>What happens next</Text>
        <View style={styles.steps}>
          <Text style={styles.step}>{groupSize ? `The Havenly team passes your group's details (${groupSize} people) to ${residenceName}.` : `The Havenly team passes your details to ${residenceName}.`}</Text>
          <Text style={styles.step}>
            {groupSize ? 'Everyone in the group' : 'You'}’ll get a notification when they’re in touch{isViewing ? ' or your viewing is booked' : ''}.
          </Text>
          <Text style={styles.step}>You can follow every enquiry any time under My enquiries.</Text>
        </View>
      </View>

      <AnimatedPressable style={styles.primary} onPress={() => navigation.replace('MyEnquiries')} accessibilityLabel="See my enquiries">
        <Text style={styles.primaryText}>See my enquiries</Text>
      </AnimatedPressable>
      <AnimatedPressable style={styles.secondary} onPress={() => navigation.goBack()} accessibilityLabel="Keep browsing">
        <Text style={styles.secondaryText}>Keep browsing</Text>
      </AnimatedPressable>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.sand, paddingHorizontal: spacing.lg },
    body: { flex: 1, alignItems: 'flex-start' },
    title: { fontFamily: 'SchibstedGrotesk_800ExtraBold', fontSize: 28, letterSpacing: -0.4, color: colors.ink, marginTop: 18 },
    summary: { fontSize: 15, fontWeight: '600', color: colors.inkBody, marginTop: 6 },
    nextLabel: {
      fontFamily: 'HankenGrotesk_700Bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.72,
      color: colors.inkSoft, marginTop: 36,
    },
    steps: { gap: 10, marginTop: 12 },
    step: { fontSize: 15, lineHeight: 22, color: colors.inkBody },
    primary: { backgroundColor: colors.coralFill, minHeight: 54, justifyContent: 'center', borderRadius: 27, alignItems: 'center' },
    primaryText: { color: '#FFFFFF', fontFamily: 'HankenGrotesk_800ExtraBold', fontSize: 16 },
    secondary: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
    secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  });
}
