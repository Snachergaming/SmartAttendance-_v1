import { supabase, SUPABASE_ANON_KEY } from '@/integrations/supabase/client';

export interface Faculty {
  id: string;
  profile_id: string;
  employee_code: string | null;
  designation: string | null;
  department: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    name: string;
    role: string;
    department: string | null;
    mobile?: string | null;
  };
}

export async function getFaculty() {
  const { data, error } = await supabase
    .from('faculty')
    .select(`
      *,
      profiles (id, name, role, department)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Faculty[];
}

export async function getFacultyById(id: string) {
  const { data, error } = await supabase
    .from('faculty')
    .select(`
      *,
      profiles (id, name, role, department)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Faculty;
}

export async function createFaculty(faculty: {
  profile_id: string;
  employee_code?: string;
  designation?: string;
  department?: string;
}) {
  // Check for duplicate employee code if provided
  if (faculty.employee_code) {
    const { data: existingByCode } = await supabase
      .from('faculty')
      .select('id')
      .ilike('employee_code', faculty.employee_code)
      .maybeSingle();

    if (existingByCode) {
      throw new Error(`Faculty with employee code "${faculty.employee_code}" already exists`);
    }
  }

  // Check if profile is already linked to a faculty
  const { data: existingByProfile } = await supabase
    .from('faculty')
    .select('id')
    .eq('profile_id', faculty.profile_id)
    .maybeSingle();

  if (existingByProfile) {
    throw new Error('This profile is already linked to a faculty record');
  }

  const { data, error } = await supabase
    .from('faculty')
    .insert(faculty)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFaculty(id: string) {
  const { error } = await supabase
    .from('faculty')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateFaculty(id: string, updates: Partial<Pick<Faculty, 'status' | 'designation' | 'department' | 'employee_code'>>) {
  const { data, error } = await supabase
    .from('faculty')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFacultyPassword(profile_id: string, new_password: string) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const session = sessionData?.session;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
  };

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const response = await supabase.functions.invoke('update-faculty-password', {
    body: JSON.stringify({ profile_id, new_password }),
    headers,
  });

  if (response.error) throw response.error;
  if (response.data?.error) throw new Error(response.data.error);
  return response.data;
}

export async function updateFacultyPasswordsToMobile() {
  try {
    // Get all faculty with their profile information including mobile
    const { data: facultyData, error: facultyError } = await supabase
      .from('faculty')
      .select(`
        id,
        profile_id,
        profiles!inner (
          id,
          name,
          mobile
        )
      `)
      .not('profiles.mobile', 'is', null);

    if (facultyError) throw facultyError;

    if (!facultyData || facultyData.length === 0) {
      return { success: 0, failed: 0, message: 'No faculty found with mobile numbers' };
    }

    let success = 0;
    let failed = 0;

    // Update passwords for each faculty member
    for (const faculty of facultyData) {
      try {
        const mobile = faculty.profiles?.mobile;
        if (!mobile) continue;

        // Use the create-faculty edge function to update password
        // We'll need to pass the profile_id and new password
        const response = await supabase.functions.invoke('update-faculty-password', {
          body: JSON.stringify({
            profile_id: faculty.profile_id,
            new_password: mobile,
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.error) {
          console.error(`Failed to update password for ${faculty.profiles?.name}:`, response.error);
          failed++;
        } else {
          success++;
        }
      } catch (error) {
        console.error(`Error updating password for ${faculty.profiles?.name}:`, error);
        failed++;
      }
    }

    return {
      success,
      failed,
      message: `Updated ${success} faculty passwords, ${failed} failed`
    };
  } catch (error) {
    console.error('Error in updateFacultyPasswordsToMobile:', error);
    throw error;
  }
}

export async function getAllFacultyWithEmail() {
  const { data, error } = await supabase
    .rpc('get_all_faculty_with_email');

  if (error) throw error;
  return data as { id: string; name: string; email: string; employee_code: string | null }[];
}
