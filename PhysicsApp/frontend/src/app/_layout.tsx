import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/ui/theme';

export default function RootLayout() {
  useEffect(() => {
    // App-wide portrait lock. Future landscape-oriented levels can override
    // by calling ScreenOrientation.lockAsync from their own screen.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            color: colors.textPrimary,
            fontWeight: '600',
          },
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: 'PHYSICS // EXPERIMENTS' }} />
        <Stack.Screen name="level-01" options={{ title: 'LEVEL 01 — TRAJECTORY' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
