import type { Metadata } from "next";
import { UsageGuide } from "@/components/usage-guide";

export const metadata: Metadata = {
  title: "How to use",
  description:
    "A practical guide to Ambro Connects: administrator access, profile and membership approvals, joining the network and making connections.",
};

export default function HowToUsePage() {
  return <UsageGuide />;
}
