import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme';

function voltageStatus(v, type) {
  if (type === 'input') {
    if (v >= 200 && v <= 250) return 'ok';
    if (v >= 180 && v <= 260) return 'warn';
    return 'bad';
  }
  if (v >= 210 && v <= 230) return 'ok';
  if (v >= 200 && v <= 240) return 'warn';
  return 'bad';
}

function statusLabel(s) {
  if (s === 'ok') return 'Normal range';
  if (s === 'warn') return 'Slightly off';
  return 'Out of range';
}

function statusDotColor(s) {
  if (s === 'ok') return COLORS.green;
  if (s === 'warn') return COLORS.amber;
  return COLORS.red;
}

export default function VoltageCard({ label, voltage, type, waiting }) {
  const accentColor = type === 'input' ? COLORS.inputColor : COLORS.outputColor;
  const status = voltageStatus(voltage, type);

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        <Feather name="zap" size={13} color={COLORS.text3} />
        <Text style={styles.label}>{label}</Text>
      </View>

      <View style={[styles.display, { borderColor: accentColor + '22' }]}>
        {waiting ? (
          <Text style={styles.waitText}>— — —</Text>
        ) : (
          <Text style={[styles.voltage, { color: accentColor }]}>
            {voltage.toFixed(1)}<Text style={styles.unit}> V</Text>
          </Text>
        )}
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: waiting ? COLORS.amber : statusDotColor(status) }]} />
        <Text style={styles.statusText}>
          {waiting ? 'Waiting for device…' : statusLabel(status)}
        </Text>
      </View>

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
  labelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14,
  },
  label: {
    fontSize: 11, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  display: {
    backgroundColor: '#111110',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    minHeight: 66,
    justifyContent: 'center',
  },
  voltage: {
    fontSize: 42, fontWeight: '800', letterSpacing: -2,
  },
  unit: {
    fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.25)', letterSpacing: 0,
  },
  waitText: {
    fontSize: 28, color: 'rgba(255,255,255,0.12)', letterSpacing: 10, fontWeight: '300',
  },
  statusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, color: COLORS.text3, fontWeight: '500' },
  accent: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, opacity: 0.5,
  },
});
