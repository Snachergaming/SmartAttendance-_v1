-- Device Sessions Migration
-- Creates device_sessions table for managing attendance device configurations

-- Create device_sessions table
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID REFERENCES public.fingerprint_devices(id) ON DELETE CASCADE NOT NULL,
    faculty_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    batch_id UUID REFERENCES public.batches(id) ON DELETE SET NULL,
    attendance_session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TEXT NOT NULL,
    session_status TEXT DEFAULT 'ACTIVE' CHECK (session_status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_device_sessions_device_id ON public.device_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_faculty_id ON public.device_sessions(faculty_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_status ON public.device_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_device_sessions_date ON public.device_sessions(session_date);

-- Enable Row Level Security
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for device_sessions
CREATE POLICY "device_sessions_faculty_select" ON public.device_sessions
    FOR SELECT USING (
        faculty_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "device_sessions_faculty_insert" ON public.device_sessions
    FOR INSERT WITH CHECK (
        faculty_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "device_sessions_faculty_update" ON public.device_sessions
    FOR UPDATE USING (
        faculty_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "device_sessions_admin_delete" ON public.device_sessions
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_device_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER device_sessions_updated_at
    BEFORE UPDATE ON public.device_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_device_sessions_updated_at();