"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plane, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MONTHS } from "@/lib/arrivals/shared";

type Partner = { code: string; name: string | null };

/** Public form: Hong Kong group arrival details for the airport transfer. Month and day pickers, year defaults to the current year. */
export function ArrivalForm({ partners, presetPartner }: { partners: Partner[]; presetPartner?: string | null }) {
  const now = new Date();
  const [partner, setPartner] = useState(presetPartner && partners.some((p) => p.code === presetPartner) ? presetPartner : "");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [flight, setFlight] = useState("");
  const [time, setTime] = useState("");
  const [pax, setPax] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [website, setWebsite] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; token: string } | null>(null);

  const daysIn = month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const date = month && day ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` : "";
  const valid = partner && date && flight.trim().length >= 2 && /^\d{2}:\d{2}$/.test(time) && Number(pax) > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/arrivals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ partner_code: partner, arrival_date: date, airline_flight: flight, arrival_time: time, pax: Number(pax), agent_name: name, agent_phone: phone, agent_notes: notes, website }) });
      const body = (await res.json().catch(() => ({}))) as { error?: string; ref?: string; token?: string };
      if (!res.ok || !body.ref) return void setError(body.error ?? "Could not send. Please try again.");
      setDone({ ref: body.ref, token: body.token ?? "" });
    } catch {
      setError("No connection. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-lg border border-mr-success/40 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto size-10 text-mr-success" />
        <p className="mt-3 font-heading text-lg font-semibold">Arrival details received</p>
        <p className="mt-1 text-sm text-mr-body">
          Reference <span className="font-mono font-semibold">{done.ref}</span>. China Travel Support will reply with the transfer arrangement.
        </p>
        {done.token && (
          <p className="mt-4 text-sm">
            Keep this link to see the reply:{" "}
            <Link href={`/arrivals/t/${done.token}`} className="break-all font-medium underline">
              {typeof window !== "undefined" ? `${window.location.origin}/arrivals/t/${done.token}` : `/arrivals/t/${done.token}`}
            </Link>
          </p>
        )}
        <Button type="button" variant="outline" className="mt-5" onClick={() => (setDone(null), setFlight(""), setTime(""), setPax(""), setNotes(""))}>
          <Plane /> Send another arrival
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-lg border border-mr-line bg-white p-5">
      <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ar_partner">Partner code</Label>
          <Select value={partner} onValueChange={setPartner}>
            <SelectTrigger id="ar_partner" className="h-11 w-full rounded-lg">
              <SelectValue placeholder="Choose your partner code" />
            </SelectTrigger>
            <SelectContent>
              {partners.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.code}
                  {p.name ? ` · ${p.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Arrival date (Hong Kong)</Label>
          <div className="grid grid-cols-[1fr_90px_110px] gap-2">
            <Select value={month} onValueChange={(v) => (setMonth(v), day && Number(day) > new Date(Number(year), Number(v), 0).getDate() && setDay(""))}>
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: daysIn }, (_, i) => String(i + 1)).map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-11 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar_flight">Airline &amp; flight number</Label>
          <Input id="ar_flight" value={flight} onChange={(e) => setFlight(e.target.value.toUpperCase())} placeholder="Emirates EK 380" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar_time">Arrival time</Label>
          <Input id="ar_time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar_pax">Number of passengers</Label>
          <Input id="ar_pax" type="number" inputMode="numeric" min={1} max={999} value={pax} onChange={(e) => setPax(e.target.value)} placeholder="8" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar_name">Your name (optional)</Label>
          <Input id="ar_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent / agency name" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar_phone">WhatsApp / phone (optional)</Label>
          <Input id="ar_phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971…" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ar_notes">Notes (optional)</Label>
          <Textarea id="ar_notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything we should know" />
        </div>
        <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden name="website" />
      </fieldset>
      {error && <p className="text-sm text-mr-red">{error}</p>}
      <Button type="submit" className="h-11 w-full text-base" disabled={pending || !valid}>
        {pending ? <Loader2 className="animate-spin" /> : <Send />} Send arrival details
      </Button>
    </form>
  );
}
