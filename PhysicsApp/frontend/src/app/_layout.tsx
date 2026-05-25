import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { colors } from '@/ui/theme';

// Lazy-require: expo-screen-orientation throws at IMPORT time if its native
// module isn't compiled into the dev client. Wrapping the require in try/catch
// lets the layout load on older builds (sans portrait lock) and pick up the
// real module automatically on the rebuild that includes it.
let ScreenOrientation: typeof import('expo-screen-orientation') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ScreenOrientation = require('expo-screen-orientation');
} catch {
  // Native module not present in this dev client build — orientation lock skipped.
}

export default function RootLayout() {
  useEffect(() => {
    if (!ScreenOrientation) return;
    // App-wide portrait lock. Future landscape-oriented levels can override
    // by calling ScreenOrientation.lockAsync from their own screen.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(
      () => {},
    );
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
        <Stack.Screen name="level-02" options={{ title: 'LEVEL 02 — COLLISIONS' }} />
        <Stack.Screen name="level-03" options={{ title: 'LEVEL 03 — INCLINED PLANE' }} />
        <Stack.Screen name="level-04" options={{ title: 'LEVEL 04 — PENDULUM' }} />
        <Stack.Screen name="level-05" options={{ title: 'LEVEL 05 — SPRINGS' }} />
        <Stack.Screen name="level-06" options={{ title: 'LEVEL 06 — ENERGY' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
