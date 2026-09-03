import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Reports whether the required environment variables are present (name and
 * length only, never the value) so a misconfigured deployment can be diagnosed
 * without exposing secrets. Safe to leave enabled: it reveals nothing sensitive.
 */
export async function GET() {
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
  const env: Record<string, { present: boolean; length: number }> = {};
  for (const n of names) {
    const v = process.env[n];
    env[n] = { present: !!v && v.trim().length > 0, length: v?.length ?? 0 };
  }
  // Catch names saved with stray whitespace, e.g. "NEXT_PUBLIC_SUPABASE_URL ".
  const suspicious = Object.keys(process.env).filter((k) => /SUPABASE/i.test(k) && !names.includes(k as (typeof names)[number]));

  const ok = names.every((n) => env[n]!.present);
  return NextResponse.json(
    {
      ok,
      env,
      suspiciousNames: suspicious,
      puppeteerExecutablePathSet: !!process.env.PUPPETEER_EXECUTABLE_PATH,
      vercelEnv: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { status: ok ? 200 : 500 },
  );
}
