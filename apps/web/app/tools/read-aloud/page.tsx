import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { ReadAloudTool } from "@/components/ReadAloudTool";

export const metadata: Metadata = {
  title: "Read Aloud — text-to-speech for any text",
  description:
    "Paste any text and have it spoken aloud by your browser's built-in voice. 20+ languages, voice + speed + pitch control. Pure Web Speech API — your text never leaves your device.",
  alternates: { canonical: "/tools/read-aloud" },
  openGraph: {
    title: "Read Aloud — GetPDFPro",
    description:
      "In-browser text-to-speech for any text. No upload, no account, no server. Just paste and listen.",
    url: "/tools/read-aloud",
  },
};

export default function ReadAloudPage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ReadAloudTool />
      </main>
      <SiteFooter />
    </>
  );
}
