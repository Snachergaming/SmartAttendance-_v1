/**
 * ATTENDRO Device API Edge Function
 *
 * Handles communication between ESP32 fingerprint devices and the server:
 * - Device heartbeat (update last_seen_at)
 * - Device registration
 * - Enrollment command dispatch
 * - Attendance sync
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface HeartbeatRequest {
  device_code: string;
  device_name?: string;
  firmware_version?: string;
  status?: string;
}

interface EnrollmentCompleteRequest {
  device_code: string;
  action: "enrollment_complete";
  fingerprint_id: number;
  student_id: string;
}

interface StartEnrollmentRequest {
  device_code: string;
  action: "start_enrollment";
  fingerprint_id: number;
  student_id: string;
}

interface AttendanceRequest {
  device_code: string;
  action: "attendance_scan";
  fingerprint_id: number;
}

interface DeviceCommand {
  enroll?: {
    fingerprint_id: number;
    student_id: string;
  };
  verify?: {
    fingerprint_id: number;
    student_id: string;
    test_id: string;
  };
}

interface VerifyRequest {
  device_code: string;
  action: "verify_fingerprint";
  fingerprint_id: number;
  student_id: string;
}

interface VerifyResultRequest {
  device_code: string;
  action: "verify_result";
  test_id: string;
  recognized_id: number | null;
  success: boolean;
}

// Store pending enrollments in memory (for this edge function instance)
const pendingEnrollments = new Map<string, { fingerprint_id: number; student_id: string }>();
// Store pending verifications in memory
const pendingVerifications = new Map<string, { fingerprint_id: number; student_id: string; test_id: string }>();
// Store verification results
const verificationResults = new Map<string, { success: boolean; recognized_id: number | null; timestamp: number }>();

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { device_code, action } = body;

    if (!device_code) {
      return new Response(
        JSON.stringify({ error: "device_code is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle different actions
    if (action === "enrollment_complete") {
      return await handleEnrollmentComplete(supabase, body);
    }

    if (action === "start_enrollment") {
      return await handleStartEnrollment(supabase, body);
    }

    if (action === "attendance_scan") {
      return await handleAttendanceScan(supabase, body);
    }

    if (action === "verify_fingerprint") {
      return await handleVerifyFingerprint(supabase, body);
    }

    if (action === "verify_result") {
      return await handleVerifyResult(supabase, body);
    }

    if (action === "get_verify_result") {
      return await handleGetVerifyResult(body);
    }

    // Default: Handle heartbeat
    return await handleHeartbeat(supabase, body);
  } catch (error) {
    console.error("Device API error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Handle start enrollment request from web app
 */
async function handleStartEnrollment(
  supabase: ReturnType<typeof createClient>,
  data: StartEnrollmentRequest
): Promise<Response> {
  const { device_code, fingerprint_id, student_id } = data;

  // Store in pending enrollments map
  pendingEnrollments.set(device_code, { fingerprint_id, student_id });

  console.log(`Enrollment queued: Device ${device_code}, FP ID ${fingerprint_id}, Student ${student_id}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Enrollment command queued",
      fingerprint_id,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle device heartbeat
 * Updates last_seen_at and returns any pending commands
 */
async function handleHeartbeat(
  supabase: ReturnType<typeof createClient>,
  data: HeartbeatRequest
): Promise<Response> {
  const { device_code, device_name, firmware_version, status } = data;

  // Check if device exists
  const { data: existingDevice, error: fetchError } = await supabase
    .from("fingerprint_devices")
    .select("*")
    .eq("device_code", device_code)
    .single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw fetchError;
  }

  let device;

  if (!existingDevice) {
    // Auto-register new device
    const { data: newDevice, error: insertError } = await supabase
      .from("fingerprint_devices")
      .insert({
        device_code,
        device_name: device_name || device_code,
        firmware_version,
        status: status || "ACTIVE",
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    device = newDevice;

    console.log(`New device registered: ${device_code}`);
  } else {
    // Update existing device
    const { data: updatedDevice, error: updateError } = await supabase
      .from("fingerprint_devices")
      .update({
        last_seen_at: new Date().toISOString(),
        firmware_version: firmware_version || existingDevice.firmware_version,
        device_name: device_name || existingDevice.device_name,
        status: status || existingDevice.status,
        updated_at: new Date().toISOString(),
      })
      .eq("device_code", device_code)
      .select()
      .single();

    if (updateError) throw updateError;
    device = updatedDevice;
  }

  // Check for pending enrollment commands (from memory)
  const response: DeviceCommand = {};
  const pending = pendingEnrollments.get(device_code);

  if (pending) {
    response.enroll = {
      fingerprint_id: pending.fingerprint_id,
      student_id: pending.student_id,
    };
    // Remove from pending (will be re-added if failed)
    pendingEnrollments.delete(device_code);

    console.log(`Sending enrollment command to ${device_code}: FP ID ${pending.fingerprint_id}`);
  }

  // Check for pending verification commands
  const pendingVerify = pendingVerifications.get(device_code);
  if (pendingVerify && !response.enroll) {
    response.verify = {
      fingerprint_id: pendingVerify.fingerprint_id,
      student_id: pendingVerify.student_id,
      test_id: pendingVerify.test_id,
    };
    pendingVerifications.delete(device_code);
    console.log(`Sending verify command to ${device_code}: FP ID ${pendingVerify.fingerprint_id}`);
  }

  // Also check database for pending enrollments (if queue table exists)
  try {
    const { data: pendingEnrollment } = await supabase
      .from("fingerprint_enrollment_queue")
      .select("*")
      .eq("device_code", device_code)
      .eq("status", "PENDING")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (pendingEnrollment && !response.enroll) {
      response.enroll = {
        fingerprint_id: pendingEnrollment.fingerprint_id,
        student_id: pendingEnrollment.student_id,
      };

      // Mark as sent
      await supabase
        .from("fingerprint_enrollment_queue")
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .eq("id", pendingEnrollment.id);
    }
  } catch (e) {
    // Queue table might not exist, that's okay
  }

  return new Response(JSON.stringify({ success: true, device, ...response }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Handle attendance scan from device
 */
async function handleAttendanceScan(
  supabase: ReturnType<typeof createClient>,
  data: AttendanceRequest
): Promise<Response> {
  const { device_code, fingerprint_id } = data;

  console.log(`🎯 Attendance scan: Device ${device_code}, Fingerprint ID ${fingerprint_id}`);

  try {
    // First, find the student with this fingerprint_id
    console.log(`🔍 Looking for fingerprint template with ID: ${fingerprint_id}`);
    const { data: fingerprintTemplate, error: fpError } = await supabase
      .from("fingerprint_templates")
      .select("student_id, students(id, name, roll_no)")
      .eq("fingerprint_id", fingerprint_id)
      .eq("is_verified", true)
      .single();

    if (fpError || !fingerprintTemplate) {
      console.log(`❌ No student found for fingerprint ID ${fingerprint_id}`, fpError);
      return new Response(
        JSON.stringify({
          error: "Student not found for this fingerprint",
          fingerprint_id,
          show_message: `Fingerprint ID ${fingerprint_id} not enrolled`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const student = fingerprintTemplate.students;
    console.log(`✅ Found student: ${student.name} (Roll: ${student.roll_no})`);

    // Find active device session for this device
    console.log(`🔍 Looking for active device session for: ${device_code}`);
    const { data: deviceSession, error: sessionError } = await supabase
      .from("device_sessions")
      .select("attendance_session_id, class_name, subject_name")
      .eq("device_code", device_code)
      .eq("session_status", "ACTIVE")
      .single();

    if (sessionError || !deviceSession?.attendance_session_id) {
      console.log(`❌ No active session found for device ${device_code}`, sessionError);
      return new Response(
        JSON.stringify({
          error: "No active attendance session for this device",
          show_message: "No active session. Please configure device first."
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`✅ Found active session: ${deviceSession.attendance_session_id}`);

    // Check if attendance record exists first
    const { data: existingRecord, error: checkError } = await supabase
      .from("attendance_records")
      .select("id, status")
      .eq("session_id", deviceSession.attendance_session_id)
      .eq("student_id", fingerprintTemplate.student_id)
      .single();

    if (checkError || !existingRecord) {
      console.log(`❌ No attendance record found for student in this session`, checkError);
      return new Response(
        JSON.stringify({
          error: "Student not enrolled in current session",
          student_name: student.name,
          show_message: `${student.name} not in current class session`
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📝 Current attendance status: ${existingRecord.status}`);

    // Update attendance record from ABSENT to PRESENT
    const { data: attendanceRecord, error: updateError } = await supabase
      .from("attendance_records")
      .update({
        status: "PRESENT",
        marked_at: new Date().toISOString(),
        remark: "Marked via fingerprint scan"
      })
      .eq("session_id", deviceSession.attendance_session_id)
      .eq("student_id", fingerprintTemplate.student_id)
      .select("id, status")
      .single();

    if (updateError) {
      console.error(`❌ Error updating attendance:`, updateError);
      throw updateError;
    }

    const wasAlreadyPresent = existingRecord.status === "PRESENT";
    console.log(`✅ Attendance updated: ${existingRecord.status} → PRESENT`);

    return new Response(
      JSON.stringify({
        success: true,
        message: wasAlreadyPresent
          ? `${student.name} was already marked present`
          : `${student.name} marked present`,
        student_name: student.name,
        roll_no: student.roll_no,
        status: "PRESENT",
        show_message: wasAlreadyPresent
          ? `${student.name} - Already Present!`
          : `${student.name} - Present!`,
        class_name: deviceSession.class_name,
        subject_name: deviceSession.subject_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("❌ Error in handleAttendanceScan:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        show_message: "Error marking attendance. Please try again."
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
async function handleEnrollmentComplete(
  supabase: ReturnType<typeof createClient>,
  data: EnrollmentCompleteRequest
): Promise<Response> {
  const { device_code, fingerprint_id, student_id } = data;

  // Verify the student exists
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, name")
    .eq("id", student_id)
    .single();

  if (studentError || !student) {
    return new Response(JSON.stringify({ error: "Student not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Delete existing template if any
  await supabase
    .from("fingerprint_templates")
    .delete()
    .eq("student_id", student_id);

  // Insert new fingerprint template record
  const { error: insertError } = await supabase
    .from("fingerprint_templates")
    .insert({
      student_id,
      fingerprint_id,
      template_data: "",
      is_verified: true,
    });

  if (insertError) throw insertError;

  // Update enrollment queue status if it exists
  try {
    await supabase
      .from("fingerprint_enrollment_queue")
      .update({
        status: "COMPLETED",
        completed_at: new Date().toISOString(),
      })
      .eq("student_id", student_id)
      .eq("device_code", device_code)
      .eq("status", "SENT");
  } catch (e) {
    // Queue might not exist
  }

  console.log(
    `Enrollment complete: Student ${student.name} -> Fingerprint ID ${fingerprint_id}`
  );

  return new Response(
    JSON.stringify({
      success: true,
      message: `Enrollment complete for ${student.name}`,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle verify fingerprint request from web app
 */
async function handleVerifyFingerprint(
  supabase: ReturnType<typeof createClient>,
  data: VerifyRequest
): Promise<Response> {
  const { device_code, fingerprint_id, student_id } = data;

  // Generate unique test ID
  const test_id = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Store in pending verifications
  pendingVerifications.set(device_code, { fingerprint_id, student_id, test_id });

  console.log(`Verify command queued: Device ${device_code}, FP ID ${fingerprint_id}, Test ID ${test_id}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: "Verify command queued",
      test_id,
      fingerprint_id,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Handle verify result from device (ESP32 reports which fingerprint it recognized)
 */
async function handleVerifyResult(
  supabase: ReturnType<typeof createClient>,
  data: VerifyResultRequest
): Promise<Response> {
  const { device_code, test_id, recognized_id, success } = data;

  // Store result
  verificationResults.set(test_id, {
    success,
    recognized_id,
    timestamp: Date.now(),
  });

  console.log(`Verify result: Test ${test_id}, Recognized ID: ${recognized_id}, Success: ${success}`);

  // Clean up old results (older than 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  for (const [key, value] of verificationResults.entries()) {
    if (value.timestamp < fiveMinutesAgo) {
      verificationResults.delete(key);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Verify result recorded",
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Get verification result (web app polls this)
 */
async function handleGetVerifyResult(data: { test_id: string }): Promise<Response> {
  const { test_id } = data;

  const result = verificationResults.get(test_id);

  if (!result) {
    return new Response(
      JSON.stringify({
        pending: true,
        message: "Waiting for device response",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Clean up after reading
  verificationResults.delete(test_id);

  return new Response(
    JSON.stringify({
      pending: false,
      success: result.success,
      recognized_id: result.recognized_id,
    }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
