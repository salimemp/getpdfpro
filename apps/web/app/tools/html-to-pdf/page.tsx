import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { HtmlToPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "HTML to PDF",
  description: "Convert HTML markup or a public URL to a PDF using the xhtml2pdf engine. ~80% fidelity.",
  alternates: { canonical: "/tools/html-to-pdf" },
  openGraph: {
    title: "HTML to PDF — GetPDFPro",
    description: "Convert HTML markup or a public URL to a PDF.",
    url: "/tools/html-to-pdf",
  },
};

export default function HTMLtoPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><HtmlToPdfTool /></main>
      <SiteFooter />
    </>
  );
}
