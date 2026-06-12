import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ExcelToPdfTool } from "@/components/OfficeTools";

export const metadata: Metadata = {
  title: "Excel to PDF",
  description: "Convert a .xlsx file to PDF. Sheets, formulas, and formatting preserved.",
  alternates: { canonical: "/tools/excel-to-pdf" },
  openGraph: {
    title: "Excel to PDF — GetPDFPro",
    description: "Convert .xlsx to PDF with Adobe PDF Services.",
    url: "/tools/excel-to-pdf",
  },
};

export default function ExceltoPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><ExcelToPdfTool /></main>
      <SiteFooter />
    </>
  );
}
