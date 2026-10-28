import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarCheck, HandCoins, ShieldCheck, Users, Waypoints } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

const FEATURES = [
  { icon: Users, title: "Member directory", body: "Searchable records, families, departments and branch assignment — with pastoral notes kept behind permission." },
  { icon: CalendarCheck, title: "Attendance that works offline", body: "Manual check-in, secure QR codes and an offline queue that syncs idempotently when connectivity returns." },
  { icon: HandCoins, title: "Giving & expenses", body: "Tithes, offerings and expenses with receipts, reconciliation and finance-only visibility." },
  { icon: Waypoints, title: "Multi-branch by design", body: "Every record belongs to an organization and branch, with leaders scoped to the branches they serve." },
  { icon: ShieldCheck, title: "Tenant isolation", body: "Row Level Security and a role-permission matrix enforced in the database, not just the interface." },
  { icon: CalendarCheck, title: "Events & follow-up", body: "Services, prayer meetings, outreach and visitor follow-up with reminders and reporting." },
];

export default async function LandingPage() {
  const ctx = await getAuthContext();
  if (ctx?.activeOrg) redirect("/dashboard");
  if (ctx) redirect("/onboarding");

  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("plans")
    .select("name, slug, price_monthly, currency, marketing_features, max_contacts, max_branches, max_users")
    .eq("is_active", true)
    .order("price_monthly");

  return (
    <div className="bg-white">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-950 font-display text-sm font-bold text-gold-400">
              K
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">KingdomFlow</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-100">
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-900"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-ink-950">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(110,86,207,0.35),transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-400">
            Members. Ministry. Growth. One Platform.
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.08] text-white sm:text-6xl">
            Run your church with clarity, care and confidence.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300 sm:text-lg">
            KingdomFlow brings member records, attendance, giving, events, departments and follow-up into one
            secure platform — built for single congregations, campus fellowships and multi-branch ministries.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-gold-400 px-5 py-3 text-sm font-semibold text-ink-950 hover:bg-gold-500"
            >
              Create your workspace <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
          <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-6 border-t border-white/10 pt-8 sm:grid-cols-4">
            {[
              ["Multi-tenant", "One org, many branches"],
              ["Role-based", "9 ministry roles"],
              ["Offline-ready", "Attendance capture"],
              ["GHS & Africa", "Built for the region"],
            ].map(([term, detail]) => (
              <div key={term}>
                <dt className="text-sm font-semibold text-white">{term}</dt>
                <dd className="mt-1 text-xs text-ink-400">{detail}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Everything the office needs. Nothing it doesn't.</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-500">
          Designed to be usable by administrators, pastors, secretaries and finance officers without technical training —
          on a phone as easily as on a desk.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-ink-200 p-5">
              <feature.icon className="h-5 w-5 text-royal-700" aria-hidden />
              <h3 className="mt-3 font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {plans && plans.length > 0 ? (
        <section className="border-t border-ink-200 bg-ink-50/60">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Simple plans that grow with you</h2>
            <p className="mt-2 text-sm text-ink-500">Start on Free. Upgrade when your congregation grows.</p>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {plans.map((plan) => (
                <div key={plan.slug} className="flex flex-col rounded-2xl border border-ink-200 bg-white p-6">
                  <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {Number(plan.price_monthly) === 0 ? "Free" : formatMoney(plan.price_monthly, plan.currency)}
                    {Number(plan.price_monthly) > 0 ? (
                      <span className="text-sm font-normal text-ink-400">/month</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Up to {plan.max_contacts.toLocaleString()} members · {plan.max_branches} branch
                    {plan.max_branches === 1 ? "" : "es"} · {plan.max_users} staff
                  </p>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-600">
                    {(plan.marketing_features as string[]).map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="text-royal-600">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="mt-6 rounded-lg bg-ink-950 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-ink-900"
                  >
                    Get started
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <footer className="border-t border-ink-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-ink-400">
          <span>© {new Date().getFullYear()} KingdomFlow. Built for churches and ministries in Ghana and beyond.</span>
          <span className="flex gap-4">
            <Link href="/login" className="hover:underline">
              Sign in
            </Link>
            <Link href="/signup" className="hover:underline">
              Create account
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
