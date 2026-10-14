import { SharedTrip } from "@/components/shared-trip";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedTrip token={token} />;
}
