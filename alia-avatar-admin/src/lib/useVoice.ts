"use client";

// ──────────────────────────────────────────────
// ALIA Avatar — Voice (spoken training turns)
//
// One spoken turn:
//   MediaRecorder (webm/opus) → base64 → session WebSocket `{type:"audio"}`
//   → Whisper STT → orchestrator (RAG + LLM + FSM) → ElevenLabs MP3 chunks
//   → MediaSource playback (streaming) with a Blob fallback.
//
// Audio travels over the session WebSocket so the reply, the visit step update
// and the speech stay in one ordered stream. When the socket is not open the
// same turn is posted to `POST /api/v1/voice/turn` instead, so dictation keeps
// working while the socket reconnects.
//
// Everything degrades: no mic permission, no STT key or no TTS key each surface
// a readable message and leave typed chat untouched.
// ──────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type VoiceState = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

export interface VoiceProviderStatus {
  available: boolean;
  provider: string;
  model: string;
  env: string;
}

export interface VoiceProviders {
  stt: VoiceProviderStatus;
  tts: VoiceProviderStatus;
  voice_id: string | null;
}

/** Session parameters echoed back to the orchestrator with every spoken turn. */
export interface VoiceTurnMeta {
  mode?: string;
  level?: string;
  visit_format?: string;
  style?: string;
  language?: string;
}

type Frame = Record<string, unknown> & { type?: string };interface UseVoiceOptions {
  sessionId: string | null;
  /** A mic stream obtained earlier (e.g. by the splash's permission prompt);
      when present it is reused instead of prompting a second time. */
  stream?: MediaStream | null;
  /** Send a JSON frame on the session WebSocket; false when it is not open. */
  send?: (frame: Record<string, unknown>) => boolean;
  onTranscript?: (text: string) => void;
  onReply?: (text: string, meta: { current_step?: string; score_update?: unknown }) => void;
  /** Called repeatedly while a reply streams in, with the accumulated text. */
  onToken?: (accumulated: string) => void;
  onError?: (message: string) => void;
  meta?: VoiceTurnMeta;
}

const RECORDER_MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
const MAX_RECORDING_MS = 60_000;
const AUDIO_MIME = "audio/mpeg";

// ── small helpers ──

function hasRecorder(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

function pickRecorderMime(): string {
  if (!hasRecorder()) return "";

  for (const mime of RECORDER_MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    } catch {
      /* keep looking */
    }
  }

  return ""; // let the browser pick its default
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;

  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }

  return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return bytes;
}

const humanizeError = (raw: unknown): string => {
  const text = typeof raw === "string" ? raw : raw instanceof Error ? raw.message : String(raw ?? "");

  if (/NotAllowedError|Permission dismissed|denied/i.test(text)) {
    return "Accès au micro refusé — autorisez le microphone dans votre navigateur.";
  }

  if (/NotFoundError|no device|Requested device not found/i.test(text)) {
    return "Aucun microphone détecté sur cet appareil.";
  }

  if (/NotReadableError/i.test(text)) {
    return "Le microphone est utilisé par une autre application.";
  }

  return text || "Erreur audio inconnue.";
};

// ──────────────────────────────────────────────
// Streaming playback
//
// ElevenLabs is asked for `mp3_44100_128` and streamed, so chunks arrive while
// the voice is still being generated. MediaSource plays them as they land; when
// MSE cannot take audio/mpeg (Safari) every chunk is kept and played as one
// Blob once the utterance completes, so the audio is never lost — only delayed.
// ──────────────────────────────────────────────

class AudioStreamer {
  muted = false;
  onPlayingChange?: (playing: boolean) => void;
  onError?: (message: string) => void;

  private audio: HTMLAudioElement | null = null;
  private ms: MediaSource | null = null;
  private sb: SourceBuffer | null = null;
  private url: string | null = null;
  private blobUrl: string | null = null;
  private queue: Uint8Array[] = [];
  private collected: Uint8Array[] = [];
  private mime = AUDIO_MIME;
  private mode: "mse" | "blob" = "blob";
  private ended = false;

  /** Live playback position, so callers can sync UI to the spoken audio.
      duration is 0 until the browser knows it (streamed blob/MSE). */
  getPlayback(): { time: number; duration: number; active: boolean } {
    const a = this.audio;
    if (!a) return { time: 0, duration: 0, active: false };
    const duration = Number.isFinite(a.duration) ? a.duration : 0;
    return { time: a.currentTime || 0, duration, active: !a.paused && !a.ended };
  }

  // ── lifecycle ──

  reset(): void {
    this.queue = [];
    this.collected = [];
    this.ended = false;
    this.mode = "blob";

    if (this.audio) {
      try {
        this.audio.pause();
      } catch {
        /* ignore */
      }

      this.audio.removeAttribute("src");

      try {
        this.audio.load();
      } catch {
        /* ignore */
      }
    }

    if (this.url) URL.revokeObjectURL(this.url);
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.url = null;
    this.blobUrl = null;
    this.audio = null;
    this.sb = null;
    this.ms = null;
  }

  dispose(): void {
    const audio = this.audio;

    this.reset();
    if (audio) audio.removeAttribute("src");
  }

  setMime(mime: string | null | undefined): void {
    if (mime && mime !== this.mime) this.mime = mime;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;

    if (muted && this.audio) {
      try {
        this.audio.pause();
      } catch {
        /* ignore */
      }
    } else if (!muted) {
      this.play();
    }
  }

  // ── input ──

  push(bytes: Uint8Array): void {
    if (!bytes.length) return;
    this.collected.push(bytes);

    if (this.mode === "mse" && this.sb) {
      this.queue.push(bytes);
      this.pump();

      return;
    }

    if (this.mode === "mse") {
      // sourceopen has not fired yet
      this.queue.push(bytes);

      return;
    }

    if (!this.ensureMse()) {
      this.queue.push(bytes);

      return;
    }

    this.queue.push(bytes);
    this.pump();
  }

  pushBase64(encoded: string): void {
    try {
      this.push(base64ToBytes(encoded));
    } catch {
      /* a malformed chunk should not kill the turn */
    }
  }

  end(): void {
    this.ended = true;

    if (this.mode === "mse" && this.sb) {
      this.pump();

      return;
    }

    this.playBlob();
  }

  // ── internals ──

  private ensureAudio(): HTMLAudioElement {
    if (!this.audio) {
      const audio = new Audio();

      audio.preload = "auto";
      audio.addEventListener("playing", () => this.onPlayingChange?.(true));
      audio.addEventListener("ended", () => this.onPlayingChange?.(false));
      audio.addEventListener("pause", () => this.onPlayingChange?.(false));
      audio.addEventListener("error", () => this.onPlayingChange?.(false));
      this.audio = audio;
    }

    return this.audio;
  }

  /** Switch to MediaSource streaming. Returns false when it is not usable. */
  private ensureMse(): boolean {
    if (this.mode === "mse") return true;
    if (typeof MediaSource === "undefined") return false;

    try {
      if (!MediaSource.isTypeSupported(this.mime)) return false;
    } catch {
      return false;
    }

    try {
      const ms = new MediaSource();
      const audio = this.ensureAudio();

      this.url = URL.createObjectURL(ms);
      audio.src = this.url;
      this.ms = ms;
      this.mode = "mse";

      ms.addEventListener("sourceopen", () => {
        try {
          const sb = ms.addSourceBuffer(this.mime);

          sb.addEventListener("updateend", () => this.pump());
          sb.addEventListener("error", () => this.fallBackToBlob());
          this.sb = sb;
          this.pump();
        } catch {
          this.fallBackToBlob();
        }
      });

      return true;
    } catch {
      this.mode = "blob";

      return false;
    }
  }

  private pump(): void {
    if (this.mode !== "mse" || !this.sb) return;
    if (this.sb.updating) return;

    if (this.queue.length === 0) {
      if (this.ended) this.endOfStream();

      return;
    }

    const next = this.queue.shift();

    if (!next) return;

    try {
      this.sb.appendBuffer(next as unknown as BufferSource);
    } catch {
      // QuotaExceededError or a rejected chunk: keep the bytes and replay as a blob.
      this.queue.unshift(next);
      this.fallBackToBlob();

      return;
    }

    this.play();
  }

  private endOfStream(): void {
    const ms = this.ms;

    if (!ms || ms.readyState !== "open") return;

    try {
      ms.endOfStream();
    } catch {
      /* already closed */
    }
  }

  /**
   * MSE is unavailable or rejected a chunk. Everything we received is still in
   * `collected`, so play the whole utterance as one Blob (delayed, never lost).
   */
  private fallBackToBlob(): void {
    if (this.mode === "blob") return;
    this.mode = "blob";
    const ms = this.ms;

    this.sb = null;
    this.ms = null;

    if (ms && ms.readyState === "open") {
      try {
        ms.endOfStream();
      } catch {
        /* ignore */
      }
    }

    this.queue = [];
    this.playBlob();
  }

  private playBlob(): void {
    if (this.mode !== "blob" || !this.ended || this.collected.length === 0) return;

    const blob = new Blob(this.collected as unknown as BlobPart[], { type: this.mime });

    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);

    const audio = this.ensureAudio();

    try {
      audio.pause();
    } catch {
      /* ignore */
    }

    this.blobUrl = URL.createObjectURL(blob);
    audio.src = this.blobUrl;
    this.play();
  }

  private play(): void {
    if (this.muted) return;
    const audio = this.ensureAudio();

    if (!audio.paused) return;
    audio.play().catch(() => {
      this.onError?.("Lecture audio bloquée par le navigateur — appuyez sur « Écouter » pour relancer.");
    });
  }

  /** Retry playback after the browser refused an autoplay attempt. */
  resume(): void {
    if (this.mode === "blob" && this.ended) this.playBlob();
    else this.play();
  }
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useVoice({ sessionId, stream, send, onTranscript, onReply, onToken, onError, meta }: UseVoiceOptions) {
  const [providers, setProviders] = useState<VoiceProviders | null>(null);
  const [state, setState] = useState<VoiceState>("idle");
  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastReply, setLastReply] = useState<string | null>(null);

  const sendRef = useRef(send);
  const transcriptRef = useRef(onTranscript);
  const replyRef = useRef(onReply);
  const onTokenRef = useRef(onToken);
  const errorRef = useRef(onError);
  /** Accumulator for the reply currently streaming in. */
  const streamTextRef = useRef("");
  const metaRef = useRef(meta);
  const sessionRef = useRef(sessionId);
  const externalStreamRef = useRef(stream);

  sendRef.current = send;
  transcriptRef.current = onTranscript;
  replyRef.current = onReply;
  onTokenRef.current = onToken;
  errorRef.current = onError;
  metaRef.current = meta;
  sessionRef.current = sessionId;
  externalStreamRef.current = stream;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReplyRef = useRef<string | null>(null);
  const streamerRef = useRef<AudioStreamer | null>(null);
  const mutedRef = useRef(muted);
  const providersRef = useRef<VoiceProviders | null>(null);

  /** Did the current turn receive any speech to play? */
  const sawAudioRef = useRef(false);

  /** Only one utterance may own the streamer at a time. Every speak() — and
      every inbound socket audio block — bumps this token and aborts the
      previous request, so two replies can never be heard on top of each
      other (the "two agents talking" symptom). */
  const speakTokenRef = useRef(0);
  const speakAbortRef = useRef<AbortController | null>(null);

  mutedRef.current = muted;
  providersRef.current = providers;

  const streamer = useCallback((): AudioStreamer => {
    if (!streamerRef.current) {
      const s = new AudioStreamer();

      s.onPlayingChange = playing => {
        setSpeaking(playing);
        setState(prev => (playing ? "speaking" : prev === "speaking" ? "idle" : prev));
      };

      s.onError = message => setError(message);
      streamerRef.current = s;
    }

    return streamerRef.current;
  }, []);

  const fail = useCallback((message: string) => {
    setError(message);
    errorRef.current?.(message);
  }, []);

  /** Silence whatever is currently speaking: drop the in-flight utterance
      request and stop the browser voice. Used before a new utterance starts
      and whenever the socket begins streaming its own audio. */
  const cancelSpeak = useCallback(() => {
    speakTokenRef.current += 1;
    speakAbortRef.current?.abort();
    speakAbortRef.current = null;

    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  useEffect(() => {
    return () => {
      streamerRef.current?.dispose();
      streamerRef.current = null;
    };
  }, []);

  // ── provider capabilities ──

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/voice/status`, { signal: AbortSignal.timeout(5000) });

        if (!res.ok) return;
        const data = (await res.json()) as VoiceProviders;

        if (!cancelled) setProviders(data);
      } catch {
        // Backend unreachable: the mic stays disabled and demo mode is untouched.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── recording ──

  const releaseStream = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }

    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  /** Post the recorded utterance to the REST fallback when the socket is down. */
  const runRestTurn = useCallback(
    async (blob: Blob) => {
      setState("transcribing");
      const m = metaRef.current ?? {};
      const form = new FormData();

      form.append("file", blob, "utterance.webm");
      if (sessionRef.current) form.append("session_id", sessionRef.current);
      form.append("language", m.language || "fr");
      if (m.mode) form.append("mode", m.mode);
      if (m.level) form.append("level", m.level);
      if (m.visit_format) form.append("visit_format", m.visit_format);
      if (m.style) form.append("style", m.style);

      try {
        const res = await fetch(`${API_BASE}/api/v1/voice/turn`, { method: "POST", body: form });

        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          const info = (detail as { detail?: { message?: string; env?: string } | string } | null)?.detail;

          const message =
            typeof info === "string" ? info : info?.message || (info?.env ? `Clé manquante : ${info.env}` : `Erreur ${res.status}`);

          throw new Error(message);
        }

        const data = (await res.json()) as {
          transcript: string;
          reply: string;
          current_step?: string;
          score_update?: unknown;
          audio_base64?: string | null;
          audio_mime?: string;
          tts_error?: string | null;
        };

        setState("thinking");

        if (data.transcript) {
          transcriptRef.current?.(data.transcript);
        }

        replyRef.current?.(data.reply, { current_step: data.current_step, score_update: data.score_update });

        if (data.audio_base64) {
          const s = streamer();

          s.reset();
          s.setMime(data.audio_mime || AUDIO_MIME);
          s.pushBase64(data.audio_base64);
          s.end();
        } else {
          setState("idle");
          if (data.tts_error) setError(`Réponse en texte uniquement — ${humanizeError(data.tts_error)}`);
        }


        // Keep both in sync: the ref is what `replayLast` reads.
        if (data.reply) {
          lastReplyRef.current = data.reply;
          setLastReply(data.reply);
        }
      } catch (e) {
        setState("idle");
        fail(humanizeError(e));
      }
    },
    [fail, streamer]
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      setState("idle");

      return;
    }

    recorder.stop(); // onstop sends the utterance
    setState(prev => (prev === "recording" ? "transcribing" : prev));
  }, [releaseStream]);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null; // drop the utterance

      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }

    chunksRef.current = [];
    releaseStream();
    setState("idle");
  }, [releaseStream]);

  const startRecording = useCallback(async () => {
    if (recorderRef.current) return;
    setError(null);

    if (!hasRecorder()) {
      fail("L'enregistrement audio n'est pas disponible dans ce navigateur.");

      return;
    }    try {
      // Reuse the splash's stream when it is still live; otherwise prompt.
      const live = externalStreamRef.current;
      const stream
        = live && live.getAudioTracks().some(t => t.readyState === "live")
          ? live
          : await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            });
      streamRef.current = stream;

      const mime = pickRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = e => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        releaseStream();
        setState("idle");
        fail("L'enregistrement a échoué.");
      };

      recorder.onstop = async () => {
        const chunks = chunksRef.current;

        chunksRef.current = [];
        const type = recorder.mimeType || mime || "audio/webm";

        releaseStream();

        if (!chunks.length) {
          setState("idle");

          return;
        }

        const blob = new Blob(chunks, { type });

        try {
          const payload = await blobToBase64(blob);
          const filename = type.includes("ogg") ? "utterance.ogg" : type.includes("mp4") ? "utterance.mp4" : "utterance.webm";
          const m = metaRef.current ?? {};

          const sent = sendRef.current?.({
            type: "audio",
            data: payload,
            mime: type,
            filename,
            language: m.language || "fr",
            speak: !mutedRef.current,
            ...m,
          });

          if (sent) {
            setState("transcribing");
          } else {
            // Socket not open: the same turn is available over REST.
            await runRestTurn(blob);
          }
        } catch (e) {
          setState("idle");
          fail(humanizeError(e));
        }
      };

      recorder.start();
      setStarted(true);
      setState("recording");

      autoStopRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") stopRecording();
      }, MAX_RECORDING_MS);
    } catch (e) {
      releaseStream();
      setState("idle");
      fail(humanizeError(e));
    }
  }, [fail, releaseStream, runRestTurn, stopRecording]);

  const toggleRecording = useCallback(() => {
    if (state === "recording") stopRecording();
    else if (state === "idle") void startRecording();
  }, [state, startRecording, stopRecording]);

  const setMuted = useCallback((next: boolean) => {
    setMutedState(next);
    if (next) streamerRef.current?.setMuted(true);
  }, []);

  const toggleMuted = useCallback(() => setMuted(!mutedRef.current), [setMuted]);

  // ── inbound frames from the session socket ──

  const handleFrame = useCallback(
    (frame: Frame): boolean => {
      switch (frame.type) {
        case "status": {
          const next = frame.state;

          if (next === "transcribing") setState("transcribing");
          else if (next === "thinking") setState("thinking");
          else if (next === "speaking") {
            // The socket is about to stream its own audio for this turn: drop
            // any REST utterance still in flight so only one voice is heard.
            cancelSpeak();
            streamer().reset();
            sawAudioRef.current = false;
            setState("speaking");
          }

          return true;
        }        case "transcript": {
          const text = String(frame.text ?? "").trim();
          if (text) transcriptRef.current?.(text);
          setState("thinking");
          streamTextRef.current = "";
          return true;
        }

        case "token": {
          // Streaming reply: each frame carries one token of ALIA's answer.
          const piece = String(frame.value ?? "");
          if (piece) {
            streamTextRef.current += piece;
            onTokenRef.current?.(streamTextRef.current);
          }
          return true;
        }

        case "reply_end": {
          const full = streamTextRef.current.trim();
          streamTextRef.current = "";
          if (full) {
            lastReplyRef.current = full;
            setLastReply(full);
            replyRef.current?.(full, {
              current_step: frame.current_step as string | undefined,
              score_update: undefined,
            });
          }
          setState(prev => (prev === "speaking" ? prev : "idle"));
          return true;
        }

        case "reply": {
          // Legacy non-streamed reply (REST fallback / `stream: false`).
          const text = String(frame.message ?? "");

          lastReplyRef.current = text;
          setLastReply(text);
          replyRef.current?.(text, {
            current_step: frame.current_step as string | undefined,
            score_update: frame.score_update,
          });

          // The audio frames that follow will drive the state from here.
          setState(prev => (prev === "speaking" ? prev : "idle"));

          return true;
        }

        case "audio": {
          sawAudioRef.current = true;
          if (mutedRef.current) return true; // muted: keep the bytes off the decoder
          cancelSpeak(); // socket audio wins over any REST utterance
          const s = streamer();

          s.setMuted(false);
          s.pushBase64(String(frame.data ?? ""));

          return true;
        }

        case "audio_end": {
          if (!mutedRef.current && sawAudioRef.current) {
            streamer().end();
          } else {
            // Nothing will play: muted, or TTS produced no speech.
            setState("idle");
          }

          if (frame.tts_error) {
            setError(`Réponse en texte uniquement — ${humanizeError(frame.tts_error)}`);
            setState("idle");
          }

          return true;
        }

        case "error": {
          const env = frame.env ? ` (${frame.env})` : "";

          fail(`${humanizeError(frame.message)}${env}`);

          if (frame.scope === "tts") {
            // The text reply already arrived; speech is simply unavailable.
            setState("idle");
          } else {
            setState("idle");
          }

          return true;
        }

        default:
          return false;
      }
    },
    [cancelSpeak, fail, streamer]
  );

  /** Local fallback: browser speech synthesis, so ALIA speaks even when
      ElevenLabs is not configured, the key lacks permission, or the request
      fails — the avatar is never silent. */
  const speakLocal = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR";
      u.rate = 0.98;
      u.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const fr = voices.find(v => /fr[-_]FR/i.test(v.lang)) || voices.find(v => /^fr/i.test(v.lang));
      if (fr) u.voice = fr;
      u.onstart = () => setState("speaking");
      u.onend = () => setState(prev => (prev === "speaking" ? "idle" : prev));
      u.onerror = () => setState(prev => (prev === "speaking" ? "idle" : prev));
      setState("speaking");
      window.speechSynthesis.speak(u);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ── replay ──

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      setError(null);

      // No ElevenLabs key (or muted): use the browser's own voice instead of
      // failing silently — the avatar must speak either way.
      if (mutedRef.current) return;

      // A new utterance always supersedes the previous one: two speaks() racing
      // used to push their bytes into the same streamer and be heard together.
      cancelSpeak();
      const token = speakTokenRef.current;
      const controller = new AbortController();

      speakAbortRef.current = controller;

      if (!providersRef.current?.tts.available) {
        if (!speakLocal(text)) {
          setError("Voix : ajoutez ELEVENLABS_API_KEY dans backend/.env");
        }
        return;
      }

      streamer().reset();
      setState("speaking");

      try {
        const res = await fetch(`${API_BASE}/api/v1/voice/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.json().catch(() => null);

          throw new Error((detail as { detail?: string } | null)?.detail || `Erreur ${res.status}`);
        }

        const s = streamer();

        s.setMuted(mutedRef.current);
        s.setMime(res.headers.get("content-type"));

        const reader = res.body.getReader();

        for (;;) {
          const { done, value } = await reader.read();

          if (done) break;

          // Superseded mid-stream (a newer utterance, or socket audio): drop
          // the rest of this one instead of mixing the two.
          if (token !== speakTokenRef.current) {
            try {
              await reader.cancel();
            } catch {
              /* already closed */
            }

            return;
          }
          if (value?.length) s.push(value);
        }

        if (token === speakTokenRef.current) s.end();
      } catch (e) {
        // Replaced by a newer utterance: stay quiet, the winner is speaking.
        if (controller.signal.aborted || token !== speakTokenRef.current) return;

        // ElevenLabs unreachable / bad key / missing permission: still speak
        // with the browser voice so the avatar is never silent.
        streamer().reset();
        setState("idle");
        if (!speakLocal(text)) fail(humanizeError(e));
      }
    },
    [cancelSpeak, fail, streamer, speakLocal]
  );

  const replayLast = useCallback(() => {
    if (lastReplyRef.current) void speak(lastReplyRef.current);
  }, [speak]);

  const resumePlayback = useCallback(() => streamer().resume(), [streamer]);
  const clearError = useCallback(() => setError(null), []);

  // Reset the transient pipeline state when a new session starts. Adjusting
  // during render (instead of in an effect) avoids a cascading second render.
  const [boundSession, setBoundSession] = useState(sessionId);

  if (boundSession !== sessionId) {
    setBoundSession(sessionId);
    setState("idle");
    setStarted(false);
    setLastReply(null);
    lastReplyRef.current = null;
    streamerRef.current?.reset();
  }

  return {
    providers,
    sttAvailable: !!providers?.stt.available,
    // Local browser voice counts as available, so the mute button is usable
    // even without an ElevenLabs key.
    ttsAvailable: !!(providers?.tts.available || (typeof window !== "undefined" && !!window.speechSynthesis)),
    supported: typeof window !== "undefined" && hasRecorder(),
    state,
    started,
    busy: state === "transcribing" || state === "thinking",
    recording: state === "recording",
    speaking,
    muted,
    error,
    lastReply,
    startRecording,
    stopRecording,
    cancelRecording,
    toggleRecording,
    setMuted,
    toggleMuted,
    speak,
    speakLocal,
    getPlayback: () => streamer().getPlayback(),
    replayLast,
    resumePlayback,
    handleFrame,
    clearError,
  };
}

export default useVoice;
