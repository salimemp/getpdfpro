import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ExtractTablesTool } from "@/components/ExtractTablesTool";

export const metadata: Metadata = {
  title: "Extract Tables from PDF — CSV or JSON",
  description:
    "Pull every table out of a PDF as CSV or JSON. Uses PyMuPDF's find_tables — fast, self-hosted, free. Best on native (born-digital) PDFs from Excel, Word, or Google Docs.",
  alternates: { canonical: "/tools/extract-tables" },
  openGraph: {
    title: "Extract Tables from PDF — GetPDFPro",
    description:
      "Self-hosted PDF table extraction. CSV or JSON output. Up to 50 MB.",
    url: "/tools/extract-tables",
  },
};

export default function ExtractTablesPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ExtractTablesTool />
      </main>
      <SiteFooter />
    </>
  );
}
