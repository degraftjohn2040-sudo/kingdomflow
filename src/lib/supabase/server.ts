import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseConfigured } from '@/lib/config';
export async function createClient() {
  if (!supabaseConfigured()) throw new Error('Configuration Required: Supabase is not connected.');
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* Server Components cannot write cookies; proxy refreshes sessions. */
          }
        },
      },
    },
  );
}
