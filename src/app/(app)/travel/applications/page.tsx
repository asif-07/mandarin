import { redirect } from "next/navigation";

/** The applications page moved out of the Travel tabs to its own section. */
export default function ApplicationsRedirect() {
  redirect("/visa");
}
