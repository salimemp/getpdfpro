import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

/// Root app widget. Wires up the router, theme, and i18n.
///
/// easy_localization needs an explicit `supportedLocales` list and
/// `localizationDelegates` set on `MaterialApp.router`. We list the
/// 12 we plan to ship at launch (matching the web app's /locale
/// namespace) plus `Locale('en')` as the fallback. The first locale
/// in the list is the default.
class GetPDFProApp extends ConsumerWidget {
  const GetPDFProApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return EasyLocalization(
      // Path to the i18n asset bundle. `assets/i18n/` is declared in
      // pubspec.yaml. easy_localization looks for `<code>.json` in that
      // directory. We ship `en.json` (default) and `hi.json` first;
      // others will be added as the translation pipeline produces them.
      supportedLocales: const [
        Locale('en'),
        Locale('es'),
        Locale('fr'),
        Locale('de'),
        Locale('it'),
        Locale('pt'),
        Locale('ja'),
        Locale('ko'),
        Locale('zh'),
        Locale('ru'),
        Locale('ar'),
        Locale('hi'),
      ],
      path: 'assets/i18n',
      fallbackLocale: const Locale('en'),
      useOnlyLangCode: true,
      child: MaterialApp.router(
        title: 'GetPDFPro',
        debugShowCheckedModeBanner: false,
        localizationsDelegates: [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
          // EasyLocalization's delegate must be obtained via a
          // method call (not a const), so we can't put the whole
          // list in `const`. The fallback to MaterialLocalizations
          // is defensive — in practice, easy_localization is
          // always wrapping this app.
          EasyLocalization.of(context)?.delegate ??
              GlobalMaterialLocalizations.delegate,
        ],
        supportedLocales: context.supportedLocales,
        locale: context.locale,

        // Theming (light + dark, system sync)
        theme: AppTheme.light,
        darkTheme: AppTheme.dark,
        themeMode: ThemeMode.system,

        // Accessibility: respect system text size, but cap it so a
        // user with a 200% system scale doesn't break the dashboard
        // grid layout. 0.8–1.5 covers the WCAG 2.1 AA range.
        builder: (context, child) {
          return MediaQuery(
            data: MediaQuery.of(context).copyWith(
              textScaler: TextScaler.linear(
                MediaQuery.textScalerOf(context).scale(1.0).clamp(0.8, 1.5),
              ),
            ),
            child: child!,
          );
        },

        routerConfig: router,
      ),
    );
  }
}
