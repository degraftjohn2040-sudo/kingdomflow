import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfigured } from '@/lib/config';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const protectedRoute =
    request.nextUrl.pathname.startsWith('/app') || request.nextUrl.pathname === '/onboarding';
  if (!supabaseConfigured()) {
    if (protectedRoute) return NextResponse.redirect(new URL('/configuration', request.url));
    return response;
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (protectedRoute && (error || !user)) {
    const destination = new URL('/login', request.url);
    const redirect = NextResponse.redirect(destination);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: [
    '/app/:path*',
    '/onboarding',
    '/login',
    '/register',
    '/reset-password',
    '/update-password',
  ],
};
