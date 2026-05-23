# Smart Stabilizer Cooling Controller (SSCC)

A Wi-Fi enabled IoT system to monitor AC stabilizer input/output voltages, control a cooling fan via relay, and provide a live web dashboard. Built on ESP8266 + ADS1115 + 2× ZMPT101B. Backend on Koyeb, frontend on Vercel.

---

## 1. Hardware

### Components

| Component | Role |
|---|---|
| ESP8266 (NodeMCU) | Main controller, Wi-Fi, web client |
| 2× ZMPT101B | AC voltage sensing (input + output) |
| ADS1115 (I2C ADC) | 16-bit 4-channel ADC (ESP8266 has only 1 ADC pin) |
| Relay Module (5V coil, optocoupler) | Fan switch |
| 12V DC Fan | Stabilizer cooling |
| 5V USB Adapter | Powers ESP8266 + ADS1115 + Relay coil |
| 12V Adapter | Powers fan (switched by relay) |

### Wiring Summary

```
ZMPT101B #1 (Input voltage)  → ADS1115 A0
ZMPT101B #2 (Output voltage) → ADS1115 A1
ADS1115 SDA → ESP8266 D2 (GPIO4)
ADS1115 SCL → ESP8266 D1 (GPIO5)
ADS1115 VCC → 3.3V
ADS1115 GND → GND

Relay IN  → ESP8266 D5 (GPIO14)
Relay VCC → 5V (from USB adapter)
Relay GND → GND (common with ESP)
Relay COM → 12V adapter (+)
Relay NO  → Fan (+)
Fan   (-) → 12V adapter (-)
```

> **Note:** Relay is wired to NO (Normally Open) pin → fan is OFF by default on ESP boot. Safe behavior.

> **Note:** Both ZMPT101B modules must share common GND with ADS1115.

---

## 2. Firmware (ESP8266 Arduino)

### Libraries Required

```
- Wire.h (I2C, built-in)
- Adafruit_ADS1X15 (ADS1115 driver)
- ESP8266WiFi.h
- ESP8266HTTPClient.h
- NTPClient.h
- WiFiUDP.h
- ArduinoJson.h
```

### Key Firmware Logic

#### Voltage Reading (RMS via ADS1115)
- Sample ADS1115 A0 and A1 ~100 times per AC cycle (50Hz = 20ms cycle)
- Each ZMPT101B output is a sine wave centered at ~mid-supply
- Compute RMS: `sqrt( sum(sample^2) / n )`
- Multiply by calibration factor to get real voltage in Volts

#### Calibration Factor
- Measure real voltage with a multimeter
- Read raw RMS from ADS1115
- `calibFactor = realVoltage / rawRMS`
- Store in firmware as a `const float` (or EEPROM for persistence)
- **One-time calibration only** — no need to redo unless module is replaced

```cpp
// Example calibration constants (tune during setup)
const float INPUT_CALIB  = 218.5;   // adjust after multimeter reading
const float OUTPUT_CALIB = 220.1;   // adjust after multimeter reading
```

#### NTP Time Sync
- Connect to pool.ntp.org on boot
- Sync every 60 seconds
- Use IST offset: `+19800` seconds (UTC+5:30)

#### Auto Fan Restart Schedule
- At **05:30:00** → turn fan OFF, set `scheduledRestart = true`
- After **10 minutes** (05:40:00) → turn fan ON
- Log this event to server as `FAN_DAILY_RESTART`
- This logic runs entirely on ESP8266 via NTP time

#### Server Communication
- Every **3 seconds** → POST `/update` to Koyeb backend
- Payload (JSON):
```json
{
  "inputVoltage": 223.4,
  "outputVoltage": 218.7,
  "fanStatus": true,
  "event": "FAN_DAILY_RESTART"
}
```
- Every **3 seconds** → GET `/command` from Koyeb to check for manual fan toggle from web UI

#### Fan Control Priority
```
Manual override (from web) → highest priority
Schedule (5:30 restart)    → second
Normal operation           → fan always ON unless overridden
```

---

## 3. Backend (Koyeb — Express.js)

### Why Koyeb
- Free tier, **no sleep on inactivity** (unlike Render which sleeps after 15 min)
- No cold start delay
- Sufficient for always-on ESP data

### No Database
- All state stored **in-memory only**
- Logs are a circular array (max 50 entries, oldest dropped)
- Server restart = logs reset (acceptable, no persistence needed)

### In-Memory State

```js
let state = {
  inputVoltage: 0,
  outputVoltage: 0,
  fanStatus: false,
  pendingFanCommand: null,   // "ON" | "OFF" | null
  logs: []                   // max 50 entries, circular
}
```

### API Endpoints

| Method | Route | Description |
|---|---|---|
| POST | `/update` | ESP sends sensor data + events |
| GET | `/state` | Webpage fetches live state |
| POST | `/fan` | Webpage sends manual fan toggle |
| GET | `/command` | ESP polls for pending fan command |

### Log Entry Format (pushed to `state.logs`)

```json
{
  "timestamp": "2024-01-15T05:30:00Z",
  "type": "FAN_DAILY_RESTART | INPUT_VOLTAGE | OUTPUT_VOLTAGE | FAN_MANUAL",
  "inputVoltage": 223.4,
  "outputVoltage": 218.7,
  "fanStatus": true,
  "event": "FAN_DAILY_RESTART"
}
```

### Deploy on Koyeb
- Push `server.js` + `package.json` to GitHub
- Connect repo on koyeb.com → deploy as Web Service
- Set PORT env var (Koyeb injects automatically)
- CORS: allow Vercel frontend domain

---

## 4. Frontend (Vercel — Plain HTML + JS)

### Why Plain HTML (no framework)
- No build step needed
- Vercel deploys instantly from a single `index.html`
- No React/Vue overhead for a simple dashboard

### Page Layout

```
┌─────────────────────────────────────┐
│  SSCC — Smart Stabilizer Controller │
├──────────────┬──────────────────────┤
│ Input: 223V  │  Output: 218V        │
├──────────────┴──────────────────────┤
│  Fan:  [  ON  ] ←toggle             │
├─────────────────────────────────────┤
│  LIVE LOGS                          │
│  ┌──────────┬────────┬────────┬─────┤
│  │ Fan Health│In Log │Out Log │Last │
│  │ (daily)  │       │       │ In  │
│  └──────────┴────────┴────────┴─────┤
└─────────────────────────────────────┘
```

### 5-Column Log Table

| Col | Name | What It Shows |
|---|---|---|
| 1 | Fan Daily Health | Did 5:30 restart happen today? ✅/❌ |
| 2 | Input Log | Running input voltage history |
| 3 | Output Log | Running output voltage history |
| 4 | Last Input | Most recent single input voltage reading |
| 5 | Last Output | Most recent single output voltage reading |

> Cols 4 & 5 are also shown as **summary cards** at top of page for quick glance.

### Polling
- `setInterval` every 3000ms → `GET /state` from Koyeb
- Update voltage cards + fan toggle + log table in place
- No page reload needed

### Fan Toggle
- Button click → `POST /fan` with `{ "command": "ON" | "OFF" }`
- Button state reflects `fanStatus` from `/state`

### Deploy on Vercel
- Push `index.html` to GitHub
- Connect on vercel.com → deploy as static site
- Set `KOYEB_URL` as a JS constant in the HTML (or env via Vercel if using build)

---

## 5. Full Data Flow

```
[AC Mains] → ZMPT101B × 2 → ADS1115 → ESP8266
                                           │
                              NTP sync (pool.ntp.org)
                                           │
                               Every 3 sec POST /update
                                           ↓
                                   Koyeb (Express)
                                   in-memory state
                                           ↑↓
                               Every 3 sec GET /state
                                           │
                                  Vercel (index.html)
                                  Live dashboard in browser
                                           │
                              User clicks fan toggle
                              POST /fan → Koyeb
                              ESP polls GET /command → acts
```

---

## 6. Build Order (Step by Step for Claude Code)

### Phase 1 — Backend
1. Create `server.js` with Express
2. Implement `/update`, `/state`, `/fan`, `/command` routes
3. Implement circular log array (max 50)
4. Add CORS for Vercel domain
5. Test locally with `node server.js`
6. Push to GitHub → deploy on Koyeb

### Phase 2 — Frontend
1. Create `index.html` with voltage cards, fan toggle, log table
2. Wire up polling to Koyeb URL
3. Test against live Koyeb backend
4. Push to GitHub → deploy on Vercel

### Phase 3 — Firmware
1. Set up ESP8266 Arduino project
2. Add all libraries (ADS1115, NTPClient, ArduinoJson, HTTPClient)
3. Implement voltage RMS reading loop
4. Add NTP sync + IST offset
5. Add 5:30 AM auto-restart logic
6. Add POST /update every 3 sec
7. Add GET /command polling every 3 sec
8. Flash to ESP8266, test on local network

### Phase 4 — Calibration
1. Power on ESP8266
2. Open Serial Monitor (115200 baud)
3. Note raw RMS values printing for A0 and A1
4. Measure real voltage with multimeter on input and output lines
5. Calculate: `calibFactor = realVoltage / rawRMS`
6. Update `INPUT_CALIB` and `OUTPUT_CALIB` constants in firmware
7. Re-flash ESP8266
8. Verify readings match multimeter (±2V tolerance acceptable)
9. **No recalibration needed after this unless ZMPT101B module is replaced**

---

## 7. Known Issues / Decisions Made

| Topic | Decision |
|---|---|
| No database | In-memory only, logs reset on server restart |
| No auth | Local/home use, no sensitive data |
| No Cloudflare Tunnel | Not needed, Koyeb is always-on public server |
| Render rejected | Sleeps after 15 min inactivity — bad for live data |
| Firebase rejected | Koyeb simpler, no third-party SDK on ESP |
| Client-side time logic | Rejected — time logic stays on ESP via NTP |
| Fan default state | OFF (relay NO pin) — safe on boot |
| ZMPT101B ADC | Goes to ADS1115, not ESP ADC (ESP ADC is 0-1V, 10-bit only) |

---

## 8. File Structure

```
sscc-backend/
├── server.js
├── package.json
└── .gitignore

sscc-frontend/
└── index.html

sscc-firmware/
└── sscc_firmware.ino
```

---

## 9. Environment / Config

| Variable | Value |
|---|---|
| NTP Server | pool.ntp.org |
| NTP UTC Offset | 19800 (IST = UTC+5:30) |
| ADS1115 I2C Address | 0x48 (default, ADDR pin to GND) |
| Relay GPIO | D5 (GPIO14) |
| Fan restart time | 05:30:00 IST |
| Fan restart delay | 10 minutes |
| Poll interval | 3000ms |
| Log max entries | 50 |
| Koyeb port | process.env.PORT |

---

*This document is the single source of truth for the SSCC project. Claude Code should read this file first before making any changes to firmware, backend, or frontend.*
