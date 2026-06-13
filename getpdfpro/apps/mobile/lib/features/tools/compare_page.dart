import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../core/api_client.dart';
import 'widgets/file_picker_field.dart';

/// Compare PDF tool page.
///
/// Two-file PDF diff. The server picks the best adapter available
/// (Adobe Document Compare first, local PyMuPDF fallback) and tells
/// us which one served the request via the `X-Cascade-Adapter`
/// response header. Both adapters return a JSON report; the shape
/// differs but we render it defensively and always show the raw
/// body in an expandable "Raw report" section so the user can see
/// what came back even if our best-effort rendering misses a new
/// field.
///
/// The endpoint is `POST /api/v1/pdf/compare-download`. We send
/// two multipart parts named `file_a` and `file_b`. The server
/// caps the combined size at 50 MB — we re-check that limit on
/// the client for a fast UX (no round-trip wasted on an obvious
/// oversize).
class ComparePage extends StatefulWidget {
  const ComparePage({super.key, this.dio});

  /// Optional Dio override. When non-null, used instead of
  /// [ApiClient.instance.dio]. Tests inject a Dio with a custom
  /// `httpClientAdapter` to assert error states without hitting
  /// the network. The auth interceptor is still required for the
  /// production build — the default `ApiClient.instance.dio`
  /// path preserves that behavior.
  @visibleForTesting
  final Dio? dio;

  @override
  State<ComparePage> createState() => _ComparePageState();
}

class _ComparePageState extends State<ComparePage> {
  /// 50 MB total cap. Matches the server's `settings.compare.max_total`
  /// and the free-tier limit surfaced in the `errors.file_too_large`
  /// i18n string.
  static const int _maxTotalBytes = 50 * 1024 * 1024;

  /// Endpoint we POST to. Same path the web app uses.
  static const String _endpoint = '/api/v1/pdf/compare-download';

  PlatformFile? _fileA;
  PlatformFile? _fileB;
  bool _busy = false;
  double _progress = 0.0;
  String? _error;

  /// Active cancel token for the in-flight request. `null` when
  /// no request is running. The cancel button is wired to this
  /// so a long-running compare can be aborted.
  CancelToken? _cancelToken;

  /// Parsed JSON from the server. We keep the raw map around so
  /// the "Raw report" expandable can pretty-print it later, even
  /// if the defensive parser above it found nothing to render.
  Map<String, dynamic>? _report;

  /// The value of the `X-Cascade-Adapter` response header. Drives
  /// the "compared via" chip in the result header.
  String? _adapter;

  @override
  void dispose() {
    _cancelToken?.cancel('disposed');
    super.dispose();
  }

  /// Test seam: set a fake File A. The real flow uses [_pickFile]
  /// which calls `FilePicker.platform.pickFiles` — that opens a
  /// system dialog and can't run under `flutter test`. Tests
  /// call this directly to put the page into the "both files
  /// picked" state without leaving the test harness.
  @visibleForTesting
  void debugSetFileA(PlatformFile? file) {
    setState(() {
      _fileA = file;
      _error = null;
      _report = null;
      _adapter = null;
      _progress = 0.0;
    });
  }

  /// Test seam: set a fake File B. See [debugSetFileA].
  @visibleForTesting
  void debugSetFileB(PlatformFile? file) {
    setState(() {
      _fileB = file;
      _error = null;
      _report = null;
      _adapter = null;
      _progress = 0.0;
    });
  }

  // ─── File picking ────────────────────────────────────────────

  Future<void> _pickFile({required bool isA}) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        withData: false,
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return;
      final picked = result.files.first;
      if (!mounted) return;
      setState(() {
        if (isA) {
          _fileA = picked;
        } else {
          _fileB = picked;
        }
        _error = null;
        _report = null;
        _adapter = null;
        _progress = 0.0;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = 'compare.picker_failed'.tr(
            namedArgs: {'error': e.toString()},
          ));
    }
  }

  void _clearFile({required bool isA}) {
    setState(() {
      if (isA) {
        _fileA = null;
      } else {
        _fileB = null;
      }
      _report = null;
      _adapter = null;
      _error = null;
    });
  }

  // ─── Validation ──────────────────────────────────────────────

  /// Returns the total size of the two picked files in bytes.
  /// Returns 0 if either is missing. Used by the size-cap gate.
  int _totalSizeBytes() {
    final a = _fileA?.size ?? 0;
    final b = _fileB?.size ?? 0;
    return a + b;
  }

  /// True when the user has picked both files AND the combined
  /// size is within the 50 MB cap. Drives the submit button.
  bool get _canSubmit =>
      !_busy &&
      _fileA != null &&
      _fileB != null &&
      _totalSizeBytes() <= _maxTotalBytes;

  /// Returns a human-readable error if we shouldn't submit, or
  /// `null` if everything looks good. Mirrors the size cap on
  /// the server so we don't burn a round-trip on a known-bad
  /// upload.
  String? _validateBeforeSubmit() {
    if (_fileA == null || _fileB == null) {
      return 'compare.both_required'.tr();
    }
    final total = _totalSizeBytes();
    if (total > _maxTotalBytes) {
      return 'compare.too_large'.tr(
        namedArgs: {
          'size': _formatBytes(total),
          'max': _formatBytes(_maxTotalBytes),
        },
      );
    }
    return null;
  }

  // ─── Submit ──────────────────────────────────────────────────

  Future<void> _doCompare() async {
    final guard = _validateBeforeSubmit();
    if (guard != null) {
      setState(() => _error = guard);
      return;
    }
    final pathA = _fileA!.path;
    final pathB = _fileB!.path;
    if (pathA == null || pathB == null) {
      setState(() => _error = 'compare.path_missing'.tr());
      return;
    }
    // Defensive: confirm the files exist on disk before we kick
    // off the multipart upload. The file picker can hand back a
    // stale path on some platforms (e.g. a content URI that was
    // revoked). We don't try to copy from a content URI here —
    // just bail with a clear error.
    final fileA = File(pathA);
    final fileB = File(pathB);
    if (!await fileA.exists() || !await fileB.exists()) {
      setState(() => _error = 'compare.file_missing'.tr());
      return;
    }

    final token = CancelToken();
    setState(() {
      _busy = true;
      _cancelToken = token;
      _error = null;
      _report = null;
      _adapter = null;
      _progress = 0.0;
    });

    try {
      final form = FormData.fromMap({
        'file_a': await MultipartFile.fromFile(pathA),
        'file_b': await MultipartFile.fromFile(pathB),
      });
      final response = await (widget.dio ?? ApiClient.instance.dio).post(
        _endpoint,
        data: form,
        options: Options(
          responseType: ResponseType.json,
          // Adobe can take 20s+ on a busy day; the global
          // uploadTimeout is 60s which is the right ceiling.
        ),
        onSendProgress: (sent, total) {
          if (total > 0 && mounted) {
            setState(() => _progress = (sent / total).clamp(0.0, 1.0));
          }
        },
        cancelToken: token,
      );
      // The body is always a JSON object — both adapters return
      // application/json with the report as the root.
      final body = response.data;
      Map<String, dynamic> json;
      if (body is Map<String, dynamic>) {
        json = body;
      } else if (body is String) {
        // Be permissive: some adapters might hand us a JSON
        // string. Decode defensively.
        try {
          final decoded = jsonDecode(body);
          json = decoded is Map<String, dynamic>
              ? decoded
              : <String, dynamic>{'raw': decoded};
        } catch (_) {
          json = <String, dynamic>{'raw': body};
        }
      } else {
        json = <String, dynamic>{'raw': body};
      }
      final adapter = response.headers.value('X-Cascade-Adapter');
      if (!mounted) return;
      setState(() {
        _report = json;
        _adapter = adapter;
        _progress = 1.0;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      if (CancelToken.isCancel(e)) {
        // User-initiated cancel. Don't surface an error — just
        // reset progress and let them try again.
        setState(() => _progress = 0.0);
        return;
      }
      setState(() => _error = _mapDioError(e));
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _cancelToken = null;
        });
      }
    }
  }

  void _cancel() {
    _cancelToken?.cancel('user-cancelled');
  }

  /// Maps a [DioException] to a user-friendly string. Falls back
  /// to the global [formatApiError] for non-2xx responses, then
  /// to a generic message for network / timeout / unknown.
  String _mapDioError(DioException e) {
    final status = e.response?.statusCode;
    if (status == 400) {
      return 'compare.error_400'.tr();
    }
    if (status == 413) {
      return 'compare.error_413'.tr();
    }
    if (status == 429 || status == 402) {
      return 'errors.rate_limited'.tr();
    }
    if (status != null && status >= 500) {
      return 'errors.server_error'.tr();
    }
    if (e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.sendTimeout ||
        e.type == DioExceptionType.receiveTimeout) {
      return 'errors.timeout'.tr();
    }
    if (e.type == DioExceptionType.connectionError) {
      return 'errors.network'.tr();
    }
    final detail = formatApiError(e.response?.data);
    if (detail.isNotEmpty) return detail;
    return 'common.error'.tr();
  }

  // ─── UI helpers ──────────────────────────────────────────────

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB';
  }

  // ─── Build ───────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text('compare.title'.tr())),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'compare.subtitle'.tr(),
              style: theme.textTheme.bodyMedium,
            ),
            const SizedBox(height: 24),
            _FileSlot(
              label: 'compare.file_a'.tr(),
              file: _fileA,
              onPick: () => _pickFile(isA: true),
              onClear: _fileA == null ? null : () => _clearFile(isA: true),
              accent: theme.colorScheme.primary,
            ),
            const SizedBox(height: 16),
            _FileSlot(
              label: 'compare.file_b'.tr(),
              file: _fileB,
              onPick: () => _pickFile(isA: false),
              onClear: _fileB == null ? null : () => _clearFile(isA: false),
              accent: theme.colorScheme.tertiary,
            ),
            if (_fileA != null && _fileB != null) ...[
              const SizedBox(height: 8),
              _SizeSummary(
                total: _totalSizeBytes(),
                max: _maxTotalBytes,
                formatBytes: _formatBytes,
              ),
            ],
            const SizedBox(height: 16),
            if (_error != null) _ErrorBanner(
              message: _error!,
              onRetry: _canSubmit ? _doCompare : null,
            ),
            if (_busy) _ProgressBar(value: _progress),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _canSubmit ? _doCompare : null,
                    icon: _busy
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.compare_arrows),
                    label: Text(
                      _busy
                          ? 'common.uploading'.tr()
                          : 'compare.start_compare'.tr(),
                    ),
                  ),
                ),
                if (_busy) ...[
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _cancel,
                    icon: const Icon(Icons.close),
                    label: Text('common.cancel'.tr()),
                  ),
                ],
              ],
            ),
            if (_report != null) ...[
              const SizedBox(height: 24),
              _ResultHeader(
                adapter: _adapter,
                report: _report!,
                formatBytes: _formatBytes,
              ),
              const SizedBox(height: 16),
              _ReportView(
                report: _report!,
                adapter: _adapter,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ─── Sub-widgets ────────────────────────────────────────────────

/// Labeled file-picker slot. Visually distinguishes File A and
/// File B with an accent strip on the leading edge.
class _FileSlot extends StatelessWidget {
  const _FileSlot({
    required this.label,
    required this.file,
    required this.onPick,
    required this.onClear,
    required this.accent,
  });

  final String label;
  final PlatformFile? file;
  final VoidCallback onPick;
  final VoidCallback? onClear;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 6),
          child: Text(
            label,
            style: theme.textTheme.titleSmall?.copyWith(
              color: accent,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Row(
          children: [
            Container(width: 4, height: 56, color: accent),
            const SizedBox(width: 8),
            Expanded(
              child: FilePickerField(
                file: file,
                onPick: onPick,
                onClear: onClear,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

/// Total-size summary shown under the two pickers. Goes red when
/// the combined size is over the cap so the user has immediate
/// feedback without submitting.
class _SizeSummary extends StatelessWidget {
  const _SizeSummary({
    required this.total,
    required this.max,
    required this.formatBytes,
  });

  final int total;
  final int max;
  final String Function(int) formatBytes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final overCap = total > max;
    final color = overCap
        ? theme.colorScheme.error
        : theme.colorScheme.onSurfaceVariant;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        'compare.total_size'.tr(namedArgs: {
          'size': formatBytes(total),
          'max': formatBytes(max),
        }),
        style: theme.textTheme.bodySmall?.copyWith(color: color),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, this.onRetry});
  final String message;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: theme.colorScheme.errorContainer,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: theme.colorScheme.onErrorContainer),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: theme.colorScheme.onErrorContainer),
            ),
          ),
          if (onRetry != null)
            TextButton(
              onPressed: onRetry,
              child: Text('common.try_again'.tr()),
            ),
        ],
      ),
    );
  }
}

class _ProgressBar extends StatelessWidget {
  const _ProgressBar({required this.value});
  final double value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: LinearProgressIndicator(value: value > 0 ? value : null),
    );
  }
}

/// Result header. Shows the page counts (if present) and the
/// "compared via" chip so the user knows which adapter served
/// the request.
class _ResultHeader extends StatelessWidget {
  const _ResultHeader({
    required this.adapter,
    required this.report,
    required this.formatBytes,
  });

  final String? adapter;
  final Map<String, dynamic> report;
  final String Function(int) formatBytes;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pagesA = _asInt(_firstOf(report, const [
      'pages_a', 'page_count_a', 'pagesA', 'pageCountA',
      'pageCountA', 'file_a_pages',
    ]));
    final pagesB = _asInt(_firstOf(report, const [
      'pages_b', 'page_count_b', 'pagesB', 'pageCountB',
      'pageCountB', 'file_b_pages',
    ]));
    return Card(
      elevation: 0,
      color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.check_circle),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'compare.complete'.tr(),
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                _AdapterChip(value: adapter),
              ],
            ),
            const SizedBox(height: 8),
            if (pagesA != null || pagesB != null)
              Text(
                'compare.page_counts'.tr(namedArgs: {
                  'a': pagesA?.toString() ?? '?',
                  'b': pagesB?.toString() ?? '?',
                }),
                style: theme.textTheme.bodyMedium,
              ),
          ],
        ),
      ),
    );
  }
}

/// Small chip in the result header. Maps the raw adapter value
/// (e.g. "adobe", "local-pymupdf") to a friendly label. Falls
/// back to the raw value if we don't recognize it.
class _AdapterChip extends StatelessWidget {
  const _AdapterChip({required this.value});
  final String? value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final v = (value ?? '').toLowerCase().trim();
    String label;
    if (v == 'adobe') {
      label = 'compare.adapter_adobe'.tr();
    } else if (v == 'local-pymupdf' || v == 'local_pymupdf' || v == 'pymupdf') {
      label = 'compare.adapter_local'.tr();
    } else if (v.isEmpty) {
      label = 'compare.adapter_unknown'.tr();
    } else {
      label = v;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSecondaryContainer,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// Tier-aware report renderer. Picks the most informative section
/// of the response based on the adapter header, falling back to
/// the raw report if the JSON shape is unknown to us.
class _ReportView extends StatelessWidget {
  const _ReportView({required this.report, required this.adapter});
  final Map<String, dynamic> report;
  final String? adapter;

  @override
  Widget build(BuildContext context) {
    final v = (adapter ?? '').toLowerCase().trim();
    if (v == 'adobe') {
      return _AdobeReportView(report: report);
    }
    if (v == 'local-pymupdf' || v == 'local_pymupdf' || v == 'pymupdf') {
      return _LocalReportView(report: report);
    }
    return _GenericReportView(report: report);
  }
}

/// Adobe Document Compare report. The server hands us a list of
/// "added", "removed", and "modified" blocks (paragraphs / regions
/// from the structured diff). We render each as a numbered
/// section with the first line of text, if available.
class _AdobeReportView extends StatelessWidget {
  const _AdobeReportView({required this.report});
  final Map<String, dynamic> report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final added = _extractList(report, const [
      'added', 'additions', 'insertions',
    ]);
    final removed = _extractList(report, const [
      'removed', 'deletions',
    ]);
    final modified = _extractList(report, const [
      'modified', 'changes', 'modifications',
    ]);
    final similarity = _asDouble(_firstOf(report, const [
      'similarity', 'similarity_pct', 'match_pct',
    ]));
    final hasContent =
        added.isNotEmpty || removed.isNotEmpty || modified.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (similarity != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              'compare.similarity'.tr(namedArgs: {
                'pct': similarity.toStringAsFixed(1),
              }),
              style: theme.textTheme.titleMedium,
            ),
          ),
        if (!hasContent) ...[
          Text(
            'compare.no_changes'.tr(),
            style: theme.textTheme.bodyMedium,
          ),
        ] else ...[
          if (added.isNotEmpty)
            _ChangeSection(
              title: 'compare.section_added'.tr(namedArgs: {
                'count': added.length.toString(),
              }),
              color: Colors.green,
              items: added,
            ),
          if (removed.isNotEmpty)
            _ChangeSection(
              title: 'compare.section_removed'.tr(namedArgs: {
                'count': removed.length.toString(),
              }),
              color: theme.colorScheme.error,
              items: removed,
            ),
          if (modified.isNotEmpty)
            _ChangeSection(
              title: 'compare.section_modified'.tr(namedArgs: {
                'count': modified.length.toString(),
              }),
              color: theme.colorScheme.tertiary,
              items: modified,
            ),
        ],
        const SizedBox(height: 16),
        _RawReport(report: report),
      ],
    );
  }
}

/// Local PyMuPDF report. Per-page stats: chars in A, chars in B,
/// overlap %, words A-only, words B-only. The server returns a
/// `pages` array of objects; we render a compact table.
class _LocalReportView extends StatelessWidget {
  const _LocalReportView({required this.report});
  final Map<String, dynamic> report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pages = _extractList(report, const ['pages', 'per_page', 'results']);
    final similarity = _asDouble(_firstOf(report, const [
      'similarity', 'similarity_pct', 'overall_similarity',
    ]));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (similarity != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              'compare.similarity'.tr(namedArgs: {
                'pct': similarity.toStringAsFixed(1),
              }),
              style: theme.textTheme.titleMedium,
            ),
          ),
        if (pages.isEmpty) ...[
          Text('compare.no_changes'.tr(), style: theme.textTheme.bodyMedium),
        ] else ...[
          _PageTable(pages: pages),
        ],
        const SizedBox(height: 16),
        _RawReport(report: report),
      ],
    );
  }
}

/// Compact per-page table for the local (PyMuPDF) tier. Each
/// row shows: page #, chars A, chars B, overlap %, A-only words,
/// B-only words. Tolerant of missing fields per row.
class _PageTable extends StatelessWidget {
  const _PageTable({required this.pages});
  final List<dynamic> pages;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            for (var i = 0; i < pages.length; i++)
              _PageRow(
                index: i,
                page: pages[i] is Map ? pages[i] as Map : const {},
              ),
          ],
        ),
      ),
    );
  }
}

class _PageRow extends StatelessWidget {
  const _PageRow({required this.index, required this.page});
  final int index;
  final Map page;

  int? get _pageNumber => _asInt(_firstOfMap(page, const [
        'page', 'page_number', 'pageNumber', 'index', 'n',
      ]));
  int? get _charsA => _asInt(_firstOfMap(page, const [
        'chars_a', 'charsA', 'chars_file_a', 'length_a', 'a_chars',
      ]));
  int? get _charsB => _asInt(_firstOfMap(page, const [
        'chars_b', 'charsB', 'chars_file_b', 'length_b', 'b_chars',
      ]));
  double? get _overlap => _asDouble(_firstOfMap(page, const [
        'overlap', 'overlap_pct', 'similarity', 'match_pct',
      ]));
  int? get _aOnly => _asInt(_firstOfMap(page, const [
        'words_a_only', 'wordsAOnly', 'a_only', 'aOnly', 'unique_a',
      ]));
  int? get _bOnly => _asInt(_firstOfMap(page, const [
        'words_b_only', 'wordsBOnly', 'b_only', 'bOnly', 'unique_b',
      ]));

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final pageNum = _pageNumber ?? (index + 1);
    final overlap = _overlap;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'compare.page_label'.tr(namedArgs: {'n': pageNum.toString()}),
                style: theme.textTheme.titleSmall,
              ),
              const Spacer(),
              if (overlap != null)
                Text(
                  '${overlap.toStringAsFixed(1)}%',
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 2),
          Wrap(
            spacing: 12,
            runSpacing: 4,
            children: [
              if (_charsA != null)
                _Stat(label: 'compare.chars_a'.tr(), value: _charsA.toString()),
              if (_charsB != null)
                _Stat(label: 'compare.chars_b'.tr(), value: _charsB.toString()),
              if (_aOnly != null)
                _Stat(label: 'compare.words_a_only'.tr(), value: _aOnly.toString()),
              if (_bOnly != null)
                _Stat(label: 'compare.words_b_only'.tr(), value: _bOnly.toString()),
            ],
          ),
          if (index < 1) const Divider(),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Text.rich(
      TextSpan(
        style: theme.textTheme.bodySmall,
        children: [
          TextSpan(
            text: '$label: ',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          TextSpan(
            text: value,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Rendered when we don't recognize the adapter (e.g. a future
/// tier that the mobile app hasn't been taught about yet).
/// Shows the raw report in an expandable section so the user
/// can still inspect what the server returned.
class _GenericReportView extends StatelessWidget {
  const _GenericReportView({required this.report});
  final Map<String, dynamic> report;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final summary = _firstOf(report, const ['summary', 'message', 'note']);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (summary is String && summary.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(summary, style: theme.textTheme.bodyMedium),
          ),
        _RawReport(report: report),
      ],
    );
  }
}

/// A change section. Tries to show a preview line for each item
/// (looking for `text`, `content`, or `snippet` keys). Falls
/// back to showing the item's key-value summary if nothing
/// string-shaped is found.
class _ChangeSection extends StatelessWidget {
  const _ChangeSection({
    required this.title,
    required this.color,
    required this.items,
  });
  final String title;
  final Color color;
  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(width: 8, height: 8, decoration: BoxDecoration(
                color: color, shape: BoxShape.circle,
              )),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: theme.textTheme.titleSmall,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          for (var i = 0; i < items.length; i++)
            Padding(
              padding: const EdgeInsets.only(left: 16, top: 4, bottom: 4),
              child: Text(
                '${i + 1}. ${_previewOf(items[i])}',
                style: theme.textTheme.bodySmall,
              ),
            ),
        ],
      ),
    );
  }
}

/// Expandable section that pretty-prints the raw JSON. We always
/// show this last so the user can see exactly what the server
/// returned even if our best-effort rendering above missed a
/// field.
class _RawReport extends StatefulWidget {
  const _RawReport({required this.report});
  final Map<String, dynamic> report;

  @override
  State<_RawReport> createState() => _RawReportState();
}

class _RawReportState extends State<_RawReport> {
  bool _expanded = false;
  bool _copied = false;

  String get _pretty => const JsonEncoder.withIndent('  ').convert(widget.report);

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _pretty));
    if (!mounted) return;
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Icon(
                    _expanded ? Icons.expand_less : Icons.expand_more,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'compare.raw_report'.tr(),
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                  IconButton(
                    icon: Icon(
                      _copied ? Icons.check : Icons.copy,
                      size: 18,
                    ),
                    tooltip: 'common.copy'.tr(),
                    onPressed: _copy,
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.surface,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: SelectableText(
                  _pretty,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Defensive parsing helpers ─────────────────────────────────

dynamic _firstOf(Map<dynamic, dynamic> map, List<String> keys) {
  for (final k in keys) {
    if (map.containsKey(k) && map[k] != null) return map[k];
  }
  return null;
}

dynamic _firstOfMap(Map map, List<String> keys) {
  for (final k in keys) {
    if (map.containsKey(k) && map[k] != null) return map[k];
  }
  return null;
}

List<dynamic> _extractList(Map<dynamic, dynamic> map, List<String> keys) {
  for (final k in keys) {
    final v = map[k];
    if (v is List) return v;
  }
  return const [];
}

int? _asInt(dynamic v) {
  if (v is int) return v;
  if (v is double) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

double? _asDouble(dynamic v) {
  if (v is double) return v;
  if (v is int) return v.toDouble();
  if (v is String) return double.tryParse(v);
  return null;
}

String _previewOf(dynamic item) {
  if (item is String) return item;
  if (item is Map) {
    for (final k in const ['text', 'content', 'snippet', 'preview', 'body']) {
      final v = item[k];
      if (v is String && v.isNotEmpty) return v;
    }
    return item.toString();
  }
  return item.toString();
}
