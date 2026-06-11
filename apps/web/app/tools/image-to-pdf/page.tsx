import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ImageToPdfTool } from "@/components/ImageToPdfTool";

export const metadata: Metadata = {
  title: "Image to PDF",
  description:
    "Combine one or more images (JPG, PNG, WebP) into a single PDF. Each image becomes one page. Free, fast, and private — files are processed on the server and never stored.",
  alternates: {
    canonical: "/tools/image-to-pdf",
  },
  openGraph: {
    title: "Image to PDF — GetPDFPro",
    description:
      "Combine one or more images (JPG, PNG, WebP) into a single PDF. Free, fast, and private.",
    url: "/tools/image-to-pdf",
  },
};

export default function ImageToPdfPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <ImageToPdfTool />
      </main>
      <SiteFooter />
    </>
  );
}
