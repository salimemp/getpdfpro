import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { RedactPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Redact PDF",
  description: "Remove text patterns from a PDF. Adobe tier = genuine redaction. Self-hosted fallback = blackout rectangles only.",
  alternates: { canonical: "/tools/redact" },
  openGraph: {
    title: "Redact PDF — GetPDFPro",
    description: "Redact text patterns from a PDF (genuine removal on Adobe, blackout on self-hosted).",
    url: "/tools/redact",
  },
};

export default function RedactPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><RedactPdfTool /></main>
      <SiteFooter />
    </>
  );
}
