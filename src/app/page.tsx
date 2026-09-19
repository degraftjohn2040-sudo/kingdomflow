import { redirect } from 'next/navigation';
import { supabaseConfigured } from '@/lib/config';
export default function Home() {
  redirect(supabaseConfigured() ? '/app' : '/configuration');
}
