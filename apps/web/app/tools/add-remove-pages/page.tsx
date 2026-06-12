import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { AddRemovePagesTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Add or Remove Pages",
  description: "Delete specific pages from a PDF, or keep only the pages you specify.",
  alternates: { canonical: "/tools/add-remove-pages" },
  openGraph: {
    title: "Add or Remove Pages — GetPDFPro",
    description: "Delete specific pages from a PDF, or keep only the pages you specify.",
    url: "/tools/add-remove-pages",
  },
};

export default function AddorRemovePagesPage() {
  return (
    <>
      <SiteHeader />
      <main><AddRemovePagesTool /></main>
      <SiteFooter />
    </>
  );
}
