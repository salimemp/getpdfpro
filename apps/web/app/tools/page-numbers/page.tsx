import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PageNumbersTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Add Page Numbers",
  description: "Stamp 'Page N of M' on every page of a PDF. Pick position, font, and starting number.",
  alternates: { canonical: "/tools/page-numbers" },
  openGraph: {
    title: "Add Page Numbers — GetPDFPro",
    description: "Add page numbers ('Page N of M') to every page of a PDF.",
    url: "/tools/page-numbers",
  },
};

export default function AddPageNumbersPage() {
  return (
    <>
      <SiteHeader />
      <main><PageNumbersTool /></main>
      <SiteFooter />
    </>
  );
}
