import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
const db = new PGlite();
const ownerA = '10000000-0000-4000-8000-000000000001';
const ownerB = '10000000-0000-4000-8000-000000000002';
const memberA = '10000000-0000-4000-8000-000000000003';
const secretaryA = '10000000-0000-4000-8000-000000000004';
const financeA = '10000000-0000-4000-8000-000000000005';
const unconfirmed = '10000000-0000-4000-8000-000000000006';
let orgA: string,
  orgB: string,
  recordA: string,
  recordB: string,
  visitorA: string,
  groupB: string,
  sessionA: string;
async function asUser<T = Record<string, unknown>>(
  uid: string,
  sql: string,
  params: unknown[] = [],
) {
  await db.exec('begin; set local role authenticated;');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [uid]);
    const result = await db.query<T>(sql, params);
    await db.exec('commit;');
    return result.rows;
  } catch (error) {
    await db.exec('rollback;');
    throw error;
  }
}
beforeAll(async () => {
  await db.exec(`
 create role authenticated; create role anon;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
 grant usage on schema public to authenticated,anon;
 alter default privileges in schema public grant all on tables to authenticated,anon;
 alter default privileges in schema public grant all on functions to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated;
 grant select,insert,update,delete on storage.objects to authenticated;
 `);
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  for (const id of [ownerA, ownerB, memberA, secretaryA, financeA, unconfirmed])
    await db.query('insert into auth.users values($1,$2)', [
      id,
      id === unconfirmed ? null : new Date().toISOString(),
    ]);
  const create =
    "select public.create_organization($1,'church','Ghana','Africa/Accra','office@example.org',null,'Owner') as id";
  orgA = (await asUser<{ id: string }>(ownerA, create, ['Organization A']))[0].id;
  orgB = (await asUser<{ id: string }>(ownerB, create, ['Organization B']))[0].id;
  for (const [id, role] of [
    [memberA, 'member'],
    [secretaryA, 'secretary'],
    [financeA, 'finance'],
  ])
    await db.query(
      'insert into public.organization_members(organization_id,user_id,role) values($1,$2,$3)',
      [orgA, id, role],
    );
  recordA = (
    await asUser<{ id: string }>(
      ownerA,
      "insert into public.members(organization_id,first_name,last_name) values($1,'Ama','A') returning id",
      [orgA],
    )
  )[0].id;
  recordB = (
    await asUser<{ id: string }>(
      ownerB,
      "insert into public.members(organization_id,first_name,last_name) values($1,'Kojo','B') returning id",
      [orgB],
    )
  )[0].id;
  groupB = (
    await asUser<{ id: string }>(
      ownerB,
      "insert into public.groups(organization_id,name) values($1,'B Group') returning id",
      [orgB],
    )
  )[0].id;
  visitorA = (
    await asUser<{ id: string }>(
      ownerA,
      "insert into public.visitors(organization_id,first_name,last_name) values($1,'Visitor','A') returning id",
      [orgA],
    )
  )[0].id;
  sessionA = (
    await asUser<{ id: string }>(
      ownerA,
      "insert into public.attendance_sessions(organization_id,title,session_date,session_type) values($1,'Service',current_date,'service') returning id",
      [orgA],
    )
  )[0].id;
});
afterAll(async () => {
  await db.close();
});
describe('real PostgreSQL migration and RLS execution', () => {
  it('enables RLS on every public table', async () => {
    const { rows } = await db.query<{ relname: string; relrowsecurity: boolean }>(
      "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
    );
    expect(rows.length).toBeGreaterThan(15);
    for (const row of rows) expect(row.relrowsecurity, row.relname).toBe(true);
  });
  it('creates the authenticated user as owner with a bounded trial', async () => {
    const rows = await asUser<{ role: string }>(
      ownerA,
      'select role from public.organization_members where organization_id=$1',
      [orgA],
    );
    expect(rows[0].role).toBe('owner');
    const { rows: trial } = await db.query<{ days: number }>(
      'select extract(epoch from trial_ends_at-created_at)/86400 as days from organizations where id=$1',
      [orgA],
    );
    expect(Number(trial[0].days)).toBe(30);
  });
  it('rejects duplicate or unverified organization bootstrap', async () => {
    const query =
      "select public.create_organization('Extra','church','Ghana','Africa/Accra',null,null,'Owner')";
    await expect(asUser(ownerA, query)).rejects.toThrow('membership already exists');
    await expect(asUser(unconfirmed, query)).rejects.toThrow('Email verification required');
  });
  it('isolates member reads and IDOR updates', async () => {
    const rows = await asUser<{ id: string }>(ownerA, 'select id from public.members');
    expect(rows.map((r) => r.id)).toContain(recordA);
    expect(rows.map((r) => r.id)).not.toContain(recordB);
    expect(
      await asUser(
        ownerA,
        "update public.members set first_name='Stolen' where id=$1 returning id",
        [recordB],
      ),
    ).toEqual([]);
  });
  it('rejects cross-tenant inserts and tenant changes', async () => {
    await expect(
      asUser(
        ownerA,
        "insert into public.members(organization_id,first_name,last_name) values($1,'Attack','A')",
        [orgB],
      ),
    ).rejects.toThrow();
    await expect(
      asUser(ownerA, 'update public.members set organization_id=$1 where id=$2', [orgB, recordA]),
    ).rejects.toThrow('immutable');
  });
  it('rejects cross-tenant foreign keys even when their UUID is known', async () => {
    await expect(
      asUser(ownerA, 'update public.members set group_id=$1 where id=$2', [groupB, recordA]),
    ).rejects.toThrow('foreign key');
  });
  it('supports member read, update and archive without destructive deletes', async () => {
    const updated = await asUser<{ phone: string }>(
      ownerA,
      "update public.members set phone='+233240000000' where id=$1 returning phone",
      [recordA],
    );
    expect(updated[0].phone).toBe('+233240000000');
    const archived = await asUser<{ status: string }>(
      ownerA,
      "update public.members set status='archived' where id=$1 returning status",
      [recordA],
    );
    expect(archived[0].status).toBe('archived');
    await asUser(ownerA, "update public.members set status='active' where id=$1", [recordA]);
    await expect(
      asUser(ownerA, 'delete from public.members where id=$1', [recordA]),
    ).rejects.toThrow('permission denied');
  });
  it('enforces permissions independently of tenant membership', async () => {
    expect(await asUser(memberA, 'select id from public.members')).toEqual([]);
    await expect(
      asUser(
        memberA,
        "insert into public.members(organization_id,first_name,last_name) values($1,'No','Rights')",
        [orgA],
      ),
    ).rejects.toThrow();
    expect(
      (
        await asUser<{ allowed: boolean }>(
          secretaryA,
          "select public.authorize($1,'members.update') as allowed",
          [orgA],
        )
      )[0].allowed,
    ).toBe(true);
    await expect(
      asUser(secretaryA, "update public.members set status='archived' where id=$1", [recordA]),
    ).rejects.toThrow('members.delete');
  });
  it('blocks privilege escalation and direct subscription changes', async () => {
    await expect(
      asUser(ownerA, "update public.organization_members set role='owner' where user_id=$1", [
        memberA,
      ]),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(
        ownerA,
        "update public.organizations set subscription_plan='premium_ai',subscription_status='active' where id=$1",
        [orgA],
      ),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(
        ownerA,
        "insert into public.organization_members(organization_id,user_id,role) values($1,$2,'owner')",
        [orgB, ownerA],
      ),
    ).rejects.toThrow('permission denied');
  });
  it('updates visitors and converts exactly once transactionally', async () => {
    await asUser(
      ownerA,
      "update public.visitors set status='contacted',next_action='Call' where id=$1",
      [visitorA],
    );
    const first = await asUser<{ id: string }>(
      ownerA,
      'select public.convert_visitor($1,$2) as id',
      [visitorA, orgA],
    );
    const second = await asUser<{ id: string }>(
      ownerA,
      'select public.convert_visitor($1,$2) as id',
      [visitorA, orgA],
    );
    expect(first[0].id).toBe(second[0].id);
    await expect(
      asUser(ownerB, 'select public.convert_visitor($1,$2)', [visitorA, orgB]),
    ).rejects.toThrow('Visitor not found');
  });
  it('records attendance, prevents duplicates, and rejects cross-tenant members', async () => {
    const rows = await asUser<{ recorded_by: string }>(
      ownerA,
      "insert into public.attendance_records(organization_id,session_id,member_id,status,recorded_by) values($1,$2,$3,'present',$4) returning recorded_by",
      [orgA, sessionA, recordA, ownerB],
    );
    expect(rows[0].recorded_by).toBe(ownerA);
    await expect(
      asUser(
        ownerA,
        "insert into public.attendance_records(organization_id,session_id,member_id,status) values($1,$2,$3,'present')",
        [orgA, sessionA, recordA],
      ),
    ).rejects.toThrow('unique');
    await expect(
      asUser(
        ownerA,
        "insert into public.attendance_records(organization_id,session_id,member_id,status) values($1,$2,$3,'present')",
        [orgA, sessionA, recordB],
      ),
    ).rejects.toThrow('foreign key');
    await asUser(
      ownerA,
      "update public.attendance_records set status='absent' where organization_id=$1 and session_id=$2 and member_id=$3",
      [orgA, sessionA, recordA],
    );
  });
  it('protects confidential prayer requests', async () => {
    await asUser(
      ownerA,
      "insert into public.prayer_requests(organization_id,title,details,confidentiality) values($1,'Private prayer','Sensitive','leadership'),($1,'Team prayer','Team details','team')",
      [orgA],
    );
    const rows = await asUser<{ confidentiality: string }>(
      secretaryA,
      'select confidentiality from public.prayer_requests',
    );
    expect(rows.map((r) => r.confidentiality)).toEqual(['team']);
    expect(await asUser(ownerB, 'select id from public.prayer_requests')).toEqual([]);
  });
  it('enforces feature entitlements at the database layer', async () => {
    const rows = await asUser<{ entitled: boolean }>(
      ownerA,
      "select public.entitled($1,'finance') as entitled",
      [orgA],
    );
    expect(rows[0].entitled).toBe(false);
    const sql =
      "insert into public.contributions(organization_id,amount,contribution_type,payment_method,contribution_date) values($1,150,'tithe','cash',current_date)";
    await expect(asUser(financeA, sql, [orgA])).rejects.toThrow();
    await db.query(
      "update public.organizations set subscription_plan='pro',subscription_status='active',subscription_ends_at=now()+interval '1 month' where id=$1",
      [orgA],
    );
    await asUser(financeA, sql, [orgA]);
    expect(await asUser(secretaryA, 'select id from public.contributions')).toEqual([]);
    await db.query(
      "update public.organizations set subscription_plan='trial',subscription_status='trialing',subscription_ends_at=null where id=$1",
      [orgA],
    );
  });
  it('does not allow fabricated payments or AI usage by organization owners', async () => {
    await expect(
      asUser(
        ownerA,
        "insert into public.payments(organization_id,amount_minor,provider,provider_reference,status,plan,verified_at) values($1,15000,'paystack','fake','verified','pro',now())",
        [orgA],
      ),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(
        ownerA,
        "insert into public.ai_usage(organization_id,user_id,feature,model,input_tokens,output_tokens) values($1,$2,'test','test',1,1)",
        [orgA, ownerA],
      ),
    ).rejects.toThrow('permission denied');
  });
  it('denies operational writes after trial expiration without hiding historical records', async () => {
    await db.query(
      "update public.organizations set trial_ends_at=now()-interval '1 day' where id=$1",
      [orgA],
    );
    await expect(
      asUser(
        ownerA,
        "insert into public.members(organization_id,first_name,last_name) values($1,'Expired','Trial')",
        [orgA],
      ),
    ).rejects.toThrow();
    expect((await asUser(ownerA, 'select id from public.members')).length).toBeGreaterThan(0);
    await db.query(
      "update public.organizations set trial_ends_at=now()+interval '30 days' where id=$1",
      [orgA],
    );
  });
  it('writes audit records without logging sensitive field content', async () => {
    const rows = await asUser<{ resource_type: string; metadata: unknown }>(
      ownerA,
      'select resource_type,metadata from public.audit_logs where organization_id=$1',
      [orgA],
    );
    expect(rows.some((r) => r.resource_type === 'members')).toBe(true);
    expect(rows.every((r) => JSON.stringify(r.metadata) === '{}')).toBe(true);
    await expect(
      asUser(ownerA, 'delete from public.audit_logs where organization_id=$1', [orgA]),
    ).rejects.toThrow('permission denied');
  });
  it('isolates private storage objects and denies cross-tenant moves', async () => {
    await asUser(
      ownerA,
      "insert into storage.objects(bucket_id,name) values('organization-files',$1)",
      [`${orgA}/logo.png`],
    );
    expect((await asUser(ownerA, 'select name from storage.objects')).length).toBe(1);
    expect(await asUser(ownerB, 'select name from storage.objects')).toEqual([]);
    await expect(
      asUser(
        ownerB,
        "insert into storage.objects(bucket_id,name) values('organization-files',$1)",
        [`${orgA}/attack.png`],
      ),
    ).rejects.toThrow();
    expect(
      await asUser(ownerA, 'update storage.objects set name=$1 returning id', [
        `${orgB}/moved.png`,
      ]),
    ).toEqual([]);
  });
  it('protects conversion markers and validates organization timezones at the database', async () => {
    await expect(
      asUser(ownerA, 'update public.visitors set converted_member_id=$1 where id=$2', [
        recordA,
        visitorA,
      ]),
    ).rejects.toThrow('permission denied');
    await expect(
      asUser(ownerA, "update public.organizations set timezone='Invalid/Timezone' where id=$1", [
        orgA,
      ]),
    ).rejects.toThrow('Invalid timezone');
  });
  it('denies anonymous table reads and privileged RPC execution despite Supabase defaults', async () => {
    await db.exec('begin; set local role anon;');
    try {
      await expect(db.query('select * from public.organizations')).rejects.toThrow(
        'permission denied',
      );
    } finally {
      await db.exec('rollback;');
    }
    await db.exec('begin; set local role anon;');
    try {
      await expect(
        db.query(
          "select public.create_organization('Attack','church','Ghana','Africa/Accra',null,null,'Attack')",
        ),
      ).rejects.toThrow('permission denied');
    } finally {
      await db.exec('rollback;');
    }
  });
  it('persists department, group, event, follow-up, and volunteer changes under tenant RLS', async () => {
    const statements = [
      [
        "insert into public.departments(organization_id,name) values($1,'Choir') returning id",
        "update public.departments set status='archived' where id=$1 returning id",
        'departments',
      ],
      [
        "insert into public.groups(organization_id,name) values($1,'Bible study') returning id",
        "update public.groups set meeting_schedule='Wednesday 18:00' where id=$1 returning id",
        'groups',
      ],
      [
        "insert into public.events(organization_id,title,starts_at,ends_at) values($1,'Gathering',now(),now()+interval '1 hour') returning id",
        "update public.events set status='cancelled' where id=$1 returning id",
        'events',
      ],
      [
        "insert into public.followups(organization_id,title,next_follow_up) values($1,'Call visitor',current_date) returning id",
        "update public.followups set status='contacted',contact_attempts=1 where id=$1 returning id",
        'followups',
      ],
      [
        'insert into public.volunteers(organization_id,member_id) values($1,$2) returning id',
        "update public.volunteers set status='unavailable' where id=$1 returning id",
        'volunteers',
      ],
    ];
    for (const [insert, update, table] of statements) {
      const [{ id }] = await asUser<{ id: string }>(
        ownerA,
        insert,
        table === 'volunteers' ? [orgA, recordA] : [orgA],
      );
      expect((await asUser(ownerA, update, [id])).length).toBe(1);
      expect(await asUser(ownerB, `select id from public.${table} where id=$1`, [id])).toEqual([]);
    }
  });
  it('revokes access immediately when a membership is suspended', async () => {
    await db.query("update public.organization_members set status='suspended' where user_id=$1", [
      secretaryA,
    ]);
    expect(await asUser(secretaryA, 'select id from public.members')).toEqual([]);
    expect(
      (
        await asUser<{ allowed: boolean }>(
          secretaryA,
          "select public.authorize($1,'members.read') as allowed",
          [orgA],
        )
      )[0].allowed,
    ).toBe(false);
  });
});
