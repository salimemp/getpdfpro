import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'app.dart';
import 'core/api_client.dart';
import 'core/deep_links.dart';
import 'core/env.dart';

/// Whether the Supabase env has been wired up. We treat an unset
/// `SUPABASE_URL` as "Supabase disabled in this build" — useful for
/// designers previewing the app or for App Store builds that ship
/// before the backend is reachable. Auth-gated flows will degrade
/// to anonymous mode instead of crashing.
bool get _hasSupabase => Env.supabaseUrl.startsWith('http');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Start listening for deep links BEFORE Supabase init. The deep
  // link that launched the app can be a password-reset or OAuth
  // callback — Supabase needs the link to set up its own listener.
  // Both initializers tolerate the link stream being empty.
  await DeepLinkHandler.instance.initialize();

  if (_hasSupabase) {
    try {
      await Supabase.initialize(
        url: Env.supabaseUrl,
        // Supabase 2.14+ renamed `anonKey` → `publishableKey`.
        // The value is still the public anon JWT — just the
        // named parameter changed.
        publishableKey: Env.supabaseAnonKey,
      );
      // Install the auth interceptor AFTER Supabase is up — otherwise
      // the interceptor would crash on the first request trying to
      // pull a non-existent session.
      ApiClient.instance.installAuthInterceptor();
    } catch (e, st) {
      // Don't crash the app on a misconfigured Supabase URL during
      // dev. Log it and continue in anonymous mode. The user can
      // still browse tools that don't require auth.
      debugPrint('Supabase init failed: $e\n$st');
    }
  } else {
    debugPrint(
      'Supabase env not set — running in anonymous mode. '
      'Set SUPABASE_URL and SUPABASE_ANON_KEY to enable auth.',
    );
  }

  runApp(const ProviderScope(child: GetPDFProApp()));
}
