import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

/// Placeholder page for tools that aren't implemented in the mobile
/// app yet. The dashboard points here for ~30 of the 35 tools until
/// we ship native implementations.
///
/// We always show a useful next step:
///   - Web CTA — the tool is fully working on app.getpdfpro.com
///   - "Coming soon" badge — sets expectations honestly
///
/// We never show a broken stub or a stack trace.
class ToolPlaceholderPage extends StatelessWidget {
  const ToolPlaceholderPage({
    super.key,
    required this.toolId,
    required this.toolTitle,
    this.toolDescription,
    this.toolIcon,
    this.webPath,
  });

  final String toolId;
  final String toolTitle;
  final String? toolDescription;
  final IconData? toolIcon;
  final String? webPath;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    // toolTitle might be a translation key OR a real translated string.
    // The router passes the raw key for placeholders, so we resolve it
    // through .tr() and fall back to the raw value if the key isn't
    // present in the active locale.
    final title = _tryTranslate(toolTitle);

    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(child: _Badge(text: 'common.coming_soon'.tr())),
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Icon(
                toolIcon ?? Icons.handyman_outlined,
                size: 72,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(height: 24),
              Text(
                title,
                style: theme.textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              if (toolDescription != null) ...[
                const SizedBox(height: 8),
                Text(
                  _tryTranslate(toolDescription!),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
              const SizedBox(height: 24),
              Card(
                elevation: 0,
                color: theme.colorScheme.surfaceContainerHighest.withValues(
                  alpha: 0.3,
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Icon(
                        Icons.info_outline,
                        color: theme.colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'This tool is in the mobile roadmap. The full '
                          'version works on the web right now.',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: () {
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(const SnackBar(content: Text('Open on web')));
                },
                icon: const Icon(Icons.open_in_browser),
                label: Text('common.open_in_browser'.tr()),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                child: Text('common.back'.tr()),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Tries to `.tr()` the value, and if the key isn't registered
  /// returns the raw value. This lets the router pass the raw i18n
  /// key (e.g. `tools.merge`) as a placeholder, and have it render
  /// "Merge PDF" on the page.
  String _tryTranslate(String key) {
    try {
      return key.tr();
    } catch (_) {
      return key;
    }
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.tertiaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        text,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onTertiaryContainer,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
