import {
  ApiError,
  authenticated,
  dbError,
  failure,
  jsonBody,
  response,
  serverSupabase,
  stringValue,
} from "@/lib/supabase";

function passwordValue(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 128)
    throw new ApiError("Enter a password with at most 128 characters.");
  return value;
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const supabase = await serverSupabase();
    const action = body.action;
    if (action === "logout") {
      const { error } = await supabase.auth.signOut();
      dbError(error);
      return response({ ok: true });
    }
    if (action === "update-password") {
      await authenticated();
      const password = passwordValue(body.password);
      if (password.length < 10)
        throw new ApiError("Use a password with at least 10 characters.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error)
        throw new ApiError(
          "We could not update your password. Please request a new reset link.",
        );
      return response({ ok: true });
    }
    const email = stringValue(body.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError("Enter a valid email address.");
    const appOrigin =
      process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    if (action === "reset-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${appOrigin}/auth/callback?next=/auth/reset`,
      });
      if (error)
        throw new ApiError(
          "We could not send a reset email. Please try again shortly.",
          429,
        );
      return response({
        ok: true,
        message:
          "If an account exists for this email, a reset link is on its way.",
      });
    }
    if (action !== "signup" && action !== "login")
      throw new ApiError("Choose a valid sign-in action.");
    const password = passwordValue(body.password);
    if (action === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.user)
        throw new ApiError(
          "We could not sign you in. Check your email and password, and confirm your email first.",
          401,
        );
      return response({
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          is_admin: data.user.app_metadata?.role === "admin",
        },
      });
    }
    if (password.length < 10)
      throw new ApiError("Use a password with at least 10 characters.");
    const fullName = stringValue(body.name, "Full name", 100);
    const memberType = body.member_type;
    const plan = body.plan;
    if (memberType !== "china" && memberType !== "global")
      throw new ApiError("Choose China or Global membership.");
    if (
      !(
        (memberType === "china" && plan === "china_yearly") ||
        (memberType === "global" &&
          (plan === "global_monthly" || plan === "trip_year"))
      )
    )
      throw new ApiError("Choose a valid membership plan.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${appOrigin}/auth/callback`,
        data: { full_name: fullName, member_type: memberType, plan },
      },
    });
    if (error?.code === "email_address_not_authorized")
      throw new ApiError(
        "Public registration is being prepared. Please contact the Ambro team or try again later.",
        503,
      );
    if (error)
      throw new ApiError(
        error.status === 429
          ? "Please wait before requesting another confirmation email."
          : "We could not create your account. Please try again or sign in if you already registered.",
        error.status === 429 ? 429 : 400,
      );
    return response(
      {
        ok: true,
        confirmation_required: !data.session,
        message: data.session
          ? "Your account is ready. Complete your profile and submit your membership reference."
          : "Check your email to confirm your account. Then sign in to complete your membership.",
      },
      201,
    );
  } catch (error) {
    return failure(error);
  }
}
