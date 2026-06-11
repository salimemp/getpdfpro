import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { MergeTool } from "@/components/MergeTool";

export const metadata: Metadata = {
  title: "Merge PDF",
  description:
    "Combine 2 or more PDFs into a single document. Free, fast, and private — files are processed in your browser session and never stored.",
  alternates: {
    canonical: "/tools/merge",
  },
  openGraph: {
    title: "Merge PDF — GetPDFPro",
    description:
      "Combine 2 or more PDFs into a single document. Free, fast, and private.",
    url: "/tools/merge",
  },
};

export default function MergePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <MergeTool />
      </main>
      <SiteFooter />
    </>
  );
}
