-- Cleanup legacy faculty policies and keep only the intended RLS rules
DROP POLICY IF EXISTS "Everyone can read faculty names" ON public.faculty;
DROP POLICY IF EXISTS "Only admins can modify faculty" ON public.faculty;
DROP POLICY IF EXISTS "Admins can manage faculty" ON public.faculty;
DROP POLICY IF EXISTS "Admins can read all faculty" ON public.faculty;
DROP POLICY IF EXISTS "Users can read own faculty record" ON public.faculty;
DROP POLICY IF EXISTS "faculty_admin_delete" ON public.faculty;
DROP POLICY IF EXISTS "faculty_admin_insert" ON public.faculty;
DROP POLICY IF EXISTS "faculty_admin_update" ON public.faculty;
DROP POLICY IF EXISTS "faculty_read_self_or_admin" ON public.faculty;

CREATE POLICY "Users can read own faculty record"
ON public.faculty
FOR SELECT
TO authenticated
USING (profile_id = auth.uid());

CREATE POLICY "Admins can read all faculty"
ON public.faculty
FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can manage faculty"
ON public.faculty
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
