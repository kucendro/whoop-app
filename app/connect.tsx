import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useDeviceStore } from '@/lib/store/device-store';
import { Button } from '@/components/ui/button';
import { colors, spacing, fontSize, fontWeight, radius } from '@/constants/theme';

export default function ConnectScreen() {
  const { connectionState, connect } = useDeviceStore();
  const router = useRouter();

  const isScanning = connectionState === 'scanning';
  const isConnecting = connectionState === 'connecting';
  const isBusy = isScanning || isConnecting;

  const getStatusText = () => {
    switch (connectionState) {
      case 'scanning':
        return 'Scanning for WHOOP...';
      case 'connecting':
        return 'Connecting...';
      default:
        return 'Not connected';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Close</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logoRing}>
              <View style={styles.logoInner}>
                {isBusy ? (
                  <ActivityIndicator size="large" color={colors.accent} />
                ) : (
                  <Text style={styles.logoText}>W</Text>
                )}
              </View>
            </View>
          </View>

          <Text style={styles.title}>WHOOP</Text>
          <Text style={styles.subtitle}>
            Connect to your WHOOP 4.0 strap to start tracking your heart rate and recovery data.
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, isBusy && styles.statusDotActive]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title={isBusy ? 'Searching...' : 'Connect WHOOP'}
            onPress={connect}
            variant="primary"
            size="lg"
            loading={isBusy}
            style={styles.connectButton}
          />

          <Text style={styles.hint}>
            Make sure your WHOOP is charged, on your wrist, and Bluetooth is enabled
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  dismissText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxxl,
  },
  logoContainer: {
    marginBottom: spacing.xxl,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bgCard,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxxl,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textTertiary,
    marginRight: spacing.sm,
  },
  statusDotActive: {
    backgroundColor: colors.accent,
  },
  statusText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  actions: {
    alignItems: 'center',
  },
  connectButton: {
    width: '100%',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
});
