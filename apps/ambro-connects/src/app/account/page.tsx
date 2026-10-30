import Account from "@/components/account";
import { Suspense } from "react";

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="container ac-page">
          <p role="status">Loading your profile…</p>
        </div>
      }
    >
      <Account />
    </Suspense>
  );
}
