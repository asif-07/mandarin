import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Profile = Tables<"profiles">;

/**
 * Current user + profile for the request. Cached per request so layouts and
 * pages can both call it without duplicate round trips.
 */
export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return { user, profile: profile ?? null };
});

/** Use in server actions and route handlers: returns the profile or redirects to /login. */
export async function requireProfile() {
  const current = await getCurrentProfile();
  if (!current?.profile) redirect("/login");
  return current.profile;
}
