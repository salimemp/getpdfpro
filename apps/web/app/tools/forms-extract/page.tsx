import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { FormsExtractTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Extract Form Fields",
  description: "Extract form field data from a PDF as JSON. AcroForm and (on Adobe) XFA support.",
  alternates: { canonical: "/tools/forms-extract" },
  openGraph: {
    title: "Extract Form Fields — GetPDFPro",
    description: "Extract form field data from a PDF as JSON.",
    url: "/tools/forms-extract",
  },
};

export default function ExtractFormFieldsPage() {
  return (
    <>
      <SiteHeader />
      <main><FormsExtractTool /></main>
      <SiteFooter />
    </>
  );
}
