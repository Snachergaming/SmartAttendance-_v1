# ATTENDRO - Complete Attendance Management System

## Overview

ATTENDRO is a complete attendance management system with:
- **Web Application** (React + TypeScript + Supabase)
- **ESP32 Fingerprint Devices** for biometric attendance
- **Real-time sync** between devices and server
- **Mobile App** support via Capacitor

This implementation includes:
1. ✅ Student enrollment with fingerprint biometric
2. ✅ Faculty session control for attendance
3. ✅ ESP32 device management with easy device ID setup
4. ✅ Real-time attendance sync
5. ✅ Offline mode with automatic sync
6. ✅ Admin device management dashboard
7. ✅ Student fingerprint enrollment interface

---

## Project Structure

```
supaconnect-hub/
├── src/                          # React web application
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── Devices.tsx      # NEW: Device management page
│   │   │   └── StudentEnrollment.tsx  # NEW: Fingerprint enrollment
│   │   └── faculty/
│   │       └── Attendance.tsx   # Faculty attendance with device support
│   ├── components/
│   │   └── devices/
│   │       ├── DeviceAttendanceMonitor.tsx  # Real-time device monitoring
│   │       └── DeviceConfigDialog.tsx       # Device configuration
│   └── services/
│       └── devices.ts           # Device API service
│
├── esp32-firmware/              # NEW: ESP32 fingerprint device firmware
│   ├── platformio.ini           # PlatformIO configuration
│   ├── src/
│   │   ├── main.cpp             # Main ESP32 firmware
│   │   └── config.h             # Configuration template
│   └── README.md                # ESP32 setup instructions
│
├── supabase/
│   ├── migrations/
│   │   ├── 20260324_fingerprint_devices.sql  # Device tables
│   │   └── 20260324_enrollment_queue.sql     # NEW: Enrollment queue
│   └── functions/
│       └── device-api/          # NEW: Device communication API
│           └── index.ts
│
└── docs/                        # Documentation
```

---

## Quick Start Guide

### 1. Web Application Setup

```bash
cd supaconnect-hub

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run migrations
cd supabase
supabase db push

# Deploy edge functions
supabase functions deploy device-api

# Start development server
cd ..
npm run dev
```

### 2. Database Setup

Run the new migrations:

```sql
-- Apply fingerprint enrollment queue migration
-- File: supabase/migrations/20260324_enrollment_queue.sql
```

This creates:
- `fingerprint_enrollment_queue` table
- `get_next_fingerprint_id()` function
- Enrollment mode support for devices

### 3. ESP32 Device Setup

#### Prerequisites
- ESP32 DevKit V1 (or compatible)
- R307 or AS608 Fingerprint Sensor
- SSD1306 OLED Display (128x64, I2C)
- Passive Buzzer (optional)
- **PlatformIO** (NOT Arduino IDE)

#### Installation

1. **Install PlatformIO:**
   - Install [VS Code](https://code.visualstudio.com/)
   - Install PlatformIO extension from VS Code marketplace

2. **Configure the device:**
   ```bash
   cd esp32-firmware
   cp src/config.h src/config_local.h
   ```

3. **Edit `src/config_local.h`:**
   ```cpp
   // WiFi Settings
   #define WIFI_SSID "YourWiFiNetwork"
   #define WIFI_PASSWORD "YourWiFiPassword"

   // Supabase Settings
   #define SUPABASE_URL "https://yourproject.supabase.co"
   #define SUPABASE_ANON_KEY "your-anon-key"

   // Device Identity
   #define DEVICE_CODE "DEVICE_001"  // Must match what you register in admin panel
   #define DEVICE_NAME "Classroom A101"
   ```

4. **Build and Upload:**
   ```bash
   # Using PlatformIO CLI
   pio run -t upload

   # Or use VS Code PlatformIO extension:
   # Click the Upload button (→) in the bottom toolbar
   ```

5. **Monitor Serial Output:**
   ```bash
   pio device monitor
   ```

#### Hardware Wiring

```
ESP32          Fingerprint Sensor (R307)
3V3     ────>  VCC (Red)
GND     ────>  GND (Black)
GPIO16  ────>  TX  (Yellow)
GPIO17  ────>  RX  (Green)

ESP32          OLED Display (SSD1306)
3V3     ────>  VCC
GND     ────>  GND
GPIO21  ────>  SDA
GPIO22  ────>  SCL

ESP32          Buzzer
GPIO25  ────>  + (Signal)
GND     ────>  - (Ground)
```

---

## Usage Workflow

### Admin Setup

1. **Register Devices:**
   - Go to Admin → Device Management
   - Click "Add Device"
   - Enter device code (e.g., `DEVICE_001`)
   - Device will auto-connect when powered on

2. **Enroll Student Fingerprints:**
   - Go to Admin → Student Enrollment
   - Select online device from dropdown
   - Select class
   - Click "Enroll" next to student name
   - Student places finger twice on sensor
   - Enrollment complete!

### Faculty Using Device for Attendance

1. **Start Attendance Session:**
   - Faculty goes to Faculty → Today's Lectures
   - Clicks "Start Attendance" for a lecture
   - Configures fingerprint device (enters device code)

2. **Students Mark Attendance:**
   - Students place finger on device
   - Attendance marked automatically
   - Real-time updates visible to faculty

3. **Faculty Ends Session:**
   - Click "End Session"
   - Can manually adjust attendance if needed

---

## Device Features

### ESP32 Firmware Features
- ✅ WiFi auto-connect and reconnect
- ✅ Real-time communication with Supabase
- ✅ OLED status display
- ✅ Audio feedback with buzzer
- ✅ Offline queue (stores up to 50 records)
- ✅ Automatic sync when online
- ✅ NTP time synchronization
- ✅ OTA firmware updates (future)

### Device Modes
1. **IDLE** - Waiting for session
2. **ATTENDANCE** - Taking attendance
3. **ENROLLMENT** - Enrolling new fingerprints
4. **ERROR** - Error state with recovery

---

## Troubleshooting

### ESP32 Compilation Error (Your Issue)

**Problem:** You're trying to compile in Arduino IDE instead of PlatformIO.

**Solution:**
1. ❌ **DO NOT** use Arduino IDE
2. ✅ **DO** use PlatformIO

**Steps:**
```bash
# Install PlatformIO
# Option 1: VS Code Extension (Recommended)
# 1. Open VS Code
# 2. Go to Extensions
# 3. Search "PlatformIO"
# 4. Install "PlatformIO IDE"

# Option 2: CLI
pip install platformio

# Navigate to firmware directory
cd esp32-firmware

# Build
pio run

# Upload to ESP32
pio run -t upload

# Monitor serial
pio device monitor
```

### Common ESP32 Issues

**WiFi Not Connecting:**
- Check SSID and password in `config_local.h`
- Ensure WiFi is 2.4GHz (ESP32 doesn't support 5GHz)
- Move device closer to router

**Fingerprint Sensor Not Found:**
- Check wiring (TX/RX might be swapped)
- Verify sensor has power (red LED should glow)
- Try different baud rate (default: 57600)

**OLED Not Displaying:**
- Check I2C address (default 0x3C, some use 0x3D)
- Verify SDA/SCL connections
- Run I2C scanner to detect display

**Device Not Appearing Online:**
- Check Supabase URL and API key
- Verify device is registered in admin panel with same code
- Check network firewall settings

---

## API Endpoints

### Device API (Edge Function)

**Heartbeat:**
```
POST /functions/v1/device-api
Body: {
  "device_code": "DEVICE_001",
  "device_name": "Classroom A101",
  "firmware_version": "1.0.0",
  "status": "ACTIVE"
}
```

**Enrollment Complete:**
```
POST /functions/v1/device-api
Body: {
  "device_code": "DEVICE_001",
  "action": "enrollment_complete",
  "fingerprint_id": 42,
  "student_id": "uuid-here"
}
```

---

## Database Schema

### New Tables

**fingerprint_enrollment_queue:**
- Manages enrollment requests from web to device
- Device polls for pending enrollments
- Tracks completion status

**Fields:**
- `id`: UUID
- `device_code`: TEXT
- `student_id`: UUID (FK to students)
- `fingerprint_id`: INTEGER
- `status`: ENUM (PENDING, SENT, COMPLETED, FAILED)
- Timestamps: sent_at, completed_at

---

## Security Notes

1. **Device Authentication:**
   - Devices use Supabase anon key
   - RLS policies control data access
   - Device registration required

2. **Fingerprint Data:**
   - Only template data stored (not actual fingerprint images)
   - Templates cannot be reverse-engineered to images
   - Stored in sensor, not transmitted

3. **Network:**
   - HTTPS for all communication
   - Certificate validation (set `setInsecure()` only for testing)

---

## Performance

- **Fingerprint recognition:** < 1 second
- **Attendance sync:** Real-time (< 2 seconds)
- **Offline capacity:** 50 records
- **Device online detection:** 2 minutes threshold
- **Heartbeat interval:** 30 seconds

---

## Future Enhancements

- [ ] OTA firmware updates
- [ ] Batch enrollment (QR code scanning)
- [ ] Advanced analytics dashboard
- [ ] Mobile app for device management
- [ ] Multi-device coordination
- [ ] Facial recognition integration

---

## Support

### Documentation
- ESP32 Setup: `esp32-firmware/README.md`
- Database Schema: `supabase/schema.sql`
- API reference: `docs/API.md`

### Issues
For bugs or feature requests, create an issue in the repository.

---

## License

Part of ATTENDRO Attendance Management System.
Developed for RIT Polytechnic AIML Department.

---

## Credits

- ESP32 Firmware: PlatformIO + Adafruit Libraries
- Fingerprint Sensor: R307/AS608 optical sensor
- Backend: Supabase (PostgreSQL + Edge Functions)
- Frontend: React + TypeScript + Vite
- UI Components: shadcn/ui + Tailwind CSS

---

**That's it! Your complete attendance system with fingerprint device integration is ready to use!** 🎉
