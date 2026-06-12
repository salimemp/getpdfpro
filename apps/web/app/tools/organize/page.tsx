import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { OrganizePdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Organize PDF",
  description: "Reorder the pages of a PDF. Pages can appear multiple times (to duplicate) or be omitted (to remove).",
  alternates: { canonical: "/tools/organize" },
  openGraph: {
    title: "Organize PDF — GetPDFPro",
    description: "Reorder and/or duplicate pages in a PDF.",
    url: "/tools/organize",
  },
};

export default function OrganizePDFPage() {
  return (
    <>
      <SiteHeader />
      <main><OrganizePdfTool /></main>
      <SiteFooter />
    </>
  );
}
