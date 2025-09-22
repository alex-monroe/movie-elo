import { createBrowserClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_MOVIES_ELOSUPABASE_URL!,
  process.env.NEXT_PUBLIC_MOVIES_ELOSUPABASE_ANON_KEY!
)
