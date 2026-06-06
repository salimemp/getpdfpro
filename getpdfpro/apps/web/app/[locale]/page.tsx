import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      {/* Hero */}
      <section className="text-center">
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl">
          {t('hero_title')}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          {t('hero_subtitle')}
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            href="/tools/merge"
            className="rounded-lg bg-sky-600 px-6 py-3 font-medium text-white shadow hover:bg-sky-700"
          >
            {t('cta_primary')}
          </Link>
          <Link
            href="#tools"
            className="rounded-lg border border-slate-300 px-6 py-3 font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            {t('cta_secondary')}
          </Link>
        </div>
      </section>

      {/* Tools grid */}
      <section id="tools" className="mt-24">
        <h2 className="text-3xl font-bold">{t('tools_title')}</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {['merge', 'split', 'compress', 'pdf_to_word', 'pdf_to_jpg', 'jpg_to_pdf', 'sign', 'ocr'].map((tool) => (
            <Link
              key={tool}
              href={`/tools/${tool}`}
              className="rounded-lg border border-slate-200 p-6 transition hover:border-sky-500 hover:shadow dark:border-slate-800"
            >
              <div className="text-sm font-medium text-slate-500">{t(`tools.${tool}`)}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
