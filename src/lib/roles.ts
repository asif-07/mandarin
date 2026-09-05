/** Role helpers safe to import from client components (no server-only deps). */
export function isAdmin(profile: { role: string } | null | undefined): boolean {
  return profile?.role === "admin";
}
