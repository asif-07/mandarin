"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayISO } from "@/lib/format";

const NATIONALITIES = ["Indian", "Emirati", "Pakistani", "Bangladeshi", "Sri Lankan", "Nepali", "Filipino", "Egyptian", "Saudi", "Omani", "Qatari", "Kuwaiti", "Bahraini", "British", "Other"];

/** Step 0 of the customer portal: who travels and when. Creates the application and opens the private link. */
export function ApplyStart() {
  const router = useRouter();
  const today = todayISO();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= 2 && phone.trim().length >= 5 && start && end && end >= start;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ full_name: name, phone, email, nationality, travel_start_date: start, travel_end_date: end, website }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; token?: string };
      if (!res.ok || !body.token) return void setError(body.error ?? "Could not start. Please try again.");
      router.push(`/apply/t/${body.token}`);
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-mr-line bg-white p-5" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="a_name">Full name (as in passport) *</Label>
        <Input id="a_name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a_phone">Phone (WhatsApp) with country code *</Label>
          <Input id="a_phone" type="tel" inputMode="tel" placeholder="+971 50 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a_email">Email</Label>
          <Input id="a_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a_nat">Nationality</Label>
          <Select value={nationality} onValueChange={setNationality}>
            <SelectTrigger id="a_nat" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NATIONALITIES.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div />
        <div className="space-y-1.5">
          <Label htmlFor="a_start">Entry into China (date) *</Label>
          <Input
            id="a_start"
            type="date"
            min={today}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (!end || end < e.target.value) setEnd(e.target.value);
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a_end">Exit from China (date) *</Label>
          <Input id="a_end" type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      {error && <p className="text-sm text-mr-red">{error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={!valid || pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Continue to passport upload
      </Button>
      <p className="text-xs text-mr-muted">The group visa for China needs at least two travellers. Travelling alone? Apply anyway: we match you with another traveller on the same dates.</p>
    </form>
  );
}
