import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { appUrl, safeNext } from '@/lib/config';
export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = appUrl();
  } catch {
    return new NextResponse('Configuration Required: canonical app URL is missing or invalid.', {
      status: 503,
    });
  }
  const code = request.nextUrl.searchParams.get('code');
  const token = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  try {
    const db = await createClient();
    const { error } = code
      ? await db.auth.exchangeCodeForSession(code)
      : token && (type === 'email' || type === 'signup' || type === 'recovery')
        ? await db.auth.verifyOtp({ token_hash: token, type })
        : { error: new Error('Missing verification code') };
    if (!error) {
      const next = request.nextUrl.searchParams.get('next');
      return NextResponse.redirect(
        new URL(
          type === 'recovery' || next === '/update-password' ? '/update-password' : safeNext(next),
          origin,
        ),
      );
    }
  } catch {
    /* Redirect to an explicit failure; never treat callback errors as authenticated. */
  }
  return NextResponse.redirect(new URL('/login?error=verification', origin));
}
