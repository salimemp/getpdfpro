"use client";

/**
 * Read-aloud + voice-to-text buttons.
 *
 * ReadAloudButton: takes a string, speaks it via SpeechSynthesis. Pauses /
 *  resumes / cancels. Shows a tooltip explaining what's happening.
 *
 * MicButton: takes a callback that receives the recognized transcript
 *  (interim + final). Uses SpeechRecognition. Shows mic active state.
 *
 * Both gracefully degrade: if the browser doesn't support the API, the
 * button is hidden, not broken.
 *
 * Browser support: see apps/web/lib/speech.ts for the full table.
 */

import { useEffect, useRef, useState } from "react";
import {
  isTtsSupported,
  isSttSupported,
  speak,
  listen,
  pickVoiceForLang,
  shortLangToBcp47,
  stripMarkdownForTts,
  type TtsState,
  type SttState,
} from "@/lib/speech";

// ─── ReadAloudButton ─────────────────────────────────────────────────

export interface ReadAloudButtonProps {
  /** The text to read. Markdown is auto-stripped. */
  text: string;
  /** IETF BCP-47 lang for the TTS voice, e.g. "en-US". Optional. */
  lang?: string;
  /** Short UI language code, e.g. "en", "es". Mapped to BCP-47. */
  shortLang?: string;
  /** Optional className to merge with the default. */
  className?: string;
  /** Label for accessibility. Defaults to "Read aloud". */
  label?: string;
}

export function ReadAloudButton({
  text,
  lang,
  shortLang,
  className,
  label = "Read aloud",
}: ReadAloudButtonProps) {
  const [state, setState] = useState<TtsState>("idle");
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<ReturnType<typeof speak> | null>(null);

  // If the browser doesn't support TTS, render nothing. Don't show a
  // broken button.
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(isTtsSupported());
  }, []);

  // Cancel on unmount so we don't leave speech running when the
  // user navigates away.
  useEffect(() => {
    return () => {
      controllerRef.current?.cancel();
    };
  }, []);

  if (supported === false) return null;

  const start = async () => {
    if (!text) return;
    setError(null);
    const targetLang = lang ?? shortLangToBcp47(shortLang ?? "en");
    const voice = await pickVoiceForLang(targetLang);
    try {
      const controller = speak(stripMarkdownForTts(text), {
        lang: targetLang,
        voiceName: voice?.name,
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

  // Don't render a button if there's no text yet (e.g. the result hasn't
  // come back from the AI).
  if (!text || !text.trim()) return null;

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {state === "idle" && (
        <button
          type="button"
          onClick={start}
          aria-label={label}
          title={label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <SpeakerIcon />
        </button>
      )}
      {state === "speaking" && (
        <>
          <button
            type="button"
            onClick={pause}
            aria-label="Pause"
            title="Pause"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
          >
            <PauseIcon />
          </button>
          <button
            type="button"
            onClick={stop}
            aria-label="Stop"
            title="Stop"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <StopIcon />
          </button>
        </>
      )}
      {state === "paused" && (
        <>
          <button
            type="button"
            onClick={resume}
            aria-label="Resume"
            title="Resume"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
          >
            <PlayIcon />
          </button>
          <button
            type="button"
            onClick={stop}
            aria-label="Stop"
            title="Stop"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <StopIcon />
          </button>
        </>
      )}
      {error && (
        <span
          role="alert"
          className="ml-1 text-xs text-rose-600 dark:text-rose-400"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ─── MicButton ──────────────────────────────────────────────────────

export interface MicButtonProps {
  /** Called with every recognized result. `isFinal` is true on final. */
  onResult: (transcript: string, isFinal: boolean) => void;
  /** IETF BCP-47 lang for the recognition, e.g. "en-US". */
  lang?: string;
  /** Short UI language code, e.g. "en", "es". Mapped to BCP-47. */
  shortLang?: string;
  /** Whether to keep listening after a pause. Defaults to false. */
  continuous?: boolean;
  /** Optional className. */
  className?: string;
  /** Label. Defaults to "Voice input". */
  label?: string;
}

export function MicButton({
  onResult,
  lang,
  shortLang,
  continuous = false,
  className,
  label = "Voice input",
}: MicButtonProps) {
  const [state, setState] = useState<SttState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState<string>("");
  const controllerRef = useRef<ReturnType<typeof listen> | null>(null);

  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSupported(isSttSupported());
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
    };
  }, []);

  if (supported === false) {
    // Show a disabled "voice input not available" tooltip so the user
    // knows the feature exists, just not in their browser.
    return (
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-300 dark:border-slate-700 dark:text-slate-700 ${className ?? ""}`}
        title="Voice input isn't supported in this browser. Try Chrome or Edge."
        aria-label="Voice input not available"
      >
        <MicOffIcon />
      </span>
    );
  }

  const start = () => {
    setError(null);
    setInterim("");
    const targetLang = lang ?? shortLangToBcp47(shortLang ?? "en");
    try {
      const controller = listen(
        (transcript, isFinal) => {
          onResult(transcript, isFinal);
          if (!isFinal) setInterim(transcript);
        },
        { lang: targetLang, continuous, interimResults: true }
      );
      controllerRef.current = controller;
      setState("listening");
      controller.onError((err) => {
        setError(err);
        setState("error");
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start dictation.");
      setState("error");
    }
  };

  const stop = () => {
    controllerRef.current?.stop();
    controllerRef.current = null;
    setState("idle");
    setInterim("");
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      {state === "idle" && (
        <button
          type="button"
          onClick={start}
          aria-label={label}
          title={label}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <MicIcon />
        </button>
      )}
      {state === "listening" && (
        <>
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 text-rose-600 animate-pulse dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
            aria-live="polite"
            title="Listening — tap to stop"
          >
            <MicOnIcon />
          </span>
          <button
            type="button"
            onClick={stop}
            aria-label="Stop dictation"
            title="Stop dictation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <StopIcon />
          </button>
        </>
      )}
      {(state === "listening" || state === "stopped") && interim && (
        <span
          className="ml-1 max-w-xs truncate text-xs italic text-slate-500 dark:text-slate-400"
          aria-live="polite"
        >
          {interim}
        </span>
      )}
      {error && (
        <span
          role="alert"
          className="ml-1 text-xs text-rose-600 dark:text-rose-400"
          title={error}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────

function SpeakerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <rect x="5" y="5" width="14" height="14" rx="1" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function MicOnIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path
        d="M19 10v2a7 7 0 0 1-14 0v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
      <path d="M5 10v2a7 7 0 0 0 12 5" />
      <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
