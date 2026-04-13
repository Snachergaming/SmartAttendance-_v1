# ATTENDRO ESP32 Device - Arduino IDE Setup

This is a simplified version for Arduino IDE **(no buzzer, no LED)**.

## Hardware Required
- ESP32 DevKit V1 (or any ESP32 board)
- R307 or AS608 Fingerprint Sensor
- SSD1306 OLED Display (128x64, I2C)
- Jumper wires

## Wiring

```
ESP32          Fingerprint Sensor (R307)
3.3V    ────>  VCC (Red wire)
GND     ────>  GND (Black wire)
GPIO16  ────>  TX  (Yellow wire)
GPIO17  ────>  RX  (Green wire)

ESP32          OLED Display (SSD1306)
3.3V    ────>  VCC
GND     ────>  GND
GPIO21  ────>  SDA
GPIO22  ────>  SCL
```

## Arduino IDE Setup

### 1. Install ESP32 Board Support

1. Open Arduino IDE
2. Go to **File → Preferences**
3. Add this URL to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools → Board → Boards Manager**
5. Search "esp32"
6. Install **"esp32 by Espressif Systems"**

### 2. Install Required Libraries

Go to **Sketch → Include Library → Manage Libraries** and install:

| Library Name | Search For |
|--------------|------------|
| Adafruit Fingerprint Sensor Library | "Adafruit Fingerprint" |
| Adafruit SSD1306 | "Adafruit SSD1306" |
| Adafruit GFX Library | "Adafruit GFX" |
| ArduinoJson | "ArduinoJson" |
| NTPClient | "NTPClient" |

### 3. Configure the Code

1. Open `ATTENDRO_Device.ino` in Arduino IDE
2. Edit the configuration section at the top (lines 24-35):

```cpp
// WiFi Settings
#define WIFI_SSID "YOUR_WIFI_NAME"           // ← Change this
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"   // ← Change this

// Supabase Settings
#define SUPABASE_URL "https://yourproject.supabase.co"  // ← Get from Supabase
#define SUPABASE_ANON_KEY "your-anon-key-here"          // ← Get from Supabase

// Device Identity
#define DEVICE_CODE "DEVICE_001"  // ← Must match admin panel
#define DEVICE_NAME "Classroom A101"
```

**Where to get Supabase credentials:**
- Login to [supabase.com](https://supabase.com)
- Go to your project
- Click "Settings" → "API"
- Copy:
  - Project URL → `SUPABASE_URL`
  - anon/public key → `SUPABASE_ANON_KEY`

### 4. Select Board and Port

1. Go to **Tools → Board → ESP32 Arduino**
2. Select **"ESP32 Dev Module"**
3. Go to **Tools → Port**
4. Select your ESP32's COM port (e.g., COM3, COM4)

### 5. Upload

1. Click **Upload** button (→)
2. Wait for compilation and upload
3. Open **Serial Monitor** (Ctrl+Shift+M)
4. Set baud rate to **115200**
5. You should see:
   ```
   ========================================
     ATTENDRO Fingerprint Device
     Version: 1.0.0
     Device: DEVICE_001
   ========================================

   Connecting to WiFi...
   WiFi connected!
   IP: 192.168.x.x
   ```

## Troubleshooting

### "Board not found" or "Upload failed"

**Fix:**
1. Install CH340 USB driver (if using cheap ESP32 clones)
2. Press and HOLD the "BOOT" button on ESP32 while uploading
3. Try a different USB cable
4. Try a different USB port

### "Compilation error: library not found"

**Fix:**
- Make sure you installed ALL libraries from step 2
- Restart Arduino IDE after installing libraries

### "Fingerprint sensor NOT found!"

**Fix:**
- Check wiring (TX and RX might be swapped)
- Make sure fingerprint sensor has power (red LED should glow)
- Try swapping GPIO16 and GPIO17

### "WiFi connection failed!"

**Fix:**
- Check WiFi SSID and password (case-sensitive!)
- Make sure WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Move ESP32 closer to WiFi router

### "OLED not working"

**Fix:**
- Check I2C wiring (SDA and SCL)
- Some displays use address `0x3D` instead of `0x3C`
- Change line 43: `#define OLED_ADDR 0x3D`

## After Upload

1. **Register device in web app:**
   - Login as Admin
   - Go to Admin → Device Management
   - Click "Add Device"
   - Enter `DEVICE_001` (or whatever you set in code)

2. **Enroll students:**
   - Go to Admin → Student Enrollment
   - Select device from dropdown
   - Select class
   - Click "Enroll" for each student
   - Student places finger twice

3. **Take attendance:**
   - Faculty logs in
   - Goes to Today's Lectures
   - Clicks "Start Attendance"
   - Configures device
   - Students scan fingers!

## Status Messages

| Display | Meaning |
|---------|---------|
| READY / No Active Session | Waiting for faculty to start session |
| ATTENDANCE / 5/60 | Taking attendance (5 out of 60 marked) |
| ENROLLMENT / ID: 42 | Enrolling student fingerprint |
| PRESENT! / ID: 23 | Attendance marked successfully |
| ERROR / Not Enrolled | Fingerprint not registered |
| Offline: 3 | 3 records waiting to sync |

## Features

✅ WiFi auto-connect and reconnect
✅ Real-time sync with Supabase
✅ OLED status display
✅ Offline mode (stores up to 50 records)
✅ Automatic sync when online
✅ Fingerprint enrollment
✅ NTP time sync

❌ No buzzer (simplified version)
❌ No LED (simplified version)

---

**Ready to use!** 🚀
