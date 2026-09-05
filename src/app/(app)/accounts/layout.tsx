import Link from "next/link";
import { Lock } from "lucide-react";
import { AccountsNav } from "@/components/accounts/accounts-nav";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentProfile, isAdmin } from "@/lib/auth";

/**
 * Accounts is admin-only (ambro, asif). The database enforces the same rule
 * through RLS, so this gate only decides what the UI shows.
 */
export default async function AccountsLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentProfile();
  if (!isAdmin(current?.profile)) {
    return (
      <>
        <PageHeader title="Accounts" />
        <EmptyState
          icon={Lock}
          title="Accounts is only available to admin users."
          action={
            <Link href="/" className={buttonVariants({ variant: "outline" })}>
              Back to dashboard
            </Link>
          }
        />
      </>
    );
  }
  return (
    <>
      <AccountsNav />
      {children}
    </>
  );
}
