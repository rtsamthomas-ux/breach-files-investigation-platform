import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env["VITE_SUPABASE_URL"] || "https://iqhskbtavksjxrvyyriz.supabase.co";

// Supports modern publishable key (sb_publishable_...) with backward compatibility for legacy anon key
const supabasePublishableKey =
  import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  import.meta.env["VITE_SUPABASE_ANON_KEY"] ||
  "";

const isPlaceholderKey =
  !supabasePublishableKey ||
  supabasePublishableKey === "your-supabase-anon-key-placeholder" ||
  supabasePublishableKey === "your-supabase-publishable-key-placeholder" ||
  supabasePublishableKey.includes("placeholder");

export const isSupabaseConfigured = Boolean(supabaseUrl && !isPlaceholderKey);

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return clientInstance;
}
