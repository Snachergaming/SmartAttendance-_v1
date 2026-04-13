# ATTENDRO - Quick Start Guide

## ✅ What You Have

1. **ESP32 Code** (Arduino IDE version in `arduino-version/`)
   - No buzzer, no LED (simplified)
   - Ready to upload to ESP32

2. **Web Application** (React + Supabase)
   - Admin panel for device management
   - Student enrollment interface
   - Faculty attendance system

3. **Database & Backend** (Supabase)
   - All tables ready
   - Edge functions for device communication

---

## 🚀 Step 1: ESP32 Device Setup (Arduino IDE)

### Install Arduino IDE
1. Download from https://www.arduino.cc/en/software
2. Install and open Arduino IDE

### Configure Arduino IDE
1. **Add ESP32 Board Support:**
   - File → Preferences
   - Add to "Additional Board Manager URLs":
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools → Board → Boards Manager
   - Search "esp32" and install "esp32 by Espressif Systems"

2. **Install Libraries:**
   - Sketch → Include Library → Manage Libraries
   - Install these (search each name):
     - Adafruit Fingerprint Sensor Library
     - Adafruit SSD1306
     - Adafruit GFX Library
     - ArduinoJson
     - NTPClient

### Upload Code

1. **Open the sketch:**
   ```
   arduino-version/ATTENDRO_Device.ino
   ```

2. **Edit configuration** (lines 24-35):
   ```cpp
   #define WIFI_SSID "YourWiFiName"           // ← Your WiFi name
   #define WIFI_PASSWORD "YourWiFiPassword"   // ← Your WiFi password
   #define SUPABASE_URL "https://yourproject.supabase.co"
   #define SUPABASE_ANON_KEY "your-anon-key"
   #define DEVICE_CODE "DEVICE_001"
   ```

3. **Connect ESP32 via USB**

4. **Select board and port:**
   - Tools → Board → ESP32 Arduino → ESP32 Dev Module
   - Tools → Port → (select your ESP32's COM port)

5. **Upload:**
   - Click Upload button (→)
   - Open Serial Monitor (Ctrl+Shift+M)
   - Set baud rate to 115200
   - You should see device booting up!

---

## 🌐 Step 2: Web Application Setup

### Prerequisites
- Node.js (v18 or higher): https://nodejs.org/

### Run the Web App

Open terminal in project folder:

```bash
cd c:\Users\athar\OneDrive\Desktop\ATTENDRO\supaconnect-hub

# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

The app will start at: **http://localhost:5173**

### Configure Supabase

1. **Create `.env` file** in project root:
   ```env
   VITE_SUPABASE_URL=https://yourproject.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

2. **Get Supabase credentials:**
   - Login to https://supabase.com
   - Go to your project
   - Settings → API
   - Copy:
     - Project URL → `VITE_SUPABASE_URL`
     - anon/public key → `VITE_SUPABASE_ANON_KEY`

3. **Run database migrations:**
   ```bash
   cd supabase
   supabase db push
   ```

4. **Deploy edge functions:**
   ```bash
   supabase functions deploy device-api
   ```

---

## 📱 Step 3: Using the System

### Admin Setup

1. **Login as admin:**
   - Go to http://localhost:5173
   - Click "Admin Login"
   - Use your admin credentials

2. **Register the device:**
   - Admin → Device Management
   - Click "Add Device"
   - Enter `DEVICE_001` (same as in ESP32 code)
   - Device status should show "Online" once ESP32 connects

3. **Enroll students:**
   - Admin → Student Enrollment
   - Select device from dropdown (must be online)
   - Select class
   - Click "Enroll" for each student
   - Student places finger on sensor twice
   - Done! ✅

### Faculty Using Device

1. **Login as faculty:**
   - Faculty → Today's Lectures
   - Click "Start Attendance" on a lecture

2. **Configure device:**
   - Enter device code: `DEVICE_001`
   - Click "Start"

3. **Students scan fingers:**
   - Students place finger on sensor
   - Attendance marks automatically
   - Faculty sees real-time updates

4. **End session:**
   - Click "End Session"
   - Review and manually adjust if needed

---

## 🔧 Hardware Wiring

```
ESP32          Fingerprint Sensor
3.3V    ────>  VCC (Red)
GND     ────>  GND (Black)
GPIO16  ────>  TX  (Yellow)
GPIO17  ────>  RX  (Green)

ESP32          OLED Display
3.3V    ────>  VCC
GND     ────>  GND
GPIO21  ────>  SDA
GPIO22  ────>  SCL
```

**No buzzer, no LED required!**

---

## 🐛 Troubleshooting

### ESP32 Issues

**"Board not found"**
- Install CH340 driver
- Hold BOOT button while uploading
- Try different USB cable/port

**"Fingerprint sensor NOT found"**
- Check wiring (TX/RX might be swapped)
- Verify sensor has power (red LED on sensor)

**"WiFi connection failed"**
- Check SSID and password (case-sensitive)
- Use 2.4GHz WiFi (ESP32 doesn't support 5GHz)

### Web App Issues

**"npm: command not found"**
- Install Node.js from https://nodejs.org/

**"Module not found"**
- Run `npm install` first

**"Supabase error"**
- Check `.env` file has correct credentials
- Make sure Supabase project is running

---

## 📊 System Features

### ✅ ESP32 Device
- WiFi auto-connect & reconnect
- Real-time sync with Supabase
- OLED status display
- Offline queue (50 records)
- Fingerprint enrollment
- NTP time sync

### ✅ Web Application
- Admin device management dashboard
- Student fingerprint enrollment
- Faculty attendance with real-time updates
- Admin reports & analytics
- Student promotion & management

### ✅ Database
- Automatic attendance sync
- Real-time subscriptions
- Offline queue processing
- Row-level security

---

## 🎯 Quick Command Reference

### Web App
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run migrations
cd supabase && supabase db push

# Deploy edge functions
supabase functions deploy device-api
```

### Arduino IDE
- Upload: Ctrl+U
- Serial Monitor: Ctrl+Shift+M
- Verify: Ctrl+R

---

## 📞 Need Help?

### Check Serial Monitor
All ESP32 debug messages appear here at 115200 baud.

### Check Supabase Logs
- Login to Supabase
- Go to Logs
- Check Edge Functions logs
- Check Database logs

### Check Browser Console
- Open browser DevTools (F12)
- Check Console tab for errors

---

**You're all set! 🎉**

1. Upload ESP32 code
2. Run web app: `npm run dev`
3. Register device in admin panel
4. Enroll students
5. Take attendance!
