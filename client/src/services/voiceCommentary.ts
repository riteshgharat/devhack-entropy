/**
 * Voice Commentary Service
 * Calls the backend /api/tts proxy (Sarvam AI bulbul:v3) and plays
 * base-64 WAV audio via the Web Audio API.
 *
 * Supports dual-host mode (male + female alternate) and two languages.
 */

export type VoiceLanguage = 'en-IN' | 'hi-IN';
export type VoiceGender = 'male' | 'female' | 'both';

export interface VoiceSettings {
  enabled: boolean;
  language: VoiceLanguage;
  gender: VoiceGender;
  volume: number; // 0.0 – 1.0
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  language: 'en-IN',
  gender: 'both',
  volume: 0.85,
};

const SETTINGS_KEY = 'voiceCommentarySettings';

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_VOICE_SETTINGS };
}

export function saveVoiceSettings(s: VoiceSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ─── Audio engine ───────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/** Queue to prevent commentary from overlapping */
let playQueue: Promise<void> = Promise.resolve();

/** Tracks which gender spoke last (for "both" mode alternation) */
let lastGender: 'male' | 'female' = 'female';

/**
 * Speak game commentary text using the player's voice settings.
 * Non-blocking — queues audio to play sequentially.
 */
export function speakCommentary(text: string, settings: VoiceSettings): void {
  if (!settings.enabled || !text.trim()) return;

  // Decide actual gender for this utterance
  let gender: 'male' | 'female';
  if (settings.gender === 'both') {
    gender = lastGender === 'male' ? 'female' : 'male';
    lastGender = gender;
  } else {
    gender = settings.gender;
    lastGender = gender;
  }

  playQueue = playQueue.then(async () => {
    try {
      await _fetchAndPlay(text, settings.language, gender, settings.volume);
    } catch (err) {
      console.warn('[VoiceCommentary] playback error:', err);
    }
  });
}

async function _fetchAndPlay(
  text: string,
  language: VoiceLanguage,
  gender: 'male' | 'female',
  volume: number,
): Promise<void> {
  const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL ?? 'http://localhost:3000';

  const res = await fetch(`${backendUrl}/api/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, gender }),
  });

  if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

  const { audio } = await res.json() as { audio: string };
  if (!audio) throw new Error('Empty audio from TTS');

  await _playBase64Wav(audio, volume);
}

async function _playBase64Wav(base64: string, volume: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Decode base64 → ArrayBuffer
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);

      const ctx = getAudioContext();

      // Resume context if needed (autoplay policy)
      const resume = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
      resume.then(() => {
        ctx.decodeAudioData(bytes.buffer, (buffer) => {
          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const gainNode = ctx.createGain();
          gainNode.gain.value = Math.max(0, Math.min(1, volume));

          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          source.start();
          source.onended = () => resolve();
        }, reject);
      }).catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}
