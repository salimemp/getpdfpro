import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { PdfToImageTool } from "@/components/PdfToImageTool";

export const metadata: Metadata = {
  title: "PDF to Image",
  description:
    "Convert every page of a PDF into a PNG or JPEG image. Bundled as a ZIP. Free, fast, and private — files are processed on the server and never stored.",
  alternates: {
    canonical: "/tools/pdf-to-image",
  },
  openGraph: {
    title: "PDF to Image — GetPDFPro",
    description:
      "Convert every page of a PDF into a PNG or JPEG image. Bundled as a ZIP. Free, fast, and private.",
    url: "/tools/pdf-to-image",
  },
};

export default function PdfToImagePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <PdfToImageTool />
      </main>
      <SiteFooter />
    </>
  );
}
