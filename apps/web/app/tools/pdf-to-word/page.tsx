import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PdfToWordTool } from "@/components/PdfToWordTool";

export const metadata: Metadata = {
  title: "PDF to Word",
  description:
    "Convert a PDF to a .docx file. Best-effort text, headings, and basic tables. Honest about accuracy — complex layouts may need manual cleanup.",
  alternates: {
    canonical: "/tools/pdf-to-word",
  },
  openGraph: {
    title: "PDF to Word — GetPDFPro",
    description:
      "Convert a PDF to a .docx file. Best-effort text, headings, and basic tables.",
    url: "/tools/pdf-to-word",
  },
};

export default function PdfToWordPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PdfToWordTool />
      </main>
      <SiteFooter />
    </>
  );
}
