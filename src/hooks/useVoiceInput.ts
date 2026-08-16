// ── Shared voice / dictation input ────────────────────────────────────────────
// Extracted from DashboardPage so the add-expense form and the ask sheet share one
// implementation. The hook owns the text state deliberately: the iOS
// keyboard-dictation path delivers text through onChange rather than through
// SpeechRecognition, so the debounce that rescues it is inseparable from the value.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMicPermission } from './useMicPermission';

export interface UseVoiceInputOpts {
  lang: 'he' | 'en';
  /** Called with a finished utterance, from any of the three input routes. */
  onCommit: (text: string, source: 'speech' | 'dictation' | 'manual') => void;
  /** Veto the debounced auto-commit — e.g. "is this parseable yet?". */
  shouldAutoCommit?: (text: string) => boolean;
  /** iOS keyboard-dictation debounce. The original 800 ms is the tested value. */
  dictationDebounceMs?: number;
  /** Fired when recognition fails for lack of a network, so the UI can focus the
   *  text field. This is what keeps the feature feeling degraded, not broken. */
  onNetworkFallback?: () => void;
}

export interface VoiceInput {
  /** the engine exists at all */
  supported: boolean;
  /** engine exists AND permission is not denied — gate the mic button on this */
  micUsable: boolean;
  /** null while probing; true only when the language really runs on-device */
  onDevice: boolean | null;
  listening: boolean;
  error: string;
  text: string;
  setText: (s: string) => void;
  start: () => Promise<void>;
  stop: () => void;
  commit: () => void;
  clearError: () => void;
}

function getEngine(): SpeechRecognitionStatic | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(opts: UseVoiceInputOpts): VoiceInput {
  const { lang, onCommit, shouldAutoCommit, dictationDebounceMs = 800, onNetworkFallback } = opts;
  const { micPermission, requestMicPermission } = useMicPermission();

  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');
  const [onDevice, setOnDevice] = useState<boolean | null>(null);

  const engine = getEngine();
  const supported = !!engine;
  const recRef = useRef<SpeechRecognition | null>(null);
  // Keep the newest callbacks reachable from the recogniser's handlers without
  // re-creating the recogniser on every render.
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const netRef = useRef(onNetworkFallback);
  netRef.current = onNetworkFallback;

  const errTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errTimer.current) clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setError(''), 3000);
  }, []);

  // ── On-device availability probe ────────────────────────────────────────────
  // Hebrew is not in Chrome's on-device (SODA) language set, so he-IL reports
  // 'unavailable' in practice and we quietly use cloud recognition. Treat
  // 'downloadable'/'downloading' as unavailable — never start a model download
  // off the back of a tap.
  useEffect(() => {
    if (!engine) { setOnDevice(false); return; }
    if (typeof engine.available !== 'function') { setOnDevice(false); return; }
    let alive = true;
    engine
      .available({ langs: [lang === 'he' ? 'he-IL' : 'en-US'], processLocally: true })
      .then(r => { if (alive) setOnDevice(r === 'available'); })
      .catch(() => { if (alive) setOnDevice(false); });
    return () => { alive = false; };
  }, [engine, lang]);

  const stop = useCallback(() => {
    // The previous implementation kept the recogniser in a function-local, so there
    // was no way to cancel it once started.
    try { recRef.current?.abort(); } catch { /* already finished */ }
    recRef.current = null;
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!engine || listening) return;

    // Prime the permission via getUserMedia first so SpeechRecognition reuses the
    // cached grant instead of raising a second prompt.
    if (micPermission !== 'granted') {
      const result = await requestMicPermission();
      if (result !== 'granted') return;
    }

    const rec = new engine();
    recRef.current = rec;
    rec.lang = lang === 'he' ? 'he-IL' : 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    if (onDevice) rec.processLocally = true;

    setText('');
    setError('');
    setListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      commitRef.current(transcript, 'speech');
    };
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false);
      if (e.error === 'aborted') return;          // user-initiated stop — stay silent
      const he = lang === 'he';
      if (e.error === 'network') {
        // The exact failure users hit offline in Chrome. Presenting it as a
        // fallback rather than a failure is the difference between "degraded"
        // and "broken".
        showError(he ? 'אין חיבור — אפשר להקליד את השאלה' : 'Offline — type it instead');
        netRef.current?.();
        return;
      }
      showError(
        e.error === 'not-allowed'
          ? (he ? 'גישה למיקרופון נדחתה' : 'Microphone access denied')
          : e.error === 'no-speech'
            ? (he ? 'לא זוהה קול — נסה שוב' : 'No speech detected — try again')
            : (he ? 'שגיאת זיהוי קול' : 'Voice recognition error'),
      );
    };
    rec.onend = () => { setListening(false); recRef.current = null; };

    try { rec.start(); }
    catch { setListening(false); recRef.current = null; }
  }, [engine, listening, micPermission, requestMicPermission, lang, onDevice, showError]);

  // ── iOS keyboard-dictation rescue ───────────────────────────────────────────
  // Safari's keyboard mic types into the field instead of firing onresult, so
  // without this the voice path fails silently on iPhone. Preserved verbatim from
  // the original DashboardPage implementation.
  useEffect(() => {
    if (!text.trim() || listening) return;
    const id = setTimeout(() => {
      if (shouldAutoCommit && !shouldAutoCommit(text)) return;
      commitRef.current(text, 'dictation');
    }, dictationDebounceMs);
    return () => clearTimeout(id);
  }, [text, listening, dictationDebounceMs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { if (errTimer.current) clearTimeout(errTimer.current); }, []);

  const commit = useCallback(() => {
    if (text.trim()) commitRef.current(text, 'manual');
  }, [text]);

  return {
    supported,
    micUsable: supported && micPermission !== 'denied',
    onDevice,
    listening,
    error,
    text,
    setText,
    start,
    stop,
    commit,
    clearError: () => setError(''),
  };
}
