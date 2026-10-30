import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
}

export async function serverSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new ApiError(
      "Membership services are being connected. Please try again shortly.",
      503,
    );
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value, options }) =>
          store.set(name, value, options),
        );
      },
    },
  });
}

export async function authenticated() {
  const supabase = await serverSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new ApiError("Please sign in to continue.", 401);
  return { supabase, user };
}

export async function administrator() {
  const result = await authenticated();
  // Read the current server-side user record, never user-editable user_metadata.
  if (result.user.app_metadata?.role !== "admin")
    throw new ApiError("Administrator access is required.", 403);
  return result;
}

export function checkMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError("Cross-site requests are not allowed.", 403);
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== process.env.NEXT_PUBLIC_APP_URL
  ) {
    throw new ApiError("This request must come from Ambro Connects.", 403);
  }
}

export async function jsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  checkMutation(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new ApiError("Send this request as JSON.", 415);
  if (Number(request.headers.get("content-length") || 0) > 100_000)
    throw new ApiError("Request is too large.", 413);
  const raw = await request.text();
  if (raw.length > 100_000) throw new ApiError("Request is too large.", 413);
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    /* Return a controlled validation error. */
  }
  throw new ApiError("Send a valid JSON object.");
}

export function stringValue(
  value: unknown,
  label: string,
  max: number,
  required = true,
): string {
  if (typeof value !== "string") {
    if (!required && value == null) return "";
    throw new ApiError(`${label} is required.`);
  }
  const text = value.trim();
  if ((required && !text) || text.length > max)
    throw new ApiError(
      `${label} must be ${required ? "between 1 and" : "at most"} ${max} characters.`,
    );
  return text;
}

export function uuidValue(value: unknown, label = "ID") {
  const id = stringValue(value, label, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new ApiError(`${label} is invalid.`);
  return id;
}

export function dbError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "P0001") throw new ApiError(error.message);
  if (error.code === "23505")
    throw new ApiError("This request has already been submitted.", 409);
  if (error.code === "42501")
    throw new ApiError("You do not have permission to do this.", 403);
  if (error.code?.startsWith("22") || error.code === "23514")
    throw new ApiError("Please check the supplied information.");
  console.error("Ambro database request failed", { code: error.code });
  throw new ApiError(
    "We could not complete this request. Please try again.",
    503,
  );
}

export function response(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export function failure(error: unknown) {
  if (error instanceof ApiError)
    return response({ error: error.message }, error.status);
  console.error(
    "Ambro API request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return response({ error: "Something went wrong. Please try again." }, 500);
}
