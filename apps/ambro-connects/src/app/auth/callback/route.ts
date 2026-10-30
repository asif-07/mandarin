import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedNext = url.searchParams.get("next") || "/account";
  const next = requestedNext === "/auth/reset" ? "/auth/reset" : "/account";
  try {
    const supabase = await serverSupabase();
    const code = url.searchParams.get("code");
    const tokenHash = url.searchParams.get("token_hash");
    const type = url.searchParams.get("type");
    let success = false;
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      success = !error;
    } else if (
      tokenHash &&
      type &&
      ["signup", "email", "recovery", "invite", "email_change"].includes(type)
    ) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      });
      success = !error;
    }
    const destination = new URL(
      success
        ? type === "recovery"
          ? "/auth/reset"
          : next
        : "/login?error=confirmation",
      url.origin,
    );
    return NextResponse.redirect(destination, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=unavailable", url.origin),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
