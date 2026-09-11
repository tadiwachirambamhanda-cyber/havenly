import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/lib/AuthContext';
import RootNavigator from '@/navigation/RootNavigator';

// TODO(claude-code): load Fraunces / Plus Jakarta Sans / JetBrains Mono via
// expo-font + @expo-google-fonts before rendering, matching src/theme/tokens.ts.

export default function App() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
