'use client';
import { createBrowserClient } from '@supabase/ssr';
import { supabaseConfigured } from '@/lib/config';
export function createClient() {
  if (!supabaseConfigured()) throw new Error('Configuration Required: Supabase is not connected.');
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
