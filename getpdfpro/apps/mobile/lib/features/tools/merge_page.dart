import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// First tool page — Merge PDFs.
/// Demonstrates: file picker, voice command ("merge these files"),
/// progress, download.
class MergePage extends StatefulWidget {
  const MergePage({super.key});

  @override
  State<MergePage> createState() => _MergePageState();
}

class _MergePageState extends State<MergePage> {
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _speechAvailable = false;
  bool _listening = false;

  @override
  void initState() {
    super.initState();
    _initSpeech();
  }

  Future<void> _initSpeech() async {
    _speechAvailable = await _speech.initialize(
      onError: (e) => debugPrint('Speech error: $e'),
      onStatus: (s) => debugPrint('Speech status: $s'),
    );
    if (mounted) setState(() {});
  }

  Future<void> _toggleListen() async {
    if (!_speechAvailable) return;
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
    } else {
      await _speech.listen(
        onResult: (result) {
          debugPrint('Heard: ${result.recognizedWords}');
          if (result.finalResult && result.recognizedWords.toLowerCase().contains('merge')) {
            // Trigger merge
            _doMerge();
          }
        },
      );
      setState(() => _listening = true);
    }
  }

  Future<void> _doMerge() async {
    // TODO: file picker + call API
    debugPrint('Merging files...');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('tools.merge'.tr())),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.merge_type, size: 96),
            const SizedBox(height: 24),
            Text('tools.merge'.tr(), style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text('tools.merge_desc'.tr(), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: _doMerge,
              icon: const Icon(Icons.upload),
              label: Text('common.upload'.tr()),
            ),
            const SizedBox(height: 16),
            if (_speechAvailable)
              OutlinedButton.icon(
                onPressed: _toggleListen,
                icon: Icon(_listening ? Icons.mic : Icons.mic_none),
                label: Text(_listening
                    ? 'dashboard.listening'.tr()
                    : 'common.tap_to_speak'.tr()),
              ),
          ],
        ),
      ),
    );
  }
}
