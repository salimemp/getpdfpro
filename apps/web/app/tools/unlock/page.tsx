import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { UnlockPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Unlock PDF",
  description: "Remove the user and/or owner password from a PDF. Result opens without any password and has no restrictions.",
  alternates: { canonical: "/tools/unlock" },
  openGraph: {
    title: "Unlock PDF — GetPDFPro",
    description: "Remove the user/owner password from a PDF.",
    url: "/tools/unlock",
  },
};

export default function UnlockPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><UnlockPdfTool /></main>
      <SiteFooter />
    </>
  );
}
