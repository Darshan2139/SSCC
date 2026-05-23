'use strict';

const express = require('express');
const cors    = require('cors');

const app = express();
app.use(express.json());
app.use(cors());        // allow any origin (Vercel, localhost)

// ── In-memory state ──────────────────────────────────────────────────────────
const MAX_LOGS = 50;

const state = {
  inputVoltage:      0,
  outputVoltage:     0,
  fanStatus:         false,   // relay NO = OFF on boot
  pendingFanCommand: null,    // 'ON' | 'OFF' | null
  logs:              [],      // circular, max 50
  lastUpdate:        null,
};

function pushLog(entry) {
  state.logs.push(entry);
  if (state.logs.length > MAX_LOGS) state.logs.shift();
}

// ── Routes ───────────────────────────────────────────────────────────────────

// ESP → server: voltage readings + optional event
app.post('/update', (req, res) => {
  const { inputVoltage, outputVoltage, fanStatus, event } = req.body;

  if (typeof inputVoltage !== 'number' || typeof outputVoltage !== 'number') {
    return res.status(400).json({ error: 'inputVoltage and outputVoltage must be numbers' });
  }

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
  res.json({ command });           // null when nothing pending
});

// Health check (Koyeb uses this to confirm the service is alive)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SSCC backend on port ${PORT}`));
