import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  actionLabel: string;
  onAction: () => void;
}

const ACTION_WIDTH = 88;

// Plain responder events rather than react-native-gesture-handler — avoids
// adding a new native dependency (and the GestureHandlerRootView wiring
// that comes with it) for what's a small, self-contained gesture.
export default function SwipeToAction({ children, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [translateX] = useState(() => new Animated.Value(0));
  const offset = useRef(0);

  const close = () => {
    offset.current = 0;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
  };

  // Where this touch started, and how far it has moved since the swipe was
  // claimed. Plain responder events (as JSX props below) do the job a
  // PanResponder did; they are handlers, so reading refs in them is fine.
  const touchStart = useRef({ x: 0, y: 0 });
  const grantX = useRef(0);
  const lastDx = useRef(0);

  const settle = () => {
    const next = offset.current + lastDx.current;
    offset.current = next < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
    lastDx.current = 0;
    Animated.spring(translateX, { toValue: offset.current, useNativeDriver: true, friction: 8 }).start();
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionBackdrop}>
        <Pressable style={styles.actionBtn} onPress={() => { onAction(); close(); }} accessibilityLabel={actionLabel}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      </View>
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        // Capture phase only to note where the touch began (works for mouse
        // drags on web too); it never claims the touch itself.
        onStartShouldSetResponderCapture={(e) => {
          touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
          return false;
        }}
        onMoveShouldSetResponder={(e) => {
          const dx = e.nativeEvent.pageX - touchStart.current.x;
          const dy = e.nativeEvent.pageY - touchStart.current.y;
          return Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5;
        }}
        onResponderGrant={(e) => { grantX.current = e.nativeEvent.pageX; lastDx.current = 0; }}
        onResponderMove={(e) => {
          lastDx.current = e.nativeEvent.pageX - grantX.current;
          translateX.setValue(Math.min(0, Math.max(-ACTION_WIDTH, offset.current + lastDx.current)));
        }}
        onResponderRelease={settle}
        onResponderTerminate={settle}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { position: 'relative', overflow: 'hidden', width: '100%' },
    foreground: {
      width: '100%', backgroundColor: colors.sand,
      // Web-only: without this, a mouse drag on the row selects its text
      // instead of the responder ever seeing the gesture.
      ...(Platform.OS === 'web' ? { userSelect: 'none' as const } : null),
    },
    actionBackdrop: {
      position: 'absolute', top: 0, right: 0, bottom: 0, width: ACTION_WIDTH,
      backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center',
    },
    actionBtn: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
    actionText: { color: 'white', fontWeight: '700', fontSize: 12.5 },
  });
}
