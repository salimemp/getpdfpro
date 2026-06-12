"use client";

/**
 * Standalone Dictate tool (speech-to-text).
 *
 * Tap the mic, speak, see your words appear. Copy or download the
 * transcript. Uses the Web Speech API (SpeechRecognition).
 *
 * Use cases:
 *   - Hands-free note taking
 *   - Drafting an email when typing is inconvenient
 *   - Capturing thoughts while walking
 *   - Voice input for users with motor impairments
 *
 * Browser support: Chrome, Edge, Safari (with permission). Firefox
 * doesn't support it — the UI shows a clear message and recommends
 * trying Chrome/Edge.
 */

import { useEffect, useRef, useState } from "react";
import {
  isSttSupported,
  listen,
  shortLangToBcp47,
  type SttState,
} from "@/lib/speech";
import {
  Mic,
  MicOff,
  Square,
  Copy,
  Check,
  Download,
  RotateCcw,
  Info,
  Globe,
  Trash2,
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
  { code: "zh", label: "Chinese (Mandarin)" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "tr", label: "Turkish" },
  { code: "pl", label: "Polish" },
  { code: "uk", label: "Ukrainian" },
  { code: "sv", label: "Swedish" },
  { code: "no", label: "Norwegian" },
  { code: "da", label: "Danish" },
  { code: "fi", label: "Finnish" },
];

export function DictateTool() {
  const [text, setText] = useState<string>("");
  const [interim, setInterim] = useState<string>("");
  const [lang, setLang] = useState<string>("en");
  const [continuous, setContinuous] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<SttState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [autoCapitalize, setAutoCapitalize] = useState(true);
  const controllerRef = useRef<ReturnType<typeof listen> | null>(null);

  useEffect(() => {
    setSupported(isSttSupported());
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
    };
  }, []);

  if (supported === false) {
    return (
      <div className="container-narrow py-12">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Dictate
        </h1>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/30">
          <h2 className="font-semibold text-amber-900 dark:text-amber-200">
            Your browser doesn&apos;t support speech recognition
          </h2>
          <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
            The Web Speech API for speech-to-text is supported in
            Chrome, Edge, and Safari. Firefox does not currently
            support it. Try one of the other browsers to use this
            tool.
          </p>
        </div>
      </div>
    );
  }

  const start = async () => {
    setError(null);
    setInterim("");
    const targetLang = shortLangToBcp47(lang);
    try {
      const controller = listen(
        (transcript, isFinal) => {
          if (isFinal) {
            setText((prev) => {
              const sep = prev && !prev.endsWith(" ") && !prev.endsWith("\n") ? " " : "";
              return prev + sep + transcript;
            });
            setInterim("");
          } else {
            setInterim(transcript);
          }
        },
        { lang: targetLang, continuous, interimResults: true }
      );
      controllerRef.current = controller;
      setState("listening");
      controller.onError((err) => {
        // "no-speech" and "aborted" are common benign events.
        if (err === "no-speech" || err === "aborted") {
          setState("idle");
          return;
        }
        setError(err);
        setState("error");
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not start dictation. Did you allow microphone access?"
      );
      setState("error");
    }
  };

  const stop = () => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setState("idle");
    // Flush any final interim
    if (interim) {
      setText((prev) => prev + (prev && !prev.endsWith(" ") ? " " : "") + interim);
      setInterim("");
    }
  };

  const onCopy = async () => {
    if (!text) return;
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
    a.download = "dictation.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  const onClear = () => {
    stop();
    setText("");
    setInterim("");
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="container-narrow py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Mic className="h-3.5 w-3.5 text-brand-600" />
          <span>Accessibility · in-browser</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Dictate
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Speech-to-text in your browser. Tap the mic, speak, see your
          words appear. Copy or download the transcript when you&apos;re
          done. Your audio never leaves your device.
        </p>
      </div>

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          The browser will ask for microphone permission the first
          time. Audio is processed entirely in your browser via the
          Web Speech API — no audio is sent to any server. For best
          accuracy, speak in a quiet environment and use a good mic.
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
              <Globe className="h-3.5 w-3.5" /> Language
            </span>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={state === "listening"}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 self-end">
            <input
              type="checkbox"
              checked={continuous}
              onChange={(e) => setContinuous(e.target.checked)}
              disabled={state === "listening"}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">
              Keep listening after each phrase (continuous mode)
            </span>
          </label>
        </div>
      </div>

      {/* Big mic button */}
      <div className="mt-6 flex justify-center">
        {state !== "listening" ? (
          <button
            type="button"
            onClick={start}
            aria-label="Start dictation"
            className="group flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
          >
            <Mic className="h-10 w-10" />
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop dictation"
            className="group flex h-24 w-24 animate-pulse items-center justify-center rounded-full bg-rose-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-rose-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/30"
          >
            <Square className="h-10 w-10" />
          </button>
        )}
      </div>
      <p
        className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400"
        aria-live="polite"
      >
        {state === "listening"
          ? "Listening… tap the button to stop"
          : "Tap the mic to start dictating"}
      </p>

      {/* Transcript */}
      <div className="mt-6">
        <label htmlFor="dictate-text" className="sr-only">
          Dictated text
        </label>
        <textarea
          id="dictate-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Your speech will appear here. You can also type or edit directly."
          className="w-full rounded-2xl border border-slate-300 bg-white p-5 text-base leading-relaxed text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {interim && (
          <p
            className="mt-2 text-sm italic text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            …{interim}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {wordCount.toLocaleString()} words · {charCount.toLocaleString()}{" "}
            characters
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onCopy}
              disabled={!text}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
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
              disabled={!text && !interim}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
            title={error}
          >
            {error === "not-allowed"
              ? "Microphone access was blocked. Click the lock icon in the address bar to allow it, then try again."
              : error}
          </p>
        )}
      </div>
    </div>
  );
}
