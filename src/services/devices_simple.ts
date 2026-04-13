/**
 * SIMPLIFIED Fingerprint Device Service - No Foreign Key Dependencies
 * This version stores names directly instead of using foreign key references
 */

import { supabase } from '@/integrations/supabase/client';

export interface FingerprintDevice {
  id: string;
  device_code: string;
  device_name: string | null;
  status: string;
  last_seen_at: string | null;
  firmware_version: string | null;
  created_at: string;
}

export interface SimpleDeviceSession {
  id: string;
  device_code: string;
  faculty_email: string;
  class_name: string;
  subject_name: string;
  batch_name: string | null;
  session_date: string;
  start_time: string;
  session_status: string;
  created_at: string;
}

// Get all available devices
export async function getAvailableDevices(): Promise<FingerprintDevice[]> {
  const { data, error } = await supabase
    .from('fingerprint_devices')
    .select('*')
    .eq('status', 'ACTIVE')
    .order('device_code');

  if (error) throw error;
  return data || [];
}

// Get device by code
export async function getDeviceByCode(deviceCode: string): Promise<FingerprintDevice | null> {
  const { data, error } = await supabase
    .from('fingerprint_devices')
    .select('*')
    .eq('device_code', deviceCode)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// Check if device is online (last seen within 2 minutes)
export function isDeviceOnline(device: FingerprintDevice): boolean {
  if (!device.last_seen_at) return false;
  const lastSeen = new Date(device.last_seen_at);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  return diffMinutes < 2;
}

// SIMPLIFIED - Configure device for attendance session (store names directly)
export async function configureDeviceForAttendance(params: {
  deviceCode: string;
  facultyId?: string;
  classId?: string;
  subjectId?: string;
  batchId?: string | null;
  attendanceSessionId?: string;
  date: string;
  startTime: string;
}): Promise<SimpleDeviceSession> {
  console.log('Configuring device with params:', params);

  // Get device to verify it exists and is online
  const device = await getDeviceByCode(params.deviceCode);
  if (!device) {
    throw new Error('Device not found. Please check the device code.');
  }

  // Check if device is online
  if (!isDeviceOnline(device)) {
    throw new Error('Device appears to be offline. Please ensure it is powered on and connected to WiFi.');
  }

  console.log('Device found and online:', device);

  // Get current user info
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user);

  if (!user?.email) {
    throw new Error('No authenticated user found.');
  }

  // Deactivate any existing active sessions for this device
  console.log('Deactivating existing sessions...');
  const { error: updateError } = await supabase
    .from('device_sessions')
    .update({ session_status: 'COMPLETED' })
    .eq('device_code', params.deviceCode)
    .eq('session_status', 'ACTIVE');

  if (updateError) {
    console.error('Error deactivating sessions:', updateError);
    // Continue anyway - table might not exist yet
  }

  // Create new device session with simple data
  console.log('Creating new session...');
  const sessionData = {
    device_code: params.deviceCode,
    faculty_email: user.email,
    class_name: 'Test Class',           // Simplified for now
    subject_name: 'Test Subject',       // Simplified for now
    batch_name: null,
    session_date: params.date,
    start_time: params.startTime,
    session_status: 'ACTIVE'
  };

  console.log('Session data:', sessionData);

  const { data, error } = await supabase
    .from('device_sessions')
    .insert(sessionData)
    .select('*')
    .single();

  if (error) {
    console.error('Insert error:', error);
    throw new Error(`Failed to create device session: ${error.message}`);
  }

  console.log('Session created successfully:', data);
  return data;
}

// Get active device session for current user
export async function getActiveDeviceSession(): Promise<SimpleDeviceSession | null> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.email) return null;

  const { data, error } = await supabase
    .from('device_sessions')
    .select('*')
    .eq('faculty_email', user.email)
    .eq('session_status', 'ACTIVE')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// End device session
export async function endDeviceSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('device_sessions')
    .update({ session_status: 'COMPLETED' })
    .eq('id', sessionId);

  if (error) throw error;
}

// Subscribe to device status changes (real-time)
export function subscribeToDeviceStatus(
  deviceCode: string,
  callback: (device: FingerprintDevice) => void
) {
  return supabase
    .channel(`device_${deviceCode}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'fingerprint_devices',
        filter: `device_code=eq.${deviceCode}`
      },
      (payload) => {
        callback(payload.new as FingerprintDevice);
      }
    )
    .subscribe();
}

// Placeholder functions for compatibility
export async function getStudentsEnrollmentStatus(classId: string) {
  return [];
}

export async function deleteStudentFingerprint(studentId: string) {
  return;
}

export async function getDeviceSessionHistory(facultyId: string, limit: number = 10) {
  return [];
}

export function subscribeToAttendanceRecords(
  sessionId: string,
  callback: (record: any) => void
) {
  return { unsubscribe: () => { } };
}