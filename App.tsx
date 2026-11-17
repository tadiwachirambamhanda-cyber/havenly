import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { SchibstedGrotesk_500Medium_Italic, SchibstedGrotesk_600SemiBold, SchibstedGrotesk_700Bold, SchibstedGrotesk_700Bold_Italic } from '@expo-google-fonts/schibsted-grotesk';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesk';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import { ToastProvider } from '@/lib/ToastContext';
import RootNavigator from '@/navigation/RootNavigator';
import AppErrorFallback from '@/components/AppErrorFallback';
import { initCrashReporting } from '@/lib/crashReporting';
import * as Sentry from '@sentry/react-native';

initCrashReporting();
SplashScreen.preventAutoHideAsync();

// The launch animation lives in RootNavigator (it also covers the initial
// auth check), so it isn't repeated here.
function AppContent() {
  const { scheme, colors } = useTheme();

  const app = (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Sentry.ErrorBoundary fallback={({ resetError }) => <AppErrorFallback onRetry={resetError} />}>
        <RootNavigator />
      </Sentry.ErrorBoundary>
    </>
  );

  // Havenly is a phone layout. On the website, keep it a phone-width column
  // in the middle of a large screen instead of stretching it across the page.
  if (Platform.OS !== 'web') return app;
  return (
    <View style={{ flex: 1, backgroundColor: colors.sandDeep, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, backgroundColor: colors.sand, overflow: 'hidden' }}>
        {app}
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SchibstedGrotesk_500Medium_Italic,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_700Bold_Italic,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      if (fontError) console.error('Font load failed, falling back to system font:', fontError.message);
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
