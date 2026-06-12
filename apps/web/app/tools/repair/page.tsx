import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { RepairTool } from "@/components/RepairTool";

export const metadata: Metadata = {
  title: "Repair PDF",
  description:
    "Fix a broken, scanned, locked, or slow-loading PDF. Recovers corrupt files, adds an OCR text layer, strips passwords, and linearizes for Fast Web View. All in one pass.",
  alternates: {
    canonical: "/tools/repair",
  },
  openGraph: {
    title: "Repair PDF — GetPDFPro",
    description:
      "Fix a broken, scanned, locked, or slow-loading PDF in one pass. Repairs, OCRs, unlocks, and linearizes.",
    url: "/tools/repair",
  },
};

export default function RepairPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <RepairTool />
      </main>
      <SiteFooter />
    </>
  );
}
