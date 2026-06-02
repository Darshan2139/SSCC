import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Modal, useWindowDimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useApp, API_URL } from '../context/AppContext';
import VoltageChart from '../components/VoltageChart';
import { COLORS, RADIUS, SHADOW } from '../theme';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─── Demo data generators ───
function genDemoDay(d) {
  const pts = [];
  const seed = d.getDate() * 31 + d.getMonth() * 7;
  const sr = i => { const x = Math.sin(seed + i * 9.2) * 10000; return x - Math.floor(x); };
  for (let m = 0; m < 1440; m += 5) {
    const h = m / 60;
    const bIn = 225 + 8 * Math.sin(h * 0.26) + 4 * Math.cos(h * 0.52);
    const bOut = 220 + 3 * Math.sin(h * 0.26) + 2 * Math.cos(h * 0.52);
    pts.push({ time: m, inputV: Math.round((bIn + (sr(m) - 0.5) * 10) * 10) / 10, outputV: Math.round((bOut + (sr(m + 5000) - 0.5) * 4) * 10) / 10 });
  }
  return pts;
}
function genDemoWeek(start) {
  const pts = [];
  for (let d = 0; d < 7; d++) {
    const dd = new Date(start); dd.setDate(dd.getDate() + d);
    for (let h = 0; h < 24; h++) {
      const bIn = 222 + 6 * Math.sin((d * 24 + h) * 0.15);
      const bOut = 219 + 2 * Math.sin((d * 24 + h) * 0.15);
      const noise = (Math.sin(d * 97 + h * 37) * 10000) % 1;
      pts.push({ day: d, hour: h, label: dd.toLocaleDateString('en-US', { weekday: 'short' }), inputV: Math.round((bIn + (noise - 0.5) * 6) * 10) / 10, outputV: Math.round((bOut + (noise - 0.5) * 2.5) * 10) / 10 });
    }
  }
  return pts;
}
function genDemoMonth(year, month) {
  const days = new Date(year, month + 1, 0).getDate();
  const pts = [];
  for (let d = 1; d <= days; d++) {
    const bIn = 224 + 4 * Math.sin(d * 0.4);
    const bOut = 220 + 1.5 * Math.sin(d * 0.4);
    const noise = (Math.sin(d * 73 + month * 17) * 10000) % 1;
    pts.push({ day: d, inputV: Math.round((bIn + (noise - 0.5) * 5) * 10) / 10, outputV: Math.round((bOut + (noise - 0.5) * 2) * 10) / 10 });
  }
  return pts;
}

function apiToChart(apiData, mode) {
  if (!apiData || !apiData.length) return [];
  return apiData.map(d => {
    const ts = new Date(d.ts);
    if (mode === 'day') return { time: ts.getHours() * 60 + ts.getMinutes(), inputV: d.inputV.avg, outputV: d.outputV.avg };
    if (mode === 'week') return { day: ts.getDay(), hour: ts.getHours(), label: ts.toLocaleDateString('en-US', { weekday: 'short' }), inputV: d.inputV.avg, outputV: d.outputV.avg };
    return { day: ts.getDate(), inputV: d.inputV.avg, outputV: d.outputV.avg };
  });
}

function calcStats(data) {
  if (!data || !data.length) return null;
  const inV = data.map(d => d.inputV);
  const outV = data.map(d => d.outputV);
  const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
  const aI = avg(inV), aO = avg(outV);
  const std = Math.sqrt(inV.reduce((s, v) => s + (v - aI) ** 2, 0) / inV.length);
  return {
    avgIn: aI.toFixed(1), avgOut: aO.toFixed(1),
    maxIn: Math.max(...inV).toFixed(1), minIn: Math.min(...inV).toFixed(1),
    maxOut: Math.max(...outV).toFixed(1), minOut: Math.min(...outV).toFixed(1),
    rangeIn: (Math.max(...inV) - Math.min(...inV)).toFixed(1),
    rangeOut: (Math.max(...outV) - Math.min(...outV)).toFixed(1),
    stability: Math.max(0, 100 - (std / aI) * 300).toFixed(0),
    readings: data.length,
  };
}

function fmtDate(d) { return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`; }
function fmtWeek(d) {
  const e = new Date(d); e.setDate(e.getDate() + 6);
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
function fmtMonth(d) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }

// ─── Date Picker Modal ───
function DatePickerModal({ visible, onClose, filter, dateRef, onSelect }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(dateRef.getFullYear());
  const [viewMonth, setViewMonth] = useState(dateRef.getMonth());

  useEffect(() => {
    if (visible) { setViewYear(dateRef.getFullYear()); setViewMonth(dateRef.getMonth()); }
  }, [visible, dateRef]);

  // Day calendar
  const renderDay = () => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push({ day: null });

    return (
      <View>
        <View style={dpStyles.navRow}>
          <TouchableOpacity style={dpStyles.navBtn} onPress={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(v => v - 1); } else setViewMonth(v => v - 1); }}>
            <Feather name="chevron-left" size={16} color={COLORS.text2} />
          </TouchableOpacity>
          <Text style={dpStyles.navLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
          <TouchableOpacity style={dpStyles.navBtn} onPress={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(v => v + 1); } else setViewMonth(v => v + 1); }}>
            <Feather name="chevron-right" size={16} color={COLORS.text2} />
          </TouchableOpacity>
        </View>
        <View style={dpStyles.wdRow}>
          {WEEKDAYS.map(w => <Text key={w} style={dpStyles.wd}>{w}</Text>)}
        </View>
        <View style={dpStyles.daysGrid}>
          {cells.map((c, i) => {
            if (!c.day) return <View key={i} style={dpStyles.dayCell} />;
            const isToday = c.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
            const isSel = c.day === dateRef.getDate() && viewMonth === dateRef.getMonth() && viewYear === dateRef.getFullYear();
            return (
              <TouchableOpacity key={i} style={[dpStyles.dayCell, dpStyles.dayBtn, isSel && dpStyles.daySel, isToday && !isSel && dpStyles.dayToday]}
                onPress={() => onSelect(new Date(viewYear, viewMonth, c.day))}>
                <Text style={[dpStyles.dayText, isSel && dpStyles.daySelText, isToday && !isSel && dpStyles.dayTodayText]}>{c.day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderMonth = () => (
    <View>
      <View style={dpStyles.navRow}>
        <TouchableOpacity style={dpStyles.navBtn} onPress={() => setViewYear(v => v - 1)}>
          <Feather name="chevron-left" size={16} color={COLORS.text2} />
        </TouchableOpacity>
        <Text style={dpStyles.navLabel}>{viewYear}</Text>
        <TouchableOpacity style={dpStyles.navBtn} onPress={() => setViewYear(v => v + 1)}>
          <Feather name="chevron-right" size={16} color={COLORS.text2} />
        </TouchableOpacity>
      </View>
      <View style={dpStyles.monthGrid}>
        {MONTHS.map((m, mi) => {
          const isCur = mi === today.getMonth() && viewYear === today.getFullYear();
          const isSel = mi === dateRef.getMonth() && viewYear === dateRef.getFullYear();
          return (
            <TouchableOpacity key={mi} style={[dpStyles.monthBtn, isSel && dpStyles.monthSel, isCur && !isSel && dpStyles.monthCur]}
              onPress={() => onSelect(new Date(viewYear, mi, 1))}>
              <Text style={[dpStyles.monthText, isSel && dpStyles.monthSelText]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const weekRows = useMemo(() => {
    const rows = []; let lastM = -1;
    for (let w = 1; w <= 52; w++) {
      const wS = new Date(viewYear, 0, 1 + (w - 1) * 7);
      const wE = new Date(wS); wE.setDate(wE.getDate() + 6);
      const mo = wS.getMonth();
      if (mo !== lastM) { rows.push({ type: 'header', month: MONTHS[mo] }); lastM = mo; }
      rows.push({ type: 'week', w, start: wS, end: wE, startLabel: `${MONTHS[wS.getMonth()]} ${wS.getDate()}`, endLabel: `${MONTHS[wE.getMonth()]} ${wE.getDate()}` });
    }
    return rows;
  }, [viewYear]);

  function getWeekNum(dt) {
    const start = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - start) / 86400000 + start.getDay() + 1) / 7);
  }
  const curWeek = getWeekNum(dateRef), todayWeek = getWeekNum(today);

  const renderWeek = () => (
    <View>
      <View style={dpStyles.navRow}>
        <TouchableOpacity style={dpStyles.navBtn} onPress={() => setViewYear(v => v - 1)}>
          <Feather name="chevron-left" size={16} color={COLORS.text2} />
        </TouchableOpacity>
        <Text style={dpStyles.navLabel}>{viewYear}</Text>
        <TouchableOpacity style={dpStyles.navBtn} onPress={() => setViewYear(v => v + 1)}>
          <Feather name="chevron-right" size={16} color={COLORS.text2} />
        </TouchableOpacity>
      </View>
      <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
        {weekRows.map((row, i) => {
          if (row.type === 'header') return <Text key={i} style={dpStyles.weekHeader}>{row.month}</Text>;
          const isSel = row.w === curWeek && viewYear === dateRef.getFullYear();
          const isCur = row.w === todayWeek && viewYear === today.getFullYear() && !isSel;
          return (
            <TouchableOpacity key={i} style={[dpStyles.weekRow, isSel && dpStyles.weekRowSel, isCur && dpStyles.weekRowCur]}
              onPress={() => onSelect(row.start)}>
              <Text style={[dpStyles.weekNum, isSel && dpStyles.weekSelText]}>Week {row.w}</Text>
              <Text style={[dpStyles.weekRange, isSel && dpStyles.weekSelText]}>{row.startLabel} – {row.endLabel}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={dpStyles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={dpStyles.popover} activeOpacity={1} onPress={e => e.stopPropagation()}>
          {filter === 'day' && renderDay()}
          {filter === 'month' && renderMonth()}
          {filter === 'week' && renderWeek()}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Stat Card ───
function StatCard({ label, value, unit, sub, subColor, iconName, iconBg, iconColor }) {
  return (
    <View style={[anStyles.card, { flex: 1 }]}>
      <View style={anStyles.statIconRow}>
        <View style={[anStyles.statIcon, { backgroundColor: iconBg }]}>
          <Feather name={iconName} size={16} color={iconColor} />
        </View>
      </View>
      <Text style={anStyles.statLabel}>{label}</Text>
      <Text style={anStyles.statValue}>{value}<Text style={anStyles.statUnit}> {unit}</Text></Text>
      {sub ? <Text style={[anStyles.statSub, { color: subColor || COLORS.text3 }]}>{sub}</Text> : null}
    </View>
  );
}

// ─── Main Analytics Screen ───
export default function AnalyticsScreen() {
  const { demoMode } = useApp();
  const { width } = useWindowDimensions();
  const chartWidth = width - 32; // 16px horizontal padding each side

  const [filter, setFilter] = useState('day');
  const [dateRef, setDateRef] = useState(new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const loadDemo = useCallback(() => {
    if (filter === 'day') return setData(genDemoDay(dateRef));
    if (filter === 'week') {
      const s = new Date(dateRef); s.setDate(s.getDate() - s.getDay());
      return setData(genDemoWeek(s));
    }
    setData(genDemoMonth(dateRef.getFullYear(), dateRef.getMonth()));
  }, [filter, dateRef]);

  useEffect(() => {
    if (demoMode) { loadDemo(); setLoading(false); return; }
    setLoading(true);
    const dateStr = `${dateRef.getFullYear()}-${String(dateRef.getMonth() + 1).padStart(2, '0')}-${String(dateRef.getDate()).padStart(2, '0')}`;
    fetch(`${API_URL}/analytics?range=${filter}&date=${dateStr}&resolution=5`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.json())
      .then(json => {
        setData(json.data && json.data.length ? apiToChart(json.data, filter) : []);
        setLoading(false);
      })
      .catch(() => { setData([]); setLoading(false); });
  }, [demoMode, filter, dateRef, loadDemo]);

  const navigate = useCallback(dir => {
    setDateRef(prev => {
      const d = new Date(prev);
      if (filter === 'day') d.setDate(d.getDate() + dir);
      else if (filter === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  }, [filter]);

  const stats = useMemo(() => calcStats(data), [data]);
  const dateLabel = filter === 'day' ? fmtDate(dateRef) : filter === 'week' ? fmtWeek(dateRef) : fmtMonth(dateRef);

  const latestIn = data.length ? data[data.length - 1].inputV : 0;
  const latestOut = data.length ? data[data.length - 1].outputV : 0;
  const shownIn = hoveredIdx != null && data[hoveredIdx] ? data[hoveredIdx].inputV : latestIn;
  const shownOut = hoveredIdx != null && data[hoveredIdx] ? data[hoveredIdx].outputV : latestOut;

  return (
    <SafeAreaView style={anStyles.safe} edges={['top']}>
      {/* Header */}
      <View style={anStyles.header}>
        <View>
          <Text style={anStyles.headerTitle}>Analytics</Text>
          <Text style={anStyles.headerSub}>Voltage trends over time</Text>
        </View>
        {demoMode && (
          <View style={anStyles.demoBadge}>
            <Text style={anStyles.demoText}>Demo</Text>
          </View>
        )}
      </View>

      <ScrollView style={anStyles.scroll} contentContainerStyle={anStyles.content} showsVerticalScrollIndicator={false}>
        {/* Filter tabs */}
        <View style={anStyles.filterTabs}>
          {['day', 'week', 'month'].map(f => (
            <TouchableOpacity key={f} style={[anStyles.filterTab, filter === f && anStyles.filterTabActive]}
              onPress={() => { setFilter(f); setPickerOpen(false); }}>
              <Text style={[anStyles.filterTabText, filter === f && anStyles.filterTabTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart card */}
        <View style={anStyles.card}>
          {/* Date nav */}
          <View style={anStyles.dateNav}>
            <TouchableOpacity style={anStyles.dateArrow} onPress={() => navigate(-1)}>
              <Feather name="chevron-left" size={18} color={COLORS.text2} />
            </TouchableOpacity>
            <TouchableOpacity style={anStyles.dateLabel} onPress={() => setPickerOpen(true)}>
              <Feather name="calendar" size={14} color={COLORS.primary} />
              <Text style={anStyles.dateLabelText}>{dateLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={anStyles.dateArrow} onPress={() => navigate(1)}>
              <Feather name="chevron-right" size={18} color={COLORS.text2} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={anStyles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={anStyles.loadingText}>Loading data…</Text>
            </View>
          ) : data.length === 0 ? (
            <View style={anStyles.emptyBox}>
              <Feather name="bar-chart-2" size={36} color={COLORS.text3} style={{ opacity: 0.35 }} />
              <Text style={anStyles.emptyTitle}>No Data Available</Text>
              <Text style={anStyles.emptyDesc}>
                {demoMode ? 'No demo data for this view.' : 'No recorded data for this period.\nTry a different date.'}
              </Text>
            </View>
          ) : (
            <>
              {/* Legend */}
              <View style={anStyles.legend}>
                <View style={anStyles.legendItem}>
                  <View style={[anStyles.legendDot, { backgroundColor: COLORS.inputColor }]} />
                  <Text style={anStyles.legendLabel}>Input</Text>
                  <Text style={anStyles.legendVal}>{shownIn.toFixed(1)} V</Text>
                </View>
                <View style={anStyles.legendItem}>
                  <View style={[anStyles.legendDot, { backgroundColor: COLORS.outputColor }]} />
                  <Text style={anStyles.legendLabel}>Output</Text>
                  <Text style={anStyles.legendVal}>{shownOut.toFixed(1)} V</Text>
                </View>
              </View>

              <VoltageChart data={data} mode={filter} containerWidth={chartWidth} />
            </>
          )}
        </View>

        {/* Stats grid */}
        {stats && (
          <>
            <View style={anStyles.statsRow}>
              <StatCard label="Avg Input" value={stats.avgIn} unit="V" sub={`Range: ${stats.rangeIn}V`}
                iconName="zap" iconBg={COLORS.primaryLight} iconColor={COLORS.primary} />
              <View style={{ width: 10 }} />
              <StatCard label="Avg Output" value={stats.avgOut} unit="V" sub={`Range: ${stats.rangeOut}V`}
                iconName="zap" iconBg={COLORS.blueBg} iconColor={COLORS.blue} />
            </View>
            <View style={[anStyles.statsRow, { marginTop: 10 }]}>
              <StatCard label="Peak Voltage" value={stats.maxIn} unit="V" sub="Highest input"
                subColor={COLORS.green} iconName="trending-up" iconBg={COLORS.greenBg} iconColor={COLORS.green} />
              <View style={{ width: 10 }} />
              <StatCard label="Stability" value={stats.stability} unit="%" sub={Number(stats.stability) >= 90 ? 'Excellent' : Number(stats.stability) >= 70 ? 'Good' : 'Needs attention'}
                subColor={Number(stats.stability) >= 90 ? COLORS.green : COLORS.amber} iconName="check-circle" iconBg={COLORS.greenBg} iconColor={COLORS.green} />
            </View>

            {/* Range bars */}
            <View style={[anStyles.card, { marginTop: 12 }]}>
              <Text style={anStyles.rangeTitle}>Voltage Range Analysis</Text>
              <RangeBar label="Input Voltage" min={stats.minIn} max={stats.maxIn} avg={stats.avgIn} color={COLORS.inputColor} />
              <View style={{ height: 16 }} />
              <RangeBar label="Output Voltage" min={stats.minOut} max={stats.maxOut} avg={stats.avgOut} color={COLORS.outputColor} />
            </View>
          </>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      <DatePickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        filter={filter}
        dateRef={dateRef}
        onSelect={d => { setDateRef(d); setPickerOpen(false); }}
      />
    </SafeAreaView>
  );
}

function RangeBar({ label, min, max, avg, color }) {
  const minN = Number(min), maxN = Number(max), avgN = Number(avg);
  const pct = maxN > minN ? ((avgN - minN) / (maxN - minN)) * 100 : 50;
  return (
    <View>
      <View style={anStyles.rangeCardTitle}>
        <View style={[anStyles.rcDot, { backgroundColor: color }]} />
        <Text style={anStyles.rangeCardLabel}>{label}</Text>
      </View>
      <View style={anStyles.rangeBarWrap}>
        <View style={anStyles.rangeBar}>
          <View style={[anStyles.rangeBarFill, { width: `${pct}%`, backgroundColor: color }]} />
          <View style={[anStyles.rangeBarMarker, { left: `${pct}%` }]} />
        </View>
      </View>
      <View style={anStyles.rangeInfo}>
        <View style={anStyles.rangeInfoItem}>
          <Text style={anStyles.rangeInfoLabel}>Min</Text>
          <Text style={[anStyles.rangeInfoVal, { color: COLORS.red }]}>{min}V</Text>
        </View>
        <View style={anStyles.rangeInfoItem}>
          <Text style={anStyles.rangeInfoLabel}>Average</Text>
          <Text style={anStyles.rangeInfoVal}>{avg}V</Text>
        </View>
        <View style={anStyles.rangeInfoItem}>
          <Text style={anStyles.rangeInfoLabel}>Max</Text>
          <Text style={[anStyles.rangeInfoVal, { color: COLORS.green }]}>{max}V</Text>
        </View>
      </View>
    </View>
  );
}

const anStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border,
    paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5, color: COLORS.text1 },
  headerSub: { fontSize: 12, color: COLORS.text3, fontWeight: '500', marginTop: 2 },
  demoBadge: { backgroundColor: COLORS.amberBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  demoText: { fontSize: 11, fontWeight: '700', color: COLORS.amber },
  scroll: { flex: 1 },
  content: { padding: 16 },
  filterTabs: {
    flexDirection: 'row', backgroundColor: COLORS.bg, borderRadius: 10,
    padding: 4, borderWidth: 1, borderColor: COLORS.borderLight, marginBottom: 14,
  },
  filterTab: { flex: 1, paddingVertical: 8, borderRadius: 7, alignItems: 'center' },
  filterTabActive: { backgroundColor: COLORS.primary },
  filterTabText: { fontSize: 13, fontWeight: '600', color: COLORS.text3 },
  filterTabTextActive: { color: 'white' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.borderLight, overflow: 'hidden', ...SHADOW.sm,
  },
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  dateArrow: {
    width: 34, height: 34, backgroundColor: COLORS.surface, borderWidth: 1,
    borderColor: COLORS.border, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
  },
  dateLabel: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 10, maxWidth: 220,
  },
  dateLabelText: { fontSize: 14, fontWeight: '700', color: COLORS.text1 },
  loadingBox: { padding: 48, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: COLORS.text3 },
  emptyBox: { padding: 48, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text2 },
  emptyDesc: { fontSize: 13, color: COLORS.text3, textAlign: 'center', lineHeight: 18 },
  legend: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 4, gap: 20 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text2 },
  legendVal: { fontSize: 13, fontWeight: '700', color: COLORS.text1 },
  statsRow: { flexDirection: 'row', marginTop: 12 },
  statIconRow: { marginBottom: 10 },
  statIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800', letterSpacing: -1, color: COLORS.text1 },
  statUnit: { fontSize: 13, fontWeight: '600', color: COLORS.text3, letterSpacing: 0 },
  statSub: { fontSize: 11, fontWeight: '600', marginTop: 5, color: COLORS.text3 },
  rangeTitle: { fontSize: 12, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.5, padding: 18, paddingBottom: 12 },
  rangeCardTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, marginBottom: 12 },
  rcDot: { width: 8, height: 8, borderRadius: 2 },
  rangeCardLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.5 },
  rangeBarWrap: { paddingHorizontal: 18 },
  rangeBar: { height: 8, borderRadius: 4, backgroundColor: COLORS.borderLight, position: 'relative', overflow: 'hidden' },
  rangeBarFill: { position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 4 },
  rangeBarMarker: { position: 'absolute', top: -4, width: 3, height: 16, borderRadius: 2, backgroundColor: COLORS.text1, marginLeft: -1.5 },
  rangeInfo: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 18, marginTop: 10 },
  rangeInfoItem: { alignItems: 'center' },
  rangeInfoLabel: { fontSize: 10, fontWeight: '500', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.3 },
  rangeInfoVal: { fontSize: 15, fontWeight: '700', color: COLORS.text1, marginTop: 2 },
});

const dpStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  popover: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, width: '100%', maxWidth: 340, ...SHADOW.md },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  navBtn: { width: 30, height: 30, borderWidth: 1, borderColor: COLORS.borderLight, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 14, fontWeight: '700', color: COLORS.text1 },
  wdRow: { flexDirection: 'row', marginBottom: 4 },
  wd: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayBtn: { borderRadius: 8 },
  daySel: { backgroundColor: COLORS.primary },
  dayToday: { borderWidth: 1.5, borderColor: COLORS.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: COLORS.text2 },
  daySelText: { color: 'white', fontWeight: '700' },
  dayTodayText: { color: COLORS.primary },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthBtn: { width: '30%', paddingVertical: 12, alignItems: 'center', borderRadius: 9 },
  monthSel: { backgroundColor: COLORS.primary },
  monthCur: { borderWidth: 1.5, borderColor: COLORS.primary },
  monthText: { fontSize: 13, fontWeight: '600', color: COLORS.text2 },
  monthSelText: { color: 'white', fontWeight: '700' },
  weekHeader: { fontSize: 11, fontWeight: '700', color: COLORS.text3, textTransform: 'uppercase', letterSpacing: 0.5, paddingVertical: 8, paddingHorizontal: 4 },
  weekRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9 },
  weekRowSel: { backgroundColor: COLORS.primary },
  weekRowCur: { borderWidth: 1.5, borderColor: COLORS.primary },
  weekNum: { fontSize: 13, fontWeight: '700', color: COLORS.text1 },
  weekRange: { fontSize: 12, fontWeight: '500', color: COLORS.text3 },
  weekSelText: { color: 'white' },
});
