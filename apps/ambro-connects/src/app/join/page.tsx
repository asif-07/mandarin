import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; plan?: string }>;
}) {
  const query = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="loading-state">Getting your membership options…</div>
      }
    >
      <AuthForm key={`${query.type}-${query.plan}`} mode="join" />
    </Suspense>
  );
}
