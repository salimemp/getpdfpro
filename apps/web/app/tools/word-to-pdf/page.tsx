import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { WordToPdfTool } from "@/components/OfficeTools";

export const metadata: Metadata = {
  title: "Word to PDF",
  description: "Convert a .docx file to PDF. Fonts, layout, and images preserved.",
  alternates: { canonical: "/tools/word-to-pdf" },
  openGraph: {
    title: "Word to PDF — GetPDFPro",
    description: "Convert .docx to PDF with Adobe PDF Services.",
    url: "/tools/word-to-pdf",
  },
};

export default function WordtoPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><WordToPdfTool /></main>
      <SiteFooter />
    </>
  );
}
