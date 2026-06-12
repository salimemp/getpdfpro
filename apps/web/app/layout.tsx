import type { Metadata, Viewport } from "next";
import { getLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/ThemeProvider";
import {
  organizationLd,
  websiteLd,
  softwareApplicationLd,
  ldJson,
  SITE_URL,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://app.getpdfpro.com"
  ),
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://app.getpdfpro.com",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Resolve the active locale for this request. For v1 with only
  // English, this is always "en". When you add more locales to
  // LOCALES in src/i18n/config.ts, this picks them up automatically.
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/*
          Site-wide JSON-LD structured data. Per-page data (FAQ, breadcrumb,
          etc.) gets added inside the page component itself. These three
          are global because they describe the site as a whole, not a
          specific page.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(organizationLd())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(websiteLd())}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={ldJson(softwareApplicationLd())}
        />
        {/* Preconnect to the API so the first tool call is fast */}
        {SITE_URL.includes("app.getpdfpro.com") && (
          <link
            rel="preconnect"
            href="https://api.getpdfpro.com"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="min-h-screen bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <NextIntlClientProvider locale={locale}>
          <ThemeProvider>
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
