/**
 * i18n routing config.
 *
 * Languages: 25+ at launch, matching iLovePDF parity.
 * RTL support built in (Arabic, Hebrew, etc.).
 */

import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  // 25 languages at launch
  locales: [
    'en', 'es', 'fr', 'de', 'it', 'pt',
    'ja', 'ko', 'zh', 'ru', 'ar', 'hi',
    'nl', 'pl', 'tr', 'vi', 'th', 'id',
    'ms', 'sv', 'da', 'fi', 'no', 'cs',
    'el',
  ],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
