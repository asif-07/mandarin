/** Shared by the public form, the API and the CRM inbox (no server-only imports). */
export const ARRIVAL_STATUSES = [
  { value: "new", label: "New" },
  { value: "replied", label: "Replied" },
  { value: "confirmed", label: "Confirmed" },
  { value: "closed", label: "Closed" },
] as const;

export type ArrivalRequestRow = {
  id: string;
  ref: string;
  token: string;
  partner_code: string;
  arrival_date: string;
  arrival_time: string;
  airline_flight: string;
  pax: number;
  agent_name: string | null;
  agent_phone: string | null;
  agent_notes: string | null;
  status: string;
  admin_reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  group_id: string | null;
  created_at: string;
  group_ref?: string | null;
};

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
