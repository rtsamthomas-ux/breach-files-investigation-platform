import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service role / secret key must NEVER be exposed to frontend or prefixed with VITE_
const supabaseUrl =
  process.env["SUPABASE_URL"] ||
  process.env["VITE_SUPABASE_URL"] ||
  "https://iqhskbtavksjxrvyyriz.supabase.co";

// Supports modern secret key (sb_secret_...) with backward compatibility for legacy service_role key
const supabaseSecretKey =
  process.env["SUPABASE_SECRET_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";

const isSecretKeyConfigured = Boolean(
  supabaseUrl &&
  supabaseSecretKey &&
  supabaseSecretKey !== "your-supabase-service-role-key-placeholder" &&
  supabaseSecretKey !== "your-supabase-secret-key-placeholder" &&
  !supabaseSecretKey.includes("placeholder"),
);

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSecretKeyConfigured) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(supabaseUrl, supabaseSecretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export function isServerSupabaseReady(): boolean {
  return isSecretKeyConfigured;
}
