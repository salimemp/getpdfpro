import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PowerpointToPdfTool } from "@/components/OfficeTools";

export const metadata: Metadata = {
  title: "PowerPoint to PDF",
  description: "Convert a .pptx file to PDF. Slides, notes, and images preserved.",
  alternates: { canonical: "/tools/powerpoint-to-pdf" },
  openGraph: {
    title: "PowerPoint to PDF — GetPDFPro",
    description: "Convert .pptx to PDF with Adobe PDF Services.",
    url: "/tools/powerpoint-to-pdf",
  },
};

export default function PowerPointtoPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><PowerpointToPdfTool /></main>
      <SiteFooter />
    </>
  );
}
