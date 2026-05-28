'use strict';

const mongoose = require('mongoose');

// ── 1-minute aggregated voltage reading ──
// Each document = avg/min/max of ~20 raw samples (ESP sends every 3s)
const readingSchema = new mongoose.Schema({
  ts: {
    type: Date,
    required: true,
  },
  inputV: {
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  outputV: {
    avg: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
  },
  fan: { type: Boolean, required: true },   // majority fan status in this bucket
  n: { type: Number, required: true },       // sample count
}, {
  timestamps: false,
  versionKey: false,
});

// Compound index for analytics queries: find by time range, sorted
readingSchema.index({ ts: 1 }, { background: true });

module.exports = mongoose.model('Reading', readingSchema);
