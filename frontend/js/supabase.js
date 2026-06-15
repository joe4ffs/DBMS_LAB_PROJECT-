// ============================================================
//  MedTrack | frontend/js/supabase.js
//  Supabase connection config
// ============================================================

const SUPABASE_URL = 'https://usupobtlppmraeuplman.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzdXBvYnRscHBtcmFldXBsbWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MTcyNzIsImV4cCI6MjA5NzA5MzI3Mn0.lHIb6QX40Dt_TaJh0ANscDEMK7V8WMR5-1pi3GdbZKI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);