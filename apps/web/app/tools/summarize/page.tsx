import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SummarizeTool } from "@/components/AiTools";

export const metadata: Metadata = {
  title: "AI Summarize PDF",
  description:
    "Get a concise summary of any PDF using Gemini AI. Pick a length (short, medium, long, bullets) and output language. Copy or download the result.",
  alternates: { canonical: "/tools/summarize" },
  openGraph: {
    title: "AI Summarize PDF — GetPDFPro",
    description: "Summarize any PDF with Gemini AI. Inline results, multiple lengths and languages.",
    url: "/tools/summarize",
  },
};

export default function SummarizePage() {
  return (
    <>
      <SiteHeader />
      <main><SummarizeTool /></main>
      <SiteFooter />
    </>
  );
}
