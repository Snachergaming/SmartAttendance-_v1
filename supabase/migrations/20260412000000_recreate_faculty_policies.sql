-- Recreate faculty policies to avoid policy recursion and ensure correct authenticated access
DROP POLICY IF EXISTS "Users can read own faculty record" ON public.faculty;
DROP POLICY IF EXISTS "Admins can read all faculty" ON public.faculty;
DROP POLICY IF EXISTS "Admins can manage faculty" ON public.faculty;

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
