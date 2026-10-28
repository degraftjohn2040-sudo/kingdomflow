import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-ink-950 p-10 lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gold-400 font-display font-bold text-ink-950">
            K
          </span>
          <span className="font-display text-xl font-semibold text-white">KingdomFlow</span>
        </Link>
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-400">Members. Ministry. Growth.</p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-white">
            One platform for the whole house.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-300">
            Member records, attendance, giving, events and follow-up across every branch — with roles and
            permissions that respect how your church actually works.
          </p>
        </div>
        <p className="text-xs text-ink-500">Built for churches and ministries in Ghana and across Africa.</p>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
