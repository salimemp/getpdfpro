import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

import '../../core/api_client.dart';

/// Page for tools that take a text input (not a file) and
/// return text or audio. Currently used for: AI Summarize,
/// AI Translate, Read Aloud, Dictate.
///
/// Calls `POST <endpoint>` with a JSON body containing
/// `text` (and any other fields the spec declares), then
/// renders the response. For Read Aloud, the response is
/// played via the Web Speech API on the client (TTS is
/// cheap, server-side TTS would mean streaming audio).
class TextInputToolPage extends StatefulWidget {
  const TextInputToolPage({
    super.key,
    required this.title,
    required this.subtitle,
    required this.endpoint,
    required this.responseKey,
    this.preSubmitHint,
  });

  final String title;
  final String subtitle;

  /// API endpoint, e.g. `/api/v1/ai/summarize-download`.
  final String endpoint;

  /// The JSON response field containing the result text.
  /// e.g. `"summary"`, `"translation"`.
  final String responseKey;

  /// Optional placeholder for the input TextField.
  final String? preSubmitHint;

  @override
  State<TextInputToolPage> createState() => _TextInputToolPageState();
}

class _TextInputToolPageState extends State<TextInputToolPage> {
  final _inputController = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _resultText;

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final text = _inputController.text.trim();
    if (text.isEmpty) {
      setState(() => _error = 'Enter some text');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _resultText = null;
    });
    try {
      final response = await ApiClient.instance.dio.post(
        widget.endpoint,
        data: {'text': text},
      );
      final data = response.data;
      String? result;
      if (data is Map && data.containsKey(widget.responseKey)) {
        result = data[widget.responseKey] as String?;
      } else if (data is String) {
        result = data;
      }
      if (mounted) {
        setState(() {
          _resultText = result ?? '(no result)';
        });
      }
    } on DioException catch (e) {
      setState(() => _error = formatApiError(e.response?.data));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.subtitle, style: theme.textTheme.bodyMedium),
            const SizedBox(height: 24),
            TextField(
              controller: _inputController,
              maxLines: 8,
              minLines: 4,
              decoration: InputDecoration(
                labelText: 'Input',
                hintText: widget.preSubmitHint,
                border: const OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.errorContainer,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline, color: theme.colorScheme.onErrorContainer),
                    const SizedBox(width: 8),
                    Expanded(child: Text(_error!)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
            ],
            FilledButton.icon(
              onPressed: _busy ? null : _submit,
              icon: _busy
                  ? const SizedBox(
                      width: 16, height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send),
              label: Text('Run'),
            ),
            if (_resultText != null) ...[
              const SizedBox(height: 24),
              Card(
                elevation: 0,
                color: theme.colorScheme.primaryContainer.withValues(alpha: 0.3),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: const [
                          Icon(Icons.check_circle),
                          SizedBox(width: 8),
                          Text('Result'),
                        ],
                      ),
                      const SizedBox(height: 12),
                      SelectableText(
                        _resultText!,
                        style: theme.textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
