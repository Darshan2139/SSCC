import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme';

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function EventBadge({ type }) {
  let bg, color, label;
  if (type === 'FAN_DAILY_RESTART') {
    bg = COLORS.amberBg; color = COLORS.amber; label = 'Restart';
  } else if (type === 'FAN_MANUAL') {
    bg = COLORS.blueBg; color = COLORS.blue; label = 'Manual';
  } else if (type === 'VOLTAGE_WARNING') {
    bg = COLORS.redBg; color = COLORS.red; label = 'Warning';
  } else {
    bg = COLORS.borderLight; color = COLORS.text3; label = 'Update';
  }
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function LogRow({ item }) {
  return (
    <View style={styles.row}>
      <Text style={styles.time}>{fmtTime(item.timestamp)}</Text>
      <View style={styles.badgeCell}><EventBadge type={item.type} /></View>
      <Text style={styles.volt}>{(item.inputVoltage ?? 0).toFixed(1)}</Text>
      <Text style={styles.volt}>{(item.outputVoltage ?? 0).toFixed(1)}</Text>
      <View style={styles.fanCell}>
        <View style={[styles.fanDot, { backgroundColor: item.fanStatus ? COLORS.green : COLORS.red }]} />
        <Text style={styles.fanText}>{item.fanStatus ? 'ON' : 'OFF'}</Text>
      </View>
    </View>
  );
}

export default function LogTable({ logs }) {
  const sorted = useMemo(() => [...logs].reverse(), [logs]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="activity" size={14} color={COLORS.text3} />
          <Text style={styles.title}>Live Activity Log</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{logs.length}</Text>
        </View>
      </View>

      <View style={[styles.row, styles.colRow]}>
        <Text style={[styles.colHdr, { flex: 2.2 }]}>Time</Text>
        <Text style={[styles.colHdr, styles.badgeCell]}>Event</Text>
        <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>In V</Text>
        <Text style={[styles.colHdr, { flex: 1, textAlign: 'center' }]}>Out V</Text>
        <Text style={[styles.colHdr, styles.fanCell]}>Fan</Text>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="loader" size={20} color={COLORS.text3} />
          <Text style={styles.emptyText}>Waiting for data…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {sorted.map((item, i) => <LogRow key={i} item={item} />)}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  // Cap the log height so a long log scrolls inside its own card instead of
  // stretching the whole page. nestedScrollEnabled lets it scroll while sitting
  // inside the screen's outer ScrollView.
  list: { maxHeight: 360 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 12, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  countPill: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100,
  },
  countText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  colRow: {
    backgroundColor: COLORS.bg,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  colHdr: {
    fontSize: 10, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    gap: 4,
  },
  time: { flex: 2.2, fontSize: 11, color: COLORS.text3 },
  badgeCell: { flex: 1.5, alignItems: 'flex-start' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 9.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  volt: { flex: 1, fontSize: 12, fontWeight: '600', color: COLORS.text1, textAlign: 'center' },
  fanCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  fanDot: { width: 6, height: 6, borderRadius: 3 },
  fanText: { fontSize: 11, fontWeight: '600', color: COLORS.text1 },
  empty: { padding: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 13, color: COLORS.text3 },
});
