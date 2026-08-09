// Replace these two values from your Supabase project dashboard.
// Project Settings / API (or Connect dialog)
window.TAR_SUPABASE_URL = "https://aakiekiadkqnbpfkmdhv.supabase.co";
window.TAR_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_Uy2yAazu21tEiRo7trVNsw_hZ1rPkTn";

window.tarSupabase = null;

if (
  window.supabase &&
  window.TAR_SUPABASE_URL &&
  !window.TAR_SUPABASE_URL.startsWith("PASTE_") &&
  window.TAR_SUPABASE_PUBLISHABLE_KEY &&
  !window.TAR_SUPABASE_PUBLISHABLE_KEY.startsWith("PASTE_")
) {
  window.tarSupabase = window.supabase.createClient(
    window.TAR_SUPABASE_URL,
    window.TAR_SUPABASE_PUBLISHABLE_KEY
  );
}
