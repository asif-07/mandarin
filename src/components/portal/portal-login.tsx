"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Access-key sign-in used by the partner portal and the visa team extension. */
export function PortalLogin({ url, title, description, next }: { url: string; title: string; description: string; next?: string }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ key }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return void setError(body.error ?? "Sign-in failed");
      router.replace(next ?? window.location.pathname);
      router.refresh();
    } catch {
      setError("No connection. Check your network and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-md rounded-lg border border-mr-line bg-white p-5">
      <p className="font-heading text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-mr-body">{description}</p>
      <div className="mt-4 space-y-1.5">
        <Label htmlFor="portal-key">Access key</Label>
        <Input id="portal-key" value={key} onChange={(e) => setKey(e.target.value.toUpperCase())} placeholder="CTS-XXXXXXXX-XXXXXXXX-XXXXXXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="h-11 font-mono text-base" />
      </div>
      {error && <p className="mt-2 text-sm text-mr-red">{error}</p>}
      <Button type="submit" className="mt-4 h-11 w-full text-base" disabled={pending || key.trim().length < 12}>
        {pending ? <Loader2 className="animate-spin" /> : <KeyRound />} Sign in
      </Button>
    </form>
  );
}
