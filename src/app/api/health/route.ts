import { NextResponse } from 'next/server';
import { supabaseConfigured } from '@/lib/config';
export async function GET() {
  const configured = supabaseConfigured();
  return NextResponse.json(
    {
      status: configured ? 'configuration_present' : 'configuration_required',
      database: 'not_probed',
      version: '0.1.0',
    },
    { status: configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
