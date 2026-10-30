import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export default function Reset() {
  return (
    <Suspense
      fallback={<div className="loading-state">Loading password reset…</div>}
    >
      <AuthForm mode="reset" />
    </Suspense>
  );
}
