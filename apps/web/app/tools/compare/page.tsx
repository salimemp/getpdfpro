import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ComparePdfsTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Compare PDF",
  description: "Compare two PDFs and get a difference report. Adobe = visual diff. Self-hosted = text-only word set diff.",
  alternates: { canonical: "/tools/compare" },
  openGraph: {
    title: "Compare PDF — GetPDFPro",
    description: "Compare two PDFs and get a difference report (JSON).",
    url: "/tools/compare",
  },
};

export default function ComparePDFPage() {
  return (
    <>
      <SiteHeader />
      <main><ComparePdfsTool /></main>
      <SiteFooter />
    </>
  );
}
