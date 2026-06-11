import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { CompressTool } from "@/components/CompressTool";

export const metadata: Metadata = {
  title: "Compress PDF",
  description:
    "Shrink a PDF with smart quality preservation. Three compression levels for any use case.",
  alternates: { canonical: "/tools/compress" },
  openGraph: {
    title: "Compress PDF — GetPDFPro",
    description: "Shrink a PDF with smart quality preservation.",
    url: "/tools/compress",
  },
};

export default function CompressPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <CompressTool />
      </main>
      <SiteFooter />
    </>
  );
}
