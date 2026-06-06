/**
 * Root layout — minimal, most logic is in [locale]/layout.tsx
 */
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://getpdfpro.com'),
  title: {
    default: 'GetPDFPro — Every PDF tool you need',
    template: '%s · GetPDFPro',
  },
  description:
    'Merge, split, compress, convert, sign, and edit PDFs. With voice commands, AI assistant, and accessibility built in. Free to start, no signup required.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://getpdfpro.com',
    siteName: 'GetPDFPro',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
