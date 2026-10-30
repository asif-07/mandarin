import { Suspense } from "react";
import { Discover } from "@/components/discover";
export default function Page() {
  return (
    <Suspense
      fallback={<div className="loading-state">Loading your network…</div>}
    >
      <Discover />
    </Suspense>
  );
}
