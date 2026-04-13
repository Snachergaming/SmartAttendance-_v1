/**
 * ATTENDRO - ESP32 Fingerprint Attendance Device
 *
 * Hardware Requirements:
 * - ESP32 DevKit or similar
 * - R307 or AS608 Fingerprint Sensor (connected to Serial2)
 * - SSD1306 128x64 OLED Display (I2C)
 * - Buzzer (optional, for audio feedback)
 *
 * Wiring:
 * - Fingerprint TX -> ESP32 GPIO16 (RX2)
 * - Fingerprint RX -> ESP32 GPIO17 (TX2)
 * - OLED SDA -> ESP32 GPIO21
 * - OLED SCL -> ESP32 GPIO22
 * - Buzzer -> ESP32 GPIO25
 *
 * Features:
 * - WiFi connectivity with auto-reconnect
 * - Supabase integration for real-time attendance
 * - OLED status display
 * - Fingerprint enrollment and identification
 * - Offline queue with automatic sync
 *
 * @author ATTENDRO Team
 * @version 1.0.0
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Adafruit_Fingerprint.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <EEPROM.h>
#include <time.h>

// Include configuration
// Copy config.h to config_local.h and update with your credentials
#if __has_include("config_local.h")
#include "config_local.h"
#else
#include "config.h"
#endif

// ============================================
// GLOBAL OBJECTS
// ============================================

// Fingerprint sensor on Serial2
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);

// OLED Display
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

// NTP Client for time sync
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, NTP_SERVER, NTP_OFFSET_SECONDS);

// HTTPS Client
WiFiClientSecure secureClient;

// ============================================
// STATE VARIABLES
// ============================================

enum DeviceMode
{
  MODE_IDLE,       // No active session
  MODE_ATTENDANCE, // Taking attendance
  MODE_ENROLLMENT, // Enrolling new fingerprint
  MODE_ERROR       // Error state
};

struct DeviceState
{
  DeviceMode mode;
  bool wifiConnected;
  bool serverConnected;
  String activeSessionId;
  String currentClassId;
  String currentSubjectId;
  int enrollingFingerprintId;
  String enrollingStudentId;
  unsigned long lastHeartbeat;
  unsigned long lastWifiCheck;
  unsigned long lastSessionCheck;
  unsigned long lastDisplayUpdate;
  int attendanceCount;
  int totalStudents;
  String lastError;
  String statusMessage;
} state;

// Offline attendance queue (stored in EEPROM)
#define OFFLINE_QUEUE_SIZE 50
#define EEPROM_SIZE 4096

struct OfflineRecord
{
  int fingerprintId;
  unsigned long timestamp;
  bool synced;
};

OfflineRecord offlineQueue[OFFLINE_QUEUE_SIZE];
int offlineQueueCount = 0;

// ============================================
// FUNCTION DECLARATIONS
// ============================================

void setupWiFi();
void setupFingerprint();
void setupDisplay();
void checkWiFiConnection();
void sendHeartbeat();
void checkForActiveSession();
void handleFingerprintScan();
void handleEnrollment();
void markAttendance(int fingerprintId);
void updateDisplay();
void playTone(int frequency, int duration);
void showSuccess();
void showError(String message);
void syncOfflineQueue();
String makeSupabaseRequest(String endpoint, String method, String body = "");
void displayCentered(String text, int y, int textSize = 1);
String getFormattedTime();
void loadOfflineQueue();
void saveOfflineQueue();

// ============================================
// SETUP
// ============================================

void setup()
{
  // Initialize Serial for debugging
  Serial.begin(115200);
  delay(1000);

  DEBUG_PRINTLN("\n========================================");
  DEBUG_PRINTLN("  ATTENDRO Fingerprint Device v" FIRMWARE_VERSION);
  DEBUG_PRINTLN("  Device: " DEVICE_CODE);
  DEBUG_PRINTLN("========================================\n");

  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  loadOfflineQueue();

  // Initialize state
  state.mode = MODE_IDLE;
  state.wifiConnected = false;
  state.serverConnected = false;
  state.activeSessionId = "";
  state.lastHeartbeat = 0;
  state.lastWifiCheck = 0;
  state.lastSessionCheck = 0;
  state.lastDisplayUpdate = 0;
  state.attendanceCount = 0;
  state.totalStudents = 0;
  state.statusMessage = "Starting...";

  // Initialize display first for visual feedback
  setupDisplay();
  displayCentered("ATTENDRO", 10, 2);
  displayCentered("Initializing...", 35);
  display.display();

  // Connect to WiFi
  setupWiFi();

  // Initialize NTP
  timeClient.begin();
  timeClient.update();

  // Initialize fingerprint sensor
  setupFingerprint();

  // Send initial heartbeat
  sendHeartbeat();

  // Ready!
  state.statusMessage = "Ready";
  playTone(1000, 100);
  delay(100);
  playTone(1500, 100);

  DEBUG_PRINTLN("\nDevice ready!");
}

// ============================================
// MAIN LOOP
// ============================================

void loop()
{
  unsigned long now = millis();

  // Check WiFi connection
  if (now - state.lastWifiCheck >= WIFI_RECONNECT_INTERVAL)
  {
    checkWiFiConnection();
    state.lastWifiCheck = now;
  }

  // Send heartbeat
  if (now - state.lastHeartbeat >= HEARTBEAT_INTERVAL)
  {
    sendHeartbeat();
    state.lastHeartbeat = now;
  }

  // Check for active session
  if (now - state.lastSessionCheck >= SESSION_CHECK_INTERVAL)
  {
    checkForActiveSession();
    state.lastSessionCheck = now;
  }

  // Update NTP time
  timeClient.update();

  // Handle fingerprint based on mode
  switch (state.mode)
  {
  case MODE_ATTENDANCE:
    handleFingerprintScan();
    break;
  case MODE_ENROLLMENT:
    handleEnrollment();
    break;
  case MODE_IDLE:
    // In idle mode, still check for fingerprints to show "No Session" message
    if (finger.getImage() == FINGERPRINT_OK)
    {
      showError("No Active Session");
      delay(1000);
    }
    break;
  case MODE_ERROR:
    // Try to recover from error
    delay(5000);
    state.mode = MODE_IDLE;
    break;
  }

  // Update display
  if (now - state.lastDisplayUpdate >= DISPLAY_UPDATE_INTERVAL)
  {
    updateDisplay();
    state.lastDisplayUpdate = now;
  }

  // Sync offline queue when connected
  if (state.wifiConnected && offlineQueueCount > 0)
  {
    syncOfflineQueue();
  }

  // Small delay to prevent watchdog issues
  delay(10);
}

// ============================================
// WIFI FUNCTIONS
// ============================================

void setupWiFi()
{
  DEBUG_PRINTLN("Connecting to WiFi...");
  display.clearDisplay();
  displayCentered("Connecting to", 20);
  displayCentered("WiFi...", 35);
  display.display();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30)
  {
    delay(500);
    DEBUG_PRINT(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    state.wifiConnected = true;
    digitalWrite(LED_PIN, HIGH);
    DEBUG_PRINTLN("\nWiFi connected!");
    DEBUG_PRINT("IP: ");
    DEBUG_PRINTLN(WiFi.localIP());

    // Configure secure client
    secureClient.setInsecure(); // For testing - in production use proper certificate

    display.clearDisplay();
    displayCentered("WiFi Connected", 20);
    displayCentered(WiFi.localIP().toString(), 35);
    display.display();
    delay(1000);
  }
  else
  {
    state.wifiConnected = false;
    digitalWrite(LED_PIN, LOW);
    DEBUG_PRINTLN("\nWiFi connection failed!");
    showError("WiFi Failed");
    delay(2000);
  }
}

void checkWiFiConnection()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    state.wifiConnected = false;
    digitalWrite(LED_PIN, LOW);
    DEBUG_PRINTLN("WiFi disconnected! Reconnecting...");
    WiFi.reconnect();

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 10)
    {
      delay(500);
      attempts++;
    }

    if (WiFi.status() == WL_CONNECTED)
    {
      state.wifiConnected = true;
      digitalWrite(LED_PIN, HIGH);
      DEBUG_PRINTLN("WiFi reconnected!");
    }
  }
  else
  {
    state.wifiConnected = true;
    digitalWrite(LED_PIN, HIGH);
  }
}

// ============================================
// FINGERPRINT FUNCTIONS
// ============================================

void setupFingerprint()
{
  DEBUG_PRINTLN("Initializing fingerprint sensor...");
  display.clearDisplay();
  displayCentered("Initializing", 20);
  displayCentered("Fingerprint...", 35);
  display.display();

  fpSerial.begin(FP_BAUD_RATE, SERIAL_8N1, FP_RX_PIN, FP_TX_PIN);
  delay(100);

  if (finger.verifyPassword())
  {
    DEBUG_PRINTLN("Fingerprint sensor found!");

    // Get sensor info
    finger.getParameters();
    DEBUG_PRINTF("Capacity: %d\n", finger.capacity);
    DEBUG_PRINTF("Security level: %d\n", finger.security_level);

    // Set security level
    finger.setSecurityLevel(FP_SECURITY_LEVEL);

    // Get template count
    finger.getTemplateCount();
    DEBUG_PRINTF("Templates stored: %d\n", finger.templateCount);

    display.clearDisplay();
    displayCentered("Sensor OK", 20);
    displayCentered(String(finger.templateCount) + " prints", 35);
    display.display();
    delay(1000);
  }
  else
  {
    DEBUG_PRINTLN("Fingerprint sensor NOT found!");
    state.mode = MODE_ERROR;
    state.lastError = "Sensor Error";
    showError("Sensor Not Found");
    delay(2000);
  }
}

void handleFingerprintScan()
{
  // Try to get a fingerprint image
  int result = finger.getImage();

  if (result == FINGERPRINT_NOFINGER)
  {
    return; // No finger detected
  }

  if (result != FINGERPRINT_OK)
  {
    DEBUG_PRINTLN("Error getting image");
    return;
  }

  DEBUG_PRINTLN("Image taken");

  // Convert image to template
  result = finger.image2Tz();
  if (result != FINGERPRINT_OK)
  {
    showError("Image Error");
    delay(500);
    return;
  }

  // Search for matching fingerprint
  result = finger.fingerSearch();
  if (result == FINGERPRINT_OK)
  {
    int fingerprintId = finger.fingerID;
    int confidence = finger.confidence;

    DEBUG_PRINTF("Found ID: %d (Confidence: %d)\n", fingerprintId, confidence);

    // Mark attendance
    markAttendance(fingerprintId);
  }
  else if (result == FINGERPRINT_NOTFOUND)
  {
    DEBUG_PRINTLN("Fingerprint not found in database");
    showError("Not Enrolled");
    playTone(200, 500);
    delay(1000);
  }
  else
  {
    DEBUG_PRINTF("Search error: %d\n", result);
    showError("Scan Error");
    delay(500);
  }
}

void handleEnrollment()
{
  static int enrollmentStep = 0;
  static unsigned long lastPrompt = 0;

  if (state.enrollingFingerprintId <= 0)
  {
    state.mode = MODE_IDLE;
    return;
  }

  // Show enrollment prompt
  if (millis() - lastPrompt > 2000)
  {
    display.clearDisplay();
    displayCentered("ENROLLMENT", 0, 1);
    displayCentered("ID: " + String(state.enrollingFingerprintId), 15);

    if (enrollmentStep == 0)
    {
      displayCentered("Place finger", 35);
      displayCentered("(1st scan)", 50);
    }
    else
    {
      displayCentered("Place SAME finger", 35);
      displayCentered("(2nd scan)", 50);
    }
    display.display();
    lastPrompt = millis();
  }

  int result = finger.getImage();

  if (result == FINGERPRINT_NOFINGER)
  {
    return;
  }

  if (result != FINGERPRINT_OK)
  {
    return;
  }

  DEBUG_PRINTLN("Image taken for enrollment");

  // Convert to template
  result = finger.image2Tz(enrollmentStep + 1);
  if (result != FINGERPRINT_OK)
  {
    showError("Conversion Error");
    delay(1000);
    return;
  }

  if (enrollmentStep == 0)
  {
    // First scan successful
    enrollmentStep = 1;
    display.clearDisplay();
    displayCentered("First scan OK!", 25);
    displayCentered("Remove finger", 40);
    display.display();
    playTone(1000, 100);

    // Wait for finger to be removed
    while (finger.getImage() != FINGERPRINT_NOFINGER)
    {
      delay(100);
    }
    delay(500);
  }
  else
  {
    // Second scan - create model
    result = finger.createModel();
    if (result != FINGERPRINT_OK)
    {
      showError("Prints don't match");
      playTone(200, 500);
      enrollmentStep = 0;
      delay(2000);
      return;
    }

    // Store the model
    result = finger.storeModel(state.enrollingFingerprintId);
    if (result == FINGERPRINT_OK)
    {
      DEBUG_PRINTF("Stored template at ID: %d\n", state.enrollingFingerprintId);

      // Notify server of successful enrollment
      notifyEnrollmentComplete(state.enrollingFingerprintId);

      display.clearDisplay();
      displayCentered("ENROLLED!", 20, 2);
      displayCentered("ID: " + String(state.enrollingFingerprintId), 45);
      display.display();
      showSuccess();

      // Reset enrollment state
      enrollmentStep = 0;
      state.enrollingFingerprintId = 0;
      state.enrollingStudentId = "";
      state.mode = MODE_IDLE;
      delay(2000);
    }
    else
    {
      showError("Storage Error");
      enrollmentStep = 0;
      delay(2000);
    }
  }
}

void notifyEnrollmentComplete(int fingerprintId)
{
  if (!state.wifiConnected)
    return;

  // The server will update the fingerprint_templates table
  // This is handled via the device API endpoint

  StaticJsonDocument<256> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["action"] = "enrollment_complete";
  doc["fingerprint_id"] = fingerprintId;
  doc["student_id"] = state.enrollingStudentId;

  String body;
  serializeJson(doc, body);

  makeSupabaseRequest("/functions/v1/device-api", "POST", body);
}

// ============================================
// ATTENDANCE FUNCTIONS
// ============================================

void markAttendance(int fingerprintId)
{
  DEBUG_PRINTF("Marking attendance for fingerprint ID: %d\n", fingerprintId);

  // Show processing
  display.clearDisplay();
  displayCentered("Processing...", 25);
  display.display();

  if (state.wifiConnected && !state.activeSessionId.isEmpty())
  {
    // Online mode - send directly to server
    StaticJsonDocument<512> doc;
    doc["device_id"] = DEVICE_CODE;
    doc["device_session_id"] = state.activeSessionId;
    doc["fingerprint_id"] = fingerprintId;
    doc["scanned_at"] = getFormattedTime();

    String body;
    serializeJson(doc, body);

    String response = makeSupabaseRequest("/rest/v1/device_attendance_queue", "POST", body);

    if (!response.isEmpty() && response.indexOf("error") == -1)
    {
      state.attendanceCount++;

      display.clearDisplay();
      displayCentered("PRESENT!", 15, 2);
      displayCentered("ID: " + String(fingerprintId), 45);
      displayCentered(String(state.attendanceCount) + "/" + String(state.totalStudents), 55);
      display.display();

      showSuccess();
      delay(1500);
    }
    else
    {
      // Failed - add to offline queue
      addToOfflineQueue(fingerprintId);
      showError("Sync Failed");
      delay(1000);
    }
  }
  else
  {
    // Offline mode - store locally
    addToOfflineQueue(fingerprintId);

    display.clearDisplay();
    displayCentered("RECORDED", 15, 2);
    displayCentered("(Offline)", 35);
    displayCentered("ID: " + String(fingerprintId), 50);
    display.display();

    playTone(800, 100);
    delay(100);
    playTone(1000, 100);
    delay(1500);
  }
}

void addToOfflineQueue(int fingerprintId)
{
  if (offlineQueueCount >= OFFLINE_QUEUE_SIZE)
  {
    DEBUG_PRINTLN("Offline queue full!");
    return;
  }

  offlineQueue[offlineQueueCount].fingerprintId = fingerprintId;
  offlineQueue[offlineQueueCount].timestamp = timeClient.getEpochTime();
  offlineQueue[offlineQueueCount].synced = false;
  offlineQueueCount++;

  saveOfflineQueue();
  DEBUG_PRINTF("Added to offline queue. Count: %d\n", offlineQueueCount);
}

void syncOfflineQueue()
{
  if (offlineQueueCount == 0)
    return;

  DEBUG_PRINTLN("Syncing offline queue...");

  int synced = 0;
  for (int i = 0; i < offlineQueueCount; i++)
  {
    if (!offlineQueue[i].synced)
    {
      StaticJsonDocument<256> doc;
      doc["device_id"] = DEVICE_CODE;
      doc["fingerprint_id"] = offlineQueue[i].fingerprintId;
      doc["scanned_at"] = offlineQueue[i].timestamp;

      String body;
      serializeJson(doc, body);

      String response = makeSupabaseRequest("/rest/v1/device_attendance_queue", "POST", body);

      if (!response.isEmpty() && response.indexOf("error") == -1)
      {
        offlineQueue[i].synced = true;
        synced++;
      }
    }
  }

  if (synced > 0)
  {
    saveOfflineQueue();
    DEBUG_PRINTF("Synced %d records\n", synced);

    // Clean up synced records
    int newCount = 0;
    for (int i = 0; i < offlineQueueCount; i++)
    {
      if (!offlineQueue[i].synced)
      {
        offlineQueue[newCount++] = offlineQueue[i];
      }
    }
    offlineQueueCount = newCount;
    saveOfflineQueue();
  }
}

// ============================================
// SERVER COMMUNICATION
// ============================================

void sendHeartbeat()
{
  if (!state.wifiConnected)
    return;

  DEBUG_PRINTLN("Sending heartbeat...");

  StaticJsonDocument<256> doc;
  doc["device_code"] = DEVICE_CODE;
  doc["device_name"] = DEVICE_NAME;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["status"] = "ACTIVE";

  String body;
  serializeJson(doc, body);

  String response = makeSupabaseRequest("/functions/v1/device-api", "POST", body);

  if (!response.isEmpty())
  {
    state.serverConnected = true;

    // Parse response for any commands
    StaticJsonDocument<512> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);

    if (!error)
    {
      // Check if there's an enrollment command
      if (responseDoc.containsKey("enroll"))
      {
        int enrollId = responseDoc["enroll"]["fingerprint_id"];
        String studentId = responseDoc["enroll"]["student_id"].as<String>();

        if (enrollId > 0)
        {
          state.mode = MODE_ENROLLMENT;
          state.enrollingFingerprintId = enrollId;
          state.enrollingStudentId = studentId;
          DEBUG_PRINTF("Starting enrollment for ID: %d\n", enrollId);
        }
      }
    }
  }
  else
  {
    state.serverConnected = false;
  }
}

void checkForActiveSession()
{
  if (!state.wifiConnected)
    return;

  // Query for active device session
  String endpoint = "/rest/v1/device_sessions?device_id=eq." + String(DEVICE_CODE) + "&session_status=eq.ACTIVE&select=*";
  String response = makeSupabaseRequest(endpoint, "GET");

  if (!response.isEmpty())
  {
    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);

    if (!error && doc.is<JsonArray>() && doc.size() > 0)
    {
      JsonObject session = doc[0];

      String sessionId = session["id"].as<String>();
      String attendanceSessionId = session["attendance_session_id"].as<String>();

      if (sessionId != state.activeSessionId)
      {
        // New session started
        state.activeSessionId = sessionId;
        state.mode = MODE_ATTENDANCE;
        state.attendanceCount = 0;
        state.currentClassId = session["class_id"].as<String>();
        state.currentSubjectId = session["subject_id"].as<String>();

        DEBUG_PRINTLN("Active session found: " + sessionId);

        // Get total students count
        // This could be enhanced to get from server
        state.totalStudents = 60; // Default

        playTone(1500, 100);
        delay(100);
        playTone(1500, 100);
      }
    }
    else
    {
      // No active session
      if (state.mode == MODE_ATTENDANCE)
      {
        DEBUG_PRINTLN("Session ended");
        state.mode = MODE_IDLE;
        state.activeSessionId = "";
        playTone(500, 300);
      }
    }
  }
}

String makeSupabaseRequest(String endpoint, String method, String body)
{
  if (!state.wifiConnected)
    return "";

  HTTPClient http;
  String url = String(SUPABASE_URL) + endpoint;

  DEBUG_PRINTF("Request: %s %s\n", method.c_str(), endpoint.c_str());

  http.begin(secureClient, url);
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", "Bearer " + String(SUPABASE_ANON_KEY));
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");

  int httpCode;
  if (method == "GET")
  {
    httpCode = http.GET();
  }
  else if (method == "POST")
  {
    httpCode = http.POST(body);
  }
  else if (method == "PATCH")
  {
    httpCode = http.PATCH(body);
  }
  else
  {
    http.end();
    return "";
  }

  String response = "";
  if (httpCode > 0)
  {
    response = http.getString();
    DEBUG_PRINTF("Response (%d): %s\n", httpCode, response.substring(0, 100).c_str());
  }
  else
  {
    DEBUG_PRINTF("Request failed: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return response;
}

// ============================================
// DISPLAY FUNCTIONS
// ============================================

void setupDisplay()
{
  Wire.begin(OLED_SDA, OLED_SCL);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR))
  {
    DEBUG_PRINTLN("SSD1306 allocation failed!");
    return;
  }

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.display();
}

void updateDisplay()
{
  display.clearDisplay();

  // Header with time
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print(getFormattedTime());

  // WiFi indicator
  if (state.wifiConnected)
  {
    display.setCursor(100, 0);
    display.print("WiFi");
  }

  // Draw separator line
  display.drawLine(0, 10, 128, 10, SSD1306_WHITE);

  // Mode-specific display
  switch (state.mode)
  {
  case MODE_IDLE:
    displayCentered("READY", 20, 2);
    displayCentered("No Active Session", 45);
    break;

  case MODE_ATTENDANCE:
    displayCentered("ATTENDANCE", 15, 1);
    displayCentered(String(state.attendanceCount) + "/" + String(state.totalStudents), 30, 2);
    displayCentered("Place finger...", 55);
    break;

  case MODE_ENROLLMENT:
    // Handled in handleEnrollment()
    return;

  case MODE_ERROR:
    displayCentered("ERROR", 20, 2);
    displayCentered(state.lastError, 45);
    break;
  }

  // Offline queue indicator
  if (offlineQueueCount > 0)
  {
    display.setCursor(0, 56);
    display.setTextSize(1);
    display.print("Offline: ");
    display.print(offlineQueueCount);
  }

  display.display();
}

void displayCentered(String text, int y, int textSize)
{
  display.setTextSize(textSize);
  int16_t x1, y1;
  uint16_t w, h;
  display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
  display.setCursor((OLED_WIDTH - w) / 2, y);
  display.print(text);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

void playTone(int frequency, int duration)
{
  tone(BUZZER_PIN, frequency, duration);
}

void showSuccess()
{
  digitalWrite(LED_PIN, HIGH);
  playTone(1000, 100);
  delay(100);
  playTone(1500, 100);
  delay(100);
  playTone(2000, 100);
}

void showError(String message)
{
  state.lastError = message;
  display.clearDisplay();
  displayCentered("ERROR", 10, 2);
  displayCentered(message, 40);
  display.display();

  playTone(200, 500);
  digitalWrite(LED_PIN, LOW);
  delay(100);
  digitalWrite(LED_PIN, HIGH);
}

String getFormattedTime()
{
  time_t now = timeClient.getEpochTime();
  struct tm *timeinfo = localtime(&now);
  char buffer[9];
  sprintf(buffer, "%02d:%02d:%02d", timeinfo->tm_hour, timeinfo->tm_min, timeinfo->tm_sec);
  return String(buffer);
}

void loadOfflineQueue()
{
  offlineQueueCount = EEPROM.read(0);
  if (offlineQueueCount > OFFLINE_QUEUE_SIZE)
  {
    offlineQueueCount = 0;
  }

  for (int i = 0; i < offlineQueueCount; i++)
  {
    int addr = 1 + i * sizeof(OfflineRecord);
    EEPROM.get(addr, offlineQueue[i]);
  }

  DEBUG_PRINTF("Loaded %d offline records\n", offlineQueueCount);
}

void saveOfflineQueue()
{
  EEPROM.write(0, offlineQueueCount);

  for (int i = 0; i < offlineQueueCount; i++)
  {
    int addr = 1 + i * sizeof(OfflineRecord);
    EEPROM.put(addr, offlineQueue[i]);
  }

  EEPROM.commit();
}
