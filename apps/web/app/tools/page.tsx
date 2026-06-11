import type { Metadata } from "next";
import Link from "next/link";
import {
  Combine,
  Scissors,
  Minimize2,
  FileImage,
  FileText,
  PenTool,
  ArrowRight,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "All PDF tools",
  description:
    "Every PDF tool you need: merge, split, compress, convert, sign, and edit — all in your browser, all private.",
  alternates: { canonical: "/tools" },
};

const tools = [
  {
    name: "Merge PDF",
    description: "Combine PDFs in the order you want. Drag, drop, done.",
    icon: Combine,
    href: "/tools/merge",
    ready: true,
  },
  {
    name: "Split PDF",
    description: "Extract pages or split by bookmarks, size, or ranges.",
    icon: Scissors,
    href: "/tools/split",
    ready: false,
  },
  {
    name: "Compress PDF",
    description: "Shrink files up to 90% with smart quality preservation.",
    icon: Minimize2,
    href: "/tools/compress",
    ready: false,
  },
  {
    name: "PDF to Image",
    description: "Convert to JPG, PNG, or WebP at any DPI.",
    icon: FileImage,
    href: "/tools/pdf-to-image",
    ready: false,
  },
  {
    name: "Image to PDF",
    description: "Turn photos and scans into clean, searchable PDFs.",
    icon: FileText,
    href: "/tools/image-to-pdf",
    ready: false,
  },
  {
    name: "Sign PDF",
    description: "Add your signature, initials, or a date stamp.",
    icon: PenTool,
    href: "/tools/sign",
    ready: false,
  },
];

export default function ToolsIndexPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="container-narrow py-16">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            All PDF tools
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            One tool at a time. Each one runs in your browser and is free
            forever for the basics.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <Link
                key={tool.name}
                href={tool.href}
                className="group relative rounded-xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-brand-700"
              >
                {!tool.ready && (
                  <span className="absolute right-4 top-4 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    Coming soon
                  </span>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
                  <tool.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{tool.name}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {tool.description}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2">
                  {tool.ready ? "Open tool" : "Notify me"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
