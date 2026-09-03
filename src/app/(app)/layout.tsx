import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentProfile();
  if (!current) redirect("/login");

  const profile = current.profile ?? {
    id: current.user.id,
    username: current.user.email?.split("@")[0] ?? "user",
    display_name: current.user.email?.split("@")[0] ?? "User",
    role: "sales",
    created_at: null,
  };

  return <AppShell profile={profile}>{children}</AppShell>;
}
