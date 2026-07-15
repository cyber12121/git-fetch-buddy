/**
 * Narrow an `unknown` caught in a try/catch to a human-readable message.
 * Prefer this over `catch (err: any)` — it handles Errors, plain objects
 * with a `.message`, strings, and unknown shapes without dropping type safety.
 */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return fallback;
}

/** Return a Firebase auth-style code (e.g. "auth/popup-blocked") if present. */
export function errorCode(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}
