
// analytics-app.jsx — Analytics page component for SPA routing
// Loaded by index.html, rendered when hash is #analytics

var ANALYTICS_DEFAULT_RES = { day: 1, week: 5, month: 15 };
var ANALYTICS_RES_OPTIONS = [1, 2, 5, 10, 15, 30, 60];

// ─── Icons (analytics-local) ───
function AnLeftArrow() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>;
}
function AnRightArrow() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;
}
function AnCalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>;
}
function AnZapIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>;
}
function AnActivityIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>;
}

// ─── Date helpers ───
var AN_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var AN_WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function anFmtDate(d) { return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0'); }
function anFmtWeek(d) { var e = new Date(d); e.setDate(e.getDate()+6); return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' – '+e.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function anFmtMonth(d) { return d.toLocaleDateString('en-US',{month:'long',year:'numeric'}); }

// ─── Date Popover ───
function AnalyticsDatePopover({ open, filter, dateRef, onSelect, onClose }) {
  var [viewYear, setViewYear] = React.useState(dateRef.getFullYear());
  var [viewMonth, setViewMonth] = React.useState(dateRef.getMonth());
  var popRef = React.useRef(null);

  React.useEffect(function() {
    if (open) { setViewYear(dateRef.getFullYear()); setViewMonth(dateRef.getMonth()); }
  }, [open, dateRef]);

  // Week rows memo MUST be before any conditional return (Rules of Hooks)
  var weekRows = React.useMemo(function() {
    var rows = [];
    var lastMonth = -1;
    for (var w = 1; w <= 52; w++) {
      var wStart = new Date(viewYear, 0, 1 + (w - 1) * 7);
      var wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
      var mo = wStart.getMonth();
      if (mo !== lastMonth) { rows.push({ type: 'header', month: AN_MONTHS[mo] }); lastMonth = mo; }
      var startLabel = AN_MONTHS[wStart.getMonth()] + ' ' + wStart.getDate();
      var endLabel = AN_MONTHS[wEnd.getMonth()] + ' ' + wEnd.getDate();
      rows.push({ type: 'week', w: w, startLabel: startLabel, endLabel: endLabel, wStart: wStart });
    }
    return rows;
  }, [viewYear]);

  if (!open) return null;
  var today = new Date();

  // Day calendar
  if (filter === 'day') {
    var firstDay = new Date(viewYear, viewMonth, 1).getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    var cells = [];
    for (var i = 0; i < firstDay; i++) cells.push({ day: prevMonthDays - firstDay + 1 + i, other: true });
    for (var d = 1; d <= daysInMonth; d++) cells.push({ day: d, other: false });
    var remaining = 42 - cells.length;
    for (var j = 1; j <= remaining; j++) cells.push({ day: j, other: true });

    var prevM = function() { if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else setViewMonth(viewMonth - 1); };
    var nextM = function() { if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else setViewMonth(viewMonth + 1); };

    return (
      <React.Fragment>
        <div className="dp-overlay" onClick={onClose}></div>
        <div className="dp-popover" ref={popRef}>
          <div className="dp-header">
            <button className="dp-nav-btn" onClick={prevM}><AnLeftArrow /></button>
            <span className="dp-month-label">{AN_MONTHS[viewMonth]} {viewYear}</span>
            <button className="dp-nav-btn" onClick={nextM}><AnRightArrow /></button>
          </div>
          <div className="dp-weekdays">
            {AN_WEEKDAYS.map(function(w) { return <div key={w} className="dp-wd">{w}</div>; })}
          </div>
          <div className="dp-days">
            {cells.map(function(c, ci) {
              var isToday = !c.other && c.day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
              var isSel = !c.other && c.day === dateRef.getDate() && viewMonth === dateRef.getMonth() && viewYear === dateRef.getFullYear();
              return (
                <button key={ci}
                  className={'dp-day' + (c.other ? ' other-month' : '') + (isToday ? ' today' : '') + (isSel ? ' selected' : '')}
                  onClick={function() { if (!c.other) onSelect(new Date(viewYear, viewMonth, c.day)); }}>
                  {c.day}
                </button>
              );
            })}
          </div>
        </div>
      </React.Fragment>
    );
  }

  // Month picker
  if (filter === 'month') {
    return (
      <React.Fragment>
        <div className="dp-overlay" onClick={onClose}></div>
        <div className="dp-popover" ref={popRef}>
          <div className="dp-header">
            <button className="dp-nav-btn" onClick={function() { setViewYear(viewYear - 1); }}><AnLeftArrow /></button>
            <span className="dp-month-label">{viewYear}</span>
            <button className="dp-nav-btn" onClick={function() { setViewYear(viewYear + 1); }}><AnRightArrow /></button>
          </div>
          <div className="dp-months">
            {AN_MONTHS.map(function(m, mi) {
              var isCurrent = mi === today.getMonth() && viewYear === today.getFullYear();
              var isSel = mi === dateRef.getMonth() && viewYear === dateRef.getFullYear();
              return (
                <button key={mi}
                  className={'dp-month-btn' + (isCurrent ? ' current' : '') + (isSel ? ' selected' : '')}
                  onClick={function() { onSelect(new Date(viewYear, mi, 1)); }}>
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </React.Fragment>
    );
  }

  // Week picker
  var getWeekNum = function(dt) {
    var start = new Date(dt.getFullYear(), 0, 1);
    return Math.ceil(((dt - start) / 86400000 + start.getDay() + 1) / 7);
  };
  var currentWeek = getWeekNum(dateRef);
  var todayWeek = getWeekNum(today);

  return (
    <React.Fragment>
      <div className="dp-overlay" onClick={onClose}></div>
      <div className="dp-popover" ref={popRef}>
        <div className="dp-header">
          <button className="dp-nav-btn" onClick={function() { setViewYear(viewYear - 1); }}><AnLeftArrow /></button>
          <span className="dp-month-label">{viewYear}</span>
          <button className="dp-nav-btn" onClick={function() { setViewYear(viewYear + 1); }}><AnRightArrow /></button>
        </div>
        <div className="dp-week-list">
          {weekRows.map(function(row, ri) {
            if (row.type === 'header') return <div key={'mh'+ri} className="dp-week-month-label">{row.month}</div>;
            var isSel = row.w === currentWeek && viewYear === dateRef.getFullYear();
            var isCurr = row.w === todayWeek && viewYear === today.getFullYear() && !isSel;
            return (
              <button key={'w'+row.w}
                className={'dp-week-row' + (isSel ? ' selected' : '') + (isCurr ? ' current' : '')}
                onClick={function() { onSelect(row.wStart); }}>
                <span className="dp-wr-num">Week {row.w}</span>
                <span className="dp-wr-range">{row.startLabel} – {row.endLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

// ─── Demo Data Generators ───
function anGenDemoDay(dateObj) {
  var pts = [];
  var seed = dateObj.getDate() * 31 + dateObj.getMonth() * 7;
  function seededRand(i) { var x = Math.sin(seed + i * 9.2) * 10000; return x - Math.floor(x); }
  for (var m = 0; m < 1440; m += 3) {
    var hour = m / 60;
    var baseIn = 225 + 8 * Math.sin(hour * 0.26) + 4 * Math.cos(hour * 0.52);
    var baseOut = 220 + 3 * Math.sin(hour * 0.26) + 2 * Math.cos(hour * 0.52);
    pts.push({ time: m, inputV: Math.round((baseIn + (seededRand(m) - 0.5) * 10) * 10) / 10, outputV: Math.round((baseOut + (seededRand(m + 5000) - 0.5) * 4) * 10) / 10 });
  }
  return pts;
}
function anGenDemoWeek(startDate) {
  var pts = [];
  for (var d = 0; d < 7; d++) {
    var dayDate = new Date(startDate); dayDate.setDate(dayDate.getDate() + d);
    for (var h = 0; h < 24; h++) {
      var baseIn = 222 + 6 * Math.sin((d * 24 + h) * 0.15) + Math.sin(d * 3 + h * 0.7) * 4;
      var baseOut = 219 + 2 * Math.sin((d * 24 + h) * 0.15) + Math.sin(d * 2 + h * 0.5) * 2;
      var noise = (Math.sin(d * 97 + h * 37) * 10000) % 1;
      pts.push({ day: d, hour: h, label: dayDate.toLocaleDateString('en-US', { weekday: 'short' }), inputV: Math.round((baseIn + (noise - 0.5) * 6) * 10) / 10, outputV: Math.round((baseOut + (noise - 0.5) * 2.5) * 10) / 10 });
    }
  }
  return pts;
}
function anGenDemoMonth(year, month) {
  var days = new Date(year, month + 1, 0).getDate();
  var pts = [];
  for (var d = 1; d <= days; d++) {
    var baseIn = 224 + 4 * Math.sin(d * 0.4) + 2 * Math.cos(d * 0.8);
    var baseOut = 220 + 1.5 * Math.sin(d * 0.4);
    var noise = (Math.sin(d * 73 + month * 17) * 10000) % 1;
    pts.push({ day: d, inputV: Math.round((baseIn + (noise - 0.5) * 5) * 10) / 10, outputV: Math.round((baseOut + (noise - 0.5) * 2) * 10) / 10 });
  }
  return pts;
}

// ─── Chart Drawing ───
function anDrawChart(canvas, data, mode, hoverIdx, inputColor, outputColor) {
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = rect.width, H = rect.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  if (!data || data.length === 0) return;

  var PAD_L = 46, PAD_R = 14, PAD_T = 18, PAD_B = 34;
  var chartW = W - PAD_L - PAD_R, chartH = H - PAD_T - PAD_B;
  var allVals = data.flatMap(function(d) { return [d.inputV, d.outputV]; });
  var minV = Math.floor(Math.min.apply(null, allVals) / 5) * 5;
  var maxV = Math.ceil(Math.max.apply(null, allVals) / 5) * 5;
  if (maxV - minV < 20) { minV -= 5; maxV += 5; }
  var rangeV = maxV - minV;

  function xPos(i) { return PAD_L + (i / (data.length - 1)) * chartW; }
  function yPos(v) { return PAD_T + (1 - (v - minV) / rangeV) * chartH; }

  // Grid
  ctx.strokeStyle = 'rgba(0,0,0,0.055)'; ctx.lineWidth = 1;
  for (var gi = 0; gi <= 5; gi++) {
    var v = minV + (rangeV / 5) * gi; var y = yPos(v);
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
    ctx.fillStyle = '#A3A29E'; ctx.font = '500 10px "Plus Jakarta Sans",sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(v) + 'V', PAD_L - 8, y + 3.5);
  }

  // X labels
  ctx.fillStyle = '#A3A29E'; ctx.textAlign = 'center';
  var xLabels = [];
  if (mode === 'day') {
    [0,120,240,360,480,600,720,840,960,1080,1200,1320,1440].forEach(function(m) {
      xLabels.push({ idx: Math.round(m/3), label: String(Math.floor(m/60)).padStart(2,'0')+':00' });
    });
  } else if (mode === 'week') {
    for (var wd = 0; wd < 7; wd++) { var idx = wd*24+12; if (idx < data.length) xLabels.push({ idx: idx, label: data[idx] ? data[idx].label : '' }); }
  } else {
    var step = Math.max(1, Math.floor(data.length / 6));
    for (var xi = 0; xi < data.length; xi += step) xLabels.push({ idx: xi, label: String(data[xi].day) });
    if (xLabels[xLabels.length-1] && xLabels[xLabels.length-1].idx !== data.length-1) xLabels.push({ idx: data.length-1, label: String(data[data.length-1].day) });
  }
  xLabels.forEach(function(xl) { if (xl.idx >= 0 && xl.idx < data.length) ctx.fillText(xl.label, xPos(xl.idx), H - 8); });

  function drawCurve(points, color, fillGrad) {
    if (points.length < 2) return;
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (var ci = 1; ci < points.length; ci++) { var cpx = (points[ci-1].x + points[ci].x) / 2; ctx.bezierCurveTo(cpx, points[ci-1].y, cpx, points[ci].y, points[ci].x, points[ci].y); }
    if (fillGrad) {
      var fp = new Path2D(); fp.moveTo(points[0].x, points[0].y);
      for (var fi = 1; fi < points.length; fi++) { var cpx2 = (points[fi-1].x + points[fi].x) / 2; fp.bezierCurveTo(cpx2, points[fi-1].y, cpx2, points[fi].y, points[fi].x, points[fi].y); }
      fp.lineTo(points[points.length-1].x, PAD_T+chartH); fp.lineTo(points[0].x, PAD_T+chartH); fp.closePath();
      ctx.save(); ctx.fillStyle = fillGrad; ctx.fill(fp); ctx.restore();
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  }

  var sampleStep = Math.max(1, Math.floor(data.length / 400));
  var sampled = []; for (var si = 0; si < data.length; si += sampleStep) sampled.push(Object.assign({}, data[si], { _idx: si }));
  if (sampled[sampled.length-1]._idx !== data.length-1) sampled.push(Object.assign({}, data[data.length-1], { _idx: data.length-1 }));

  var inputPts = sampled.map(function(d) { return { x: xPos(d._idx), y: yPos(d.inputV) }; });
  var outputPts = sampled.map(function(d) { return { x: xPos(d._idx), y: yPos(d.outputV) }; });

  var inG = ctx.createLinearGradient(0,PAD_T,0,PAD_T+chartH); inG.addColorStop(0,inputColor+'30'); inG.addColorStop(1,inputColor+'03');
  var outG = ctx.createLinearGradient(0,PAD_T,0,PAD_T+chartH); outG.addColorStop(0,outputColor+'25'); outG.addColorStop(1,outputColor+'03');
  drawCurve(outputPts, outputColor, outG);
  drawCurve(inputPts, inputColor, inG);

  if (hoverIdx != null && hoverIdx >= 0 && hoverIdx < data.length) {
    var hx = xPos(hoverIdx);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(hx, PAD_T); ctx.lineTo(hx, PAD_T+chartH); ctx.stroke(); ctx.setLineDash([]);
    [{ y: yPos(data[hoverIdx].inputV), color: inputColor }, { y: yPos(data[hoverIdx].outputV), color: outputColor }].forEach(function(dot) {
      ctx.beginPath(); ctx.arc(hx, dot.y, 5, 0, Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle=dot.color; ctx.lineWidth=2.5; ctx.stroke();
    });
  }
}

// ─── Chart Component ───
function AnalyticsVoltageChart({ data, mode, onHover }) {
  var canvasRef = React.useRef(null);
  var wrapRef = React.useRef(null);
  var [hoverIdx, setHoverIdx] = React.useState(null);
  var [tooltipPos, setTooltipPos] = React.useState({ x: 0, y: 0 });
  var inputColor = '#D97757', outputColor = '#3572B0';

  var handleInteraction = React.useCallback(function(clientX, clientY) {
    var canvas = canvasRef.current; if (!canvas || !data || !data.length) return;
    var rect = canvas.getBoundingClientRect();
    var x = clientX - rect.left - 46; var ratio = Math.max(0, Math.min(1, x / (rect.width - 60)));
    var idx = Math.round(ratio * (data.length - 1));
    setHoverIdx(idx); setTooltipPos({ x: clientX - rect.left, y: clientY - rect.top });
    if (onHover) onHover(idx);
  }, [data, onHover]);

  var clearHover = React.useCallback(function() { setHoverIdx(null); if (onHover) onHover(null); }, [onHover]);

  React.useEffect(function() { var c = canvasRef.current; if (c) anDrawChart(c, data, mode, hoverIdx, inputColor, outputColor); }, [data, mode, hoverIdx]);
  React.useEffect(function() {
    var c = canvasRef.current; if (!c) return;
    var obs = new ResizeObserver(function() { anDrawChart(c, data, mode, hoverIdx, inputColor, outputColor); });
    obs.observe(c); return function() { obs.disconnect(); };
  }, [data, mode, hoverIdx]);

  var hoverData = hoverIdx != null && data && data[hoverIdx] ? data[hoverIdx] : null;
  var tooltipTime = '';
  if (hoverData) {
    if (mode === 'day') { var m = hoverData.time; tooltipTime = String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
    else if (mode === 'week') tooltipTime = hoverData.label + ' ' + String(hoverData.hour).padStart(2,'0')+':00';
    else tooltipTime = 'Day ' + hoverData.day;
  }

  return (
    <div className="chart-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} className="chart-canvas" style={{height:280}}
        onMouseMove={function(e) { handleInteraction(e.clientX, e.clientY); }}
        onMouseLeave={clearHover}
        onTouchStart={function(e) { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchMove={function(e) { e.preventDefault(); handleInteraction(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={clearHover}></canvas>
      {hoverData && (
        <div className="chart-tooltip visible" style={{ left: Math.max(80, Math.min(tooltipPos.x, (wrapRef.current ? wrapRef.current.offsetWidth : 300)-80)), top: Math.max(60, tooltipPos.y - 8) }}>
          <div className="tt-time">{tooltipTime}</div>
          <div className="tt-row"><span className="tt-dot" style={{background:inputColor}}></span><span className="tt-label">Input</span><span className="tt-val">{hoverData.inputV.toFixed(1)} V</span></div>
          <div className="tt-row"><span className="tt-dot" style={{background:outputColor}}></span><span className="tt-label">Output</span><span className="tt-val">{hoverData.outputV.toFixed(1)} V</span></div>
        </div>
      )}
    </div>
  );
}

// ─── Stats calculator ───
function anCalcStats(data) {
  if (!data || !data.length) return null;
  var inV = data.map(function(d) { return d.inputV; });
  var outV = data.map(function(d) { return d.outputV; });
  var avg = function(a) { return a.reduce(function(s,v){return s+v;},0)/a.length; };
  var aI = avg(inV), aO = avg(outV);
  var std = Math.sqrt(inV.reduce(function(s,v){return s+Math.pow(v-aI,2);},0)/inV.length);
  return {
    avgIn:aI.toFixed(1), avgOut:aO.toFixed(1),
    maxIn:Math.max.apply(null,inV).toFixed(1), minIn:Math.min.apply(null,inV).toFixed(1),
    maxOut:Math.max.apply(null,outV).toFixed(1), minOut:Math.min.apply(null,outV).toFixed(1),
    rangeIn:(Math.max.apply(null,inV)-Math.min.apply(null,inV)).toFixed(1),
    rangeOut:(Math.max.apply(null,outV)-Math.min.apply(null,outV)).toFixed(1),
    stability: Math.max(0,100-(std/aI)*300).toFixed(0),
    readings: data.length,
  };
}

// ─── API data transform ───
function anApiToChartData(apiData, mode) {
  if (!apiData || !apiData.length) return [];
  return apiData.map(function(d) {
    var ts = new Date(d.ts);
    if (mode === 'day') {
      return { time: ts.getHours() * 60 + ts.getMinutes(), inputV: d.inputV.avg, outputV: d.outputV.avg };
    } else if (mode === 'week') {
      var dow = ts.getDay();
      return { day: dow === 0 ? 6 : dow - 1, hour: ts.getHours(), label: ts.toLocaleDateString('en-US', { weekday: 'short' }), inputV: d.inputV.avg, outputV: d.outputV.avg };
    } else {
      return { day: ts.getDate(), inputV: d.inputV.avg, outputV: d.outputV.avg };
    }
  });
}

// ─── Main Analytics Page Component ───
function AnalyticsPage({ demoMode }) {
  var [filter, setFilter] = React.useState('day');
  var [dateRef, setDateRef] = React.useState(new Date());
  var [hoveredIdx, setHoveredIdx] = React.useState(null);
  var [pickerOpen, setPickerOpen] = React.useState(false);
  var [resolution, setResolution] = React.useState(ANALYTICS_DEFAULT_RES['day']);
  var [data, setData] = React.useState([]);
  var [loading, setLoading] = React.useState(false);
  var [isDemo, setIsDemo] = React.useState(false);

  // Helper to load demo data for current filter/date
  function loadDemoData() {
    if (filter === 'day') return anGenDemoDay(dateRef);
    if (filter === 'week') { var s = new Date(dateRef); s.setDate(s.getDate()-s.getDay()); return anGenDemoWeek(s); }
    return anGenDemoMonth(dateRef.getFullYear(), dateRef.getMonth());
  }

  // Fetch data from API or use demo
  React.useEffect(function() {
    // Demo mode ON → show demo data
    if (demoMode) {
      setData(loadDemoData());
      setIsDemo(true);
      setLoading(false);
      return;
    }

    // Demo mode OFF + no server → empty state
    if (!KOYEB_URL) {
      setData([]);
      setIsDemo(false);
      setLoading(false);
      return;
    }

    // Demo mode OFF + server → fetch real data
    setLoading(true);
    var dateStr = dateRef.getFullYear() + '-' + String(dateRef.getMonth()+1).padStart(2,'0') + '-' + String(dateRef.getDate()).padStart(2,'0');
    var url = KOYEB_URL + '/analytics?range=' + filter + '&date=' + dateStr + '&resolution=' + resolution;
    fetch(url).then(function(res) { return res.json(); }).then(function(json) {
      if (json.data && json.data.length > 0) {
        setData(anApiToChartData(json.data, filter));
        setIsDemo(false);
      } else {
        setData([]);
        setIsDemo(false);
      }
      setLoading(false);
    }).catch(function(e) {
      console.error('Analytics fetch failed:', e);
      setData([]);
      setIsDemo(false);
      setLoading(false);
    });
  }, [demoMode, filter, dateRef, resolution]);

  React.useEffect(function() { setResolution(ANALYTICS_DEFAULT_RES[filter] || 1); }, [filter]);

  var stats = React.useMemo(function() { return anCalcStats(data); }, [data]);

  var navigate = React.useCallback(function(dir) {
    setDateRef(function(prev) {
      var d = new Date(prev);
      if (filter === 'day') d.setDate(d.getDate() + dir);
      else if (filter === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setMonth(d.getMonth() + dir);
      return d;
    });
  }, [filter]);

  var dateLabel = filter === 'day' ? anFmtDate(dateRef) : filter === 'week' ? anFmtWeek(dateRef) : anFmtMonth(dateRef);
  var latestIn = data.length > 0 ? data[data.length-1].inputV : 0;
  var latestOut = data.length > 0 ? data[data.length-1].outputV : 0;
  var shownIn = hoveredIdx != null && data[hoveredIdx] ? data[hoveredIdx].inputV : latestIn;
  var shownOut = hoveredIdx != null && data[hoveredIdx] ? data[hoveredIdx].outputV : latestOut;

  return (
    <div className="analytics-page">
      <div className="container">
        <div className="page-title-row">
          <div>
            <div className="page-title">Voltage Analytics</div>
            <div className="page-title-sub">Input &amp; output voltage trends over time</div>
          </div>
          <div className="filter-tabs">
            {['day','week','month'].map(function(f) {
              return (
                <button key={f} className={'filter-tab'+(filter===f?' active':'')} onClick={function(){setFilter(f);setPickerOpen(false);}}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {isDemo && (
          <div style={{background:'var(--amber-bg)',color:'var(--amber)',padding:'8px 16px',borderRadius:'var(--radius-sm)',fontSize:'12px',fontWeight:600,marginBottom:16,textAlign:'center'}}>
            Demo mode — showing sample data
          </div>
        )}

        {!demoMode && data.length === 0 && !loading && (
          <div className="card" style={{padding:'48px 24px',textAlign:'center',marginBottom:20}}>
            <div style={{fontSize:40,marginBottom:12,opacity:0.3}}>📊</div>
            <div style={{fontSize:16,fontWeight:700,color:'var(--text-2)',marginBottom:6}}>No Data Available</div>
            <div style={{fontSize:13,color:'var(--text-3)',maxWidth:320,margin:'0 auto'}}>
              {KOYEB_URL ? 'No recorded data for this period. Data will appear once the device starts sending readings.'
                : 'Enable Demo Mode in Settings to see sample analytics data.'}
            </div>
          </div>
        )}

        <div className="card" style={{display: (!demoMode && data.length === 0 && !loading) ? 'none' : ''}}>
          <div className="date-nav">
            <button className="date-arrow" onClick={function(){navigate(-1);}}><AnLeftArrow /></button>
            <button className="date-label-btn" onClick={function(){setPickerOpen(!pickerOpen);}}>
              <AnCalIcon />{dateLabel}
            </button>
            <button className="date-arrow" onClick={function(){navigate(1);}}><AnRightArrow /></button>
            <AnalyticsDatePopover open={pickerOpen} filter={filter} dateRef={dateRef}
              onSelect={function(d){setDateRef(d);setPickerOpen(false);}}
              onClose={function(){setPickerOpen(false);}} />
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',flexWrap:'wrap',gap:8}}>
            <div className="chart-legend" style={{padding:0}}>
              <div className="legend-item"><span className="legend-dot" style={{background:'var(--input-color)'}}></span>Input Voltage<span className="legend-value">{shownIn.toFixed(1)} V</span></div>
              <div className="legend-item"><span className="legend-dot" style={{background:'var(--output-color)'}}></span>Output Voltage<span className="legend-value">{shownOut.toFixed(1)} V</span></div>
            </div>
            {KOYEB_URL && (
              <div style={{display:'flex',alignItems:'center',gap:6,fontSize:'11px',fontWeight:600,color:'var(--text-3)'}}>
                <span>Resolution:</span>
                <select value={resolution} onChange={function(e){setResolution(Number(e.target.value));}}
                  style={{padding:'4px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--surface)',fontSize:'11px',fontWeight:600,fontFamily:'var(--font)',color:'var(--text-2)',cursor:'pointer'}}>
                  {ANALYTICS_RES_OPTIONS.map(function(r) { return <option key={r} value={r}>{r >= 60 ? (r/60)+'h' : r+'m'}</option>; })}
                </select>
              </div>
            )}
          </div>
          <AnalyticsVoltageChart data={data} mode={filter} onHover={setHoveredIdx} />
        </div>

        {stats && (
          <div className="an-stats-grid">
            <div className="card stat-card">
              <div className="stat-icon-row"><div className="stat-icon" style={{background:'var(--primary-light)'}}><AnZapIcon /></div></div>
              <div className="stat-label">Avg Input</div>
              <div className="stat-value">{stats.avgIn}<span className="stat-unit"> V</span></div>
              <div className="stat-change stat-change--neutral">Range: {stats.rangeIn}V</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon-row"><div className="stat-icon" style={{background:'var(--blue-bg)'}}><svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg></div></div>
              <div className="stat-label">Avg Output</div>
              <div className="stat-value">{stats.avgOut}<span className="stat-unit"> V</span></div>
              <div className="stat-change stat-change--neutral">Range: {stats.rangeOut}V</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon-row"><div className="stat-icon" style={{background:'var(--green-bg)'}}><svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg></div></div>
              <div className="stat-label">Peak Voltage</div>
              <div className="stat-value">{stats.maxIn}<span className="stat-unit"> V</span></div>
              <div className="stat-change stat-change--up">Highest input recorded</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon-row"><div className="stat-icon" style={{background:'var(--red-bg)'}}><svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg></div></div>
              <div className="stat-label">Lowest Voltage</div>
              <div className="stat-value">{stats.minIn}<span className="stat-unit"> V</span></div>
              <div className="stat-change stat-change--down">Lowest input recorded</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon-row"><div className="stat-icon" style={{background:'var(--green-bg)'}}><svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div></div>
              <div className="stat-label">Stability</div>
              <div className="stat-value">{stats.stability}<span className="stat-unit">%</span></div>
              <div className={'stat-change '+(Number(stats.stability)>=90?'stat-change--up':'stat-change--down')}>{Number(stats.stability)>=90?'Excellent':Number(stats.stability)>=70?'Good':'Needs attention'}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon-row"><div className="stat-icon" style={{background:'var(--amber-bg)'}}><svg viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg></div></div>
              <div className="stat-label">Readings</div>
              <div className="stat-value">{stats.readings.toLocaleString()}</div>
              <div className="stat-change stat-change--neutral">{resolution >= 60 ? (resolution/60)+'h' : resolution+'m'} resolution{isDemo ? ' (demo)' : ''}</div>
            </div>
          </div>
        )}

        {stats && (
          <div className="range-section">
            <div className="range-section-title"><AnActivityIcon /> Voltage Range Analysis</div>
            <div className="range-cards">
              <div className="card range-card">
                <div className="range-card-title"><span className="rc-dot" style={{background:'var(--input-color)'}}></span>Input Voltage Range</div>
                <div className="range-bar-wrap">
                  <div className="range-bar-labels"><span>{stats.minIn}V</span><span>{stats.maxIn}V</span></div>
                  <div className="range-bar">
                    <div className="range-bar-fill" style={{background:'linear-gradient(90deg,var(--input-color)40,var(--input-color))',width:((Number(stats.avgIn)-Number(stats.minIn))/(Number(stats.maxIn)-Number(stats.minIn))*100)+'%'}}></div>
                    <div className="range-bar-marker" style={{left:((Number(stats.avgIn)-Number(stats.minIn))/(Number(stats.maxIn)-Number(stats.minIn))*100)+'%'}}></div>
                  </div>
                </div>
                <div className="range-info">
                  <div className="range-info-item"><div className="range-info-label">Min</div><div className="range-info-val" style={{color:'var(--red)'}}>{stats.minIn}V</div></div>
                  <div className="range-info-item"><div className="range-info-label">Average</div><div className="range-info-val">{stats.avgIn}V</div></div>
                  <div className="range-info-item"><div className="range-info-label">Max</div><div className="range-info-val" style={{color:'var(--green)'}}>{stats.maxIn}V</div></div>
                </div>
              </div>
              <div className="card range-card">
                <div className="range-card-title"><span className="rc-dot" style={{background:'var(--output-color)'}}></span>Output Voltage Range</div>
                <div className="range-bar-wrap">
                  <div className="range-bar-labels"><span>{stats.minOut}V</span><span>{stats.maxOut}V</span></div>
                  <div className="range-bar">
                    <div className="range-bar-fill" style={{background:'linear-gradient(90deg,var(--output-color)40,var(--output-color))',width:((Number(stats.avgOut)-Number(stats.minOut))/(Number(stats.maxOut)-Number(stats.minOut))*100)+'%'}}></div>
                    <div className="range-bar-marker" style={{left:((Number(stats.avgOut)-Number(stats.minOut))/(Number(stats.maxOut)-Number(stats.minOut))*100)+'%'}}></div>
                  </div>
                </div>
                <div className="range-info">
                  <div className="range-info-item"><div className="range-info-label">Min</div><div className="range-info-val" style={{color:'var(--red)'}}>{stats.minOut}V</div></div>
                  <div className="range-info-item"><div className="range-info-label">Average</div><div className="range-info-val">{stats.avgOut}V</div></div>
                  <div className="range-info-item"><div className="range-info-label">Max</div><div className="range-info-val" style={{color:'var(--green)'}}>{stats.maxOut}V</div></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
