import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { TranslateTool } from "@/components/AiTools";

export const metadata: Metadata = {
  title: "AI Translate PDF",
  description:
    "Translate a PDF into any language using Gemini AI. Output as a new PDF (page count preserved) or plain text. 12+ languages supported.",
  alternates: { canonical: "/tools/translate" },
  openGraph: {
    title: "AI Translate PDF — GetPDFPro",
    description: "Translate any PDF with Gemini AI. New PDF or plain text output.",
    url: "/tools/translate",
  },
};

export default function TranslatePage() {
  return (
    <>
      <SiteHeader />
      <main><TranslateTool /></main>
      <SiteFooter />
    </>
  );
}
