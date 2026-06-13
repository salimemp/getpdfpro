import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../core/env.dart';

/// Settings page — single source of truth for the user's local app
/// preferences. Three sections:
///
///   1. Account — sign in / out / "signed in as {email}"
///   2. Appearance — theme (system / light / dark) — synced to local
///      storage so the next launch respects the choice without waiting
///      for Supabase. This mirrors the web app's localStorage approach;
///      cross-device sync is a v2 feature.
///   3. Language — locale override — also stored locally.
///   4. About — version, link to web, send feedback, privacy/terms.
///
/// We don't pull from a provider/state-management library for these
/// prefs — they're a single SharedPreferences key each, and a
/// `setState` after write is plenty.
class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  static const _kThemeModeKey = 'pref.themeMode';
  static const _kLocaleKey = 'pref.locale';

  ThemeMode _themeMode = ThemeMode.system;
  Locale? _localeOverride;

  @override
  void initState() {
    super.initState();
    _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(_kThemeModeKey);
    final mode = switch (stored) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    final lang = prefs.getString(_kLocaleKey);
    setState(() {
      _themeMode = mode;
      _localeOverride = lang == null ? null : Locale(lang);
    });
  }

  Future<void> _setThemeMode(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kThemeModeKey, mode.name);
    setState(() => _themeMode = mode);
  }

  Future<void> _setLocale(Locale? locale) async {
    final prefs = await SharedPreferences.getInstance();
    if (locale == null) {
      await prefs.remove(_kLocaleKey);
    } else {
      await prefs.setString(_kLocaleKey, locale.languageCode);
    }
    setState(() => _localeOverride = locale);
    if (locale != null) {
      await context.setLocale(locale);
    } else {
      await context.setLocale(const Locale('en')); // fall back to default
    }
  }

  Future<void> _signOut() async {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {
      // Supabase not initialized — ignore. The local state will
      // just show the user as still signed in until next launch.
    }
    if (mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('settings.signed_out'.tr())));
    }
  }

  /// The current Supabase user, or null if anonymous / Supabase
  /// not initialized. We never throw — settings page must be
  /// viewable in anonymous mode (per the web app's parity rule).
  User? _user() {
    try {
      return Supabase.instance.client.auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = _user();

    return Scaffold(
      appBar: AppBar(title: Text('settings.title'.tr())),
      body: ListView(
        children: [
          // ─── Account ────────────────────────────────────────
          _SectionHeader('settings.section_account'.tr()),
          if (user != null) ...[
            ListTile(
              leading: CircleAvatar(
                child: Text((user.email ?? '?').characters.first.toUpperCase()),
              ),
              title: Text(
                'settings.signed_in_as'.tr(
                  namedArgs: {'email': user.email ?? '—'},
                ),
              ),
              subtitle: Text(
                user.id,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            ListTile(
              leading: const Icon(Icons.logout),
              title: Text('common.sign_out'.tr()),
              onTap: _signOut,
            ),
          ] else
            ListTile(
              leading: const Icon(Icons.login),
              title: Text('settings.sign_in_cta'.tr()),
              onTap: () => context.push('/login?returnTo=/settings'),
            ),

          const Divider(),

          // ─── Appearance ────────────────────────────────────
          _SectionHeader('settings.section_appearance'.tr()),
          // RadioGroup is the Material 3 way to manage a set of
          // Radio children. The legacy per-Radio `groupValue` +
          // `onChanged` is deprecated in Flutter 3.32+.
          RadioGroup<ThemeMode>(
            groupValue: _themeMode,
            onChanged: (v) {
              if (v != null) _setThemeMode(v);
            },
            child: Column(
              children: [
                RadioListTile<ThemeMode>(
                  value: ThemeMode.system,
                  title: Text('settings.theme_system'.tr()),
                  secondary: const Icon(Icons.brightness_auto),
                ),
                RadioListTile<ThemeMode>(
                  value: ThemeMode.light,
                  title: Text('settings.theme_light'.tr()),
                  secondary: const Icon(Icons.light_mode),
                ),
                RadioListTile<ThemeMode>(
                  value: ThemeMode.dark,
                  title: Text('settings.theme_dark'.tr()),
                  secondary: const Icon(Icons.dark_mode),
                ),
              ],
            ),
          ),

          const Divider(),

          // ─── Language ──────────────────────────────────────
          _SectionHeader('settings.section_language'.tr()),
          ListTile(
            leading: const Icon(Icons.translate),
            title: Text('settings.language_system'.tr()),
            trailing: _localeOverride == null ? const Icon(Icons.check) : null,
            onTap: () => _setLocale(null),
          ),
          for (final lang in _supportedLanguages)
            ListTile(
              leading: const SizedBox(width: 24),
              title: Text(_displayName(lang)),
              trailing: _localeOverride?.languageCode == lang
                  ? const Icon(Icons.check)
                  : null,
              onTap: () => _setLocale(Locale(lang)),
            ),

          const Divider(),

          // ─── About ─────────────────────────────────────────
          _SectionHeader('settings.section_about'.tr()),
          ListTile(
            leading: const Icon(Icons.open_in_browser),
            title: Text('settings.open_on_web'.tr()),
            subtitle: Text(Env.websiteUrl),
            onTap: () {
              // The web app should be opened externally. There's no
              // url_launcher in pubspec — just show the URL for copy.
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(Env.websiteUrl)));
            },
          ),
          ListTile(
            leading: const Icon(Icons.bug_report),
            title: Text('settings.send_feedback'.tr()),
            subtitle: Text(Env.supportEmail),
            onTap: () {
              ScaffoldMessenger.of(
                context,
              ).showSnackBar(SnackBar(content: Text(Env.supportEmail)));
            },
          ),
          ListTile(
            leading: const Icon(Icons.privacy_tip),
            title: Text('settings.privacy_policy'.tr()),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('${Env.websiteUrl}/privacy')),
              );
            },
          ),
          ListTile(
            leading: const Icon(Icons.description),
            title: Text('settings.terms_of_service'.tr()),
            onTap: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('${Env.websiteUrl}/terms')),
              );
            },
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Text(
              'settings.version'.tr(
                namedArgs: {'version': Env.appVersion, 'build': Env.appBuild},
              ),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  /// Languages we ship at launch. Mirrors the `supportedLocales` list
  /// in `app.dart`. Add a new locale in both places at once.
  static const _supportedLanguages = [
    'en',
    'es',
    'fr',
    'de',
    'it',
    'pt',
    'ja',
    'ko',
    'zh',
    'ru',
    'ar',
    'hi',
  ];

  String _displayName(String code) {
    switch (code) {
      case 'en':
        return 'English';
      case 'es':
        return 'Español';
      case 'fr':
        return 'Français';
      case 'de':
        return 'Deutsch';
      case 'it':
        return 'Italiano';
      case 'pt':
        return 'Português';
      case 'ja':
        return '日本語';
      case 'ko':
        return '한국어';
      case 'zh':
        return '中文';
      case 'ru':
        return 'Русский';
      case 'ar':
        return 'العربية';
      case 'hi':
        return 'हिन्दी';
      default:
        return code;
    }
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        text.toUpperCase(),
        style: theme.textTheme.labelMedium?.copyWith(
          color: theme.colorScheme.primary,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}
