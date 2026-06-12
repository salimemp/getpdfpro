import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { WatermarkTool } from "@/components/WatermarkTool";

export const metadata: Metadata = {
  title: "Add Watermark to PDF",
  description:
    "Stamp a text or image watermark on every page of a PDF. DRAFT, CONFIDENTIAL, company logo. 8 positions, 4 colors, 7 rotations, opacity control.",
  alternates: { canonical: "/tools/watermark" },
  openGraph: {
    title: "Add Watermark to PDF — GetPDFPro",
    description: "Stamp text or image watermarks on every page. Free, private.",
    url: "/tools/watermark",
  },
};

export default function WatermarkPage() {
  return (
    <>
      <SiteHeader />
      <main><WatermarkTool /></main>
      <SiteFooter />
    </>
  );
}
