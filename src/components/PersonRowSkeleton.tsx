import React from 'react';
import { View, StyleSheet } from 'react-native';
import Skeleton from '@/components/Skeleton';
import { spacing } from '@/theme/tokens';

// Shared placeholder for the "avatar + name + handle" row shape used by
// FollowListScreen, NewGroupScreen, and SharePostScreen's people lists —
// same 44px avatar and row spacing as the real rows in all three.
export default function PersonRowSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={{ padding: spacing.lg }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton style={styles.avatar} />
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
});
