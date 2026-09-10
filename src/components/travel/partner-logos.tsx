"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ImagePlus, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { removePartnerLogo, savePartner, setPartnerLogo, type PartnerRow } from "@/lib/actions/travel-groups";
import { BUCKETS } from "@/lib/constants";

type PartnerWithUrl = PartnerRow & { logo_url: string | null };

function PartnerLine({ partner }: { partner: PartnerWithUrl }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(partner.name ?? "");
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

  function saveName() {
    if ((partner.name ?? "") === name.trim()) return;
    startTransition(async () => {
      const res = await savePartner({ code: partner.code, name });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-mr-line bg-white">
        {partner.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partner.logo_url} alt={`${partner.code} logo`} className="max-h-full max-w-full object-contain" />
        ) : (
          <Building2 className="size-5 text-mr-muted" />
        )}
      </div>
      <span className="w-16 shrink-0 font-mono text-sm font-semibold text-mr-ink">{partner.code}</span>
      <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} placeholder="Partner name (printed when there is no logo)" className="min-w-[180px] flex-1" disabled={pending} />
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          onLogo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />} {partner.logo_path ? "Replace logo" : "Add logo"}
      </Button>
      {partner.logo_path && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove logo"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await removePartnerLogo(partner.code);
              if (!res.ok) return void toast.error(res.error);
              router.refresh();
            })
          }
        >
          <X />
        </Button>
      )}
    </li>
  );
}

export function PartnerLogosCard({ partners }: { partners: PartnerWithUrl[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState("");

  function add() {
    startTransition(async () => {
      const res = await savePartner({ code });
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${code.toUpperCase()} added`);
      setCode("");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partners</CardTitle>
        <p className="text-xs text-mr-muted">A partner is created automatically the first time you upload a pack with their code. Add a PNG logo here and it is printed on the first page of their downloads instead of the Mandarin Roots logo.</p>
      </CardHeader>
      <CardContent>
        {partners.length === 0 ? <p className="text-sm text-mr-muted">No partners yet.</p> : <ul className="divide-y divide-mr-line">{partners.map((p) => <PartnerLine key={p.id} partner={p} />)}</ul>}
        <div className="mt-3 flex items-center gap-2">
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="New partner code, e.g. EDPT" className="max-w-[220px] font-mono" disabled={pending} />
          <Button variant="outline" size="sm" onClick={add} disabled={pending || !code.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <Plus />} Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
