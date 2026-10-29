"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ApplicationKind } from "@/lib/apply/shared";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

const NATIONALITIES = ["Indian", "Emirati", "Pakistani", "Bangladeshi", "Sri Lankan", "Nepali", "Filipino", "Egyptian", "Saudi", "Omani", "Qatari", "Kuwaiti", "Bahraini", "British", "Other"];

/** Step 0: who is uploading (a traveller or a travel agent for a group) and when the trip is. Opens the private link. */
export function ApplyStart({ initialKind = "b2c" }: { initialKind?: ApplicationKind }) {
  const router = useRouter();
  const today = todayISO();
  const [kind, setKind] = useState<ApplicationKind>(initialKind);
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = name.trim().length >= 2 && phone.trim().length >= 5 && start && end && end >= start && (kind === "b2c" || agency.trim().length >= 2);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, contact_name: name, agency_name: agency, phone, email, nationality, travel_start_date: start, travel_end_date: end, website }) });
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
      <div className="grid gap-2 sm:grid-cols-2">
        <KindButton active={kind === "b2c"} onClick={() => setKind("b2c")} icon={<User className="size-4" />} title="I am travelling" hint="Upload your own documents, and add family or friends travelling with you." />
        <KindButton active={kind === "b2b"} onClick={() => setKind("b2b")} icon={<Building2 className="size-4" />} title="I am a travel agent" hint="Bulk upload the documents of a whole group. No partner code needed." />
      </div>
      {kind === "b2b" && (
        <div className="space-y-1.5">
          <Label htmlFor="a_agency">Agency name *</Label>
          <Input id="a_agency" value={agency} onChange={(e) => setAgency(e.target.value)} autoComplete="organization" required />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="a_name">{kind === "b2b" ? "Contact person *" : "Full name (as in passport) *"}</Label>
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
          <Label htmlFor="a_nat">{kind === "b2b" ? "Nationality of the group" : "Nationality"}</Label>
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
        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} {kind === "b2b" ? "Continue to bulk upload" : "Continue to passport upload"}
      </Button>
      <p className="text-xs text-mr-muted">{kind === "b2b" ? "Drop all the passports at once: we read each one and create the passenger list for you. Then add photos and PAN cards." : "The group visa for China needs at least two travellers. Travelling alone? Apply anyway: we match you with another traveller on the same dates."}</p>
    </form>
  );
}

function KindButton({ active, onClick, icon, title, hint }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; hint: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors", active ? "border-mr-ink bg-mr-surface" : "border-mr-line hover:bg-mr-surface")} aria-pressed={active}>
      <span className={cn("mt-0.5 rounded-md p-1.5", active ? "bg-mr-ink text-white" : "bg-mr-surface text-mr-body")}>{icon}</span>
      <span>
        <span className="block font-medium text-mr-ink">{title}</span>
        <span className="block text-xs text-mr-muted">{hint}</span>
      </span>
    </button>
  );
}
