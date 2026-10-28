export type FormState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> };
export type ActionState = FormState | null;

export const OK = (message?: string): FormState => ({ ok: true, message });
export const FAIL = (message: string, fieldErrors?: Record<string, string>): FormState => ({
  ok: false,
  message,
  fieldErrors,
});

/** Turns Postgres/PostgREST errors into messages that are safe to show a user. */
export function toUserMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!raw) return fallback;
  if (/Permission required|42501|row-level security/i.test(raw)) {
    return "You do not have permission to do that.";
  }
  if (/duplicate key/i.test(raw)) return "That record already exists.";
  if (/Invalid login credentials/i.test(raw)) return "Incorrect email or password.";
  if (/Email not confirmed/i.test(raw)) return "Please confirm your email address first.";
  if (/JWT expired|invalid JWT/i.test(raw)) return "Your session expired. Please sign in again.";
  // Strip schema noise so internal details are not surfaced verbatim.
  return raw.replace(/^(ERROR:\s*)?(public\.|private\.)/i, "").slice(0, 240);
}
