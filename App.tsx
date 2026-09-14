import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium_Italic, Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_700Bold_Italic } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { AuthProvider } from '@/lib/AuthContext';
import { ThemeProvider, useTheme } from '@/lib/ThemeContext';
import RootNavigator from '@/navigation/RootNavigator';
import LaunchAnimation from '@/components/LaunchAnimation';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const [showIntro, setShowIntro] = useState(true);
  const { scheme } = useTheme();

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {showIntro ? <LaunchAnimation onFinish={() => setShowIntro(false)} /> : <RootNavigator />}
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
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
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
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
