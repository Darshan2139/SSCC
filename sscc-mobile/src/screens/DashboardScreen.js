import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import VoltageCard from '../components/VoltageCard';
import FanCard from '../components/FanCard';
import HealthCard from '../components/HealthCard';
import LogTable from '../components/LogTable';
import { COLORS, RADIUS, SHADOW } from '../theme';

function timeAgo(date) {
  if (!date) return '—';
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 5) return 'Just now';
  if (sec < 60) return `${sec}s ago`;
  return `${Math.floor(sec / 60)}m ago`;
}

function InfoItem({ label, value, valueColor }) {
  return (
    <View style={styles.infoItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

function SystemStatusCard({ lastUpdate, isOnline, pollInterval, demoMode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Feather name="server" size={13} color={COLORS.text3} />
        <Text style={styles.cardTitle}>System Status</Text>
      </View>
      <View style={styles.infoGrid}>
        <InfoItem label="Last Update" value={timeAgo(lastUpdate)} />
        <InfoItem label="Poll Rate" value={`${pollInterval}s`} />
        <InfoItem
          label="Connection"
          value={isOnline ? 'Connected' : 'Offline'}
          valueColor={isOnline ? COLORS.green : COLORS.red}
        />
        <InfoItem label="Mode" value={demoMode ? 'Demo' : 'Live'} />
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const {
    state, isOnline, lastUpdate, restartDoneToday,
    demoMode, pollInterval, fanLoading, fanResult, sendFanCommand,
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);
  const waiting = !isOnline && state.inputVoltage === 0;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Feather name="zap" size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>SSCC</Text>
            <Text style={styles.headerSub}>Smart Stabilizer Controller</Text>
          </View>
        </View>
        <View style={[styles.badge, isOnline ? styles.badgeOnline : styles.badgeOffline]}>
          <View style={[styles.badgeDot, { backgroundColor: isOnline ? COLORS.green : COLORS.red }]} />
          <Text style={[styles.badgeText, { color: isOnline ? COLORS.green : COLORS.red }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {demoMode && (
          <View style={styles.demoBanner}>
            <Feather name="info" size={13} color={COLORS.amber} />
            <Text style={styles.demoText}>Demo mode — showing sample data</Text>
          </View>
        )}

        <VoltageCard
          label="Input Voltage"
          voltage={state.inputVoltage}
          type="input"
          waiting={waiting}
        />
        <View style={styles.gap} />

        <VoltageCard
          label="Output Voltage"
          voltage={state.outputVoltage}
          type="output"
          waiting={waiting}
        />
        <View style={styles.gap} />

        <FanCard
          status={state.fanStatus}
          waiting={waiting}
          fanLoading={fanLoading}
          fanResult={fanResult}
          onToggle={sendFanCommand}
        />
        <View style={styles.gap} />

        <HealthCard restartDoneToday={restartDoneToday} />
        <View style={styles.gap} />

        <SystemStatusCard
          lastUpdate={lastUpdate}
          isOnline={isOnline}
          pollInterval={pollInterval}
          demoMode={demoMode}
        />
        <View style={styles.gap} />

        <LogTable logs={state.logs} />
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 38, height: 38,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: COLORS.text1 },
  headerSub: { fontSize: 11, color: COLORS.text3, fontWeight: '500', marginTop: 1 },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
  },
  badgeOnline: { backgroundColor: COLORS.greenBg },
  badgeOffline: { backgroundColor: COLORS.redBg },
  badgeDot: { width: 7, height: 7, borderRadius: 3.5 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { padding: 16 },
  gap: { height: 12 },
  row: { flexDirection: 'row' },

  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.amberBg,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14, paddingVertical: 9,
    marginBottom: 12,
  },
  demoText: { fontSize: 12, fontWeight: '600', color: COLORS.amber, flex: 1 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    padding: 18,
    ...SHADOW.sm,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 14 },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  infoItem: { width: '50%', marginBottom: 10 },
  infoLabel: {
    fontSize: 10, fontWeight: '600', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2,
  },
  infoValue: { fontSize: 13, fontWeight: '700', color: COLORS.text1 },
});
