import { STANDARD_BORDER } from "@/lib/constants";

/**
 * Submission rules from the B2B requirements. Pure functions so the portal
 * form can show them live and the server can enforce them on submit.
 */
export type FlightInput = {
  travel_date: string; // China entry date (yyyy-mm-dd)
  travel_end_date: string; // China exit date
  arrival_flight_date: string | null;
  arrival_flight_time: string | null; // HH:MM
  departure_flight_date: string | null;
  departure_flight_time: string | null;
  entry_port: string;
  exit_port: string;
  other_border_requested: boolean;
};

export type RuleResult = { blockers: string[]; warnings: string[]; infos: string[] };

const minutes = (hhmm: string | null): number | null => {
  const m = hhmm?.match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

export const ARRIVAL_AFTER_4PM =
  "Same-Day China Entry Not Possible. The flight arrives after 4:00 PM on the selected entry date. Travellers will need to stay in Hong Kong and enter China the following day. Please change the entry date or flight arrangement before submitting the group.";
export const DEPARTURE_BEFORE_2PM =
  "Departure Flight Timing Not Recommended. Please book a late-evening flight or a flight on the following day and allow sufficient time to exit China, reach Hong Kong, and complete the airport journey.";
export const HK_STAY_REQUIRED =
  "Hong Kong Stay Required. Please ensure the travellers have a valid hotel booking in Hong Kong, a valid return/onward flight ticket, and sufficient time to complete re-entry into Hong Kong and travel to the airport.";

export function checkSubmission(v: FlightInput): RuleResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  if (!v.other_border_requested) {
    if (v.entry_port.trim().toLowerCase() !== STANDARD_BORDER.toLowerCase() || v.exit_port.trim().toLowerCase() !== STANDARD_BORDER.toLowerCase()) {
      blockers.push(`Entry and exit port must be ${STANDARD_BORDER} for the normal process. Use "Request other border" for any other crossing.`);
    }
  } else if (!v.entry_port.trim() || !v.exit_port.trim()) {
    blockers.push("Enter the requested entry and exit border.");
  }

  if (!v.arrival_flight_date || !v.arrival_flight_time) blockers.push("Enter the Hong Kong arrival flight date and time.");
  else {
    const t = minutes(v.arrival_flight_time);
    if (v.arrival_flight_date === v.travel_date && t !== null && t > 16 * 60) blockers.push(ARRIVAL_AFTER_4PM);
    if (v.arrival_flight_date > v.travel_date) blockers.push("The arrival flight lands after the China entry date. Change the entry date or the flight.");
  }

  if (!v.departure_flight_date || !v.departure_flight_time) blockers.push("Enter the departure flight date and time.");
  else {
    const t = minutes(v.departure_flight_time);
    if (v.departure_flight_date === v.travel_end_date && t !== null && t < 14 * 60) blockers.push(DEPARTURE_BEFORE_2PM);
    if (v.departure_flight_date < v.travel_end_date) blockers.push("The departure flight leaves before the China exit date. Change the exit date or the flight.");
    if (v.departure_flight_date > v.travel_end_date) infos.push(HK_STAY_REQUIRED);
  }

  if (v.travel_end_date < v.travel_date) blockers.push("Exit date must be on or after the entry date.");
  return { blockers, warnings, infos };
}
