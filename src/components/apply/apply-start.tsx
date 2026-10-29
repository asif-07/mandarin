"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkTransitDates, EXIT_BY_TIME, MAX_STAY_NIGHTS, maxExitDate, MIN_PAX } from "@/lib/apply/shared";
import { formatDate, todayISO } from "@/lib/format";

const NATIONALITIES = ["Indian", "Emirati", "Pakistani", "Bangladeshi", "Sri Lankan", "Nepali", "Filipino", "Egyptian", "Saudi", "Omani", "Qatari", "Kuwaiti", "Bahraini", "British", "Other"];

/** Step 0 of the 144-hour transit visa application: who you are, when you expect to enter and exit, how many travel together. */
export function ApplyStart() {
  const router = useRouter();
  const today = todayISO();
  const [given, setGiven] = useState("");
  const [surname, setSurname] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("Indian");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pax, setPax] = useState("2");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxExit = start ? maxExitDate(start) : "";
  const dateProblem = start && end ? checkTransitDates(start, end) : null;
  const valid = given.trim() && surname.trim() && phone.trim().length >= 5 && start && end && !dateProblem && Number(pax) >= 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ given_name: given, surname, phone, email, nationality, travel_start_date: start, travel_end_date: end, pax: Number(pax), website }) });
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="a_given">Given name (as in passport) *</Label>
          <Input id="a_given" value={given} onChange={(e) => setGiven(e.target.value)} autoComplete="given-name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a_surname">Surname (as in passport) *</Label>
          <Input id="a_surname" value={surname} onChange={(e) => setSurname(e.target.value)} autoComplete="family-name" required />
        </div>
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
        <div className="space-y-1.5">
          <Label htmlFor="a_pax">How many persons travelling together? *</Label>
          <Input id="a_pax" type="number" inputMode="numeric" min={1} max={99} value={pax} onChange={(e) => setPax(e.target.value)} required />
          <p className="text-[11px] leading-snug text-mr-muted">Minimum {MIN_PAX} pax required to apply for the 144-hour group transit visa.{Number(pax) === 1 ? " Travelling alone? Apply anyway: we match you with another traveller on the same dates." : ""}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a_start">Expecting to enter China (date) *</Label>
          <Input
            id="a_start"
            type="date"
            min={today}
            value={start}
            onChange={(e) => {
              setStart(e.target.value);
              if (e.target.value && (!end || end < e.target.value || end > maxExitDate(e.target.value))) setEnd(maxExitDate(e.target.value));
            }}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a_end">Expecting to exit China (date) *</Label>
          <Input id="a_end" type="date" min={start || today} max={maxExit || undefined} value={end} onChange={(e) => setEnd(e.target.value)} required />
        </div>
      </div>
      {start && (
        <p className={dateProblem ? "text-sm text-mr-red" : "text-sm text-mr-body"}>
          {dateProblem ?? (
            <>
              Maximum stay in China is <strong>{MAX_STAY_NIGHTS} nights / {MAX_STAY_NIGHTS + 1} days</strong>, until the evening of the 6th day: with entry on {formatDate(start)} you must exit by <strong>{formatDate(maxExit)}, {EXIT_BY_TIME}</strong>.
            </>
          )}
        </p>
      )}
      <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
      {error && <p className="text-sm text-mr-red">{error}</p>}
      <Button type="submit" className="w-full sm:w-auto" disabled={!valid || pending}>
        {pending ? <Loader2 className="animate-spin" /> : <ArrowRight />} Continue to passport upload
      </Button>
      <p className="text-xs text-mr-muted">Next: upload your passport (front and back), tell us whether you have the Hong Kong PAR, then add your co-passengers or send them a link to fill in their own details.</p>
    </form>
  );
}
