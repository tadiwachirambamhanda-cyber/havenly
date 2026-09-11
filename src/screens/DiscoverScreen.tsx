import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme/tokens';

// STUB — port search bar, horizontal-scroll "Trending spots" cards, and
// "This week on campus" event list from the HTML prototype's #discover screen.
// Query `worship_places` + a future `spots`/`events` table.

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Discover Dubai</Text>
      <Text style={styles.placeholder}>
        TODO(claude-code): port search bar + trending spots (horizontal scroll)
        + this-week events list from the HTML prototype's #discover screen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.sand, padding: spacing.lg, paddingTop: 60 },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 26, color: colors.ink },
  placeholder: { color: colors.inkSoft, marginTop: 20, lineHeight: 20 },
});
