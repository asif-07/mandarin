import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { COMPANY } from "@/lib/constants";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const current = await getCurrentProfile();
  const supabase = await createClient();
  const [{ data: profiles }, { data: counters }] = await Promise.all([
    supabase.from("profiles").select("*").order("username"),
    supabase.from("counters").select("*").order("key"),
  ]);

  return (
    <>
      <PageHeader title="Settings" description="Workspace, team accounts and numbering." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Signed in as</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2">
              <dt className="text-mr-muted">Name</dt>
              <dd>{current?.profile?.display_name}</dd>
              <dt className="text-mr-muted">Username</dt>
              <dd>{current?.profile?.username}</dd>
              <dt className="text-mr-muted">Role</dt>
              <dd className="capitalize">{current?.profile?.role}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Company details on invoices</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-mr-body">
            <p className="font-medium text-mr-ink">{COMPANY.name}</p>
            <p>{COMPANY.addressLine1}</p>
            <p>{COMPANY.addressLine2}</p>
            <p>{COMPANY.addressLine3}</p>
            <p>{COMPANY.phone}</p>
            <p className="mt-3 text-xs text-mr-muted">
              Edit these in src/lib/constants.ts; they are not user-editable in v1.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-mr-line text-sm">
              {profiles?.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium text-mr-ink">{p.display_name}</span>
                    <span className="ml-2 text-mr-muted">@{p.username}</span>
                  </span>
                  <span className="rounded-md bg-mr-surface px-2 py-0.5 text-xs capitalize text-mr-body">{p.role}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-mr-muted">
              All accounts have full access in v1. Roles are stored so permissions can be enforced later.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Numbering counters</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-mr-line text-sm">
              {counters?.map((c) => (
                <li key={c.key} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-mr-body">{c.key}</span>
                  <span className="tnum font-medium text-mr-ink">{c.current_value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-mr-muted">Last issued values as of {formatDate(new Date())}.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
