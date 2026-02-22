/**
 * Sarvam AI Text-to-Speech service (bulbul:v3)
 * API docs: https://docs.sarvam.ai/api-reference-docs/text-to-speech
 */

export type VoiceLanguage = 'en-IN' | 'hi-IN';
export type VoiceGender = 'male' | 'female';

// bulbul:v3 speakers mapped to language + gender (names must be lowercase)
const SPEAKER_MAP: Record<VoiceLanguage, Record<VoiceGender, string>> = {
  'en-IN': {
    male: 'rohan',      // Energetic male – great sports commentator feel
    female: 'pooja',   // Friendly, enthusiastic female
  },
  'hi-IN': {
    male: 'rahul',      // Lively Hindi male
    female: 'priya',   // Vibrant Hindi female
  },
};

export interface TTSOptions {
  text: string;
  language: VoiceLanguage;
  gender: VoiceGender;
  /** Audio pace (0.5–2.0). Defaults to 1.15 for punchy commentary */
  pace?: number;
}

export interface TTSResult {
  /** Base-64 encoded WAV audio */
  audioBase64: string;
  durationMs?: number;
}

export async function synthesizeSpeech(opts: TTSOptions): Promise<TTSResult> {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    throw new Error('SARVAM_API_KEY environment variable is not set');
  }

  const speaker = SPEAKER_MAP[opts.language]?.[opts.gender] ?? 'rohan';

  const body = {
    text: opts.text.slice(0, 500), // bulbul:v3 max 2500 chars; cap at 500 for speed
    target_language_code: opts.language,
    speaker,
    model: 'bulbul:v3',
    pace: opts.pace ?? 1.15,
    speech_sample_rate: 22050,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const res = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Sarvam TTS HTTP ${res.status}: ${errText}`);
    }

    const data = await res.json() as { audios: string[]; request_id?: string };
    const audioBase64 = data.audios?.[0];
    if (!audioBase64) {
      throw new Error('Sarvam TTS returned empty audio');
    }

    return { audioBase64 };
  } finally {
    clearTimeout(timeout);
  }
}
