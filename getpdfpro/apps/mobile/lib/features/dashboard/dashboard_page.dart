import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:go_router/go_router.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/tool_registry.dart';

/// Main dashboard — what users see after onboarding or sign-in.
///
/// Layout:
///   - Greeting (signed-in name OR "Welcome" for anonymous)
///   - Search bar (with voice mic for hands-free search)
///   - Quick actions (4 most-used tools as large cards)
///   - Tools by category (8 categories, all 35 tools)
///   - "Open on web" CTA at the bottom (for power users)
///
/// The dashboard reuses `ToolRegistry` so adding a new tool on
/// either the web app or the mobile app updates both at once.
///
/// Tap handling is centralized in `_openTool(context, tool)`: it
/// checks the auth gate (`requiresSignIn`), shows a "coming soon"
/// snackbar for tools that aren't implemented yet, and navigates
/// via go_router.
class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';
  bool _listening = false;
  late final stt.SpeechToText _speech;
  bool _speechAvailable = false;

  /// The 4 "quick action" tools surfaced at the top of the dashboard.
  /// These are the most-used tools across all our analytics.
  static const List<String> _quickActionIds = [
    'merge',
    'compress',
    'pdf-to-word',
    'sign',
  ];

  @override
  void initState() {
    super.initState();
    _speech = stt.SpeechToText();
    _initSpeech();
  }

  Future<void> _initSpeech() async {
    try {
      _speechAvailable = await _speech.initialize(
        onError: (e) => debugPrint('Speech error: $e'),
        onStatus: (s) => debugPrint('Speech status: $s'),
      );
    } catch (e) {
      _speechAvailable = false;
    }
    if (mounted) setState(() {});
  }

  void _onQueryChanged(String value) {
    setState(() => _query = value.trim());
  }

  Future<void> _toggleListening() async {
    if (!_speechAvailable) return;
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
    } else {
      await _speech.listen(
        onResult: (result) {
          if (result.finalResult) {
            setState(() {
              _listening = false;
              _searchController.text = result.recognizedWords;
              _query = result.recognizedWords;
            });
            _speech.stop();
          }
        },
      );
      setState(() => _listening = true);
    }
  }

  /// Returns the signed-in user's display name, or null if anonymous.
  String? _userName() {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return null;
      final meta = user.userMetadata;
      if (meta != null) {
        final name = meta['full_name'];
        if (name is String && name.isNotEmpty) return name;
      }
      final email = user.email;
      if (email != null && email.contains('@')) return email.split('@').first;
    } catch (_) {
      // Supabase not initialized (dev build before env is set)
    }
    return null;
  }

  /// Filtered list of tools based on the current search query.
  List<Tool> _filteredTools() => ToolRegistry.search(_query);

  /// Resolved quick-action tools.
  List<Tool> _quickActions() {
    return _quickActionIds
        .map((id) => ToolRegistry.byId(id))
        .whereType<Tool>()
        .toList();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _speech.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isWide = MediaQuery.of(context).size.width >= 720;
    final name = _userName();
    final greeting = name == null
        ? 'dashboard.greeting_anon'.tr()
        : 'dashboard.greeting'.tr(namedArgs: {'name': name});

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          // App bar with greeting
          SliverAppBar.large(
            floating: true,
            title: Text(greeting, style: theme.textTheme.headlineSmall),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                tooltip: 'settings.title'.tr(),
                onPressed: () => context.push('/settings'),
              ),
            ],
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Text(
                'dashboard.greeting_subtitle'.tr(),
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),

          // Search bar
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: _SearchBar(
                controller: _searchController,
                onChanged: _onQueryChanged,
                speechAvailable: _speechAvailable,
                listening: _listening,
                onMicTap: _toggleListening,
                hintText: 'dashboard.search_hint'.tr(),
              ),
            ),
          ),

          // Show either search results or category-grouped tools
          if (_query.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: _ResultsList(tools: _filteredTools()),
            ),
          ] else ...[
            // Quick actions
            if (_quickActions().isNotEmpty) ...[
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Text(
                    'dashboard.quick_actions'.tr(),
                    style: theme.textTheme.titleSmall,
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                sliver: SliverGrid(
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: isWide ? 4 : 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    childAspectRatio: 1.4,
                  ),
                  delegate: SliverChildListDelegate(
                    _quickActions()
                        .map((t) => _QuickActionCard(tool: t))
                        .toList(),
                  ),
                ),
              ),
            ],

            // All categories
            for (final category in ToolRegistry.activeCategories()) ...[
              SliverToBoxAdapter(
                child: _CategorySection(category: category),
              ),
            ],
          ],

          // "Open on web" footer
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: TextButton.icon(
                  icon: const Icon(Icons.open_in_browser),
                  label: Text('dashboard.open_browser_cta'.tr()),
                  onPressed: () {
                    // Could deep-link to the web app. For now, just
                    // show a snackbar.
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('common.open_in_browser'.tr()),
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.onChanged,
    required this.speechAvailable,
    required this.listening,
    required this.onMicTap,
    required this.hintText,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final bool speechAvailable;
  final bool listening;
  final VoidCallback onMicTap;
  final String hintText;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return TextField(
      controller: controller,
      onChanged: onChanged,
      textInputAction: TextInputAction.search,
      decoration: InputDecoration(
        hintText: hintText,
        prefixIcon: const Icon(Icons.search),
        suffixIcon: speechAvailable
            ? IconButton(
                icon: Icon(listening ? Icons.mic : Icons.mic_none),
                color: listening ? theme.colorScheme.primary : null,
                tooltip: 'dashboard.voice_hint'.tr(),
                onPressed: onMicTap,
              )
            : null,
        filled: true,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(28),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }
}

class _ResultsList extends StatelessWidget {
  const _ResultsList({required this.tools});
  final List<Tool> tools;

  @override
  Widget build(BuildContext context) {
    if (tools.isEmpty) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Center(
          child: Text(
            'dashboard.no_results'.tr(),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ),
      );
    }
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: tools.length,
      itemBuilder: (context, i) => _ToolListTile(tool: tools[i]),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  const _QuickActionCard({required this.tool});
  final Tool tool;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer.withValues(alpha: 0.4),
      child: InkWell(
        onTap: () => _openTool(context, tool),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(
                tool.icon,
                size: 32,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 8),
              Text(
                tool.titleKey.tr(),
                style: theme.textTheme.titleSmall,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategorySection extends StatelessWidget {
  const _CategorySection({required this.category});
  final ToolCategory category;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tools = ToolRegistry.byCategory(category);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                category.icon,
                size: 20,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  category.titleKey.tr(),
                  style: theme.textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            category.descriptionKey.tr(),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          // 2-column grid of tool cards
          LayoutBuilder(
            builder: (context, constraints) {
              final cols = constraints.maxWidth > 600 ? 3 : 2;
              return GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: cols,
                  mainAxisSpacing: 8,
                  crossAxisSpacing: 8,
                  childAspectRatio: 2.4,
                ),
                itemCount: tools.length,
                itemBuilder: (context, i) => _ToolGridCard(tool: tools[i]),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _ToolGridCard extends StatelessWidget {
  const _ToolGridCard({required this.tool});
  final Tool tool;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: () => _openTool(context, tool),
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(
                tool.icon,
                size: 22,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      tool.titleKey.tr(),
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      tool.descriptionKey.tr(),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ToolListTile extends StatelessWidget {
  const _ToolListTile({required this.tool});
  final Tool tool;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(tool.icon),
      title: Text(tool.titleKey.tr()),
      subtitle: Text(
        tool.descriptionKey.tr(),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      onTap: () => _openTool(context, tool),
    );
  }
}

/// Centralized tool open. Three gates to check in order:
///
///  1. `comingSoon` — tool is registered but not yet implemented.
///     Show a "coming soon" snackbar and don't navigate.
///  2. `requiresSignIn` — tool needs an authenticated user (e.g.
///     AI summarize / translate which cost us money). If the user
///     is anonymous, push them to the sign-in screen with a
///     returnTo path so they land back here after auth.
///  3. Otherwise, navigate to `tool.route` via go_router.
///
/// We never silently fail — the user always sees a snackbar telling
/// them what just happened or what they need to do next.
void _openTool(BuildContext context, Tool tool) {
  if (tool.comingSoon) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('common.coming_soon'.tr())),
    );
    return;
  }

  if (tool.requiresSignIn) {
    bool signedIn = false;
    try {
      signedIn = Supabase.instance.client.auth.currentUser != null;
    } catch (_) {
      // Supabase not initialized in this dev build — treat as anon.
      signedIn = false;
    }
    if (!signedIn) {
      // Save where the user wanted to go so we can return them there
      // after sign-in completes. The router reads this on resume.
      context.push('/login?returnTo=${Uri.encodeComponent(tool.route)}');
      return;
    }
  }

  context.push(tool.route);
}
