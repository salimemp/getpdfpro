/**
 * Web Speech API wrappers — text-to-speech (TTS) and speech-to-text (STT).
 *
 * Browser support:
 *   - Chrome / Edge: full support (TTS + STT)
 *   - Safari (macOS, iOS): TTS yes, STT yes
 *   - Firefox: TTS yes, STT no (we fall back to "type this instead")
 *   - Server-side: neither — these are client-only.
 *
 * Why client-side:
 *   - Zero server cost, zero latency, works offline
 *   - Voice quality is OS / browser-dependent (Chrome's Google voices are
 *     quite good; Safari uses the OS TTS engine)
 *   - We never send the audio to a server, so privacy is preserved —
 *     important for a "private PDF tools" product.
 *
 * Limitations:
 *   - STT requires mic permission. The user must grant it the first time.
 *   - STT continuous mode is hit-or-miss across browsers. We default to
 *     single-shot (one utterance) and let the user re-tap to dictate more.
 *   - The `lang` param needs an IETF BCP-47 tag (e.g. "en-US", "es-ES",
 *     "hi-IN"). We map our UI's short codes ("en", "es", "hi") to the
 *     best-matching locale the browser exposes.
 *   - Voice quality and selection depend on the user's OS. We expose
 *     `getAvailableVoices()` so the UI can let the user pick.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
 */

"use client";

// ─── TTS (text-to-speech) ────────────────────────────────────────────

export type TtsState = "idle" | "speaking" | "paused";

export interface TtsOptions {
  /** IETF BCP-47 language tag, e.g. "en-US". Defaults to "en-US". */
  lang?: string;
  /** Rate 0.1-10. Defaults to 1.0. */
  rate?: number;
  /** Pitch 0-2. Defaults to 1.0. */
  pitch?: number;
  /** Volume 0-1. Defaults to 1.0. */
  volume?: number;
  /** Voice name from `getAvailableVoices()`. Optional. */
  voiceName?: string;
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** All available voices, deduplicated. Loaded async because some
 *  browsers (Chrome) populate the voice list lazily after page load. */
export function getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTtsSupported()) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    // If voices already loaded, return them
    const voices = synth.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }
    // Otherwise wait for the voiceschanged event
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", handler);
    // Safety net: resolve after 1.5s even if event never fires
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    }, 1500);
  });
}

/** Pick the best voice for a given language. Prefers local / native voices
 *  over cloud voices (free, faster, works offline). */
export async function pickVoiceForLang(lang: string): Promise<SpeechSynthesisVoice | null> {
  const voices = await getAvailableVoices();
  if (voices.length === 0) return null;

  // Normalize the input lang to a primary subtag
  const targetPrimary = lang.toLowerCase().split("-")[0];
  const targetFull = lang.toLowerCase();

  // 1. Exact match on full tag (e.g. "en-US")
  const exact = voices.find((v) => v.lang.toLowerCase() === targetFull);
  if (exact) return exact;

  // 2. Primary subtag match (e.g. "en" → "en-GB")
  const primary = voices.find(
    (v) => v.lang.toLowerCase().split("-")[0] === targetPrimary
  );
  if (primary) return primary;

  return null;
}

/** Speak a piece of text. Returns a controller that can pause / resume /
 *  cancel. Resolves with the controller. The controller emits "end" when
 *  speech completes naturally, or "error" if SpeechSynthesisErrorEvent fires.
 */
export function speak(text: string, options: TtsOptions = {}): {
  state: () => TtsState;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  onEnd: (cb: () => void) => void;
  onError: (cb: (err: string) => void) => void;
} {
  if (!isTtsSupported()) {
    throw new Error("Text-to-speech is not supported in this browser.");
  }
  const synth = window.speechSynthesis;
  // Cancel anything currently speaking — calling speak() twice in a row
  // without cancel can drop utterances on Chrome (a known bug).
  synth.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = options.lang ?? "en-US";
  utter.rate = clamp(options.rate ?? 1, 0.1, 10);
  utter.pitch = clamp(options.pitch ?? 1, 0, 2);
  utter.volume = clamp(options.volume ?? 1, 0, 1);

  let _state: TtsState = "speaking";
  let _onEnd: () => void = () => {};
  let _onError: (err: string) => void = () => {};

  utter.onend = () => {
    _state = "idle";
    _onEnd();
  };
  utter.onerror = (e) => {
    // "interrupted" and "canceled" fire when the user clicks stop; don't
    // surface those as errors.
    if (e.error !== "interrupted" && e.error !== "canceled") {
      _state = "idle";
      _onError(e.error || "unknown");
    }
  };

  // Set voice asynchronously if requested
  if (options.voiceName) {
    getAvailableVoices().then((voices) => {
      const v = voices.find((v) => v.name === options.voiceName);
      if (v) utter.voice = v;
      synth.speak(utter);
    });
  } else {
    synth.speak(utter);
  }

  return {
    state: () => _state,
    pause: () => {
      if (_state === "speaking") {
        synth.pause();
        _state = "paused";
      }
    },
    resume: () => {
      if (_state === "paused") {
        synth.resume();
        _state = "speaking";
      }
    },
    cancel: () => {
      synth.cancel();
      _state = "idle";
    },
    onEnd: (cb) => {
      _onEnd = cb;
    },
    onError: (cb) => {
      _onError = cb;
    },
  };
}

// ─── STT (speech-to-text) ────────────────────────────────────────────

export type SttState = "idle" | "listening" | "stopped" | "error";

export interface SttOptions {
  /** IETF BCP-47 language tag, e.g. "en-US". Defaults to "en-US". */
  lang?: string;
  /** Whether to keep listening after a pause. Defaults to false
   *  (single-shot, stop after one utterance — most reliable across browsers). */
  continuous?: boolean;
  /** Whether to return interim results. Defaults to true. */
  interimResults?: boolean;
  /** Max number of alternatives per result. Defaults to 1. */
  maxAlternatives?: number;
}

export function isSttSupported(): boolean {
  if (typeof window === "undefined") return false;
  // The spec'd global is `SpeechRecognition` (Chrome) or
  // `webkitSpeechRecognition` (older Safari). Both have the same API.
  // The TypeScript types come from apps/web/types/web-speech.d.ts.
  return (
    typeof window.SpeechRecognition !== "undefined" ||
    typeof window.webkitSpeechRecognition !== "undefined"
  );
}

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionInstance)
  | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** Begin dictation. Returns a controller that exposes the live state
 *  and a `stop()` method. The callback fires for every recognized
 *  result (interim and final). Resolves with the controller.
 */
export function listen(
  onResult: (transcript: string, isFinal: boolean) => void,
  options: SttOptions = {}
): {
  state: () => SttState;
  stop: () => void;
  onError: (cb: (err: string) => void) => void;
} {
  if (!isSttSupported()) {
    throw new Error("Speech recognition is not supported in this browser.");
  }
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    throw new Error("Speech recognition is not supported in this browser.");
  }
  // Ctor is a constructor type — instantiate it
  const rec = new Ctor();
  rec.lang = options.lang ?? "en-US";
  rec.continuous = options.continuous ?? false;
  rec.interimResults = options.interimResults ?? true;
  rec.maxAlternatives = options.maxAlternatives ?? 1;

  let _state: SttState = "listening";
  let _onError: (err: string) => void = () => {};

  rec.onresult = (event: SpeechRecognitionEvent) => {
    // Concatenate all final results in this event (continuous mode may
    // return several results per onresult). The most recent interim result
    // is also surfaced so the UI can show live transcription.
    let final = "";
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? "";
      if (result.isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (final) {
      onResult(final.trim(), true);
    } else if (interim) {
      onResult(interim.trim(), false);
    }
  };

  rec.onerror = (event: SpeechRecognitionErrorEvent) => {
    _state = "error";
    _onError(event.error || "unknown");
  };

  rec.onend = () => {
    if (_state === "listening") {
      _state = "stopped";
    }
  };

  rec.start();

  return {
    state: () => _state,
    stop: () => {
      _state = "stopped";
      rec.stop();
    },
    onError: (cb) => {
      _onError = cb;
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Map our short UI language codes (used in Summarize/Translate) to a
 *  best-guess IETF BCP-47 tag for SpeechSynthesis. Falls back to "en-US". */
export function shortLangToBcp47(short: string): string {
  const m: Record<string, string> = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    de: "de-DE",
    it: "it-IT",
    pt: "pt-BR",
    nl: "nl-NL",
    ru: "ru-RU",
    ja: "ja-JP",
    ko: "ko-KR",
    zh: "zh-CN",
    "zh-cn": "zh-CN",
    "zh-tw": "zh-TW",
    ar: "ar-SA",
    hi: "hi-IN",
    bn: "bn-IN",
    ta: "ta-IN",
    te: "te-IN",
    mr: "mr-IN",
    gu: "gu-IN",
    kn: "kn-IN",
    ml: "ml-IN",
    pa: "pa-IN",
    ur: "ur-PK",
    th: "th-TH",
    vi: "vi-VN",
    id: "id-ID",
    ms: "ms-MY",
    tl: "fil-PH",
    tr: "tr-TR",
    pl: "pl-PL",
    uk: "uk-UA",
    ro: "ro-RO",
    cs: "cs-CZ",
    el: "el-GR",
    he: "he-IL",
    sv: "sv-SE",
    no: "nb-NO",
    da: "da-DK",
    fi: "fi-FI",
    hu: "hu-HU",
  };
  return m[short.toLowerCase()] ?? "en-US";
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Strip markdown for cleaner TTS. Removes # headers, ** bold **, *
 *  italic *, [text](url), and code fences. Keeps the text content. */
export function stripMarkdownForTts(md: string): string {
  return md
    // Code fences
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    // Inline code
    .replace(/`([^`]+)`/g, "$1")
    // Headers (any number of #)
    .replace(/^#+\s+/gm, "")
    // Bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Links: keep the text, drop the URL
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    // Bullets at start of line
    .replace(/^\s*[-*+]\s+/gm, "")
    // Numbered lists
    .replace(/^\s*\d+\.\s+/gm, "")
    // Collapse blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
