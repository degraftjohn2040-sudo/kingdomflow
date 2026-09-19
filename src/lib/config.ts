export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function appUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL;
  if (!value) throw new Error('Configuration Required: NEXT_PUBLIC_APP_URL is not set.');
  const url = new URL(value);
  if (
    url.protocol !== 'https:' &&
    !(process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname))
  ) {
    throw new Error('Configuration Required: app URL must use HTTPS.');
  }
  return url.origin;
}
export function safeNext(value: string | null): string {
  return value &&
    /^\/(?!\/)/.test(value) &&
    !value.includes('\\') &&
    !/[\r\n]/.test(value) &&
    (value === '/app' || value.startsWith('/app/'))
    ? value
    : '/app';
}
