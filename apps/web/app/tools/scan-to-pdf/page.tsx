import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ScanToPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Scan to PDF",
  description: "Convert phone-scanned images (JPG/PNG/WebP/TIFF) to a single searchable PDF with an invisible OCR text layer.",
  alternates: { canonical: "/tools/scan-to-pdf" },
  openGraph: {
    title: "Scan to PDF — GetPDFPro",
    description: "Convert scanned images to a searchable PDF (with Tesseract OCR).",
    url: "/tools/scan-to-pdf",
  },
};

export default function ScantoPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><ScanToPdfTool /></main>
      <SiteFooter />
    </>
  );
}
