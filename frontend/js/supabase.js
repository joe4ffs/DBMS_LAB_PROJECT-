// ============================================================
//  MedTrack | frontend/js/supabase.js
//  Supabase connection config
// ============================================================

const SUPABASE_URL = 'https://vrdukbmbeuztozqtskhx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZHVrYm1iZXV6dG96cXRza2h4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1ODYyODEsImV4cCI6MjA5NzE2MjI4MX0.d1LErBAfiDs7Vm-HEmkrCyDZ_8mrCpFKjLSPL-tXDzo';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);