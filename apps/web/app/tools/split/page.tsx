import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { SplitTool } from "@/components/SplitTool";

export const metadata: Metadata = {
  title: "Split PDF",
  description:
    "Extract pages or split a PDF by custom ranges. The output is a ZIP of one-PDF-per-page.",
  alternates: { canonical: "/tools/split" },
  openGraph: {
    title: "Split PDF — GetPDFPro",
    description: "Extract pages or split a PDF by custom ranges.",
    url: "/tools/split",
  },
};

export default function SplitPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <SplitTool />
      </main>
      <SiteFooter />
    </>
  );
}
