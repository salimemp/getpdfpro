import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PdfToPdfATool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Convert PDF to PDF/A",
  description: "Convert a PDF to PDF/A-2b (archival format). Embeds fonts, normalizes color, and writes XMP metadata.",
  alternates: { canonical: "/tools/pdf-to-pdfa" },
  openGraph: {
    title: "Convert PDF to PDF/A — GetPDFPro",
    description: "Convert a PDF to PDF/A-2b archival format.",
    url: "/tools/pdf-to-pdfa",
  },
};

export default function ConvertToPdfAPage() {
  return (
    <>
      <SiteHeader />
      <main><PdfToPdfATool /></main>
      <SiteFooter />
    </>
  );
}
