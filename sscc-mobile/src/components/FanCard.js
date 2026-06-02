import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme';

export default function FanCard({ status, waiting, fanLoading, fanResult, onToggle }) {
  const isDisabled = waiting || fanLoading || fanResult === 'success';

  let btnBg, btnColor, btnLabel;
  if (fanLoading) {
    btnBg = COLORS.borderLight; btnColor = COLORS.text3; btnLabel = 'Sending…';
  } else if (fanResult === 'success') {
    btnBg = COLORS.greenBg; btnColor = COLORS.green; btnLabel = 'Sent — waiting for device…';
  } else if (fanResult === 'failed') {
    btnBg = COLORS.redBg; btnColor = COLORS.red; btnLabel = 'Failed — tap to retry';
  } else if (waiting) {
    btnBg = COLORS.borderLight; btnColor = COLORS.text3; btnLabel = 'Waiting for device…';
  } else if (status) {
    btnBg = COLORS.redBg; btnColor = COLORS.red; btnLabel = 'Turn Off Fan';
  } else {
    btnBg = COLORS.greenBg; btnColor = COLORS.green; btnLabel = 'Turn On Fan';
  }

  const dotColor = waiting ? COLORS.text3 : status ? COLORS.green : COLORS.red;
  const statusText = waiting ? 'No Signal' : status ? 'Running' : 'Stopped';
  const accentColor = status ? COLORS.green : COLORS.red;

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Feather name="wind" size={13} color={COLORS.text3} />
        <Text style={styles.label}>Cooling Fan</Text>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: dotColor }]}>{statusText}</Text>
      </View>

      <TouchableOpacity
        style={[styles.btn, { backgroundColor: btnBg }, isDisabled && styles.btnDisabled]}
        onPress={onToggle}
        disabled={isDisabled}
        activeOpacity={0.8}
      >
        {fanLoading && <ActivityIndicator size="small" color={COLORS.text3} style={{ marginRight: 6 }} />}
        <Text style={[styles.btnText, { color: btnColor }]}>{btnLabel}</Text>
      </TouchableOpacity>

      <View style={[styles.accent, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 20,
    overflow: 'hidden',
    position: 'relative',
    ...SHADOW.sm,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: RADIUS.sm,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  accent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, opacity: 0.6,
  },
});
