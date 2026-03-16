import { Stack, Redirect, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { useDeviceStore } from '@/lib/store/device-store';

export default function RootLayout() {
  const connectionState = useDeviceStore((s) => s.connectionState);
  const segments = useSegments();

  const isConnected = connectionState === 'connected';
  const inConnect = segments[0] === 'connect';

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="connect"
          options={{
            presentation: 'fullScreenModal',
            animation: 'fade',
          }}
        />
      </Stack>
      {/* Declarative redirects — no timing issues */}
      {isConnected && inConnect && <Redirect href="/" />}
      <StatusBar style="light" />
    </View>
  );
}
