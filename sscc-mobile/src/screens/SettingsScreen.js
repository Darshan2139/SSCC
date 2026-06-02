import React from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp, API_URL } from '../context/AppContext';
import { COLORS, RADIUS, SHADOW } from '../theme';

function SectionTitle({ label }) {
  return <Text style={styles.sectionTitle}>{label}</Text>;
}

function SettingRow({ label, description, children }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description ? <Text style={styles.settingDesc}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function PollButton({ value, current, onPress }) {
  const active = value === current;
  return (
    <TouchableOpacity
      style={[styles.pollBtn, active && styles.pollBtnActive]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.pollBtnText, active && styles.pollBtnTextActive]}>{value}s</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { demoMode, setDemoMode, pollInterval, setPollInterval } = useApp();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Feather name="sliders" size={18} color={COLORS.primary} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>Configure your SSCC dashboard</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <SectionTitle label="Data" />
        <View style={styles.card}>
          <SettingRow
            label="Demo Mode"
            description="Show sample data instead of live readings"
          >
            <Switch
              value={demoMode}
              onValueChange={setDemoMode}
              trackColor={{ false: COLORS.borderLight, true: COLORS.primary }}
              thumbColor={COLORS.surface}
              ios_backgroundColor={COLORS.borderLight}
            />
          </SettingRow>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Poll Interval</Text>
              <Text style={styles.settingDesc}>How often to fetch live data</Text>
            </View>
          </View>
          <View style={styles.pollGrid}>
            {[1, 2, 3, 5, 10].map(v => (
              <PollButton key={v} value={v} current={pollInterval} onPress={() => setPollInterval(v)} />
            ))}
          </View>
        </View>

        <SectionTitle label="Connection" />
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="server" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Backend Server</Text>
              <Text style={styles.infoValue} numberOfLines={1}>{API_URL}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="wifi" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Protocol</Text>
              <Text style={styles.infoValue}>HTTPS / REST API</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="refresh-cw" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Stale Threshold</Text>
              <Text style={styles.infoValue}>15 seconds — offline if no update</Text>
            </View>
          </View>
        </View>

        <SectionTitle label="Device" />
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="cpu" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Microcontroller</Text>
              <Text style={styles.infoValue}>ESP8266 NodeMCU</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="activity" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Sensors</Text>
              <Text style={styles.infoValue}>2× ZMPT101B + ADS1115 ADC</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="clock" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Daily Restart</Text>
              <Text style={styles.infoValue}>05:30 IST — fan off for 10 min</Text>
            </View>
          </View>
        </View>

        <SectionTitle label="About" />
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="zap" size={16} color={COLORS.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>App</Text>
              <Text style={styles.infoValue}>SSCC Mobile v1.0.0</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Feather name="info" size={16} color={COLORS.text3} />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>{Platform.OS === 'ios' ? 'iOS' : 'Android'} · Expo SDK 52</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 20, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  headerIcon: {
    width: 38, height: 38, backgroundColor: COLORS.primaryLight,
    borderRadius: 11, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, color: COLORS.text1 },
  headerSub: { fontSize: 11, color: COLORS.text3, fontWeight: '500', marginTop: 1 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: COLORS.text3,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginTop: 6, paddingHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    marginBottom: 16,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: 0 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14,
  },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text1 },
  settingDesc: { fontSize: 12, color: COLORS.text3, marginTop: 3 },
  pollGrid: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 18, paddingBottom: 16,
  },
  pollBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 9,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center',
  },
  pollBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pollBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.text3 },
  pollBtnTextActive: { color: 'white' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, gap: 14,
  },
  infoIconWrap: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center',
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.text1 },
});
