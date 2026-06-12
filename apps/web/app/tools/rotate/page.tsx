import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { RotatePdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Rotate PDF",
  description: "Rotate pages of a PDF by 90, 180, or 270 degrees. Non-destructive — original page visuals are preserved.",
  alternates: { canonical: "/tools/rotate" },
  openGraph: {
    title: "Rotate PDF — GetPDFPro",
    description: "Rotate all or specific pages of a PDF by 90°, 180°, or 270°.",
    url: "/tools/rotate",
  },
};

export default function RotatePDFPage() {
  return (
    <>
      <SiteHeader />
      <main><RotatePdfTool /></main>
      <SiteFooter />
    </>
  );
}
