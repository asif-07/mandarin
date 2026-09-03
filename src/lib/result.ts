/** Typed result returned by every mutation (server action or route handler). */
export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: string, fieldErrors?: FieldErrors): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object" && e && "message" in e && typeof e.message === "string") return e.message;
  return fallback;
}
