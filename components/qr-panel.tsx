"use client";

import { useState, useTransition } from "react";
import { QrCode, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import { startQrCheckin } from "@/app/actions/attendance";
import { Alert, Badge, Button, ButtonLink, Card } from "@/components/ui";

/**
 * Mints a session-scoped QR code. The QR encodes only session + secret; the
 * server hashes the secret and rejects any token that does not belong to this
 * session, has expired, or arrives after the session is closed. A bare member
 * id is never part of the URL, so a shared screenshot cannot check anyone in.
 */
export function QrPanel({
  sessionId,
  orgId,
  expiresAt = null,
}: {
  sessionId: string;
  orgId: string;
  expiresAt?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ secret: string; expires_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = state
    ? `${typeof window === "undefined" ? "" : window.location.origin}/checkin?o=${orgId}&s=${sessionId}&k=${state.secret}`
    : null;

  function mint(ttl: number) {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await startQrCheckin(sessionId, ttl);
      if (!result.ok) {
        setError(result.message ?? "Could not start check-in.");
        return;
      }
      setState(result.data);
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Copy failed — select the link manually.");
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Self check-in</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Members scan to check themselves in. Codes expire and are bound to this session.
          </p>
        </div>
        {expiresAt ? <Badge tone="info">active code on file</Badge> : <Badge>no active code</Badge>}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={() => mint(120)} disabled={pending}>
          {pending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden /> : <QrCode className="h-4 w-4" aria-hidden />}
          {pending ? "Preparing…" : "Start 2-hour check-in"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => mint(480)} disabled={pending}>
          Start 8-hour check-in
        </Button>
      </div>

      {error ? (
        <div className="mt-3">
          <Alert tone="danger" title="Check-in could not start">
            {error}
          </Alert>
        </div>
      ) : null}

      {state ? (
        <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Share this link</p>
          <code className="mt-1 block break-all rounded-lg bg-white px-3 py-2 text-[11px] text-ink-700">
            {link}
          </code>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={copy}>
              <Share2 className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Copy link"}
            </Button>
            <ButtonLink
              variant="ghost"
              href={`/checkin?o=${orgId}&s=${sessionId}&k=${state.secret}`}
              target="_blank"
              rel="noreferrer"
            >
              Open check-in screen
            </ButtonLink>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Expires {new Date(state.expires_at).toLocaleString()}. Starting a new code invalidates the previous one.
          </p>
        </div>
      ) : null}
    </Card>
  );
}
