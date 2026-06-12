import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ProtectPdfTool } from "@/components/NewPdfTools";

export const metadata: Metadata = {
  title: "Protect PDF",
  description: "Encrypt a PDF with AES-256. Set a user password and optionally allow specific actions (print, copy, etc.).",
  alternates: { canonical: "/tools/protect" },
  openGraph: {
    title: "Protect PDF — GetPDFPro",
    description: "Encrypt a PDF with AES-256 and a user/owner password.",
    url: "/tools/protect",
  },
};

export default function ProtectPDFPage() {
  return (
    <>
      <SiteHeader />
      <main><ProtectPdfTool /></main>
      <SiteFooter />
    </>
  );
}
