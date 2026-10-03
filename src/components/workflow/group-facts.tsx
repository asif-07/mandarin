import { STANDARD_BORDER, TRANSFER_MODES, labelFor } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/format";
import type { WorkflowGroup } from "@/lib/workflow/data";

function Row({ k, v, warn }: { k: string; v: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs text-mr-muted">{k}</dt>
      <dd className={warn ? "text-right text-sm font-semibold text-mr-warning" : "text-right text-sm font-medium text-mr-ink"}>{v}</dd>
    </div>
  );
}

/** The submission and ground-operations facts of a group, the same on every side. */
export function GroupFacts({ g, section = "all" }: { g: WorkflowGroup; section?: "all" | "trip" | "ground" }) {
  const trip = (
    <dl className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white px-4">
      <Row k="Group ID" v={<span className="font-mono text-xs">{g.group_ref}</span>} />
      <Row k="Pax" v={g.pax_expected ?? g.traveller_count ?? "—"} />
      <Row k="China entry" v={formatDate(g.travel_date)} />
      <Row k="China exit" v={formatDate(g.travel_end_date)} />
      <Row k="Entry port" v={g.entry_port ?? "—"} warn={g.other_border_requested} />
      <Row k="Exit port" v={g.exit_port ?? "—"} warn={g.other_border_requested} />
      {g.other_border_requested && <Row k="Border request" v={`Other border requested${g.other_border_note ? ` · ${g.other_border_note}` : ""} (normal flow is ${STANDARD_BORDER})`} warn />}
      <Row k="Arrival flight (HK)" v={g.arrival_flight_date ? `${formatDate(g.arrival_flight_date)} ${g.arrival_flight_time ?? ""}${g.arrival_flight_no ? ` · ${g.arrival_flight_no}` : ""}` : "—"} />
      <Row k="Departure flight" v={g.departure_flight_date ? `${formatDate(g.departure_flight_date)} ${g.departure_flight_time ?? ""}${g.departure_flight_no ? ` · ${g.departure_flight_no}` : ""}` : "—"} />
      {g.label && <Row k="Label" v={g.label} />}
      {g.notes && <Row k="Notes" v={g.notes} />}
      {g.company_decision_note && <Row k="Company note" v={g.company_decision_note} />}
    </dl>
  );
  const ground = (
    <dl className="divide-y divide-mr-line rounded-lg border border-mr-line bg-white px-4">
      <Row k="Assigned guide" v={g.guide?.name ?? g.guide_name ?? "Not assigned"} />
      <Row k="Guide contact" v={g.guide?.phone ?? g.guide_phone ?? "—"} />
      {(g.guide?.role || g.guide?.languages) && <Row k="Role / languages" v={[g.guide?.role, g.guide?.languages].filter(Boolean).join(" · ")} />}
      {(g.guide_notes || g.guide?.notes) && <Row k="Operational notes" v={g.guide_notes ?? g.guide?.notes} />}
      <Row k="Entry date" v={g.china_entry_at ? formatDateTime(g.china_entry_at) : formatDate(g.travel_date)} />
      <Row k="Entry border" v={g.entry_port ?? "—"} />
      <Row k="Destination" v={g.destination ?? "—"} />
      <Row k="Transfer / vehicle" v={g.vehicle_notes ?? "—"} />
      <Row k="Exit date" v={g.china_exit_at ? formatDateTime(g.china_exit_at) : formatDate(g.travel_end_date)} />
      <Row k="Exit border" v={g.exit_port ?? "—"} />
      <Row k="Stamped visa" v={g.stamped_visa_uploaded_at ? `Uploaded ${formatDateTime(g.stamped_visa_uploaded_at)}${g.stamped_visa_uploaded_by ? ` by ${g.stamped_visa_uploaded_by}` : ""}` : "Not uploaded"} />
      {g.china_entry_confirmed_by && <Row k="Entry confirmed by" v={g.china_entry_confirmed_by} />}
      {g.china_exit_confirmed_by && <Row k="Exit confirmed by" v={g.china_exit_confirmed_by} />}
    </dl>
  );
  void TRANSFER_MODES;
  void labelFor;
  if (section === "trip") return trip;
  if (section === "ground") return ground;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <p className="micro-label mb-1">Trip</p>
        {trip}
      </div>
      <div>
        <p className="micro-label mb-1">Ground operations</p>
        {ground}
      </div>
    </div>
  );
}
