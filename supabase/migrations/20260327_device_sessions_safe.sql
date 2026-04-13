-- Safe Device Sessions Migration
-- Creates device_sessions table with optional foreign keys

-- First, let's check what tables exist
DO $$
BEGIN
    RAISE NOTICE 'Checking existing tables...';
END $$;

-- Create device_sessions table with minimal constraints first
CREATE TABLE IF NOT EXISTS public.device_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID NOT NULL,
    faculty_id UUID NOT NULL,
    class_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    batch_id UUID,
    attendance_session_id UUID,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TEXT NOT NULL,
    session_status TEXT DEFAULT 'ACTIVE' CHECK (session_status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign keys only if the referenced tables exist
DO $$
BEGIN
    -- Add device foreign key if fingerprint_devices table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fingerprint_devices') THEN
        BEGIN
            ALTER TABLE public.device_sessions
            ADD CONSTRAINT fk_device_sessions_device_id
            FOREIGN KEY (device_id) REFERENCES public.fingerprint_devices(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add device_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add profiles foreign key if profiles table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        BEGIN
            ALTER TABLE public.device_sessions
            ADD CONSTRAINT fk_device_sessions_faculty_id
            FOREIGN KEY (faculty_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add faculty_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add classes foreign key if classes table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classes') THEN
        BEGIN
            ALTER TABLE public.device_sessions
            ADD CONSTRAINT fk_device_sessions_class_id
            FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add class_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add subjects foreign key if subjects table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') THEN
        BEGIN
            ALTER TABLE public.device_sessions
            ADD CONSTRAINT fk_device_sessions_subject_id
            FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add subject_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add batches foreign key if batches table exists (optional)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batches') THEN
        BEGIN
            ALTER TABLE public.device_sessions
            ADD CONSTRAINT fk_device_sessions_batch_id
            FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add batch_id foreign key: %', SQLERRM;
        END;
    END IF;

    -- Add attendance_sessions foreign key if table exists (optional)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_sessions') THEN
        BEGIN
            ALTER TABLE public.device_sessions
            ADD CONSTRAINT fk_device_sessions_attendance_session_id
            FOREIGN KEY (attendance_session_id) REFERENCES public.attendance_sessions(id) ON DELETE CASCADE;
        EXCEPTION WHEN others THEN
            RAISE NOTICE 'Could not add attendance_session_id foreign key: %', SQLERRM;
        END;
    END IF;

END $$;