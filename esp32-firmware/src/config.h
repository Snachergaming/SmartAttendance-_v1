/**
 * ATTENDRO ESP32 Fingerprint Device Configuration
 *
 * IMPORTANT: Copy this file to config_local.h and update with your credentials
 * Do NOT commit config_local.h to version control!
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============================================
// WIFI CONFIGURATION
// ============================================
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ============================================
// SUPABASE CONFIGURATION
// ============================================
// Get these from your Supabase project settings
#define SUPABASE_URL "https://YOUR_PROJECT.supabase.co"
#define SUPABASE_ANON_KEY "YOUR_SUPABASE_ANON_KEY"

// ============================================
// DEVICE CONFIGURATION
// ============================================
// Unique device code - must match what's registered in the database
// Format: DEVICE_XXX where XXX is a unique identifier
#define DEVICE_CODE "DEVICE_001"
#define DEVICE_NAME "Classroom A101"
#define FIRMWARE_VERSION "1.0.0"

// ============================================
// HARDWARE PINS
// ============================================
// Fingerprint Sensor (R307/AS608) - Using Serial2
#define FP_RX_PIN 16 // Connect to TX of fingerprint sensor
#define FP_TX_PIN 17 // Connect to RX of fingerprint sensor

// OLED Display (SSD1306 128x64) - I2C
#define OLED_SDA 21 // Default I2C SDA
#define OLED_SCL 22 // Default I2C SCL
#define OLED_WIDTH 128
#define OLED_HEIGHT 64
#define OLED_ADDR 0x3C

// Buzzer (optional)
#define BUZZER_PIN 25

// Status LED
#define LED_PIN 2 // Built-in LED on most ESP32 boards

// Button for manual mode switch (optional)
#define BUTTON_PIN 0 // Boot button on most ESP32 boards

// ============================================
// TIMING CONFIGURATION (milliseconds)
// ============================================
#define HEARTBEAT_INTERVAL 30000       // Send heartbeat every 30 seconds
#define WIFI_RECONNECT_INTERVAL 10000  // Try WiFi reconnect every 10 seconds
#define FINGERPRINT_CHECK_INTERVAL 100 // Check for fingerprint every 100ms
#define DISPLAY_UPDATE_INTERVAL 1000   // Update display every 1 second
#define SESSION_CHECK_INTERVAL 5000    // Check for active session every 5 seconds

// ============================================
// FINGERPRINT SENSOR CONFIGURATION
// ============================================
#define FP_BAUD_RATE 57600
#define FP_MAX_TEMPLATES 127 // Maximum fingerprint templates the sensor can store
#define FP_SECURITY_LEVEL 3  // 1-5, higher is more strict

// ============================================
// NTP CONFIGURATION
// ============================================
#define NTP_SERVER "pool.ntp.org"
#define NTP_OFFSET_SECONDS 19800 // IST = UTC + 5:30 = 19800 seconds

// ============================================
// DEBUG CONFIGURATION
// ============================================
#define DEBUG_ENABLED true
#define DEBUG_SERIAL Serial

#if DEBUG_ENABLED
#define DEBUG_PRINT(x) DEBUG_SERIAL.print(x)
#define DEBUG_PRINTLN(x) DEBUG_SERIAL.println(x)
#define DEBUG_PRINTF(format, ...) DEBUG_SERIAL.printf(format, ##__VA_ARGS__)
#else
#define DEBUG_PRINT(x)
#define DEBUG_PRINTLN(x)
#define DEBUG_PRINTF(format, ...)
#endif

#endif // CONFIG_H
