// ============================================================
//  MedTrack | frontend/js/supabase.js
//  Supabase connection config
// ============================================================

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);