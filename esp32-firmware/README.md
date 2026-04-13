# ATTENDRO ESP32 Fingerprint Device

ESP32-based fingerprint attendance device for the ATTENDRO system.

## Hardware Requirements

### Components
- **ESP32 DevKit V1** (or compatible ESP32 board)
- **R307 or AS608 Fingerprint Sensor** (optical fingerprint module)
- **SSD1306 OLED Display** (128x64, I2C interface)
- **Passive Buzzer** (optional, for audio feedback)
- **3.3V/5V Power Supply** (USB or external)

### Wiring Diagram

```
ESP32 DevKit V1          Fingerprint Sensor (R307/AS608)
┌────────────────┐       ┌──────────────────┐
│            3V3 ├───────┤ VCC (Red)        │
│            GND ├───────┤ GND (Black)      │
│         GPIO16 ├───────┤ TX  (Yellow)     │
│         GPIO17 ├───────┤ RX  (Green)      │
└────────────────┘       └──────────────────┘

ESP32 DevKit V1          OLED Display (SSD1306)
┌────────────────┐       ┌──────────────────┐
│            3V3 ├───────┤ VCC              │
│            GND ├───────┤ GND              │
│         GPIO21 ├───────┤ SDA              │
│         GPIO22 ├───────┤ SCL              │
└────────────────┘       └──────────────────┘

ESP32 DevKit V1          Buzzer (Optional)
┌────────────────┐       ┌──────────────────┐
│         GPIO25 ├───────┤ + (Signal)       │
│            GND ├───────┤ - (Ground)       │
└────────────────┘       └──────────────────┘
```

## Software Setup

### Prerequisites
1. Install [PlatformIO](https://platformio.org/install) (VS Code extension recommended)
2. Install USB-to-Serial drivers for your ESP32 board

### Configuration

1. **Copy the config file:**
   ```bash
   cp src/config.h src/config_local.h
   ```

2. **Edit `src/config_local.h`** with your credentials:
   ```cpp
   // WiFi Settings
   #define WIFI_SSID "YourWiFiName"
   #define WIFI_PASSWORD "YourWiFiPassword"

   // Supabase Settings (from your Supabase project)
   #define SUPABASE_URL "https://yourproject.supabase.co"
   #define SUPABASE_ANON_KEY "your-anon-key-here"

   // Device Identity
   #define DEVICE_CODE "DEVICE_001"  // Must be registered in the database
   #define DEVICE_NAME "Classroom A101"
   ```

3. **Build and Upload:**
   ```bash
   # Using PlatformIO CLI
   pio run -t upload

   # Or use PlatformIO IDE in VS Code
   # Click the Upload button (→) in the bottom toolbar
   ```

4. **Monitor Serial Output:**
   ```bash
   pio device monitor
   ```

## Device Registration

Before the device can be used, it must be registered in the ATTENDRO system:

1. **Admin Panel**: Go to Admin > Device Management
2. **Add Device**: Enter the device code (e.g., `DEVICE_001`)
3. **Activate**: Set device status to ACTIVE

The device will automatically connect and send heartbeats once configured.

## Usage

### Attendance Mode
1. Faculty starts an attendance session from the app
2. Faculty configures the device for that session (enters device code)
3. Device automatically enters ATTENDANCE mode
4. Students place their enrolled finger on the sensor
5. Attendance is marked automatically and synced in real-time

### Enrollment Mode
1. Admin or faculty initiates enrollment from the app
2. Device receives enrollment command via heartbeat
3. Student places finger twice for enrollment
4. Fingerprint is stored locally on the sensor
5. Enrollment status is synced to the server

### Offline Mode
If WiFi is unavailable, the device:
- Stores attendance records locally (up to 50 records)
- Automatically syncs when connection is restored
- Shows "Offline" indicator on display

## LED & Buzzer Indicators

| Indicator | Meaning |
|-----------|---------|
| LED ON | WiFi connected |
| LED OFF | WiFi disconnected |
| LED Blinking | Connecting to WiFi |
| 3 Rising Tones | Attendance marked successfully |
| Single Low Tone | Error or fingerprint not found |
| 2 Quick Beeps | Session started |

## Troubleshooting

### Fingerprint Sensor Not Found
- Check wiring (TX/RX might be swapped)
- Ensure sensor is powered (red LED on sensor should glow)
- Try different baud rate (57600 is default for most R307/AS608)

### WiFi Connection Issues
- Verify SSID and password
- Check if WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Move device closer to router

### OLED Display Not Working
- Check I2C address (default 0x3C, some displays use 0x3D)
- Verify SDA/SCL connections
- Run I2C scanner to detect display

### Attendance Not Syncing
- Check Supabase URL and API key
- Verify device is registered in database
- Check if attendance session is active

## Pin Configuration

| Function | GPIO Pin | Notes |
|----------|----------|-------|
| Fingerprint TX | GPIO16 | Connect to sensor TX |
| Fingerprint RX | GPIO17 | Connect to sensor RX |
| OLED SDA | GPIO21 | I2C Data |
| OLED SCL | GPIO22 | I2C Clock |
| Buzzer | GPIO25 | PWM output |
| Status LED | GPIO2 | Built-in LED |
| Mode Button | GPIO0 | Boot button |

## Power Consumption

- Active (scanning): ~150mA
- Idle (WiFi connected): ~80mA
- Deep Sleep: ~10μA (not implemented)

Recommended: 5V 1A USB power supply or 18650 battery with TP4056 charger.

## License

Part of the ATTENDRO Attendance Management System.
