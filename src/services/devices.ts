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
  attendance_session_id: string | null;
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

  // CREATE ATTENDANCE SESSION AND RECORDS - Always create them
  let attendanceSessionId = params.attendanceSessionId;
  let className = 'Test Class';
  let subjectName = 'Test Subject';

  // Always try to create attendance session and records
  console.log('Creating attendance session and records...');
  console.log('Params:', params);

  // Use provided IDs or fallback to test data
  const classIdToUse = params.classId || null;
  const subjectIdToUse = params.subjectId || null;
  const facultyIdToUse = params.facultyId || user?.id || null;

  if (classIdToUse && subjectIdToUse) {
    // Create attendance session with real data
    const { data: attendanceSession, error: sessionError } = await supabase
      .from('attendance_sessions')
      .insert({
        class_id: classIdToUse,
        subject_id: subjectIdToUse,
        faculty_id: facultyIdToUse,
        batch_id: params.batchId,
        date: params.date,
        start_time: params.startTime,
        is_substitution: false
      })
      .select('id')
      .single();

    if (sessionError) {
      console.error('Error creating attendance session:', sessionError);
    } else {
      attendanceSessionId = attendanceSession.id;
      console.log('Attendance session created:', attendanceSession.id);

      // Get all students in the class
      let studentsQuery = supabase
        .from('students')
        .select('id, name, roll_no')
        .eq('class_id', classIdToUse)
        .eq('status', 'ACTIVE')
        .order('roll_no');

      // If batch specified, filter by batch
      if (params.batchId) {
        studentsQuery = studentsQuery.eq('batch_id', params.batchId);
      }

      const { data: students, error: studentsError } = await studentsQuery;

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
      } else if (students && students.length > 0) {
        console.log(`Found ${students.length} students to create attendance records for`);

        // Create attendance records for all students (default: ABSENT)
        const attendanceRecords = students.map(student => ({
          session_id: attendanceSession.id,
          student_id: student.id,
          status: 'ABSENT' as const,
          remark: null
        }));

        const { error: recordsError } = await supabase
          .from('attendance_records')
          .insert(attendanceRecords);

        if (recordsError) {
          console.error('Error creating attendance records:', recordsError);
        } else {
          console.log(`✅ Created ${attendanceRecords.length} attendance records (all ABSENT initially)`);
        }
      } else {
        console.log('No students found for this class');
      }

      // Get class and subject names for display
      try {
        const { data: classData } = await supabase
          .from('classes')
          .select('name, division')
          .eq('id', classIdToUse)
          .single();

        const { data: subjectData } = await supabase
          .from('subjects')
          .select('name')
          .eq('id', subjectIdToUse)
          .single();

        if (classData) className = `${classData.name} ${classData.division}`;
        if (subjectData) subjectName = subjectData.name;
      } catch (e) {
        console.log('Could not fetch class/subject names, using defaults');
      }
    }
  } else {
    console.log('⚠️ No class/subject IDs provided - creating minimal session');
    // Create a simple attendance session without linking to class/subject
    const { data: attendanceSession, error: sessionError } = await supabase
      .from('attendance_sessions')
      .insert({
        class_id: null,
        subject_id: null,
        faculty_id: facultyIdToUse,
        batch_id: null,
        date: params.date,
        start_time: params.startTime,
        is_substitution: false
      })
      .select('id')
      .single();

    if (!sessionError) {
      attendanceSessionId = attendanceSession.id;
      console.log('✅ Basic attendance session created:', attendanceSession.id);
    }
  }

  // Create device session record
  console.log('Creating device session...');
  const sessionData = {
    device_code: params.deviceCode,
    faculty_email: user.email,
    class_name: className,
    subject_name: subjectName,
    batch_name: params.batchId ? 'Batch' : null,
    session_date: params.date,
    start_time: params.startTime,
    session_status: 'ACTIVE',
    attendance_session_id: attendanceSessionId
  };

  console.log('Device session data:', sessionData);

  const { data, error } = await supabase
    .from('device_sessions')
    .insert(sessionData)
    .select('*')
    .single();

  if (error) {
    console.error('Insert error:', error);
    throw new Error(`Failed to create device session: ${error.message}`);
  }

  console.log('Device session created successfully:', data);
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

// Update attendance when fingerprint is scanned
export async function markStudentPresent(studentId: string, deviceCode: string): Promise<void> {
  console.log(`Marking student ${studentId} present on device ${deviceCode}`);

  try {
    // Find active session for this device
    const { data: deviceSession, error: sessionError } = await supabase
      .from('device_sessions')
      .select('attendance_session_id')
      .eq('device_code', deviceCode)
      .eq('session_status', 'ACTIVE')
      .single();

    if (sessionError || !deviceSession?.attendance_session_id) {
      console.error('No active session found for device:', deviceCode);
      return;
    }

    console.log('Found active attendance session:', deviceSession.attendance_session_id);

    // Update attendance record from ABSENT to PRESENT
    const { data: updated, error: updateError } = await supabase
      .from('attendance_records')
      .update({
        status: 'PRESENT',
        // modified_at: new Date().toISOString() // Optional timestamp
      })
      .eq('session_id', deviceSession.attendance_session_id)
      .eq('student_id', studentId)
      .select('id, students(name, roll_no)')
      .single();

    if (updateError) {
      console.error('Error updating attendance:', updateError);
    } else {
      console.log('Attendance updated successfully:', updated);
    }
  } catch (error) {
    console.error('Error in markStudentPresent:', error);
  }
}

// Get attendance records for active session (for real-time display)
export async function getActiveSessionAttendance(deviceCode: string) {
  try {
    // Find active session for this device
    const { data: deviceSession, error: sessionError } = await supabase
      .from('device_sessions')
      .select('attendance_session_id, class_name, subject_name')
      .eq('device_code', deviceCode)
      .eq('session_status', 'ACTIVE')
      .single();

    if (sessionError || !deviceSession?.attendance_session_id) {
      return null;
    }

    // Get attendance records with student info
    const { data: records, error: recordsError } = await supabase
      .from('attendance_records')
      .select(`
        id, status, student_id,
        students!inner (id, name, roll_no, enrollment_no)
      `)
      .eq('session_id', deviceSession.attendance_session_id);

    if (recordsError) throw recordsError;

    // Sort by roll_no client-side (PostgREST doesn't support ordering by nested fields)
    const sortedRecords = (records || []).sort((a: any, b: any) => {
      const rollA = a.students?.roll_no || 0;
      const rollB = b.students?.roll_no || 0;
      return rollA - rollB;
    });

    return {
      session: deviceSession,
      records: sortedRecords
    };
  } catch (error) {
    console.error('Error getting active session attendance:', error);
    return null;
  }
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