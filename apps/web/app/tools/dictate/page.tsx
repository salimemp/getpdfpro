import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { DictateTool } from "@/components/DictateTool";

export const metadata: Metadata = {
  title: "Dictate — speech-to-text in your browser",
  description:
    "Speech-to-text powered by the Web Speech API. 24+ languages, continuous mode, copy or download. Your audio never leaves your device.",
  alternates: { canonical: "/tools/dictate" },
  openGraph: {
    title: "Dictate — GetPDFPro",
    description:
      "In-browser speech-to-text. Tap, speak, see your words. No upload, no account, no server.",
    url: "/tools/dictate",
  },
};

export default function DictatePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <DictateTool />
      </main>
      <SiteFooter />
    </>
  );
}
