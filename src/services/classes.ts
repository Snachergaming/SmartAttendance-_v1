import { supabase } from '@/integrations/supabase/client';

export interface Class {
  id: string;
  name: string;
  year: number;
  semester: number;
  division: string;
  department: string | null;
  class_teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getClasses() {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .order('year', { ascending: true })
      .order('division', { ascending: true });

    if (error) {
      console.error('getClasses error:', error);
      throw new Error(error.message || 'Failed to fetch classes');
    }

    return data as Class[];
  } catch (error) {
    console.error('Unexpected getClasses error:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch classes');
  }
}

export async function getClassById(id: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Class;
}

export async function getClassByTeacherId(teacherId: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('class_teacher_id', teacherId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Class | null;
}

export async function createClass(classData: {
  name: string;
  year: number;
  semester: number;
  division: string;
  department?: string;
  class_teacher_id?: string;
}) {
  // Normalize class_teacher_id before inserting
  const normalizedData = {
    ...classData,
    class_teacher_id: classData.class_teacher_id?.trim() || null,
  };

  // Check for duplicate class (same name and division)
  const { data: existingByName, error: nameError } = await supabase
    .from('classes')
    .select('id')
    .ilike('name', normalizedData.name)
    .ilike('division', normalizedData.division)
    .maybeSingle();

  if (nameError) throw nameError;
  if (existingByName) {
    throw new Error(`Class "${normalizedData.name} ${normalizedData.division}" already exists`);
  }

  // Check for duplicate (same year, semester, division)
  const { data: existingByYearSem, error: yearSemError } = await supabase
    .from('classes')
    .select('id')
    .eq('year', normalizedData.year)
    .eq('semester', normalizedData.semester)
    .ilike('division', normalizedData.division)
    .maybeSingle();

  if (yearSemError) throw yearSemError;
  if (existingByYearSem) {
    throw new Error(`A class for Year ${normalizedData.year}, Semester ${normalizedData.semester}, Division ${normalizedData.division} already exists`);
  }

  const { data, error } = await supabase
    .from('classes')
    .insert(normalizedData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClass(id: string, updates: Partial<Class>) {
  const normalizedUpdates = {
    ...updates,
    ...(updates.class_teacher_id !== undefined ? {
      class_teacher_id: updates.class_teacher_id?.trim() || null,
    } : {}),
  };

  const { data, error } = await supabase
    .from('classes')
    .update(normalizedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteClass(id: string) {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getClassWithTeacher(classId: string) {
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      faculty:class_teacher_id (
        id,
        profiles (
          name,
          phone
        )
      )
    `)
    .eq('id', classId)
    .single();

  if (error) throw error;
  return data;
}
