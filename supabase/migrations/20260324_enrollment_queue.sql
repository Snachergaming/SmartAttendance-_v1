-- Fingerprint Enrollment Queue Migration
-- Adds enrollment queue for device-initiated fingerprint enrollment

-- Create enrollment queue table
CREATE TABLE IF NOT EXISTS public.fingerprint_enrollment_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_code TEXT NOT NULL,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    fingerprint_id INTEGER NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENT, COMPLETED, FAILED
    sent_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_enrollment_queue_device ON public.fingerprint_enrollment_queue(device_code);
CREATE INDEX IF NOT EXISTS idx_enrollment_queue_status ON public.fingerprint_enrollment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrollment_queue_student ON public.fingerprint_enrollment_queue(student_id);

-- Enable RLS
ALTER TABLE public.fingerprint_enrollment_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "enrollment_queue_select" ON public.fingerprint_enrollment_queue
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'FACULTY'))
    );

CREATE POLICY "enrollment_queue_insert" ON public.fingerprint_enrollment_queue
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'FACULTY'))
    );

CREATE POLICY "enrollment_queue_update" ON public.fingerprint_enrollment_queue
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'FACULTY'))
    );

CREATE POLICY "enrollment_queue_delete" ON public.fingerprint_enrollment_queue
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Add device settings column to fingerprint_devices for enrollment mode
ALTER TABLE public.fingerprint_devices
ADD COLUMN IF NOT EXISTS enrollment_mode BOOLEAN DEFAULT false;

-- Function to get next available fingerprint ID for a device
CREATE OR REPLACE FUNCTION get_next_fingerprint_id()
RETURNS INTEGER AS $$
DECLARE
    max_id INTEGER;
BEGIN
    SELECT COALESCE(MAX(fingerprint_id), 0) INTO max_id
    FROM public.fingerprint_templates;

    RETURN max_id + 1;
END;
$$ LANGUAGE plpgsql;
