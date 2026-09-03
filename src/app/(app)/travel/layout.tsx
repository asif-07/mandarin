import { TravelNav } from "@/components/travel/travel-nav";

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TravelNav />
      {children}
    </>
  );
}
