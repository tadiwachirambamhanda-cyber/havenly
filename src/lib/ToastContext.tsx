import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@/components/Icon';
import { useTheme } from '@/lib/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

type ToastType = 'success' | 'error';
interface ToastState { message: string; type: ToastType; key: number }
interface ToastContextValue { showToast: (message: string, type?: ToastType) => void }

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Lightweight, self-dismissing feedback for routine success/error messages —
// keeps native Alert.alert reserved for things that actually need a
// confirmation (logout, delete, block) rather than every status message.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ message, type, key: Date.now() });
    translateY.setValue(-80);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    timeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -80, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, 2600);
  }, [translateY, opacity]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          key={toast.key}
          pointerEvents="none"
          style={[styles.container, { top: insets.top + 10, opacity, transform: [{ translateY }] }]}
        >
          <View style={[styles.pill, toast.type === 'error' && styles.pillError]}>
            <Icon
              name={toast.type === 'error' ? 'alert-circle' : 'check-circle'}
              size={15}
              color={toast.type === 'error' ? colors.coral : colors.teal}
            />
            <Text style={styles.text} numberOfLines={2}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 999 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white,
      borderRadius: 100, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 420,
      borderWidth: 1, borderColor: colors.line,
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    },
    pillError: { borderColor: colors.coralSoft },
    text: { fontSize: 13, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  });
}
