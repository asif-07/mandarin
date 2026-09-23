"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { removePartnerLogo, savePartner, setPartnerLogo, type PartnerRow } from "@/lib/actions/travel-groups";
import { BUCKETS } from "@/lib/constants";

type PartnerWithUrl = PartnerRow & { logo_url: string | null };

/** One partner: logo, code, and the contact details that fill invoices and covers. Fields save on blur. */
function PartnerLine({ partner }: { partner: PartnerWithUrl }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: partner.name ?? "", phone: partner.phone ?? "", email: partner.email ?? "", address: partner.address ?? "" });
  const ref = useRef<HTMLInputElement>(null);

  async function onLogo(f: File | undefined) {
    if (!f) return;
    if (!/image\/(png|jpeg)/.test(f.type)) return void toast.error("Use a PNG or JPG logo");
    if (f.size > 5 * 1024 * 1024) return void toast.error("Logo must be under 5 MB");
    setBusy(true);
    try {
      const supabase = createClient();
      const ext = f.type === "image/png" ? "png" : "jpg";
      const path = `${partner.code}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKETS.partnerLogos).upload(path, f, { contentType: f.type, upsert: false });
      if (error) throw new Error(error.message);
      const res = await setPartnerLogo(partner.code, path, f.name);
      if (!res.ok) throw new Error(res.error);
      toast.success(`${partner.code} logo saved`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the logo");
    } finally {
      setBusy(false);
    }
  }

  function save(field: keyof typeof form) {
    const current = (partner[field] ?? "").trim();
    if (current === form[field].trim()) return;
    startTransition(async () => {
      const res = await savePartner({ code: partner.code, [field]: form[field] });
      if (!res.ok) return void toast.error(res.error);
      router.refresh();
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-mr-line bg-white">
          {partner.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.logo_url} alt={`${partner.code} logo`} className="max-h-full max-w-full object-contain" />
          ) : (
            <Building2 className="size-4 text-mr-muted" />
          )}
        </div>
        <span className="w-14 shrink-0 font-mono text-sm font-semibold text-mr-ink">{partner.code}</span>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => save("name")} placeholder="Partner name" className="min-w-0 flex-1" disabled={pending} />
        <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()} title={partner.logo_path ? "Replace logo" : "Add logo (printed on their covers)"}>
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        </Button>
        {partner.logo_path && (
          <Button variant="ghost" size="icon-sm" aria-label="Remove logo" disabled={pending} onClick={() => startTransition(async () => { const res = await removePartnerLogo(partner.code); if (!res.ok) return void toast.error(res.error); router.refresh(); })}>
            <X />
          </Button>
        )}
      </div>
      <div className="mt-2 grid gap-2 pl-[52px] sm:grid-cols-3">
        <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} onBlur={() => save("phone")} placeholder="Phone" inputMode="tel" disabled={pending} />
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => save("email")} placeholder="Email" type="email" disabled={pending} />
        <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} onBlur={() => save("address")} placeholder="Address / city" disabled={pending} />
      </div>
    </li>
  );
}

/** Compact "Partners" button opening a dialog to add partners and keep their logo and contact details. */
export function PartnersButton({ partners }: { partners: PartnerWithUrl[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  function add() {
    startTransition(async () => {
      const res = await savePartner({ code, name });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${code.toUpperCase()} added`);
      setCode("");
      setName("");
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Building2 /> Partners{partners.length ? ` (${partners.length})` : ""}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Partners</DialogTitle>
            <DialogDescription>
              Partners appear in the group and invoice dropdowns. Name, phone, email and address fill the invoice; the logo is printed on their covers once the visa is received. A partner is also created automatically the first time a pack is uploaded with their code.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-mr-line bg-mr-surface p-3">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code, e.g. EDPT" className="w-[150px] font-mono" disabled={pending} />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner name" className="min-w-[160px] flex-1" disabled={pending} />
            <Button size="sm" onClick={add} disabled={pending || !code.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add partner
            </Button>
          </div>
          <div className="max-h-[55vh] overflow-y-auto">
            {partners.length === 0 ? <p className="py-4 text-sm text-mr-muted">No partners yet.</p> : <ul className="divide-y divide-mr-line">{partners.map((p) => <PartnerLine key={p.id} partner={p} />)}</ul>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
