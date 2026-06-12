/**
 * Minimal TypeScript declarations for the Web Speech API.
 *
 * The Web Speech API is not yet in the default lib.dom.d.ts. We
 * declare just enough types to support our `apps/web/lib/speech.ts`
 * wrappers. Reference:
 *   https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
 */

declare global {
  // ─── Speech-to-text (STT) ────────────────────────────────────────
  interface SpeechRecognitionResultAlt {
    transcript: string;
    confidence: number;
  }
  interface SpeechRecognitionResult {
    readonly length: number;
    isFinal: boolean;
    [index: number]: SpeechRecognitionResultAlt;
  }
  interface SpeechRecognitionResultList {
    readonly length: number;
    [index: number]: SpeechRecognitionResult;
  }
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }
  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }
  interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onresult:
      | ((
          this: SpeechRecognitionInstance,
          ev: SpeechRecognitionEvent
        ) => unknown)
      | null;
    onerror:
      | ((
          this: SpeechRecognitionInstance,
          ev: SpeechRecognitionErrorEvent
        ) => unknown)
      | null;
    onend: ((this: SpeechRecognitionInstance, ev: Event) => unknown) | null;
    onstart: ((this: SpeechRecognitionInstance, ev: Event) => unknown) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }
  interface SpeechRecognitionCtor {
    new (): SpeechRecognitionInstance;
  }

  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export {};
