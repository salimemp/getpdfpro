import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { EditPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Edit PDF",
  description: "Edit metadata, cover a region with white, and/or stamp a label. NOT a click-to-edit WYSIWYG editor.",
  alternates: { canonical: "/tools/edit-pdf" },
  openGraph: {
    title: "Edit PDF — GetPDFPro",
    description: "Edit PDF metadata, whiteout a region, and/or stamp a text label.",
    url: "/tools/edit-pdf",
  },
};

export default function EditPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><EditPdfTool /></main>
      <SiteFooter />
    </>
  );
}
