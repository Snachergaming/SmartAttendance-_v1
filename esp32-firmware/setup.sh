#!/bin/bash

# ATTENDRO ESP32 Quick Setup Script
# This script helps you quickly configure and upload the ESP32 firmware

echo "======================================"
echo "  ATTENDRO ESP32 Quick Setup"
echo "======================================"
echo ""

# Check if PlatformIO is installed
if ! command -v pio &> /dev/null
then
    echo "❌ PlatformIO not found!"
    echo ""
    echo "Please install PlatformIO first:"
    echo "  Option 1: VS Code Extension (Recommended)"
    echo "    1. Install VS Code: https://code.visualstudio.com/"
    echo "    2. Install PlatformIO IDE extension"
    echo ""
    echo "  Option 2: CLI"
    echo "    pip install platformio"
    echo ""
    exit 1
fi

echo "✅ PlatformIO found!"
echo ""

# Check if config_local.h exists
if [ ! -f "src/config_local.h" ]; then
    echo "📝 Creating config_local.h from template..."
    cp src/config.h src/config_local.h
    echo "✅ config_local.h created!"
    echo ""
    echo "⚠️  IMPORTANT: Edit src/config_local.h with your credentials:"
    echo "   - WiFi SSID and Password"
    echo "   - Supabase URL and Anon Key"
    echo "   - Device Code (must match admin panel)"
    echo ""
    read -p "Press Enter when you've configured src/config_local.h..."
else
    echo "✅ config_local.h exists"
fi

echo ""
echo "======================================"
echo "  Build Options"
echo "======================================"
echo "1. Build firmware only"
echo "2. Build and upload to ESP32"
echo "3. Upload and monitor serial"
echo "4. Just monitor serial"
echo ""
read -p "Select option (1-4): " option

case $option in
    1)
        echo ""
        echo "Building firmware..."
        pio run
        ;;
    2)
        echo ""
        echo "Building and uploading..."
        pio run -t upload
        ;;
    3)
        echo ""
        echo "Building, uploading, and monitoring..."
        pio run -t upload && pio device monitor
        ;;
    4)
        echo ""
        echo "Monitoring serial..."
        pio device monitor
        ;;
    *)
        echo "Invalid option!"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "  Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Register device in Admin → Device Management"
echo "2. Enroll students in Admin → Student Enrollment"
echo "3. Faculty can now use device for attendance!"
echo ""
