/*
 * SSCC — Smart Stabilizer Cooling Controller
 * Full firmware: ADS1115 + ZMPT101B + Relay + WiFi + HTTP + NTP
 *
 * Hardware:
 *   ZMPT101B #1 (input)  → ADS1115 A0
 *   ZMPT101B #2 (output) → ADS1115 A1
 *   ADS1115 SDA → D2 (GPIO4)
 *   ADS1115 SCL → D1 (GPIO5)
 *   Relay IN    → D5 (GPIO14)
 *   Relay wired to NO (Normally Open) — fan ON when relay is ON
 */

#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

// Result of one voltage measurement. Declared at the TOP of the sketch (right
// after the #includes) so the Arduino IDE's auto-generated function prototypes
// can see the type. If this struct is placed lower down, functions that return
// it fail with: "'VReading' does not name a type".
struct VReading {
  float volts;     // calibrated voltage
  float rmsVolts;  // uncalibrated RMS in volts (use this for 2-point calibration)
  bool  clipping;  // true if the waveform hit an ADC rail (pot set too high)
};

// ══════════════════════════════════════════════════════════════
// ██  CONFIGURATION — CHANGE THESE  ██
// ══════════════════════════════════════════════════════════════

// WiFi
const char* WIFI_SSID     = "Kirti-Darshan-Home";
const char* WIFI_PASSWORD = "6514(2139)";

// Backend URL (your Render deployment)
const char* SERVER_URL    = "https://sscc-backend.onrender.com";

// ── Voltage calibration: V = slope * rmsVolts + intercept ──
// The old single-point factors are used as the SLOPES (intercept 0), so this
// behaves like before until you do a proper 2-point calibration. For accuracy
// across the full day/night range, capture two (rawRMS, multimeterV) pairs from
// the Serial "[cal] inRMS=… outRMS=…" line and compute:
//   slope     = (V2 - V1) / (rms2 - rms1)
//   intercept = V1 - slope * rms1
float IN_SLOPE      = 731.0;   // cal: least-squares fit over 4 captures (~262V avg)
float IN_INTERCEPT  = 0.0;
float OUT_SLOPE     = 663.0;   // cal: least-squares fit over 4 captures (~224V avg)
float OUT_INTERCEPT = 0.0;

// ══════════════════════════════════════════════════════════════
// ██  PINS & CONSTANTS  ██
// ══════════════════════════════════════════════════════════════

#define RELAY_PIN       D5        // GPIO14 — relay control
#define RMS_WINDOW_MS   200       // sample 10 full 50Hz cycles (integer cycles)
#define POST_INTERVAL   3000      // send data every 3 seconds
#define POLL_INTERVAL   3000      // check for fan commands every 3 seconds
#define NTP_SYNC_INTERVAL 60000   // NTP sync every 60 seconds

// Fan restart schedule (IST)
#define RESTART_HOUR    5
#define RESTART_MINUTE  30
#define RESTART_OFF_MINUTES 10

// NTP
#define IST_OFFSET      19800     // UTC+5:30 in seconds
#define NTP_SERVER      "pool.ntp.org"

// Time validation: epoch for 2025-01-01 00:00:00 UTC
#define MIN_VALID_EPOCH 1735689600UL

// NTP retry settings
#define NTP_MAX_RETRIES  15       // max retries on boot
#define NTP_RETRY_DELAY  2000     // ms between retries
#define NTP_RESYNC_INTERVAL 300000  // force re-sync every 5 minutes

// ══════════════════════════════════════════════════════════════
// ██  GLOBALS  ██
// ══════════════════════════════════════════════════════════════

Adafruit_ADS1115 ads;
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, NTP_SERVER, IST_OFFSET, NTP_SYNC_INTERVAL);

// State
float inputVoltage  = 0;
float outputVoltage = 0;
bool  fanOn         = true;     // fan ON by default after init
bool  manualOverride = false;   // true when web user sent a command
bool  timeValid     = false;    // true once NTP gives valid time

// Schedule
bool  scheduledOff      = false;
bool  dailyRestartDone  = false;
int   lastCheckedDay    = -1;

// Timers
unsigned long lastPost = 0;
unsigned long lastPoll = 0;
unsigned long fanOffTime = 0;
unsigned long lastNtpSync = 0;

// ══════════════════════════════════════════════════════════════
// ██  TIME VALIDATION  ██
// ══════════════════════════════════════════════════════════════

bool isTimeValid() {
  unsigned long epoch = timeClient.getEpochTime();
  return epoch > MIN_VALID_EPOCH;
}

// Try to sync NTP and validate the time
// Returns true if time is now valid
bool syncNTP() {
  timeClient.forceUpdate();
  delay(100);

  if (isTimeValid()) {
    if (!timeValid) {
      timeValid = true;
      Serial.print("NTP synced! Time: ");
      Serial.println(timeClient.getFormattedTime());
    }
    return true;
  }
  return false;
}

// Fallback: get time from our backend server if NTP keeps failing
bool syncFromServer() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = String(SERVER_URL) + "/time";
  http.begin(client, url);
  http.setTimeout(5000);

  int code = http.GET();

  if (code == 200) {
    String response = http.getString();

    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err && !doc["epoch"].isNull()) {
      unsigned long serverEpoch = doc["epoch"];
      if (serverEpoch > MIN_VALID_EPOCH) {
        // Adjust NTP client's internal offset to match server time
        // This is a workaround since NTPClient doesn't have setEpoch
        // We set the time offset so getEpochTime returns correct value
        unsigned long rawEpoch = timeClient.getEpochTime() - IST_OFFSET;
        long correction = (long)serverEpoch - (long)rawEpoch;
        // Re-init with corrected offset
        timeClient.setTimeOffset(IST_OFFSET + correction);
        timeValid = true;
        Serial.print("Time synced from server! Epoch: ");
        Serial.println(serverEpoch);
        http.end();
        return true;
      }
    }
  } else {
    Serial.print("Server time sync failed: ");
    Serial.println(http.errorToString(code));
  }

  http.end();
  return false;
}

// ══════════════════════════════════════════════════════════════
// ██  VOLTAGE READING  ██
// ══════════════════════════════════════════════════════════════

// Single-pass RMS over an integer number of mains cycles.
// DC offset is removed with the variance identity:
//   Vac_rms^2 = mean(x^2) - mean(x)^2
// so the SAME samples give both the midpoint and the RMS — no separate DC pass,
// and no window mismatch between the two. Also reports raw min/max so we can
// detect clipping (the #1 cause of bad readings at high/night voltage).
// (struct VReading is declared near the top of the file, after the #includes.)
VReading readChannelRMS(int channel, float slope, float intercept) {
  double  sumX = 0, sumX2 = 0;
  long    n = 0;
  int16_t mn = 32767, mx = 0;

  // Time-bounded loop → always an integer number of 50Hz cycles → stable RMS.
  unsigned long t0 = millis();
  while (millis() - t0 < RMS_WINDOW_MS) {
    int16_t r = ads.readADC_SingleEnded(channel);   // single-ended: 0..32767
    sumX  += r;
    sumX2 += (double)r * r;
    if (r < mn) mn = r;
    if (r > mx) mx = r;
    n++;
    yield();
  }

  VReading out;
  if (n < 2) { out.volts = 0; out.rmsVolts = 0; out.clipping = false; return out; }

  double meanX     = sumX / n;
  double varCounts = sumX2 / n - meanX * meanX;        // AC variance in counts^2
  if (varCounts < 0) varCounts = 0;                    // guard tiny negative noise

  out.rmsVolts = sqrt(varCounts) * 0.125 / 1000.0;     // counts -> volts (GAIN_ONE)
  out.volts    = slope * out.rmsVolts + intercept;     // 2-point calibration
  // Full-scale single-ended = 32767 (=4.096V). Within ~2% of a rail = clipping.
  out.clipping = (mx > 32100) || (mn < 200);
  return out;
}

// ══════════════════════════════════════════════════════════════
// ██  FAN CONTROL  ██
// ══════════════════════════════════════════════════════════════

void setFan(bool on) {
  fanOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);  // NO wiring: HIGH=relay on=fan ON, LOW=relay off=fan OFF
  Serial.print("Fan → ");
  Serial.println(on ? "ON" : "OFF");
}

// ══════════════════════════════════════════════════════════════
// ██  HTTP: POST /update  ██
// ══════════════════════════════════════════════════════════════

void postUpdate(const char* event) {
  WiFiClientSecure client;
  client.setInsecure();  // skip cert check (fine for IoT)
  HTTPClient http;

  String url = String(SERVER_URL) + "/update";
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  StaticJsonDocument<256> doc;
  doc["inputVoltage"]  = round(inputVoltage * 10.0) / 10.0;
  doc["outputVoltage"] = round(outputVoltage * 10.0) / 10.0;
  doc["fanStatus"]     = fanOn;
  if (event != NULL) {
    doc["event"] = event;
  }

  String payload;
  serializeJson(doc, payload);

  int code = http.POST(payload);

  if (code > 0) {
    Serial.print("POST /update → ");
    Serial.println(code);
  } else {
    Serial.print("POST failed: ");
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// ══════════════════════════════════════════════════════════════
// ██  HTTP: GET /command  ██
// ══════════════════════════════════════════════════════════════

void pollCommand() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = String(SERVER_URL) + "/command";
  http.begin(client, url);
  http.setTimeout(5000);

  int code = http.GET();

  if (code == 200) {
    String response = http.getString();

    StaticJsonDocument<128> doc;
    DeserializationError err = deserializeJson(doc, response);

    if (!err && !doc["command"].isNull()) {
      const char* cmd = doc["command"];
      if (strcmp(cmd, "ON") == 0) {
        setFan(true);
        manualOverride = true;
        Serial.println("Web command → FAN ON");
      } else if (strcmp(cmd, "OFF") == 0) {
        setFan(false);
        manualOverride = true;
        Serial.println("Web command → FAN OFF");
      }
    }
  } else {
    Serial.print("GET /command failed: ");
    Serial.println(http.errorToString(code));
  }

  http.end();
}

// ══════════════════════════════════════════════════════════════
// ██  DAILY FAN RESTART SCHEDULE (05:30 IST)  ██
// ══════════════════════════════════════════════════════════════

void checkSchedule() {
  // Don't check schedule if time isn't valid yet
  if (!timeValid) return;

  int hour   = timeClient.getHours();
  int minute = timeClient.getMinutes();
  int day    = timeClient.getDay();

  // Reset daily flag at midnight
  if (day != lastCheckedDay) {
    dailyRestartDone = false;
    lastCheckedDay = day;
  }

  // 05:30 → turn fan OFF, start 10-min timer
  if (!dailyRestartDone && hour == RESTART_HOUR && minute == RESTART_MINUTE) {
    Serial.println("Schedule: 05:30 → Fan OFF for 10 min");
    setFan(false);
    scheduledOff = true;
    fanOffTime = millis();
    dailyRestartDone = true;
    manualOverride = false;  // schedule takes over
    postUpdate("FAN_DAILY_RESTART");
  }

  // After 10 minutes → turn fan back ON
  if (scheduledOff && (millis() - fanOffTime >= RESTART_OFF_MINUTES * 60000UL)) {
    Serial.println("Schedule: 10 min done → Fan ON");
    setFan(true);
    scheduledOff = false;
    postUpdate("FAN_DAILY_RESTART");
  }
}

// ══════════════════════════════════════════════════════════════
// ██  WIFI CONNECTION  ██
// ══════════════════════════════════════════════════════════════

void connectWiFi() {
  Serial.print("Connecting to ");
  Serial.print(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.print("Connected! IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("WiFi FAILED — restarting in 5s");
    delay(5000);
    ESP.restart();
  }
}

// ══════════════════════════════════════════════════════════════
// ██  SETUP  ██
// ══════════════════════════════════════════════════════════════

void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("=== SSCC Starting ===");

  // Relay pin
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);  // NO wiring: relay on = fan ON (safe default)

  // I2C + ADS1115
  Wire.begin(D2, D1);
  if (!ads.begin()) {
    Serial.println("ERROR: ADS1115 not found");
    while (1) { yield(); }
  }
  ads.setDataRate(RATE_ADS1115_860SPS);
  ads.setGain(GAIN_ONE);
  Serial.println("ADS1115 ready");

  // WiFi
  connectWiFi();

  // ── NTP sync with retry until valid ──
  timeClient.begin();
  Serial.println("Syncing NTP...");

  timeValid = false;
  for (int i = 0; i < NTP_MAX_RETRIES; i++) {
    if (syncNTP()) {
      Serial.print("NTP OK on attempt ");
      Serial.println(i + 1);
      break;
    }
    Serial.print("NTP attempt ");
    Serial.print(i + 1);
    Serial.print("/");
    Serial.print(NTP_MAX_RETRIES);
    Serial.print(" failed (epoch: ");
    Serial.print(timeClient.getEpochTime());
    Serial.println(")");
    delay(NTP_RETRY_DELAY);
  }

  // If NTP still failed, try getting time from our backend server
  if (!timeValid) {
    Serial.println("NTP failed — trying server time sync...");
    if (!syncFromServer()) {
      Serial.println("WARNING: Time not synced! Schedule disabled until sync succeeds.");
    }
  }

  if (timeValid) {
    Serial.print("Time: ");
    Serial.println(timeClient.getFormattedTime());
  }

  lastNtpSync = millis();

  // Turn fan ON after successful boot
  setFan(true);

  Serial.println("=== SSCC Ready ===");
  Serial.println();
}

// ══════════════════════════════════════════════════════════════
// ██  MAIN LOOP  ██
// ══════════════════════════════════════════════════════════════

void loop() {
  // Keep NTP updated
  timeClient.update();

  // Reconnect WiFi if dropped
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost — reconnecting");
    connectWiFi();
  }

  // Periodic forced NTP re-sync (every 5 minutes)
  // Fixes drift and catches up after power cuts
  unsigned long now = millis();
  if (now - lastNtpSync >= NTP_RESYNC_INTERVAL) {
    Serial.println("Periodic NTP re-sync...");
    if (syncNTP()) {
      Serial.print("NTP re-sync OK: ");
      Serial.println(timeClient.getFormattedTime());
    } else if (!timeValid) {
      // Still no valid time — try server fallback
      Serial.println("NTP still failing — trying server...");
      syncFromServer();
    }
    lastNtpSync = now;
  }

  // Read voltages (single-pass RMS + clipping detection)
  VReading inR  = readChannelRMS(0, IN_SLOPE,  IN_INTERCEPT);
  VReading outR = readChannelRMS(1, OUT_SLOPE, OUT_INTERCEPT);

  // Exponential moving average — steadies the value sent to the app.
  // Seed directly on the first reading so it converges instantly.
  if (inputVoltage  == 0) inputVoltage  = inR.volts;
  else                    inputVoltage  = 0.7f * inputVoltage  + 0.3f * inR.volts;
  if (outputVoltage == 0) outputVoltage = outR.volts;
  else                    outputVoltage = 0.7f * outputVoltage + 0.3f * outR.volts;

  // Serial debug
  Serial.print("In: ");
  Serial.print(inputVoltage, 1);
  Serial.print("V  Out: ");
  Serial.print(outputVoltage, 1);
  Serial.print("V  Fan: ");
  Serial.print(fanOn ? "ON" : "OFF");
  Serial.print("  Time: ");
  Serial.print(timeValid ? timeClient.getFormattedTime() : "NOT SYNCED");
  Serial.println();

  // Calibration / health line — pair these rawRMS values with a multimeter
  // reading to compute IN_SLOPE/INTERCEPT and OUT_SLOPE/INTERCEPT (2-point cal).
  // If you see CLIPPING, lower that channel's ZMPT101B pot until it disappears.
  Serial.printf("  [cal] inRMS=%.5f outRMS=%.5f%s%s\n",
                inR.rmsVolts, outR.rmsVolts,
                inR.clipping  ? "  <-- IN CLIPPING!"  : "",
                outR.clipping ? "  <-- OUT CLIPPING!" : "");

  // POST /update every 3 seconds
  if (now - lastPost >= POST_INTERVAL) {
    postUpdate(NULL);
    lastPost = now;
  }

  // GET /command every 3 seconds
  if (now - lastPoll >= POLL_INTERVAL) {
    pollCommand();
    lastPoll = now;
  }

  // Check 05:30 daily restart schedule (only if time is valid)
  checkSchedule();

  // Small delay to prevent tight loop
  delay(100);
}
