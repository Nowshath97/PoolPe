const SUPABASE_URL =
  "https://dxuodvgodmsmgxwchoed.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_R2md-ZzIgZvxbZlYXovssg_2jRsExY-";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );
