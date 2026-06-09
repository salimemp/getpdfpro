import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://getpdfpro.com"),
  title: {
    default: "GetPDFPro — The Professional PDF Toolkit",
    template: "%s | GetPDFPro",
  },
  description:
    "Merge, split, compress, convert, sign, and edit PDFs in your browser. Free, fast, and private — files are encrypted end-to-end and never leave your control.",
  keywords: [
    "PDF editor",
    "merge PDF",
    "split PDF",
    "compress PDF",
    "PDF converter",
    "online PDF tools",
    "iLovePDF alternative",
  ],
  authors: [{ name: "GetPDFPro" }],
  creator: "GetPDFPro",
  publisher: "GetPDFPro",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://getpdfpro.com",
    siteName: "GetPDFPro",
    title: "GetPDFPro — The Professional PDF Toolkit",
    description:
      "Free, fast, private PDF tools. Merge, split, compress, convert, sign, and edit PDFs in your browser.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GetPDFPro — The Professional PDF Toolkit",
    description:
      "Free, fast, private PDF tools. Merge, split, compress, convert, sign, and edit PDFs in your browser.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
