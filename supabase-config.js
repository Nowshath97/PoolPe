const SUPABASE_URL =
  "https://dxuodvgodmsmgxwchoed.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_R2md-ZzIgZvxbZlYXovssg_2jRsExY-";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );

/* =========================================================
   PoolPay - Supabase Configuration
   =========================================================

   IMPORTANT:
   Use only your Supabase Project URL and Publishable key.
   NEVER put service_role / secret keys in this file.
*/

const SUPABASE_URL =
  "YOUR_SUPABASE_PROJECT_URL";

const SUPABASE_PUBLISHABLE_KEY =
  "YOUR_SUPABASE_PUBLISHABLE_KEY";

if (!window.supabase) {
  throw new Error(
    "Supabase library failed to load."
  );
}

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

console.log("PoolPay Supabase initialized");
