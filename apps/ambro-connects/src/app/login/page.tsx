import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
export default function Login() {
  return (
    <Suspense fallback={<div className="loading-state">Loading sign in…</div>}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
