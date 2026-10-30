import { MemberProfile } from "@/components/member-profile";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MemberProfile id={id} />;
}
