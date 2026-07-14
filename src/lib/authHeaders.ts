import { auth } from "./firebaseAuth";

/**
 * Build fetch headers that include the current user's Firebase ID token when
 * signed in, so the server can verify the request (see server.ts requireAuth).
 * If there's no session (or token refresh fails) we still send the standard
 * JSON headers — the server then applies its anonymous-access policy.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const user = auth.currentUser;
  if (user) {
    try {
      headers["Authorization"] = `Bearer ${await user.getIdToken()}`;
    } catch {
      /* ignore: proceed unauthenticated */
    }
  }
  return headers;
}
