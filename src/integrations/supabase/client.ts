import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://dpxqrvagqnzizocdyyxv.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweHFydmFncW56aXpvY2R5eXh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MzY1MDIsImV4cCI6MjA5MTQxMjUwMn0.zAGPtjMQz-Z67dl9WhLD-m_Fre5VTbeWTCvzn53eRrc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Clear expired session
export async function clearExpiredSession() {
  try {
    await supabase.auth.signOut();
    localStorage.clear();
    window.location.href = '/login/admin';
  } catch (error) {
    console.error('Error clearing session:', error);
  }
}
