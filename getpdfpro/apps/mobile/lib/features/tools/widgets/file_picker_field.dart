import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

/// Reusable file-picker row used by tool pages (Compress, PDF-to-Image,
/// Merge, Split, ...).
///
/// UX:
///   - When no file is picked: a tappable "Pick a file" affordance
///     with an upload icon and the localized `common.upload` label.
///   - When a file is picked: shows the file name + size, with a
///     clear button (×) to unset it.
///
/// The row is tappable even when a file is picked — this lets the
/// user re-pick a different file without first clearing.
///
/// `onClear` is null when no file is picked — the clear button is
/// hidden in that case so the row stays compact.
class FilePickerField extends StatelessWidget {
  const FilePickerField({
    super.key,
    required this.file,
    required this.onPick,
    this.onClear,
  });

  /// The currently-picked file, or null if none.
  final PlatformFile? file;

  /// Called when the user taps the row. Use to launch FilePicker.
  final VoidCallback onPick;

  /// Called when the user taps the × button. If null, the × is
  /// hidden (no file picked, nothing to clear).
  final VoidCallback? onClear;

  String _formatSize(int? bytes) {
    if (bytes == null) return '';
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final f = file;
    return InkWell(
      onTap: onPick,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          border: Border.all(color: theme.colorScheme.outline),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              f == null ? Icons.upload_file : Icons.picture_as_pdf,
              color: theme.colorScheme.primary,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    f == null ? 'common.upload'.tr() : f.name,
                    style: theme.textTheme.bodyLarge,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (f != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      _formatSize(f.size),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (onClear != null)
              IconButton(
                icon: const Icon(Icons.close),
                tooltip: 'common.delete'.tr(),
                onPressed: onClear,
              ),
          ],
        ),
      ),
    );
  }
}
