// js/config/supabase.js
const SUPABASE_URL = "https://uqjtdklhjvshyromzzoa.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_m7D76P4JQAyymSIUogkVnQ_XqIxOkKv";

// SOLUCIÓN: Registramos la instancia explícitamente en window.supabaseClient
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Por si acaso algún otro módulo viejo aún busca la palabra 'supabaseDB' o 'supabase', las vinculamos también:
window.supabaseDB = window.supabaseClient;