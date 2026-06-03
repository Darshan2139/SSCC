import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText, Defs, LinearGradient, Stop } from 'react-native-svg';
import { COLORS } from '../theme';

const PAD_L = 46, PAD_R = 14, PAD_T = 18, PAD_B = 36;

function smoothPath(pts) {
  if (!pts || pts.length < 2) return '';
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const cpx = ((pts[i - 1].x + pts[i].x) / 2).toFixed(1);
    d += ` C ${cpx} ${pts[i - 1].y.toFixed(1)} ${cpx} ${pts[i].y.toFixed(1)} ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
  }
  return d;
}

function fillPath(pts, bottom) {
  const line = smoothPath(pts);
  if (!line) return '';
  return `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${bottom} L ${pts[0].x.toFixed(1)} ${bottom} Z`;
}

function getLabel(d, mode) {
  if (mode === 'day' && d.time != null) {
    const h = Math.floor(d.time / 60), m = d.time % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (mode === 'week') return `${d.label || ''} ${String(d.hour ?? 0).padStart(2, '0')}:00`;
  return `Day ${d.day}`;
}

export default function VoltageChart({ data, mode, containerWidth }) {
  const W = containerWidth || 320;
  const H = 260;
  const [hoverIdx, setHoverIdx] = useState(null);
  const hoverRef = useRef(null);          // last index, to skip duplicate setState
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const chartBottom = PAD_T + chartH;

  // Everything geometric is computed ONCE per data/size change — including the
  // heavy path strings — so dragging the finger never rebuilds them.
  const geom = useMemo(() => {
    if (!data || data.length === 0) {
      return { gridLines: [], xLabels: [], xPos: () => 0, yPos: () => 0,
        inputLine: '', outputLine: '', inputFill: '', outputFill: '' };
    }

    const allVals = data.flatMap(d => [d.inputV, d.outputV]);
    let minV = Math.floor(Math.min(...allVals) / 5) * 5;
    let maxV = Math.ceil(Math.max(...allVals) / 5) * 5;
    if (maxV - minV < 20) { minV -= 5; maxV += 5; }
    const rangeV = maxV - minV;

    const xPos = i => PAD_L + (i / Math.max(data.length - 1, 1)) * chartW;
    const yPos = v => PAD_T + (1 - (v - minV) / rangeV) * chartH;

    const step = Math.max(1, Math.floor(data.length / 80));
    const sampled = [];
    for (let i = 0; i < data.length; i += step) sampled.push({ ...data[i], _i: i });
    if (sampled[sampled.length - 1]._i !== data.length - 1) sampled.push({ ...data[data.length - 1], _i: data.length - 1 });

    const inputPts = sampled.map(d => ({ x: xPos(d._i), y: yPos(d.inputV) }));
    const outputPts = sampled.map(d => ({ x: xPos(d._i), y: yPos(d.outputV) }));

    const gridLines = [];
    for (let i = 0; i <= 4; i++) {
      const v = minV + (rangeV / 4) * i;
      gridLines.push({ v: Math.round(v), y: yPos(v) });
    }

    const xLabels = [];
    if (mode === 'day') {
      [0, 4, 8, 12, 16, 20].forEach(h => {
        const idx = Math.round((h / 24) * (data.length - 1));
        xLabels.push({ idx, label: `${String(h).padStart(2, '0')}:00` });
      });
    } else if (mode === 'week') {
      for (let d = 0; d < 7; d++) {
        const idx = Math.min(Math.round((d / 6) * (data.length - 1)), data.length - 1);
        if (data[idx]) xLabels.push({ idx, label: data[idx].label || `D${d + 1}` });
      }
    } else {
      const s = Math.max(1, Math.floor(data.length / 6));
      for (let i = 0; i < data.length; i += s) xLabels.push({ idx: i, label: String(data[i].day || i + 1) });
    }

    return {
      gridLines, xLabels, xPos, yPos,
      inputLine: smoothPath(inputPts),
      outputLine: smoothPath(outputPts),
      inputFill: fillPath(inputPts, chartBottom),
      outputFill: fillPath(outputPts, chartBottom),
    };
  }, [data, mode, chartW, chartH, chartBottom]);

  const { gridLines, xLabels, xPos, yPos, inputLine, outputLine, inputFill, outputFill } = geom;

  // Static chart layer — memoized so a hover/drag does NOT re-render it.
  const staticChart = useMemo(() => (
    <Svg width={W} height={H}>
      <Defs>
        <LinearGradient id="inG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.inputColor} stopOpacity="0.18" />
          <Stop offset="1" stopColor={COLORS.inputColor} stopOpacity="0.01" />
        </LinearGradient>
        <LinearGradient id="outG" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={COLORS.outputColor} stopOpacity="0.14" />
          <Stop offset="1" stopColor={COLORS.outputColor} stopOpacity="0.01" />
        </LinearGradient>
      </Defs>

      {gridLines.map((g, i) => (
        <React.Fragment key={i}>
          <Line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
          <SvgText x={PAD_L - 6} y={g.y + 4} textAnchor="end" fontSize={10} fill={COLORS.text3}>{g.v}V</SvgText>
        </React.Fragment>
      ))}

      {xLabels.map((xl, i) => (
        <SvgText key={i} x={xPos(xl.idx)} y={H - 8} textAnchor="middle" fontSize={10} fill={COLORS.text3}>
          {xl.label}
        </SvgText>
      ))}

      {outputFill ? <Path d={outputFill} fill="url(#outG)" /> : null}
      {inputFill ? <Path d={inputFill} fill="url(#inG)" /> : null}
      {outputLine ? <Path d={outputLine} stroke={COLORS.outputColor} strokeWidth={2} fill="none" strokeLinejoin="round" /> : null}
      {inputLine ? <Path d={inputLine} stroke={COLORS.inputColor} strokeWidth={2} fill="none" strokeLinejoin="round" /> : null}
    </Svg>
  ), [W, H, gridLines, xLabels, xPos, inputFill, outputFill, inputLine, outputLine]);

  const setHover = idx => {
    if (idx !== hoverRef.current) { hoverRef.current = idx; setHoverIdx(idx); }
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: e => {
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX - PAD_L) / chartW));
      setHover(Math.round(ratio * ((data?.length || 1) - 1)));
    },
    onPanResponderMove: e => {
      const ratio = Math.max(0, Math.min(1, (e.nativeEvent.locationX - PAD_L) / chartW));
      setHover(Math.round(ratio * ((data?.length || 1) - 1)));
    },
    onPanResponderRelease: () => setHover(null),
    onPanResponderTerminate: () => setHover(null),
  }), [data, chartW]);

  if (!data || data.length === 0) {
    return (
      <View style={[styles.empty, { height: H }]}>
        <Text style={styles.emptyText}>No data for this period</Text>
      </View>
    );
  }

  const hoverData = hoverIdx != null && data[hoverIdx] ? data[hoverIdx] : null;
  const hoverX = hoverData != null ? xPos(hoverIdx) : null;
  const hoverInY = hoverData ? yPos(hoverData.inputV) : null;
  const hoverOutY = hoverData ? yPos(hoverData.outputV) : null;

  // Tooltip position (clamped on-screen)
  const TT_W = 138;
  const ttLeft = hoverX != null ? Math.max(PAD_L, Math.min(hoverX - TT_W / 2, W - TT_W - 4)) : 0;

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      {staticChart}

      {/* Lightweight hover overlay — only THIS redraws while dragging */}
      {hoverData && (
        <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Line x1={hoverX} y1={PAD_T} x2={hoverX} y2={chartBottom}
            stroke="rgba(0,0,0,0.15)" strokeWidth={1} strokeDasharray="4,3" />
          <Circle cx={hoverX} cy={hoverInY} r={5} fill="white" stroke={COLORS.inputColor} strokeWidth={2.5} />
          <Circle cx={hoverX} cy={hoverOutY} r={5} fill="white" stroke={COLORS.outputColor} strokeWidth={2.5} />
        </Svg>
      )}

      {hoverData && (
        <View style={[styles.tooltip, { left: ttLeft, top: 12, width: TT_W }]} pointerEvents="none">
          <Text style={styles.ttTime} numberOfLines={1}>{getLabel(hoverData, mode)}</Text>
          <View style={styles.ttRow}>
            <View style={[styles.ttDot, { backgroundColor: COLORS.inputColor }]} />
            <Text style={styles.ttLabel} numberOfLines={1}>Input</Text>
            <Text style={styles.ttVal} numberOfLines={1}>{hoverData.inputV.toFixed(1)} V</Text>
          </View>
          <View style={styles.ttRow}>
            <View style={[styles.ttDot, { backgroundColor: COLORS.outputColor }]} />
            <Text style={styles.ttLabel} numberOfLines={1}>Output</Text>
            <Text style={styles.ttVal} numberOfLines={1}>{hoverData.outputV.toFixed(1)} V</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: COLORS.text3 },
  tooltip: {
    position: 'absolute',
    backgroundColor: '#1B1B18',
    borderRadius: 10,
    padding: 10,
    zIndex: 10,
  },
  ttTime: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 5 },
  ttRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  ttDot: { width: 7, height: 7, borderRadius: 2, marginRight: 6 },
  ttLabel: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  ttVal: { fontSize: 11, color: 'white', fontWeight: '700' },
});
