import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { name, year, semester, division, department, class_teacher_id } = await req.json();

    if (!name || !year || !semester || !division) {
      return new Response(
        JSON.stringify({ error: "Name, year, semester, and division are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate class (same name and division)
    const { data: existingByName } = await supabase
      .from('classes')
      .select('id')
      .ilike('name', name)
      .ilike('division', division)
      .maybeSingle();

    if (existingByName) {
      return new Response(
        JSON.stringify({ error: `Class "${name} ${division}" already exists` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for duplicate (same year, semester, division)
    const { data: existingByYearSem } = await supabase
      .from('classes')
      .select('id')
      .eq('year', year)
      .eq('semester', semester)
      .ilike('division', division)
      .maybeSingle();

    if (existingByYearSem) {
      return new Response(
        JSON.stringify({ error: `A class for Year ${year}, Semester ${semester}, Division ${division} already exists` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create class record
    const { data, error } = await supabase
      .from('classes')
      .insert({
        name,
        year,
        semester,
        division,
        department: department || 'Smart Attendance',
        class_teacher_id: class_teacher_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Class creation error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, class: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});