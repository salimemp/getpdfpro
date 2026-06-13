/// Tool registry — single source of truth for every tool page.
///
/// Mirrors `apps/web/app/tools/page.tsx` in the web app, which has
/// the same data. Whenever you add a new tool on the web, add it
/// here too — the dashboard uses this list to render tool cards.
library;

import 'package:flutter/material.dart';

/// Top-level category for the dashboard. Tools within a category
/// are shown together; categories are the primary nav buckets.
enum ToolCategory {
  organize(
    id: 'organize',
    titleKey: 'category.organize',
    descriptionKey: 'category.organize_desc',
    icon: Icons.dashboard_customize,
  ),
  optimize(
    id: 'optimize',
    titleKey: 'category.optimize',
    descriptionKey: 'category.optimize_desc',
    icon: Icons.compress,
  ),
  convertTo(
    id: 'convert-to',
    titleKey: 'category.convert_to',
    descriptionKey: 'category.convert_to_desc',
    icon: Icons.file_download,
  ),
  convertFrom(
    id: 'convert-from',
    titleKey: 'category.convert_from',
    descriptionKey: 'category.convert_from_desc',
    icon: Icons.file_upload,
  ),
  edit(
    id: 'edit',
    titleKey: 'category.edit',
    descriptionKey: 'category.edit_desc',
    icon: Icons.edit,
  ),
  security(
    id: 'security',
    titleKey: 'category.security',
    descriptionKey: 'category.security_desc',
    icon: Icons.shield,
  ),
  intelligence(
    id: 'intelligence',
    titleKey: 'category.intelligence',
    descriptionKey: 'category.intelligence_desc',
    icon: Icons.auto_awesome,
  ),
  accessibility(
    id: 'accessibility',
    titleKey: 'category.accessibility',
    descriptionKey: 'category.accessibility_desc',
    icon: Icons.accessibility_new,
  );

  const ToolCategory({
    required this.id,
    required this.titleKey,
    required this.descriptionKey,
    required this.icon,
  });
  final String id;
  final String titleKey;
  final String descriptionKey;
  final IconData icon;
}

/// A single tool. The `route` is the path inside the Flutter app's
/// go_router. The `webPath` is the equivalent path on the web app
/// (used for the "open in browser" link in the tool's overflow menu).
class Tool {
  const Tool({
    required this.id,
    required this.titleKey,
    required this.descriptionKey,
    required this.category,
    required this.route,
    required this.icon,
    this.webPath,
    this.requiresSignIn = false,
    this.comingSoon = false,
    this.placeholder = false,
  });

  final String id;
  final String titleKey;
  final String descriptionKey;
  final ToolCategory category;
  final String route;
  final IconData icon;

  /// Path on the web app, used to deep-link users to the web version
  /// if they prefer a bigger screen for this tool.
  final String? webPath;

  /// True if this tool requires the user to be signed in to work.
  /// We use this to gate the card with a "Sign in" CTA on tap.
  final bool requiresSignIn;

  /// True if the tool is on the roadmap but not yet implemented in
  /// the mobile app. UI shows a "Coming soon" badge and disables tap.
  final bool comingSoon;

  /// True if the tool is registered but the mobile app has not
  /// shipped a native page for it yet — the router falls through
  /// to the generic "Coming soon" placeholder for `/tools/<id>`.
  /// Defaults to `false`. Set to `true` only when the only thing
  /// the mobile app can do today is show a "use the web" CTA.
  ///
  /// Distinct from [comingSoon], which is shown in the dashboard
  /// search results as a "Coming soon" badge and disables tap.
  final bool placeholder;
}

/// The single registry of every tool. Add new tools here, give them
/// a unique `id`, and they'll show up in the dashboard automatically.
///
/// Web-app equivalents are listed in `apps/web/app/tools/page.tsx`
/// — keep both files in sync.
class ToolRegistry {
  static const List<Tool> all = [
    // ─── Organize ──────────────────────────────────────────────
    Tool(
      id: 'merge',
      titleKey: 'tools.merge',
      descriptionKey: 'tools.merge_desc',
      category: ToolCategory.organize,
      route: '/tools/merge',
      icon: Icons.merge_type,
      webPath: '/tools/merge',
    ),
    Tool(
      id: 'split',
      titleKey: 'tools.split',
      descriptionKey: 'tools.split_desc',
      category: ToolCategory.organize,
      route: '/tools/split',
      icon: Icons.call_split,
      webPath: '/tools/split',
    ),
    Tool(
      id: 'add-remove-pages',
      titleKey: 'tools.add_remove_pages',
      descriptionKey: 'tools.add_remove_pages_desc',
      category: ToolCategory.organize,
      route: '/tools/add-remove-pages',
      icon: Icons.note_add,
      webPath: '/tools/add-remove-pages',
    ),
    Tool(
      id: 'extract-pages',
      titleKey: 'tools.extract_pages',
      descriptionKey: 'tools.extract_pages_desc',
      category: ToolCategory.organize,
      route: '/tools/extract-pages',
      icon: Icons.content_copy,
      webPath: '/tools/extract-pages',
    ),
    Tool(
      id: 'organize',
      titleKey: 'tools.organize',
      descriptionKey: 'tools.organize_desc',
      category: ToolCategory.organize,
      route: '/tools/organize',
      icon: Icons.swap_vert,
      webPath: '/tools/organize',
    ),
    Tool(
      id: 'page-numbers',
      titleKey: 'tools.page_numbers',
      descriptionKey: 'tools.page_numbers_desc',
      category: ToolCategory.organize,
      route: '/tools/page-numbers',
      icon: Icons.numbers,
      webPath: '/tools/page-numbers',
    ),
    Tool(
      id: 'scan-to-pdf',
      titleKey: 'tools.scan_to_pdf',
      descriptionKey: 'tools.scan_to_pdf_desc',
      category: ToolCategory.organize,
      route: '/tools/scan-to-pdf',
      icon: Icons.document_scanner,
      webPath: '/tools/scan-to-pdf',
    ),

    // ─── Optimize ──────────────────────────────────────────────
    Tool(
      id: 'compress',
      titleKey: 'tools.compress',
      descriptionKey: 'tools.compress_desc',
      category: ToolCategory.optimize,
      route: '/tools/compress',
      icon: Icons.compress,
      webPath: '/tools/compress',
    ),
    Tool(
      id: 'repair',
      titleKey: 'tools.repair',
      descriptionKey: 'tools.repair_desc',
      category: ToolCategory.optimize,
      route: '/tools/repair',
      icon: Icons.build,
      webPath: '/tools/repair',
    ),
    Tool(
      id: 'ocr',
      titleKey: 'tools.ocr',
      descriptionKey: 'tools.ocr_desc',
      category: ToolCategory.optimize,
      route: '/tools/ocr',
      icon: Icons.document_scanner_outlined,
      webPath: '/tools/ocr',
    ),

    // ─── Convert TO PDF ───────────────────────────────────────
    Tool(
      id: 'image-to-pdf',
      titleKey: 'tools.image_to_pdf',
      descriptionKey: 'tools.image_to_pdf_desc',
      category: ToolCategory.convertTo,
      route: '/tools/image-to-pdf',
      icon: Icons.image,
      webPath: '/tools/image-to-pdf',
    ),
    Tool(
      id: 'html-to-pdf',
      titleKey: 'tools.html_to_pdf',
      descriptionKey: 'tools.html_to_pdf_desc',
      category: ToolCategory.convertTo,
      route: '/tools/html-to-pdf',
      icon: Icons.code,
      webPath: '/tools/html-to-pdf',
    ),
    Tool(
      id: 'word-to-pdf',
      titleKey: 'tools.word_to_pdf',
      descriptionKey: 'tools.word_to_pdf_desc',
      category: ToolCategory.convertTo,
      route: '/tools/word-to-pdf',
      icon: Icons.description,
      webPath: '/tools/word-to-pdf',
    ),
    Tool(
      id: 'powerpoint-to-pdf',
      titleKey: 'tools.powerpoint_to_pdf',
      descriptionKey: 'tools.powerpoint_to_pdf_desc',
      category: ToolCategory.convertTo,
      route: '/tools/powerpoint-to-pdf',
      icon: Icons.slideshow,
      webPath: '/tools/powerpoint-to-pdf',
    ),
    Tool(
      id: 'excel-to-pdf',
      titleKey: 'tools.excel_to_pdf',
      descriptionKey: 'tools.excel_to_pdf_desc',
      category: ToolCategory.convertTo,
      route: '/tools/excel-to-pdf',
      icon: Icons.table_chart,
      webPath: '/tools/excel-to-pdf',
    ),

    // ─── Convert FROM PDF ─────────────────────────────────────
    Tool(
      id: 'pdf-to-image',
      titleKey: 'tools.pdf_to_image',
      descriptionKey: 'tools.pdf_to_image_desc',
      category: ToolCategory.convertFrom,
      route: '/tools/pdf-to-image',
      icon: Icons.image,
      webPath: '/tools/pdf-to-image',
    ),
    Tool(
      id: 'pdf-to-word',
      titleKey: 'tools.pdf_to_word',
      descriptionKey: 'tools.pdf_to_word_desc',
      category: ToolCategory.convertFrom,
      route: '/tools/pdf-to-word',
      icon: Icons.description,
      webPath: '/tools/pdf-to-word',
    ),
    Tool(
      id: 'pdf-to-powerpoint',
      titleKey: 'tools.pdf_to_powerpoint',
      descriptionKey: 'tools.pdf_to_powerpoint_desc',
      category: ToolCategory.convertFrom,
      route: '/tools/pdf-to-powerpoint',
      icon: Icons.slideshow,
      webPath: '/tools/pdf-to-powerpoint',
    ),
    Tool(
      id: 'pdf-to-excel',
      titleKey: 'tools.pdf_to_excel',
      descriptionKey: 'tools.pdf_to_excel_desc',
      category: ToolCategory.convertFrom,
      route: '/tools/pdf-to-excel',
      icon: Icons.table_chart,
      webPath: '/tools/pdf-to-excel',
    ),
    Tool(
      id: 'pdf-to-pdfa',
      titleKey: 'tools.pdf_to_pdfa',
      descriptionKey: 'tools.pdf_to_pdfa_desc',
      category: ToolCategory.convertFrom,
      route: '/tools/pdf-to-pdfa',
      icon: Icons.archive,
      webPath: '/tools/pdf-to-pdfa',
    ),
    Tool(
      id: 'extract-tables',
      titleKey: 'tools.extract_tables',
      descriptionKey: 'tools.extract_tables_desc',
      category: ToolCategory.convertFrom,
      route: '/tools/extract-tables',
      icon: Icons.table_rows,
      webPath: '/tools/extract-tables',
    ),

    // ─── Edit ─────────────────────────────────────────────────
    Tool(
      id: 'rotate',
      titleKey: 'tools.rotate',
      descriptionKey: 'tools.rotate_desc',
      category: ToolCategory.edit,
      route: '/tools/rotate',
      icon: Icons.rotate_90_degrees_ccw,
      webPath: '/tools/rotate',
    ),
    Tool(
      id: 'watermark',
      titleKey: 'tools.watermark',
      descriptionKey: 'tools.watermark_desc',
      category: ToolCategory.edit,
      route: '/tools/watermark',
      icon: Icons.water_drop,
      webPath: '/tools/watermark',
    ),
    Tool(
      id: 'crop',
      titleKey: 'tools.crop',
      descriptionKey: 'tools.crop_desc',
      category: ToolCategory.edit,
      route: '/tools/crop',
      icon: Icons.crop,
      webPath: '/tools/crop',
    ),
    Tool(
      id: 'edit-pdf',
      titleKey: 'tools.edit_pdf',
      descriptionKey: 'tools.edit_pdf_desc',
      category: ToolCategory.edit,
      route: '/tools/edit-pdf',
      icon: Icons.edit_note,
      webPath: '/tools/edit-pdf',
    ),
    Tool(
      id: 'forms-extract',
      titleKey: 'tools.forms_extract',
      descriptionKey: 'tools.forms_extract_desc',
      category: ToolCategory.edit,
      route: '/tools/forms-extract',
      icon: Icons.dynamic_form,
      webPath: '/tools/forms-extract',
    ),

    // ─── Security ─────────────────────────────────────────────
    Tool(
      id: 'unlock',
      titleKey: 'tools.unlock',
      descriptionKey: 'tools.unlock_desc',
      category: ToolCategory.security,
      route: '/tools/unlock',
      icon: Icons.lock_open,
      webPath: '/tools/unlock',
    ),
    Tool(
      id: 'protect',
      titleKey: 'tools.protect',
      descriptionKey: 'tools.protect_desc',
      category: ToolCategory.security,
      route: '/tools/protect',
      icon: Icons.lock,
      webPath: '/tools/protect',
    ),
    Tool(
      id: 'sign',
      titleKey: 'tools.sign',
      descriptionKey: 'tools.sign_desc',
      category: ToolCategory.security,
      route: '/tools/sign',
      icon: Icons.draw,
      webPath: '/tools/sign',
    ),
    Tool(
      id: 'redact',
      titleKey: 'tools.redact',
      descriptionKey: 'tools.redact_desc',
      category: ToolCategory.security,
      route: '/tools/redact',
      icon: Icons.format_color_fill,
      webPath: '/tools/redact',
    ),
    Tool(
      id: 'compare',
      titleKey: 'tools.compare',
      descriptionKey: 'tools.compare_desc',
      category: ToolCategory.security,
      route: '/tools/compare',
      icon: Icons.compare_arrows,
      webPath: '/tools/compare',
      // Native ComparePage ships in
      // apps/mobile/lib/features/tools/compare_page.dart and is
      // wired to /tools/compare directly in app_router.dart.
      placeholder: false,
    ),

    // ─── Intelligence (AI) ────────────────────────────────────
    Tool(
      id: 'summarize',
      titleKey: 'tools.summarize',
      descriptionKey: 'tools.summarize_desc',
      category: ToolCategory.intelligence,
      route: '/tools/summarize',
      icon: Icons.auto_awesome,
      webPath: '/tools/summarize',
      requiresSignIn: true,
    ),
    Tool(
      id: 'translate',
      titleKey: 'tools.translate',
      descriptionKey: 'tools.translate_desc',
      category: ToolCategory.intelligence,
      route: '/tools/translate',
      icon: Icons.translate,
      webPath: '/tools/translate',
      requiresSignIn: true,
    ),

    // ─── Accessibility ───────────────────────────────────────
    Tool(
      id: 'read-aloud',
      titleKey: 'tools.read_aloud',
      descriptionKey: 'tools.read_aloud_desc',
      category: ToolCategory.accessibility,
      route: '/tools/read-aloud',
      icon: Icons.volume_up,
      webPath: '/tools/read-aloud',
    ),
    Tool(
      id: 'dictate',
      titleKey: 'tools.dictate',
      descriptionKey: 'tools.dictate_desc',
      category: ToolCategory.accessibility,
      route: '/tools/dictate',
      icon: Icons.mic,
      webPath: '/tools/dictate',
    ),
  ];

  /// Returns the tools in a given category, in registration order.
  static List<Tool> byCategory(ToolCategory c) =>
      all.where((t) => t.category == c).toList();

  /// Returns all categories that have at least one tool. Since the
  /// registry covers every category, this is just `ToolCategory.values`.
  static List<ToolCategory> activeCategories() => ToolCategory.values;

  /// Looks up a tool by its `id`. Returns null if not found.
  static Tool? byId(String id) {
    for (final t in all) {
      if (t.id == id) return t;
    }
    return null;
  }

  /// Search by title / description. Case-insensitive substring match
  /// against the i18n key (e.g. "tools.merge" or "tools.merge_desc")
  /// and the raw English fallback. Used by the dashboard search bar.
  static List<Tool> search(String query) {
    if (query.isEmpty) return all;
    final q = query.toLowerCase();
    return all.where((t) {
      // The dashboard's i18n key is "tools.<id>" — the raw id is a
      // reasonable English proxy for "search by English name". This
      // keeps search working before the i18n strings are loaded.
      return t.id.toLowerCase().contains(q) ||
          t.titleKey.toLowerCase().contains(q) ||
          t.descriptionKey.toLowerCase().contains(q);
    }).toList();
  }
}
