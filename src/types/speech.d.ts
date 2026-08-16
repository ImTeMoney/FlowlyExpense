// Web Speech API typings.
//
// lib.dom.d.ts only gained SpeechRecognition in recent TypeScript 5.x releases, and
// package.json pins "^5.2.2" — a caret range that may resolve to a version without
// them. The interfaces are declared explicitly here so the build does not depend on
// which minor version npm happens to install.

declare global {
  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  type SpeechRecognitionErrorCode =
    | 'no-speech' | 'aborted' | 'audio-capture' | 'network'
    | 'not-allowed' | 'service-not-allowed' | 'bad-grammar' | 'language-not-supported';

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: SpeechRecognitionErrorCode;
    readonly message: string;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    /** Chrome 139+: forces on-device recognition. Optional — absent in Safari. */
    processLocally?: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((e: SpeechRecognitionEvent) => void) | null;
    onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    onstart: (() => void) | null;
  }

  /** Chrome 139+ on-device availability probe. Declared optional because no other
   *  engine implements it; Hebrew is not in Chrome's SODA language set, so for he-IL
   *  this reports 'unavailable' and the caller falls back to cloud recognition. */
  type SpeechRecognitionAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available';

  interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
    available?(options: { langs: string[]; processLocally?: boolean }): Promise<SpeechRecognitionAvailability>;
    install?(options: { langs: string[]; processLocally?: boolean }): Promise<boolean>;
  }

  interface Window {
    SpeechRecognition: SpeechRecognitionStatic | undefined;
    webkitSpeechRecognition: SpeechRecognitionStatic | undefined;
  }
}

export {};
