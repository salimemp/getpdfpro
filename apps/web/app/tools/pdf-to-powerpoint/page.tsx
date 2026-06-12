import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PdfToPowerpointTool } from "@/components/OfficeTools";

export const metadata: Metadata = {
  title: "PDF to PowerPoint",
  description: "Convert a PDF to .pptx. Slide-by-slide layout via Adobe PDF Services.",
  alternates: { canonical: "/tools/pdf-to-powerpoint" },
  openGraph: {
    title: "PDF to PowerPoint — GetPDFPro",
    description: "Convert PDF to .pptx with Adobe PDF Services.",
    url: "/tools/pdf-to-powerpoint",
  },
};

export default function PDFtoPowerPointPage() {
  return (
    <>
      <SiteHeader />
      <main><PdfToPowerpointTool /></main>
      <SiteFooter />
    </>
  );
}
