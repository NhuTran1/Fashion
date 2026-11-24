import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { AppShell } from './src/components/AppShell';
import { AppProvider } from './src/state/AppContext';

/** Root Expo application component wrapping AppProvider and AppShell. */
export default function App(): React.ReactElement {
  return (
    <AppProvider>
      <StatusBar style="dark" />
      <AppShell />
    </AppProvider>
  );
}
