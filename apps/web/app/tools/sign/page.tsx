import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SignPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Sign PDF",
  description: "Add a visual signature stamp to a PDF. NOT a PKI signature — anyone with image editing can remove it.",
  alternates: { canonical: "/tools/sign" },
  openGraph: {
    title: "Sign PDF — GetPDFPro",
    description: "Add a visual signature stamp to a PDF (NOT a PKI signature).",
    url: "/tools/sign",
  },
};

export default function SignPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><SignPdfTool /></main>
      <SiteFooter />
    </>
  );
}
