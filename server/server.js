'use strict';

require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');
const Reading  = require('./models/reading');

const app = express();
app.use(express.json());
app.use(cors());

// ══════════════════════════════════════════════════════════════
// ██  MONGODB CONNECTION  ██
// ══════════════════════════════════════════════════════════════

const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('ERROR: MONGODB_URI not set in environment');
  console.error('Create a .env file with your MongoDB Atlas connection string');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ══════════════════════════════════════════════════════════════
// ██  IN-MEMORY STATE (live dashboard — unchanged)  ██
// ══════════════════════════════════════════════════════════════

const MAX_LOGS = 50;

const state = {
  inputVoltage:      0,
  outputVoltage:     0,
  fanStatus:         false,
  pendingFanCommand: null,
  logs:              [],
  lastUpdate:        null,
};

function pushLog(entry) {
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) state.logs.shift();
}

// ══════════════════════════════════════════════════════════════
// ██  1-MINUTE AGGREGATION BUFFER  ██
// ══════════════════════════════════════════════════════════════
// ESP sends every 3s → ~20 samples/minute
// We buffer them, then flush ONE document to MongoDB per minute

let bucket = null;   // current minute's accumulator

function getBucketKey(date) {
  // Round down to the start of the current minute
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(),
                  date.getHours(), date.getMinutes(), 0, 0).getTime();
}

function addToBucket(inputV, outputV, fanStatus) {
  const now = new Date();
  const key = getBucketKey(now);

  // If minute rolled over, flush the old bucket first
  if (bucket && bucket.key !== key) {
    flushBucket();
  }

  // Create new bucket if needed
  if (!bucket) {
    bucket = {
      key,
      ts: new Date(key),
      inputVals:  [],
      outputVals: [],
      fanOn: 0,
      fanOff: 0,
    };
  }

  bucket.inputVals.push(inputV);
  bucket.outputVals.push(outputV);
  if (fanStatus) bucket.fanOn++; else bucket.fanOff++;
}

async function flushBucket() {
  if (!bucket || bucket.inputVals.length === 0) return;

  const b = bucket;
  bucket = null;  // clear immediately so new data goes to fresh bucket

  const inVals  = b.inputVals;
  const outVals = b.outputVals;
  const n       = inVals.length;

  const doc = {
    ts: b.ts,
    inputV: {
      avg: Math.round((inVals.reduce((s, v) => s + v, 0) / n) * 10) / 10,
      min: Math.round(Math.min(...inVals) * 10) / 10,
      max: Math.round(Math.max(...inVals) * 10) / 10,
    },
    outputV: {
      avg: Math.round((outVals.reduce((s, v) => s + v, 0) / n) * 10) / 10,
      min: Math.round(Math.min(...outVals) * 10) / 10,
      max: Math.round(Math.max(...outVals) * 10) / 10,
    },
    fan: b.fanOn >= b.fanOff,
    n,
  };

  try {
    await Reading.create(doc);
  } catch (err) {
    console.error('Failed to flush bucket:', err.message);
  }
}

// Flush any partial bucket every 60s (safety net)
setInterval(() => {
  if (bucket && bucket.inputVals.length > 0) {
    const age = Date.now() - bucket.key;
    if (age >= 60000) flushBucket();
  }
}, 15000);

// ══════════════════════════════════════════════════════════════
// ██  DATA CLEANUP (keep storage lean)  ██
// ══════════════════════════════════════════════════════════════
// Delete raw 1-min data older than 1 year
// Runs once per day

async function cleanupOldData() {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  try {
    const result = await Reading.deleteMany({ ts: { $lt: oneYearAgo } });
    if (result.deletedCount > 0) {
      console.log(`Cleanup: deleted ${result.deletedCount} readings older than 1 year`);
    }
  } catch (err) {
    console.error('Cleanup failed:', err.message);
  }
}

// Run cleanup once on start, then every 24 hours
setTimeout(cleanupOldData, 10000);
setInterval(cleanupOldData, 24 * 60 * 60 * 1000);

// ══════════════════════════════════════════════════════════════
// ██  EXISTING ROUTES (unchanged behavior)  ██
// ══════════════════════════════════════════════════════════════

// ESP → server: voltage readings + optional event
app.post('/update', (req, res) => {
  const { inputVoltage, outputVoltage, fanStatus, event } = req.body;

  if (typeof inputVoltage !== 'number' || typeof outputVoltage !== 'number') {
    return res.status(400).json({ error: 'inputVoltage and outputVoltage must be numbers' });
  }

  // ── Update live state (for dashboard) ──
  state.inputVoltage  = inputVoltage;
  state.outputVoltage = outputVoltage;
  if (typeof fanStatus === 'boolean') state.fanStatus = fanStatus;
  state.lastUpdate = new Date().toISOString();

  pushLog({
    timestamp:     state.lastUpdate,
    type:          event || 'UPDATE',
    inputVoltage,
    outputVoltage,
    fanStatus:     state.fanStatus,
    event:         event || null,
  });

  // ── Add to 1-min aggregation buffer (for analytics) ──
  addToBucket(inputVoltage, outputVoltage, state.fanStatus);

  res.json({ ok: true });
});

// Frontend → GET live state
app.get('/state', (_req, res) => {
  res.json({
    inputVoltage:  state.inputVoltage,
    outputVoltage: state.outputVoltage,
    fanStatus:     state.fanStatus,
    logs:          state.logs,
    lastUpdate:    state.lastUpdate,
  });
});

// Frontend → set pending fan command
app.post('/fan', (req, res) => {
  const { command } = req.body;
  if (command !== 'ON' && command !== 'OFF') {
    return res.status(400).json({ error: "command must be 'ON' or 'OFF'" });
  }
  state.pendingFanCommand = command;
  res.json({ ok: true, command });
});

// ESP → poll for pending fan command (consume + clear)
app.get('/command', (_req, res) => {
  const command = state.pendingFanCommand;
  state.pendingFanCommand = null;
  res.json({ command });
});

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ══════════════════════════════════════════════════════════════
// ██  ANALYTICS API  ██
// ══════════════════════════════════════════════════════════════

// GET /analytics?range=day&date=2026-05-28&resolution=1
//   range:      day | week | month
//   date:       YYYY-MM-DD (defaults to today)
//   resolution: minutes per point — 1, 2, 3, 5, 10, 15, 30, 60
//               defaults: day→1, week→5, month→15

const VALID_RESOLUTIONS = [1, 2, 3, 5, 10, 15, 30, 60];
const DEFAULT_RES = { day: 1, week: 5, month: 15 };

app.get('/analytics', async (req, res) => {
  try {
    const range = req.query.range || 'day';
    const dateStr = req.query.date;
    const resParam = parseInt(req.query.resolution) || DEFAULT_RES[range] || 1;

    // Validate resolution
    const resolution = VALID_RESOLUTIONS.includes(resParam) ? resParam : DEFAULT_RES[range] || 1;

    // Parse date
    let refDate;
    if (dateStr) {
      refDate = new Date(dateStr + 'T00:00:00+05:30');  // IST
      if (isNaN(refDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      }
    } else {
      // Default to today IST
      const now = new Date();
      const ist = new Date(now.getTime() + 19800000);  // UTC+5:30
      refDate = new Date(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
    }

    // Calculate time range
    let start, end;
    if (range === 'day') {
      start = new Date(refDate);
      end = new Date(refDate);
      end.setDate(end.getDate() + 1);
    } else if (range === 'week') {
      // Start from Monday of the week containing refDate
      start = new Date(refDate);
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;  // Monday = start
      start.setDate(start.getDate() + diff);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
    } else if (range === 'month') {
      start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    } else {
      return res.status(400).json({ error: "range must be 'day', 'week', or 'month'" });
    }

    // If resolution === 1, just return raw 1-min documents
    if (resolution === 1) {
      const docs = await Reading.find(
        { ts: { $gte: start, $lt: end } },
        { _id: 0, __v: 0 }
      ).sort({ ts: 1 }).lean();

      return res.json({
        range, resolution, start, end,
        count: docs.length,
        data: docs,
      });
    }

    // For larger resolutions, aggregate 1-min data into bigger buckets
    const resMs = resolution * 60 * 1000;

    const pipeline = [
      { $match: { ts: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            // Floor timestamp to resolution bucket
            $subtract: [
              { $toLong: '$ts' },
              { $mod: [{ $toLong: '$ts' }, resMs] }
            ]
          },
          avgIn:  { $avg: '$inputV.avg' },
          minIn:  { $min: '$inputV.min' },
          maxIn:  { $max: '$inputV.max' },
          avgOut: { $avg: '$outputV.avg' },
          minOut: { $min: '$outputV.min' },
          maxOut: { $max: '$outputV.max' },
          fan:    { $avg: { $cond: ['$fan', 1, 0] } },  // % of time fan was on
          n:      { $sum: '$n' },
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          ts: { $toDate: '$_id' },
          inputV:  { avg: { $round: ['$avgIn', 1] }, min: { $round: ['$minIn', 1] }, max: { $round: ['$maxIn', 1] } },
          outputV: { avg: { $round: ['$avgOut', 1] }, min: { $round: ['$minOut', 1] }, max: { $round: ['$maxOut', 1] } },
          fan: { $gte: ['$fan', 0.5] },   // majority
          n: 1,
        }
      }
    ];

    const data = await Reading.aggregate(pipeline);

    res.json({
      range, resolution, start, end,
      count: data.length,
      data,
    });

  } catch (err) {
    console.error('Analytics error:', err.message);
    res.status(500).json({ error: 'Analytics query failed' });
  }
});

// GET /analytics/stats?range=day&date=2026-05-28
// Returns summary stats for the period (no time series, just numbers)
app.get('/analytics/stats', async (req, res) => {
  try {
    const range = req.query.range || 'day';
    const dateStr = req.query.date;

    let refDate;
    if (dateStr) {
      refDate = new Date(dateStr + 'T00:00:00+05:30');
      if (isNaN(refDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date' });
      }
    } else {
      const now = new Date();
      const ist = new Date(now.getTime() + 19800000);
      refDate = new Date(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
    }

    let start, end;
    if (range === 'day') {
      start = new Date(refDate);
      end = new Date(refDate); end.setDate(end.getDate() + 1);
    } else if (range === 'week') {
      start = new Date(refDate);
      const dow = start.getDay();
      start.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));
      end = new Date(start); end.setDate(end.getDate() + 7);
    } else {
      start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
      end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
    }

    const pipeline = [
      { $match: { ts: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: null,
          avgIn:  { $avg: '$inputV.avg' },
          minIn:  { $min: '$inputV.min' },
          maxIn:  { $max: '$inputV.max' },
          avgOut: { $avg: '$outputV.avg' },
          minOut: { $min: '$outputV.min' },
          maxOut: { $max: '$outputV.max' },
          totalSamples: { $sum: '$n' },
          readings: { $sum: 1 },
          fanOnCount: { $sum: { $cond: ['$fan', 1, 0] } },
        }
      }
    ];

    const result = await Reading.aggregate(pipeline);

    if (result.length === 0) {
      return res.json({ range, start, end, data: null });
    }

    const r = result[0];
    const rangeIn = r.maxIn - r.minIn;
    const avgIn = r.avgIn;
    // Stability = 100% - (coefficient of variation estimate)
    // Using range as a proxy since we don't store raw variance
    const stability = avgIn > 0 ? Math.max(0, Math.round(100 - (rangeIn / avgIn) * 50)) : 0;

    res.json({
      range, start, end,
      data: {
        avgIn:  Math.round(r.avgIn * 10) / 10,
        minIn:  Math.round(r.minIn * 10) / 10,
        maxIn:  Math.round(r.maxIn * 10) / 10,
        avgOut: Math.round(r.avgOut * 10) / 10,
        minOut: Math.round(r.minOut * 10) / 10,
        maxOut: Math.round(r.maxOut * 10) / 10,
        rangeIn:  Math.round(rangeIn * 10) / 10,
        rangeOut: Math.round((r.maxOut - r.minOut) * 10) / 10,
        stability,
        readings: r.readings,
        totalSamples: r.totalSamples,
        fanOnPercent: r.readings > 0 ? Math.round((r.fanOnCount / r.readings) * 100) : 0,
      },
    });

  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ error: 'Stats query failed' });
  }
});

// GET /analytics/available
// Returns date range of available data (so frontend knows which dates have data)
app.get('/analytics/available', async (_req, res) => {
  try {
    const oldest = await Reading.findOne().sort({ ts: 1 }).select('ts').lean();
    const newest = await Reading.findOne().sort({ ts: -1 }).select('ts').lean();

    if (!oldest || !newest) {
      return res.json({ hasData: false });
    }

    res.json({
      hasData: true,
      oldest: oldest.ts,
      newest: newest.ts,
      totalReadings: await Reading.countDocuments(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Query failed' });
  }
});

// ══════════════════════════════════════════════════════════════
// ██  SERVER TIME ENDPOINT (for ESP time sync)  ██
// ══════════════════════════════════════════════════════════════
// ESP can call this to get accurate server time if NTP fails

app.get('/time', (_req, res) => {
  const now = new Date();
  res.json({
    utc: now.toISOString(),
    epoch: Math.floor(now.getTime() / 1000),
    ist: new Date(now.getTime() + 19800000).toISOString(),
  });
});

// ══════════════════════════════════════════════════════════════
// ██  START  ██
// ══════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SSCC backend on port ${PORT}`));
