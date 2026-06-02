import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme';

export default function HealthCard({ restartDoneToday }) {
  const now = new Date();
  const isPast530 = now.getHours() > 5 || (now.getHours() === 5 && now.getMinutes() >= 30);

  let iconName, iconColor, statusText, statusColor;
  if (restartDoneToday) {
    iconName = 'check-circle'; iconColor = COLORS.green;
    statusText = 'Completed'; statusColor = COLORS.green;
  } else if (!isPast530) {
    iconName = 'clock'; iconColor = COLORS.amber;
    statusText = 'Scheduled'; statusColor = COLORS.amber;
  } else {
    iconName = 'clock'; iconColor = COLORS.amber;
    statusText = 'Pending'; statusColor = COLORS.amber;
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Feather name="calendar" size={13} color={COLORS.text3} />
        <Text style={styles.title}>Daily Health</Text>
      </View>
      <View style={styles.statusRow}>
        <Feather name={iconName} size={22} color={iconColor} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.statusMain, { color: statusColor }]}>{statusText}</Text>
          <Text style={styles.statusSub}>05:30 restart cycle</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
    ...SHADOW.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  title: {
    fontSize: 11, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusMain: { fontSize: 15, fontWeight: '700' },
  statusSub: { fontSize: 11, color: COLORS.text3, marginTop: 3 },
});
