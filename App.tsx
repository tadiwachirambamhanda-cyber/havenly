import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium_Italic, Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_700Bold_Italic } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
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
  const { scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Sentry.ErrorBoundary fallback={({ resetError }) => <AppErrorFallback onRetry={resetError} />}>
        <RootNavigator />
      </Sentry.ErrorBoundary>
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_700Bold_Italic,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
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
