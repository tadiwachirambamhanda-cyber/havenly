import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from '@/components/Skeleton';
import { radius, spacing } from '@/theme/tokens';

// Shared placeholder for the "avatar + name + handle" row shape used by the
// people lists, inbox and notifications (same 44px avatar and row spacing as
// the real rows). thumb="square" matches rows led by a photo instead, like
// perks and residences.
export default function PersonRowSkeleton({ count = 6, thumb = 'circle' }: { count?: number; thumb?: 'circle' | 'square' }) {
  return (
    <View style={{ padding: spacing.lg }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton style={thumb === 'square' ? styles.square : styles.avatar} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton style={{ height: 13, width: '45%' }} />
            <Skeleton style={{ height: 11, width: '30%' }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  square: { width: 56, height: 56, borderRadius: radius.sm },
});
