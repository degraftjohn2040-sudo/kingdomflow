import { describe, it, expect } from 'vitest';
import { getModule, moduleSchema } from '../src/lib/modules';
import { registerSchema, loginSchema, organizationSchema } from '../src/lib/validation';
import { csvCell, safeSearch } from '../src/lib/utils';
import { safeNext } from '../src/lib/config';
const member = {
  first_name: 'Ama',
  last_name: 'Mensah',
  membership_date: '2026-09-19',
  status: 'active',
};
describe('server input validation', () => {
  it('requires strong registration passwords and valid login emails', () => {
    expect(registerSchema.safeParse({ email: 'not-email', password: 'short' }).success).toBe(false);
    expect(
      registerSchema.safeParse({ email: 'a@example.org', password: 'a-strong-password' }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: 'x@example.org', password: '' }).success).toBe(false);
  });
  it('requires valid onboarding timezones', () => {
    const org = {
      name: 'Test church',
      organization_type: 'church',
      country: 'Ghana',
      timezone: 'Africa/Accra',
      email: '',
      phone: '+233 24 000 0000',
      administrator_name: 'Test owner',
    };
    expect(organizationSchema.safeParse(org).success).toBe(true);
    expect(organizationSchema.safeParse({ ...org, timezone: 'Mars/Test' }).success).toBe(false);
  });
  it('accepts member fields but rejects injected tenant, role and IDs', () => {
    const schema = moduleSchema(getModule('members')!);
    expect(schema.safeParse(member).success).toBe(true);
    for (const extra of [
      { organization_id: crypto.randomUUID() },
      { role: 'owner' },
      { id: crypto.randomUUID() },
      { subscription_plan: 'pro' },
    ])
      expect(schema.safeParse({ ...member, ...extra }).success).toBe(false);
  });
  it('rejects invalid phone, dates, email, and foreign IDs', () => {
    const schema = moduleSchema(getModule('members')!);
    for (const extra of [
      { phone: 'hello' },
      { email: 'test' },
      { date_of_birth: '2026-02-30' },
      { date_of_birth: '2200-01-01' },
      { group_id: 'not-uuid' },
    ])
      expect(schema.safeParse({ ...member, ...extra }).success).toBe(false);
  });
  it('checks money precision and positive amounts', () => {
    const schema = moduleSchema(getModule('contributions')!);
    const base = {
      contribution_type: 'tithe',
      payment_method: 'cash',
      contribution_date: '2026-09-19',
    };
    for (const amount of ['-1', '0', '1.999', 'not a number'])
      expect(schema.safeParse({ ...base, amount }).success).toBe(false);
    expect(schema.safeParse({ ...base, amount: '150.50' }).success).toBe(true);
  });
  it('validates event chronology and attendance type relations', () => {
    expect(
      moduleSchema(getModule('events')!).safeParse({
        title: 'Service',
        starts_at: '2026-09-19T14:00',
        ends_at: '2026-09-19T12:00',
        status: 'scheduled',
      }).success,
    ).toBe(false);
    const schema = moduleSchema(getModule('attendance')!);
    const base = { title: 'Sunday service', session_date: '2026-09-19' };
    expect(schema.safeParse({ ...base, session_type: 'group' }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, session_type: 'service', group_id: crypto.randomUUID() }).success,
    ).toBe(false);
    expect(
      schema.safeParse({ ...base, session_type: 'group', group_id: crypto.randomUUID() }).success,
    ).toBe(true);
  });
  it('never resolves prototype properties as modules', () => {
    expect(getModule('__proto__')).toBeUndefined();
    expect(getModule('constructor')).toBeUndefined();
  });
});
describe('output and redirect safety', () => {
  it('neutralizes spreadsheet formulas and quotes cells', () => {
    for (const x of ['=1+1', '+cmd', '-1', '@SUM(A1)', '\t=1', ' =1'])
      expect(csvCell(x).startsWith('"\'')).toBe(true);
    expect(csvCell('A "quoted" name')).toBe('"A ""quoted"" name"');
  });
  it('removes PostgREST filter syntax', () => {
    expect(safeSearch('a),organization_id.eq.123%_*')).toBe('aorganizationideq123');
  });
  it('allows only internal workspace redirects', () => {
    for (const value of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      '/application',
      '/app\r\nX: evil',
      null,
    ])
      expect(safeNext(value)).toBe('/app');
    expect(safeNext('/app/members')).toBe('/app/members');
  });
});
