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
import { radius, spacing } from '@/theme/tokens';
import type { ColorTokens } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/RootNavigator';

type Route = RouteProp<RootStackParamList, 'HousingEnquirySent'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

// The moment a student asks about a room is the one that matters most to the
// housing side of Havenly, so it ends on a screen that says what happened
// and what happens next, instead of a brief pop-up and a silent return.
export default function HousingEnquirySentScreen() {
  const navigation = useNavigation<Nav>();
  const { residenceName, kind, moveIn } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isViewing = kind === 'viewing';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.body}>
        <Icon name="check-circle" size={44} color={colors.teal} weight="fill" />
        <Text style={styles.title}>{isViewing ? 'Viewing request sent' : 'Question sent'}</Text>
        <Text style={styles.summary}>
          {residenceName}
          {isViewing ? ` · move-in ${formatMonth(moveIn)}` : ''}
        </Text>

        <Text style={styles.nextLabel}>What happens next</Text>
        <View style={styles.steps}>
          <Text style={styles.step}>The Havenly team passes your details to {residenceName}.</Text>
          <Text style={styles.step}>
            You’ll get a notification when they’re in touch{isViewing ? ' or your viewing is booked' : ''}.
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
    title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 28, color: colors.ink, marginTop: 18 },
    summary: { fontSize: 14.5, fontWeight: '600', color: colors.inkSoft, marginTop: 6 },
    nextLabel: {
      fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
      color: colors.inkSoft, marginTop: 36,
    },
    steps: { gap: 10, marginTop: 12 },
    step: { fontSize: 14.5, lineHeight: 21, color: colors.ink },
    primary: { backgroundColor: colors.coral, paddingVertical: 15, borderRadius: radius.button, alignItems: 'center' },
    primaryText: { color: 'white', fontWeight: '700', fontSize: 15 },
    secondary: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    secondaryText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  });
}
