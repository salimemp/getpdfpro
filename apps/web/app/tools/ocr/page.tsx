import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { OcrTool } from "@/components/OcrTool";

export const metadata: Metadata = {
  title: "OCR PDF",
  description:
    "Make a scanned PDF searchable. Adds an invisible text layer (preserves the original look) or extract plain text. Powered by Tesseract OCR.",
  alternates: {
    canonical: "/tools/ocr",
  },
  openGraph: {
    title: "OCR PDF — GetPDFPro",
    description:
      "Make a scanned PDF searchable. Adds an invisible text layer over the original scans.",
    url: "/tools/ocr",
  },
};

export default function OcrPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <OcrTool />
      </main>
      <SiteFooter />
    </>
  );
}
