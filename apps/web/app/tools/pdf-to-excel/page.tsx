import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PdfToExcelTool } from "@/components/OfficeTools";

export const metadata: Metadata = {
  title: "PDF to Excel",
  description: "Convert a PDF to .xlsx. Tables extracted cell-by-cell via Adobe.",
  alternates: { canonical: "/tools/pdf-to-excel" },
  openGraph: {
    title: "PDF to Excel — GetPDFPro",
    description: "Convert PDF to .xlsx with Adobe PDF Services.",
    url: "/tools/pdf-to-excel",
  },
};

export default function PDFtoExcelPage() {
  return (
    <>
      <SiteHeader />
      <main><PdfToExcelTool /></main>
      <SiteFooter />
    </>
  );
}
