import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ExtractPagesTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Extract Pages",
  description: "Pull specific pages from a PDF into a new PDF. Use for 'give me just chapter 3' or 'extract the cover'.",
  alternates: { canonical: "/tools/extract-pages" },
  openGraph: {
    title: "Extract Pages — GetPDFPro",
    description: "Extract specific pages from a PDF into a new PDF.",
    url: "/tools/extract-pages",
  },
};

export default function ExtractPagesPage() {
  return (
    <>
      <SiteHeader />
      <main><ExtractPagesTool /></main>
      <SiteFooter />
    </>
  );
}
