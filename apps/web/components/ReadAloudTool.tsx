"use client";

/**
 * Standalone Read-Aloud tool.
 *
 * Paste any text → choose a language + voice + speed → tap play.
 * Uses the Web Speech API (SpeechSynthesis) — zero server cost, works
 * offline, voices depend on the user's OS.
 *
 * Use cases:
 *   - Listen to long emails, articles, or notes without re-reading
 *   - Accessibility: hear content instead of reading it
 *   - Pronunciation check: hear a phrase in a target language before
 *     committing to it (e.g. before a meeting)
 */

import { useEffect, useRef, useState } from "react";
import {
  isTtsSupported,
  getAvailableVoices,
  speak,
  shortLangToBcp47,
  type TtsState,
} from "@/lib/speech";
import {
  Mic,
  Play,
  Pause,
  Square,
  Volume2,
  Copy,
  Check,
  Download,
  RotateCcw,
  Info,
  Globe,
  Settings2,
} from "lucide-react";

const LANG_OPTIONS: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "nl", label: "Dutch" },
  { code: "ru", label: "Russian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
];

const SAMPLE_TEXT =
  "Welcome to GetPDFPro's read-aloud tool. Paste any text here, choose a language, and tap play. The voice you hear comes from your operating system — Safari uses the macOS or iOS TTS engine, Chrome and Edge use Google's cloud voices, and Firefox falls back to the system TTS. Your text never leaves your device.";

export function ReadAloudTool() {
  const [text, setText] = useState<string>(SAMPLE_TEXT);
  const [lang, setLang] = useState<string>("en");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string>("");
  const [rate, setRate] = useState<number>(1);
  const [pitch, setPitch] = useState<number>(1);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<TtsState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const controllerRef = useRef<ReturnType<typeof speak> | null>(null);

  // Detect support and load voices
  useEffect(() => {
    setSupported(isTtsSupported());
    if (!isTtsSupported()) return;
    getAvailableVoices().then((v) => {
      // Filter to voices matching the chosen language
      const filtered = v.filter((voice) => {
        const primary = voice.lang.toLowerCase().split("-")[0];
        return primary === lang.toLowerCase();
      });
      setVoices(filtered);
      // Auto-pick a default voice if none selected yet
      if (!voiceName && filtered.length > 0) {
        // Prefer local / native voices
        const local = filtered.find((v) => v.localService);
        setVoiceName((local ?? filtered[0]).name);
      }
    });
  }, [lang, voiceName]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

  if (supported === false) {
    return (
      <div className="container-narrow py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Read Aloud
        </h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            Your browser doesn&apos;t support text-to-speech
          </h2>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            The Web Speech API is supported in Chrome, Edge, and Safari.
            Firefox does not currently support speech synthesis. Try a
            different browser to use this tool.
          </p>
        </div>
      </div>
    );
  }

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;
  // Rough estimate: ~150 words/min at 1.0x
  const estimatedMinutes = Math.max(1, Math.round(wordCount / (150 * rate)));

  const start = () => {
    if (!text.trim()) {
      setError("Paste or type some text first.");
      return;
    }
    setError(null);
    const targetLang = shortLangToBcp47(lang);
    try {
      const controller = speak(text, {
        lang: targetLang,
        rate,
        pitch,
        voiceName: voiceName || undefined,
      });
      controllerRef.current = controller;
      setState("speaking");
      controller.onEnd(() => setState("idle"));
      controller.onError((err) => {
        setError(err);
        setState("idle");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start speech.");
      setState("idle");
    }
  };
  const pause = () => {
    controllerRef.current?.pause();
    setState("paused");
  };
  const resume = () => {
    controllerRef.current?.resume();
    setState("speaking");
  };
  const stop = () => {
    controllerRef.current?.cancel();
    controllerRef.current = null;
    setState("idle");
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  const onDownload = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "read-aloud-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  const onClear = () => {
    stop();
    setText("");
  };

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Volume2 className="h-3.5 w-3.5 text-brand-600" />
          <span>Accessibility · in-browser</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Read Aloud
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Paste any text and have it spoken aloud by your browser&apos;s
          built-in voice. Choose a language, voice, and speed. Your
          text never leaves your device — this is pure Web Speech API.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Voice quality and selection depend on your browser and OS.
          Chrome and Edge ship Google&apos;s cloud voices; Safari uses the
          macOS / iOS TTS engine; Firefox falls back to the system TTS.
          Your text is processed entirely in your browser.
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Globe className="h-3.5 w-3.5" /> Language
            </span>
            <select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                setVoiceName(""); // reset voice so we auto-pick for new lang
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Voice
            </span>
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {voices.length === 0 && <option value="">(system default)</option>}
              {voices.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} {v.localService ? "" : "· cloud"}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Speed: {rate.toFixed(1)}x
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
              className="mt-2 w-full"
              aria-label="Speech rate"
            />
          </label>
        </div>

        <div className="mt-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Pitch: {pitch.toFixed(1)}
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="mt-2 w-full"
              aria-label="Speech pitch"
            />
          </label>
        </div>
      </div>

      {/* Text area */}
      <div className="mt-4">
        <label htmlFor="read-aloud-text" className="sr-only">
          Text to read aloud
        </label>
        <textarea
          id="read-aloud-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Paste or type any text here…"
          className="w-full rounded-2xl border border-slate-300 bg-white p-5 text-base leading-relaxed text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {wordCount.toLocaleString()} words · {charCount.toLocaleString()}{" "}
            characters · ~{estimatedMinutes} min at {rate.toFixed(1)}x
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={onDownload}
              disabled={!text}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Download className="h-3 w-3" /> .txt
            </button>
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {state === "idle" && (
          <button
            type="button"
            onClick={start}
            disabled={!text.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="h-4 w-4" /> Read aloud
          </button>
        )}
        {state === "speaking" && (
          <>
            <button
              type="button"
              onClick={pause}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
            >
              <Pause className="h-4 w-4" /> Pause
            </button>
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
            <span className="ml-2 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-rose-500" />
              Speaking…
            </span>
          </>
        )}
        {state === "paused" && (
          <>
            <button
              type="button"
              onClick={resume}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              <Play className="h-4 w-4" /> Resume
            </button>
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Square className="h-4 w-4" /> Stop
            </button>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
              Paused
            </span>
          </>
        )}
        {error && (
          <span
            role="alert"
            className="text-sm text-rose-600 dark:text-rose-400"
            title={error}
          >
            {error}
          </span>
        )}
      </div>

      {/* Tips */}
      <div className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Tips
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
          <li>
            <strong>For long articles:</strong> paste a URL into a text
            extractor, copy the result, paste here. The 50,000-character
            limit is browser-dependent but most handle up to 32k.
          </li>
          <li>
            <strong>For language learning:</strong> pick a slow speed
            (0.6-0.8x) and a voice from the target language. The IPA
            alignment helps with pronunciation.
          </li>
          <li>
            <strong>For proofreading:</strong> listen at 1.0x with the
            default voice. Hearing your own writing read back is the
            fastest way to spot missing words and awkward phrasing.
          </li>
        </ul>
      </div>
    </div>
  );
}
