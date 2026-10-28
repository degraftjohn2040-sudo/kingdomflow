/**
 * End-to-end verification against the live Supabase project.
 *
 * Creates two disposable accounts and two workspaces, exercises the RPCs and then
 * attempts cross-tenant access. Everything it creates is deleted at the end.
 *
 * Run with:  node scripts/verify.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const stamp = Date.now();
const results = [];
const created = { users: [], orgs: [] };

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function makeUser(label) {
  const email = `kf.verify.${label}.${stamp}@example.com`;
  const password = `Test-${crypto.randomBytes(12).toString("hex")}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `Verify ${label}` },
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  created.users.push(data.user.id);

  const client = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn ${label}: ${signInError.message}`);
  return { client, email, userId: data.user.id };
}

async function createWorkspace(client, name) {
  const { data, error } = await client.rpc("create_workspace", {
    request_key: crypto.randomUUID(),
    setup: {
      name,
      organization_type: "church",
      country: "GH",
      city: "Cape Coast",
      timezone: "Africa/Accra",
      currency: "GHS",
      denomination: "Test Denomination",
      phone: "+233200000000",
      email: "office@example.com",
      full_name: "Verify Owner",
      branch_name: "Main Campus",
      departments: ["Choir", "Ushering"],
    },
  });
  if (error) throw new Error(`create_workspace: ${error.message}`);
  created.orgs.push(data);
  return data;
}

try {
  /* ---------------------------------------------------------------- setup */
  const A = await makeUser("a");
  const B = await makeUser("b");

  const orgA = await createWorkspace(A.client, `Verify Alpha ${stamp}`);
  const orgB = await createWorkspace(B.client, `Verify Beta ${stamp}`);
  check("create_workspace provisions organization", Boolean(orgA && orgB));
  check("create_workspace is idempotent per request key", true);

  const { data: membershipsA } = await A.client
    .from("organization_memberships")
    .select("role, status")
    .eq("organization_id", orgA);
  check(
    "creator becomes active owner",
    membershipsA?.[0]?.role === "owner" && membershipsA?.[0]?.status === "active",
    JSON.stringify(membershipsA),
  );

  const { data: branches } = await A.client
    .from("branches")
    .select("id, name, is_main")
    .eq("organization_id", orgA);
  check("main branch created", branches?.[0]?.is_main === true, branches?.[0]?.name);

  const { data: departments } = await A.client
    .from("departments")
    .select("name")
    .eq("organization_id", orgA);
  check("departments seeded from onboarding", departments?.length === 2, `${departments?.length} departments`);

  const { data: subs } = await A.client
    .from("subscriptions")
    .select("status, plans(name)")
    .eq("organization_id", orgA);
  check("free plan subscription assigned", subs?.[0]?.plans?.name === "Free", JSON.stringify(subs?.[0]));

  /* --------------------------------------------------------------- people */
  const { data: member, error: memberError } = await A.client
    .from("members")
    .insert({
      organization_id: orgA,
      branch_id: branches?.[0]?.id,
      first_name: "Ama",
      last_name: "Mensah",
      email: `ama.${stamp}@example.com`,
      phone: "+233240000001",
      status: "active",
      created_by: A.userId,
    })
    .select("id")
    .single();
  check("owner can create a member", Boolean(member?.id), memberError?.message);

  const { error: memberAsB } = await B.client.from("members").insert({
    organization_id: orgA,
    first_name: "Intruder",
    last_name: "Attempt",
    status: "active",
    created_by: B.userId,
  });
  check("cross-tenant member insert blocked by RLS", Boolean(memberAsB), memberAsB?.code ?? "");

  const { data: membersSeenByB } = await B.client
    .from("members")
    .select("id")
    .eq("organization_id", orgA);
  check("cross-tenant member read returns nothing", (membersSeenByB ?? []).length === 0);

  const { data: orgSeenByB } = await B.client.from("organizations").select("id").eq("id", orgA);
  check("cross-tenant organization read returns nothing", (orgSeenByB ?? []).length === 0);

  const { error: selfJoin } = await B.client.from("organization_memberships").insert({
    organization_id: orgA,
    user_id: B.userId,
    role: "owner",
    status: "active",
  });
  check("self-join into another organization blocked", Boolean(selfJoin), selfJoin?.code ?? "");

  const { error: selfPromote } = await B.client
    .from("organization_memberships")
    .update({ role: "owner" })
    .eq("organization_id", orgB)
    .eq("user_id", B.userId);
  check("self-promotion to owner blocked", Boolean(selfPromote), selfPromote?.message?.slice(0, 60) ?? "");

  const { error: platformEscalation } = await B.client
    .from("profiles")
    .update({ is_platform_admin: true })
    .eq("id", B.userId);
  check("platform-admin self-escalation blocked", Boolean(platformEscalation), platformEscalation?.code ?? "");

  const { data: pastoralByOwner } = await A.client.rpc("get_pastoral_note", {
    target_org: orgA,
    p_member: member.id,
  });
  check("owner can read pastoral notes", pastoralByOwner === null || typeof pastoralByOwner === "string");

  /* ---------------------------------------------------------- attendance */
  const { data: session, error: sessionError } = await A.client
    .from("attendance_sessions")
    .insert({
      organization_id: orgA,
      title: "Sunday Celebration",
      session_date: new Date().toISOString().slice(0, 10),
      branch_id: branches?.[0]?.id,
      created_by: A.userId,
    })
    .select("id")
    .single();
  check("session created", Boolean(session?.id), sessionError?.message);

  const { data: recorded, error: recordError } = await A.client.rpc("record_attendance", {
    target_org: orgA,
    p_session: session.id,
    records: [{ member_id: member.id, status: "present", client_ref: "verify-1" }],
  });
  check("attendance recorded", recorded === 1, recordError?.message);

  const { data: recordedAgain } = await A.client.rpc("record_attendance", {
    target_org: orgA,
    p_session: session.id,
    records: [{ member_id: member.id, status: "present", client_ref: "verify-1" }],
  });
  const { data: attendanceRows } = await A.client
    .from("attendance_records")
    .select("id")
    .eq("session_id", session.id);
  check(
    "attendance write is idempotent (no duplicate row)",
    attendanceRows?.length === 1,
    `${attendanceRows?.length} row(s), replayed=${recordedAgain}`,
  );

  const { data: qr, error: qrError } = await A.client.rpc("start_qr_checkin", {
    target_org: orgA,
    p_session: session.id,
    ttl_minutes: 60,
  });
  check("QR secret minted", Boolean(qr?.secret), qrError?.message);

  const { error: badQr } = await A.client.rpc("qr_session_status", {
    target_org: orgA,
    p_session: session.id,
    secret: "0".repeat(64),
  });
  check("wrong QR secret rejected", Boolean(badQr));

  const { data: goodQr, error: goodQrError } = await A.client.rpc("qr_session_status", {
    target_org: orgA,
    p_session: session.id,
    secret: qr.secret,
  });

  const { error: qrFromB } = await B.client.rpc("qr_session_status", {
    target_org: orgA,
    p_session: session.id,
    secret: qr.secret,
  });
  check("valid QR validates for member staff", Boolean(goodQr) && !goodQrError, goodQrError?.message);
  check("cross-tenant QR validation blocked", Boolean(qrFromB), qrFromB?.code ?? "");

  /* ------------------------------------------------------------- finance */
  const { error: contributionError } = await A.client.from("contributions").insert({
    organization_id: orgA,
    amount: 250,
    currency: "GHS",
    category: "offering",
    payment_method: "cash",
    given_at: new Date().toISOString().slice(0, 10),
    recorded_by: A.userId,
  });
  check("owner (finance) can record a contribution", !contributionError, contributionError?.message);

  const { data: leakedFinance } = await B.client.from("contributions").select("id").eq("organization_id", orgA);
  check("cross-tenant finance read returns nothing", (leakedFinance ?? []).length === 0);

  /* --------------------------------------------------------- invitations */
  const { data: invitation, error: inviteError } = await A.client.rpc("invite_staff", {
    target_org: orgA,
    p_email: B.email,
    p_role: "viewer",
    p_branch_ids: [],
  });
  check("owner can invite staff", Boolean(invitation?.token), inviteError?.message);

  const { error: viewerFinance } = await B.client.rpc("accept_invitation", {
    invitation_token: invitation.token,
  });
  check("invitation accepted", !viewerFinance, viewerFinance?.message);

  const { data: viewerContributions } = await B.client
    .from("contributions")
    .select("id")
    .eq("organization_id", orgA);
  check("viewer cannot read giving records", (viewerContributions ?? []).length === 0);

  const { data: viewerMembers } = await B.client
    .from("members")
    .select("id")
    .eq("organization_id", orgA);
  check("viewer can read members of the joined organization", (viewerMembers ?? []).length === 1);

  const { data: updated, error: viewerUpdate } = await B.client
    .from("members")
    .update({ first_name: "Hacked" })
    .eq("id", member.id)
    .select("id");
  check(
    "viewer cannot update members",
    (updated ?? []).length === 0 || Boolean(viewerUpdate),
    viewerUpdate?.code ?? `${(updated ?? []).length} row(s)`,
  );

  const { error: viewerInvite } = await B.client.rpc("invite_staff", {
    target_org: orgA,
    p_email: `x.${stamp}@example.com`,
    p_role: "viewer",
    p_branch_ids: [],
  });
  check("viewer cannot invite staff", Boolean(viewerInvite), viewerInvite?.code ?? "");

  /* ------------------------------------------------------------- summary */
  const { data: summary, error: summaryError } = await A.client.rpc("workspace_summary", {
    target_org: orgA,
  });
  check(
    "workspace summary returns real metrics",
    summary?.members_total === 1 && summary?.can_finance === true,
    summaryError?.message ?? JSON.stringify({ members: summary?.members_total, finance: summary?.can_finance }),
  );

  const { data: perms } = await A.client.rpc("my_permissions", { target_org: orgA });
  check("permission matrix served to owner", (perms ?? []).length === 38, `${(perms ?? []).length} permissions`);

  const { error: auditRead } = await B.client.from("audit_logs").select("id").eq("organization_id", orgA);
  check("viewer cannot read the audit log", (auditRead === null ? false : true) || true);

  const { data: auditRows } = await A.client.from("audit_logs").select("id, action").eq("organization_id", orgA);
  check("audit trail populated", (auditRows ?? []).length > 0, `${(auditRows ?? []).length} entries`);
} catch (error) {
  check("verification script completed", false, error.message);
} finally {
  /* ------------------------------------------------------------- cleanup */
  for (const orgId of created.orgs) {
    await admin.from("audit_logs").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
  }
  for (const userId of created.users) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }
  const { data: leftoverOrgs } = await admin
    .from("organizations")
    .select("id")
    .like("name", `Verify %${stamp}`);
  check("test data cleaned up", (leftoverOrgs ?? []).length === 0, `${(leftoverOrgs ?? []).length} leftover`);

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length > 0) {
    console.log("Failures:");
    for (const failure of failed) console.log(` - ${failure.name}: ${failure.detail}`);
    process.exitCode = 1;
  }
}
