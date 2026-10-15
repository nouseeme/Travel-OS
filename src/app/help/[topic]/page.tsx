import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticle } from "@/components/help-article";
import { HelpFrame, HelpGate } from "@/components/help-frame";
import { getHelpAccess } from "@/lib/help-access";
import { helpSections } from "@/lib/help-content";
import "../help.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Panduan penggunaan · Egimu Travel",
};
export default async function HelpTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  // Check every article, including direct URL and RSC requests.
  const access = await getHelpAccess();
  if (access !== "allowed") return <HelpGate access={access} />;
  const { topic } = await params;
  if (!helpSections.some((section) => section.id === topic)) notFound();
  return (
    <HelpFrame>
      <HelpArticle sectionId={topic} />
    </HelpFrame>
  );
}
