                                  /**
                                   * ATTENDRO - ESP32 Fingerprint Attendance Device (Arduino IDE Version)
                                   *
                                   * Hardware: ESP32 + R307/AS608 Fingerprint Sensor + SSD1306 OLED
                                   *
                                   * Simplified version for Arduino IDE (no buzzer, no LED)
                                   *
                                   * Installation:
                                   * 1. Install ESP32 board support in Arduino IDE
                                   * 2. Install libraries (Sketch -> Include Library -> Manage Libraries):
                                   *    - Adafruit Fingerprint Sensor Library
                                   *    - Adafruit SSD1306
                                   *    - Adafruit GFX Library
                                   *    - ArduinoJson
                                   *    - NTPClient
                                   * 3. Edit WiFi and Supabase credentials below
                                   * 4. Select Board: ESP32 Dev Module
                                   * 5. Upload!
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
                                  #include "soc/soc.h"           // Disable brownout detector
                                  #include "soc/rtc_cntl_reg.h"  // Disable brownout detector

                                  // ============================================
                                  // CONFIGURATION - EDIT THESE!
                                  // ============================================

                                  // WiFi Settings
                                  #define WIFI_SSID "YOUR_WIFI_SSID"
                                  #define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

                                  // Supabase Settings
                                  #define SUPABASE_URL "https://yourproject.supabase.co"
                                  #define SUPABASE_ANON_KEY "your-supabase-anon-key"

                                  // Device Identity (must match device registered in admin panel)
                                  #define DEVICE_CODE "DEVICE_001"
                                  #define DEVICE_NAME "Classroom A101"
                                  #define FIRMWARE_VERSION "1.0.0"

                                  // Hardware Pins
                                  #define FP_RX_PIN 16 // Fingerprint sensor TX -> ESP32 GPIO16
                                  #define FP_TX_PIN 17 // Fingerprint sensor RX -> ESP32 GPIO17
                                  #define OLED_SDA 21  // OLED SDA
                                  #define OLED_SCL 22  // OLED SCL
                                  #define OLED_WIDTH 128
                                  #define OLED_HEIGHT 64
                                  #define OLED_ADDR 0x3C

                                  // Fingerprint Sensor Settings
                                  #define FP_BAUD_RATE 57600
                                  #define FP_SECURITY_LEVEL 3

                                  // Timing Configuration (milliseconds)
                                  #define HEARTBEAT_INTERVAL 5000  // 5 seconds for faster command pickup
                                  #define WIFI_RECONNECT_INTERVAL 10000
                                  #define DISPLAY_UPDATE_INTERVAL 1000
                                  #define SESSION_CHECK_INTERVAL 5000

                                  // NTP Settings
                                  #define NTP_SERVER "pool.ntp.org"
                                  #define NTP_OFFSET_SECONDS 19800 // IST = UTC+5:30

                                  // Offline Queue
                                  #define OFFLINE_QUEUE_SIZE 50
                                  #define EEPROM_SIZE 4096

                                  // Debug Settings
                                  #define DEBUG_ENABLED true

                                  #if DEBUG_ENABLED
                                  #define DEBUG_PRINT(x) Serial.print(x)
                                  #define DEBUG_PRINTLN(x) Serial.println(x)
                                  #define DEBUG_PRINTF(format, ...) Serial.printf(format, ##__VA_ARGS__)
                                  #else
                                  #define DEBUG_PRINT(x)
                                  #define DEBUG_PRINTLN(x)
                                  #define DEBUG_PRINTF(format, ...)
                                  #endif

                                  // ============================================
                                  // GLOBAL OBJECTS
                                  // ============================================

                                  HardwareSerial fpSerial(2);
                                  Adafruit_Fingerprint finger = Adafruit_Fingerprint(&fpSerial);
                                  Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
                                  WiFiUDP ntpUDP;
                                  NTPClient timeClient(ntpUDP, NTP_SERVER, NTP_OFFSET_SECONDS);
                                  WiFiClientSecure secureClient;

                                  // ============================================
                                  // STATE VARIABLES
                                  // ============================================

                                  enum DeviceMode
                                  {
                                    MODE_IDLE,
                                    MODE_ATTENDANCE,
                                    MODE_ENROLLMENT,
                                    MODE_VERIFY,
                                    MODE_ERROR
                                  };

                                  struct DeviceState
                                  {
                                    DeviceMode mode;
                                    bool wifiConnected;
                                    bool serverConnected;
                                    String deviceUUID;           // Device UUID from database
                                    String activeSessionId;
                                    String currentClassId;
                                    String currentSubjectId;
                                    int enrollingFingerprintId;
                                    String enrollingStudentId;
                                    int verifyFingerprintId;
                                    String verifyStudentId;
                                    String verifyTestId;
                                    unsigned long lastHeartbeat;
                                    unsigned long lastWifiCheck;
                                    unsigned long lastSessionCheck;
                                    unsigned long lastDisplayUpdate;
                                    int attendanceCount;
                                    int totalStudents;
                                    String lastError;
                                  } state;

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
                                  void handleVerification();
                                  void markAttendance(int fingerprintId);
                                  void updateDisplay();
                                  void displayCentered(String text, int y, int textSize = 1);
                                  void addToOfflineQueue(int fingerprintId);
                                  void syncOfflineQueue();
                                  String makeSupabaseRequest(String endpoint, String method, String body = "");
                                  String getFormattedTime();
                                  void loadOfflineQueue();
                                  void saveOfflineQueue();
                                  void notifyEnrollmentComplete(int fingerprintId);
                                  void notifyVerifyResult(int recognizedId, bool success);

                                  // ============================================
                                  // SETUP
                                  // ============================================

                                  void setup()
                                  {
                                    // POWER FIX: Disable brownout detector FIRST
                                    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

                                    Serial.begin(115200);
                                    delay(2000);  // Extra delay for power stabilization

                                    DEBUG_PRINTLN("\n========================================");
                                    DEBUG_PRINTLN("  ATTENDRO Fingerprint Device");
                                    DEBUG_PRINTLN("  Version: " FIRMWARE_VERSION);
                                    DEBUG_PRINTLN("  Device: " DEVICE_CODE);
                                    DEBUG_PRINTLN("  Power: Brownout DISABLED");
                                    DEBUG_PRINTLN("========================================\n");

                                    // Initialize EEPROM
                                    EEPROM.begin(EEPROM_SIZE);
                                    loadOfflineQueue();

                                    // Initialize state
                                    state.mode = MODE_IDLE;
                                    state.wifiConnected = false;
                                    state.serverConnected = false;
                                    state.deviceUUID = "";
                                    state.activeSessionId = "";
                                    state.lastHeartbeat = 0;
                                    state.lastWifiCheck = 0;
                                    state.lastSessionCheck = 0;
                                    state.lastDisplayUpdate = 0;
                                    state.attendanceCount = 0;
                                    state.totalStudents = 0;

                                    // Initialize display
                                    setupDisplay();
                                    delay(200);  // Power stabilization
                                    displayCentered("ATTENDRO", 10, 2);
                                    displayCentered("Initializing...", 35);
                                    display.display();
                                    delay(300);  // Power stabilization

                                    // Connect to WiFi (reduced power mode)
                                    setupWiFi();

                                    // Initialize NTP
                                    timeClient.begin();
                                    timeClient.update();

                                    // Initialize fingerprint sensor
                                    setupFingerprint();

                                    // Send initial heartbeat
                                    sendHeartbeat();

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
                                    case MODE_VERIFY:
                                      handleVerification();
                                      break;
                                    case MODE_IDLE:
                                      // Check for fingerprints in idle mode
                                      if (finger.getImage() == FINGERPRINT_OK)
                                      {
                                        display.clearDisplay();
                                        displayCentered("ERROR", 10, 2);
                                        displayCentered("No Active Session", 40);
                                        display.display();
                                        delay(1000);
                                      }
                                      break;
                                    case MODE_ERROR:
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

                                    // POWER FIX: Reduce WiFi TX power to prevent brownout
                                    WiFi.mode(WIFI_STA);
                                    delay(500);  // Let voltage stabilize
                                    WiFi.setTxPower(WIFI_POWER_11dBm);  // Reduce from 19dBm to 11dBm
                                    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
                                    delay(100);

                                    int attempts = 0;
                                    while (WiFi.status() != WL_CONNECTED && attempts < 30)
                                    {
                                      delay(500);
                                      DEBUG_PRINT(".");
                                      attempts++;
                                    }

                                    if (WiFi.status() == WL_CONNECTED)
                                    {
                                      state.wifiConnected = true;
                                      DEBUG_PRINTLN("\nWiFi connected!");
                                      DEBUG_PRINT("IP: ");
                                      DEBUG_PRINTLN(WiFi.localIP());

                                      secureClient.setInsecure();

                                      display.clearDisplay();
                                      displayCentered("WiFi Connected", 20);
                                      displayCentered(WiFi.localIP().toString(), 35);
                                      display.display();
                                      delay(1000);
                                    }
                                    else
                                    {
                                      state.wifiConnected = false;
                                      DEBUG_PRINTLN("\nWiFi connection failed!");
                                      display.clearDisplay();
                                      displayCentered("ERROR", 10, 2);
                                      displayCentered("WiFi Failed", 40);
                                      display.display();
                                      delay(2000);
                                    }
                                  }

                                  void checkWiFiConnection()
                                  {
                                    if (WiFi.status() != WL_CONNECTED)
                                    {
                                      state.wifiConnected = false;
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
                                        DEBUG_PRINTLN("WiFi reconnected!");
                                      }
                                    }
                                    else
                                    {
                                      state.wifiConnected = true;
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

                                      finger.getParameters();
                                      DEBUG_PRINTF("Capacity: %d\n", finger.capacity);
                                      DEBUG_PRINTF("Security level: %d\n", finger.security_level);

                                      finger.setSecurityLevel(FP_SECURITY_LEVEL);
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
                                      display.clearDisplay();
                                      displayCentered("ERROR", 10, 2);
                                      displayCentered("Sensor Not Found", 40);
                                      display.display();
                                      delay(2000);
                                    }
                                  }

                                  void handleFingerprintScan()
                                  {
                                    int result = finger.getImage();

                                    if (result == FINGERPRINT_NOFINGER)
                                    {
                                      return;
                                    }

                                    if (result != FINGERPRINT_OK)
                                    {
                                      DEBUG_PRINTLN("Error getting image");
                                      return;
                                    }

                                    DEBUG_PRINTLN("Image taken");

                                    result = finger.image2Tz();
                                    if (result != FINGERPRINT_OK)
                                    {
                                      display.clearDisplay();
                                      displayCentered("ERROR", 10, 2);
                                      displayCentered("Image Error", 40);
                                      display.display();
                                      delay(500);
                                      return;
                                    }

                                    result = finger.fingerSearch();
                                    if (result == FINGERPRINT_OK)
                                    {
                                      int fingerprintId = finger.fingerID;
                                      int confidence = finger.confidence;

                                      DEBUG_PRINTF("Found ID: %d (Confidence: %d)\n", fingerprintId, confidence);
                                      markAttendance(fingerprintId);
                                    }
                                    else if (result == FINGERPRINT_NOTFOUND)
                                    {
                                      DEBUG_PRINTLN("Fingerprint not found");
                                      display.clearDisplay();
                                      displayCentered("ERROR", 10, 2);
                                      displayCentered("Not Enrolled", 40);
                                      display.display();
                                      delay(1000);
                                    }
                                    else
                                    {
                                      DEBUG_PRINTF("Search error: %d\n", result);
                                      display.clearDisplay();
                                      displayCentered("ERROR", 10, 2);
                                      displayCentered("Scan Error", 40);
                                      display.display();
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

                                    if (millis() - lastPrompt > 2000)
                                    {
                                      display.clearDisplay();
                                      displayCentered("ENROLLMENT", 0, 1);
                                      displayCentered("ID: " + String(state.enrollingFingerprintId), 15);

                                      if (enrollmentStep == 0)
                                      {
                                        displayCentered("Place finger", 35);
                                        displayCentered("(1st scan)", 50);
                                        DEBUG_PRINTLN("========================================");
                                        DEBUG_PRINTF("ENROLLMENT: Waiting for FIRST scan (ID: %d)\n", state.enrollingFingerprintId);
                                        DEBUG_PRINTLN("========================================");
                                      }
                                      else
                                      {
                                        displayCentered("Place SAME finger", 35);
                                        displayCentered("(2nd scan)", 50);
                                        DEBUG_PRINTLN("----------------------------------------");
                                        DEBUG_PRINTF("ENROLLMENT: Waiting for SECOND scan (ID: %d)\n", state.enrollingFingerprintId);
                                        DEBUG_PRINTLN("----------------------------------------");
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
                                      DEBUG_PRINTF("ERROR: getImage failed with code: %d\n", result);
                                      return;
                                    }

                                    DEBUG_PRINTLN(">>> FINGER DETECTED! Image captured successfully");

                                    result = finger.image2Tz(enrollmentStep + 1);
                                    if (result != FINGERPRINT_OK)
                                    {
                                      DEBUG_PRINTF("ERROR: image2Tz failed with code: %d\n", result);
                                      display.clearDisplay();
                                      displayCentered("ERROR", 10, 2);
                                      displayCentered("Conversion Error", 40);
                                      display.display();
                                      delay(1000);
                                      return;
                                    }

                                    DEBUG_PRINTLN(">>> Image converted to template successfully");

                                    if (enrollmentStep == 0)
                                    {
                                      enrollmentStep = 1;
                                      DEBUG_PRINTLN("");
                                      DEBUG_PRINTLN("************************************");
                                      DEBUG_PRINTLN("*  FIRST SCAN COMPLETE!            *");
                                      DEBUG_PRINTLN("*  Please REMOVE finger...         *");
                                      DEBUG_PRINTLN("************************************");
                                      DEBUG_PRINTLN("");

                                      display.clearDisplay();
                                      displayCentered("First scan OK!", 25);
                                      displayCentered("Remove finger", 40);
                                      display.display();

                                      while (finger.getImage() != FINGERPRINT_NOFINGER)
                                      {
                                        delay(100);
                                      }
                                      DEBUG_PRINTLN(">>> Finger removed. Ready for second scan.");
                                      delay(500);
                                    }
                                    else
                                    {
                                      DEBUG_PRINTLN(">>> Creating fingerprint model from both scans...");
                                      result = finger.createModel();
                                      if (result != FINGERPRINT_OK)
                                      {
                                        DEBUG_PRINTF("ERROR: createModel failed - Prints don't match! Code: %d\n", result);
                                        display.clearDisplay();
                                        displayCentered("ERROR", 10, 2);
                                        displayCentered("Prints don't match", 40);
                                        display.display();
                                        enrollmentStep = 0;
                                        delay(2000);
                                        return;
                                      }

                                      DEBUG_PRINTLN(">>> Both fingerprints match! Storing template...");
                                      result = finger.storeModel(state.enrollingFingerprintId);
                                      if (result == FINGERPRINT_OK)
                                      {
                                        DEBUG_PRINTLN("");
                                        DEBUG_PRINTLN("========================================");
                                        DEBUG_PRINTF("SUCCESS! Template stored at ID: %d\n", state.enrollingFingerprintId);
                                        DEBUG_PRINTLN("========================================");
                                        DEBUG_PRINTLN("");
                                        DEBUG_PRINTLN(">>> Sending enrollment_complete to server...");

                                        notifyEnrollmentComplete(state.enrollingFingerprintId);

                                        display.clearDisplay();
                                        displayCentered("ENROLLED!", 20, 2);
                                        displayCentered("ID: " + String(state.enrollingFingerprintId), 45);
                                        display.display();

                                        enrollmentStep = 0;
                                        state.enrollingFingerprintId = 0;
                                        state.enrollingStudentId = "";
                                        state.mode = MODE_IDLE;
                                        delay(2000);
                                      }
                                      else
                                      {
                                        display.clearDisplay();
                                        displayCentered("ERROR", 10, 2);
                                        displayCentered("Storage Error", 40);
                                        display.display();
                                        enrollmentStep = 0;
                                        delay(2000);
                                      }
                                    }
                                  }

                                  void notifyEnrollmentComplete(int fingerprintId)
                                  {
                                    DEBUG_PRINTLN(">>> Notifying server of enrollment completion...");

                                    if (!state.wifiConnected)
                                    {
                                      DEBUG_PRINTLN("ERROR: WiFi not connected! Cannot notify server.");
                                      return;
                                    }

                                    StaticJsonDocument<256> doc;
                                    doc["device_code"] = DEVICE_CODE;
                                    doc["action"] = "enrollment_complete";
                                    doc["fingerprint_id"] = fingerprintId;
                                    doc["student_id"] = state.enrollingStudentId;

                                    String body;
                                    serializeJson(doc, body);

                                    DEBUG_PRINTLN(">>> Sending to server:");
                                    DEBUG_PRINTLN(body);

                                    String response = makeSupabaseRequest("/functions/v1/device-api", "POST", body);

                                    if (response.isEmpty())
                                    {
                                      DEBUG_PRINTLN("WARNING: Empty response from server");
                                    }
                                    else
                                    {
                                      DEBUG_PRINTLN(">>> Server response:");
                                      DEBUG_PRINTLN(response);
                                      DEBUG_PRINTLN(">>> Enrollment notification sent successfully!");
                                    }
                                  }

                                  // ============================================
                                  // VERIFICATION FUNCTIONS
                                  // ============================================

                                  void handleVerification()
                                  {
                                    static unsigned long verifyStartTime = 0;
                                    const unsigned long VERIFY_TIMEOUT = 30000; // 30 second timeout

                                    if (state.verifyFingerprintId <= 0)
                                    {
                                      state.mode = MODE_IDLE;
                                      return;
                                    }

                                    // Initialize verify start time
                                    if (verifyStartTime == 0)
                                    {
                                      verifyStartTime = millis();
                                    }

                                    // Show verification screen
                                    display.clearDisplay();
                                    displayCentered("VERIFY TEST", 0, 1);
                                    displayCentered("ID: " + String(state.verifyFingerprintId), 15);
                                    displayCentered("Place Finger...", 35);
                                    display.display();

                                    // Check for timeout
                                    if (millis() - verifyStartTime > VERIFY_TIMEOUT)
                                    {
                                      DEBUG_PRINTLN("Verification timeout");
                                      notifyVerifyResult(-1, false);
                                      display.clearDisplay();
                                      displayCentered("TIMEOUT!", 20, 2);
                                      display.display();
                                      delay(1500);
                                      verifyStartTime = 0;
                                      state.verifyFingerprintId = 0;
                                      state.mode = MODE_IDLE;
                                      return;
                                    }

                                    // Wait for finger
                                    int result = finger.getImage();
                                    if (result != FINGERPRINT_OK)
                                    {
                                      return; // No finger yet
                                    }

                                    DEBUG_PRINTLN("Image taken for verification");

                                    // Convert image to template
                                    result = finger.image2Tz();
                                    if (result != FINGERPRINT_OK)
                                    {
                                      display.clearDisplay();
                                      displayCentered("Bad Image", 20, 2);
                                      displayCentered("Try Again", 45);
                                      display.display();
                                      delay(1000);
                                      return;
                                    }

                                    // Search for fingerprint match
                                    result = finger.fingerSearch();

                                    if (result == FINGERPRINT_OK)
                                    {
                                      int foundId = finger.fingerID;
                                      int confidence = finger.confidence;
                                      DEBUG_PRINTF("Found fingerprint ID: %d (confidence: %d)\n", foundId, confidence);

                                      // Check if it matches the expected ID
                                      if (foundId == state.verifyFingerprintId)
                                      {
                                        // Success! Correct fingerprint
                                        notifyVerifyResult(foundId, true);
                                        display.clearDisplay();
                                        displayCentered("VERIFIED!", 10, 2);
                                        displayCentered("ID: " + String(foundId), 40);
                                        displayCentered("Match!", 55);
                                        display.display();
                                        delay(2000);
                                      }
                                      else
                                      {
                                        // Wrong fingerprint recognized
                                        notifyVerifyResult(foundId, false);
                                        display.clearDisplay();
                                        displayCentered("WRONG ID!", 10, 2);
                                        displayCentered("Expected: " + String(state.verifyFingerprintId), 35);
                                        displayCentered("Got: " + String(foundId), 50);
                                        display.display();
                                        delay(2000);
                                      }
                                    }
                                    else
                                    {
                                      // No match found
                                      notifyVerifyResult(-1, false);
                                      display.clearDisplay();
                                      displayCentered("NO MATCH!", 10, 2);
                                      displayCentered("Fingerprint not", 35);
                                      displayCentered("recognized", 50);
                                      display.display();
                                      delay(2000);
                                    }

                                    // Return to idle
                                    verifyStartTime = 0;
                                    state.verifyFingerprintId = 0;
                                    state.verifyStudentId = "";
                                    state.verifyTestId = "";
                                    state.mode = MODE_IDLE;
                                  }

                                  void notifyVerifyResult(int recognizedId, bool success)
                                  {
                                    if (!state.wifiConnected)
                                      return;

                                    StaticJsonDocument<256> doc;
                                    doc["device_code"] = DEVICE_CODE;
                                    doc["action"] = "verify_result";
                                    doc["test_id"] = state.verifyTestId;
                                    doc["recognized_id"] = recognizedId;
                                    doc["success"] = success;

                                    String body;
                                    serializeJson(doc, body);

                                    DEBUG_PRINTF("Sending verify result: ID=%d, success=%d\n", recognizedId, success);
                                    makeSupabaseRequest("/functions/v1/device-api", "POST", body);
                                  }

                                  // ============================================
                                  // ATTENDANCE FUNCTIONS
                                  // ============================================

                                  void markAttendance(int fingerprintId)
                                  {
                                    DEBUG_PRINTF("Marking attendance for fingerprint ID: %d\n", fingerprintId);

                                    display.clearDisplay();
                                    displayCentered("Processing...", 25);
                                    display.display();

                                    if (state.wifiConnected)
                                    {
                                      // Send attendance scan request to device API
                                      StaticJsonDocument<512> doc;
                                      doc["device_code"] = DEVICE_CODE;
                                      doc["action"] = "attendance_scan";
                                      doc["fingerprint_id"] = fingerprintId;

                                      String body;
                                      serializeJson(doc, body);

                                      // Send to device API edge function
                                      String response = makeSupabaseRequest("/functions/v1/device-api", "POST", body);

                                      if (!response.isEmpty())
                                      {
                                        // Parse response
                                        StaticJsonDocument<1024> responseDoc;
                                        DeserializationError error = deserializeJson(responseDoc, response);

                                        if (!error && responseDoc["success"])
                                        {
                                          // Success - student marked present
                                          String studentName = responseDoc["student_name"] | "Unknown";
                                          String rollNo = responseDoc["roll_no"] | "";
                                          String showMessage = responseDoc["show_message"] | "Present!";

                                          state.attendanceCount++;

                                          display.clearDisplay();
                                          displayCentered("PRESENT!", 10, 2);
                                          displayCentered(studentName, 30);
                                          if (!rollNo.isEmpty()) {
                                            displayCentered("Roll: " + rollNo, 45);
                                          }
                                          display.display();

                                          DEBUG_PRINTF("Attendance marked: %s\n", studentName.c_str());
                                          delay(2000);
                                        }
                                        else
                                        {
                                          // Error response from server
                                          String errorMsg = responseDoc["show_message"] | "Error";

                                          display.clearDisplay();
                                          displayCentered("ERROR", 10, 2);
                                          displayCentered(errorMsg, 30);
                                          displayCentered("ID: " + String(fingerprintId), 50);
                                          display.display();

                                          DEBUG_PRINTF("Server error: %s\n", errorMsg.c_str());

                                          // Add to offline queue as backup
                                          addToOfflineQueue(fingerprintId);
                                          delay(2000);
                                        }
                                      }
                                      else
                                      {
                                        // Network/server connection failed
                                        display.clearDisplay();
                                        displayCentered("ERROR", 10, 2);
                                        displayCentered("Connection Failed", 30);
                                        displayCentered("Saved Offline", 45);
                                        display.display();

                                        DEBUG_PRINTLN("Network error - saving offline");
                                        addToOfflineQueue(fingerprintId);
                                        delay(2000);
                                      }
                                    }
                                    else
                                    {
                                      // No WiFi connection - save offline
                                      addToOfflineQueue(fingerprintId);

                                      display.clearDisplay();
                                      displayCentered("RECORDED", 15, 2);
                                      displayCentered("(Offline)", 35);
                                      displayCentered("ID: " + String(fingerprintId), 50);
                                      display.display();

                                      DEBUG_PRINTLN("Offline attendance recorded");
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

                                      StaticJsonDocument<512> responseDoc;
                                      DeserializationError error = deserializeJson(responseDoc, response);

                                      if (!error)
                                      {
                                        // Extract device UUID from response
                                        if (responseDoc.containsKey("device") && responseDoc["device"].containsKey("id"))
                                        {
                                          state.deviceUUID = responseDoc["device"]["id"].as<String>();
                                        }

                                        // Check for enrollment command
                                        if (responseDoc.containsKey("enroll"))
                                        {
                                          int enrollId = responseDoc["enroll"]["fingerprint_id"];
                                          String studentId = responseDoc["enroll"]["student_id"].as<String>();

                                          if (enrollId > 0)
                                          {
                                            state.mode = MODE_ENROLLMENT;
                                            state.enrollingFingerprintId = enrollId;
                                            state.enrollingStudentId = studentId;
                                            DEBUG_PRINTLN("");
                                            DEBUG_PRINTLN("########################################");
                                            DEBUG_PRINTLN("#  ENROLLMENT COMMAND RECEIVED!        #");
                                            DEBUG_PRINTF("#  Fingerprint ID: %d\n", enrollId);
                                            DEBUG_PRINTF("#  Student ID: %s\n", studentId.c_str());
                                            DEBUG_PRINTLN("########################################");
                                            DEBUG_PRINTLN("");
                                          }
                                        }

                                        // Check for verify command
                                        if (responseDoc.containsKey("verify"))
                                        {
                                          int verifyId = responseDoc["verify"]["fingerprint_id"];
                                          String studentId = responseDoc["verify"]["student_id"].as<String>();
                                          String testId = responseDoc["verify"]["test_id"].as<String>();

                                          if (verifyId > 0)
                                          {
                                            state.mode = MODE_VERIFY;
                                            state.verifyFingerprintId = verifyId;
                                            state.verifyStudentId = studentId;
                                            state.verifyTestId = testId;
                                            DEBUG_PRINTLN("");
                                            DEBUG_PRINTLN("########################################");
                                            DEBUG_PRINTLN("#  VERIFY COMMAND RECEIVED!            #");
                                            DEBUG_PRINTF("#  Fingerprint ID: %d\n", verifyId);
                                            DEBUG_PRINTLN("########################################");
                                            DEBUG_PRINTLN("");
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

                                    // Query device_sessions by device_code (TEXT column, not UUID)
                                    String deviceCode = DEVICE_CODE;
                                    String endpoint = "/rest/v1/device_sessions?device_code=eq." + deviceCode + "&session_status=eq.ACTIVE&select=*";

                                    DEBUG_PRINTF("🔍 Checking for active session: device_code=%s\n", deviceCode.c_str());
                                    String response = makeSupabaseRequest(endpoint, "GET");

                                    if (!response.isEmpty())
                                    {
                                      DEBUG_PRINTF("📥 Session response: %s\n", response.substring(0, 200).c_str());
                                      StaticJsonDocument<1024> doc;
                                      DeserializationError error = deserializeJson(doc, response);

                                      if (!error && doc.is<JsonArray>() && doc.size() > 0)
                                      {
                                        JsonObject session = doc[0];

                                        String sessionId = session["id"].as<String>();

                                        if (sessionId != state.activeSessionId)
                                        {
                                          state.activeSessionId = sessionId;
                                          state.mode = MODE_ATTENDANCE;
                                          state.attendanceCount = 0;
                                          state.currentClassId = session["class_id"].as<String>();
                                          state.currentSubjectId = session["subject_id"].as<String>();

                                          DEBUG_PRINTLN("Active session found: " + sessionId);

                                          state.totalStudents = 60;
                                        }
                                      }
                                      else
                                      {
                                        if (state.mode == MODE_ATTENDANCE)
                                        {
                                          DEBUG_PRINTLN("Session ended");
                                          state.mode = MODE_IDLE;
                                          state.activeSessionId = "";
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

                                    // Set HTTP timeout to 10 seconds (prevents hangs)
                                    http.setTimeout(10000);

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
