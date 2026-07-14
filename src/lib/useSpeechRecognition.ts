import { useState, useEffect, useRef, useCallback } from "react";

// Minimal Web Speech API typings (not in the standard DOM lib for every target).
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [i: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  length: number;
  [i: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEventLike extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export interface UseSpeechRecognition {
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Thin wrapper around the Web Speech API. Calls `onFinal` with each finalized
 * transcript segment. Degrades silently (supported === false) on browsers without
 * the API (e.g. Firefox, or non-HTTPS contexts).
 */
export function useSpeechRecognition(onFinal: (transcript: string) => void): UseSpeechRecognition {
  const supported = getCtor() !== null;
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const alt = res[0];
        if (alt && res.isFinal) finalText += alt.transcript;
      }
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    rec.onerror = (e) => {
      console.warn("Speech recognition error:", e.error);
      setListening(false);
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      console.warn("Speech start failed:", err);
    }
  }, []);

  const reset = useCallback(() => {
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => () => {
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
  }, []);

  return { supported, listening, start, stop, reset };
}
