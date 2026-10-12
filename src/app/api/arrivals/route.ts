import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { newArrivalRef, newArrivalToken } from "@/lib/arrivals/server";
import { notify } from "@/lib/workflow/engine";
import { formatDate } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  partner_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,12}$/, "Choose the partner code"),
  arrival_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the arrival date"),
  airline_flight: z.string().trim().min(2, "Enter the airline and flight number").max(80),
  arrival_time: z.string().regex(/^\d{2}:\d{2}$/, "Enter the arrival time"),
  pax: z.coerce.number().int().positive("Number of passengers").max(999),
  agent_name: z.string().trim().max(120).optional().nullable().transform((v) => v || null),
  agent_phone: z.string().trim().max(40).optional().nullable().transform((v) => v || null),
  agent_notes: z.string().trim().max(1000).optional().nullable().transform((v) => v || null),
  website: z.string().optional(), // honeypot
});

/** POST — public submission of Hong Kong group arrival details (no login). Notifies CTS. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Please check the details" }, { status: 400 });
  const v = parsed.data;
  if (v.website) return NextResponse.json({ ok: true, ref: "HKA-OK", token: "" }); // bots fill the hidden field
  const supabase = createAdminClient();
  const { data: partner } = await supabase.from("b2b_partners").select("code, name").eq("code", v.partner_code).maybeSingle();
  if (!partner) return NextResponse.json({ error: "Unknown partner code" }, { status: 400 });
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = newArrivalRef(v.arrival_date);
    const token = newArrivalToken();
    const { data, error } = await supabase
      .from("arrival_requests")
      .insert({ ref, token, partner_code: partner.code, arrival_date: v.arrival_date, arrival_time: v.arrival_time, airline_flight: v.airline_flight, pax: v.pax, agent_name: v.agent_name, agent_phone: v.agent_phone, agent_notes: v.agent_notes })
      .select("id, ref, token")
      .single();
    if (!error && data) {
      await notify(supabase, [{ audience: "company" }], null, `Arrival details: ${partner.code} · ${formatDate(v.arrival_date)} ${v.arrival_time} · ${v.pax} pax`, `${v.airline_flight}${v.agent_name ? ` · from ${v.agent_name}` : ""}${v.agent_phone ? ` (${v.agent_phone})` : ""} · ref ${data.ref}`);
      return NextResponse.json({ ok: true, ref: data.ref, token: data.token });
    }
    if (error?.code !== "23505") return NextResponse.json({ error: error?.message ?? "Could not save" }, { status: 500 });
  }
  return NextResponse.json({ error: "Could not save, please try again" }, { status: 500 });
}
