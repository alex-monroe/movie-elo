import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.MOVIES_ELO_SUPABASE_URL ??
  process.env.NEXT_PUBLIC_MOVIES_ELOSUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.MOVIES_ELO_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing Supabase URL. Please set NEXT_PUBLIC_MOVIES_ELOSUPABASE_URL (or the legacy NEXT_PUBLIC_SUPABASE_URL).'
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Missing Supabase service role key. Please set MOVIES_ELO_SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY).'
  );
}

export const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
