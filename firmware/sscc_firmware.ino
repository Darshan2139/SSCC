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
 */

#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

// ══════════════════════════════════════════════════════════════
// ██  CONFIGURATION — CHANGE THESE  ██
// ══════════════════════════════════════════════════════════════

// WiFi
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend URL (your Render deployment)
const char* SERVER_URL    = "https://sscc-backend.onrender.com";

// Calibration factors (from your test: 241V multimeter reading)
const float INPUT_CALIB   = 737.0;   // = multimeter / raw_rms for channel 0
const float OUTPUT_CALIB  = 719.4;   // = multimeter / raw_rms for channel 1

// ══════════════════════════════════════════════════════════════
// ██  PINS & CONSTANTS  ██
// ══════════════════════════════════════════════════════════════

#define RELAY_PIN       D5        // GPIO14 — relay control
#define SAMPLES         200       // ~230ms per channel at 860SPS
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

// Schedule
bool  scheduledOff      = false;
bool  dailyRestartDone  = false;
int   lastCheckedDay    = -1;

// Timers
unsigned long lastPost = 0;
unsigned long lastPoll = 0;
unsigned long fanOffTime = 0;

// ══════════════════════════════════════════════════════════════
// ██  VOLTAGE READING  ██
// ══════════════════════════════════════════════════════════════

float getRMSVoltage(int channel, float calibFactor) {

  // Pass 1 — find DC midpoint
  long dcSum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    dcSum += ads.readADC_SingleEnded(channel);
    yield();
  }
  float dcOffset = dcSum / (float)SAMPLES;

  // Pass 2 — true RMS with DC removed
  float sumSquares = 0;
  for (int i = 0; i < SAMPLES; i++) {
    float sample  = ads.readADC_SingleEnded(channel) - dcOffset;
    float voltage = sample * 0.125 / 1000.0;  // GAIN_ONE = 0.125mV per bit
    sumSquares   += voltage * voltage;
    yield();
  }

  float rmsRaw = sqrt(sumSquares / SAMPLES);
  return rmsRaw * calibFactor;
}

// ══════════════════════════════════════════════════════════════
// ██  FAN CONTROL  ██
// ══════════════════════════════════════════════════════════════

void setFan(bool on) {
  fanOn = on;
  digitalWrite(RELAY_PIN, on ? HIGH : LOW);
  Serial.print("Fan → ");
  Serial.println(on ? "ON" : "OFF");
}

// ══════════════════════════════════════════════════════════════
// ██  HTTP: POST /update  ██
// ══════════════════════════════════════════════════════════════

void postUpdate(const char* event) {
  WiFiClient client;
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
  WiFiClient client;
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
  digitalWrite(RELAY_PIN, LOW);  // fan OFF on boot (safe)

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

  // NTP
  timeClient.begin();
  timeClient.update();
  Serial.print("NTP time: ");
  Serial.println(timeClient.getFormattedTime());

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

  // Read voltages
  inputVoltage  = getRMSVoltage(0, INPUT_CALIB);
  outputVoltage = getRMSVoltage(1, OUTPUT_CALIB);

  // Serial debug
  Serial.print("In: ");
  Serial.print(inputVoltage, 1);
  Serial.print("V  Out: ");
  Serial.print(outputVoltage, 1);
  Serial.print("V  Fan: ");
  Serial.print(fanOn ? "ON" : "OFF");
  Serial.print("  Time: ");
  Serial.println(timeClient.getFormattedTime());

  // POST /update every 3 seconds
  unsigned long now = millis();
  if (now - lastPost >= POST_INTERVAL) {
    postUpdate(NULL);
    lastPost = now;
  }

  // GET /command every 3 seconds
  if (now - lastPoll >= POLL_INTERVAL) {
    pollCommand();
    lastPoll = now;
  }

  // Check 05:30 daily restart schedule
  checkSchedule();

  // Small delay to prevent tight loop
  delay(100);
}
