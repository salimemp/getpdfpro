import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { CropPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Crop PDF",
  description: "Crop pages of a PDF by shrinking the visible area. Values in PDF points (1 pt = 1/72 inch).",
  alternates: { canonical: "/tools/crop" },
  openGraph: {
    title: "Crop PDF — GetPDFPro",
    description: "Crop pages of a PDF to a rectangle in PDF points (1 pt = 1/72 inch).",
    url: "/tools/crop",
  },
};

export default function CropPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><CropPdfTool /></main>
      <SiteFooter />
    </>
  );
}
