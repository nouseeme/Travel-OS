import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  return <Dashboard key={(path || ["home"]).join("/")} />;
}
