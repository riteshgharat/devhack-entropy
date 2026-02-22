import {
  AIInput,
  AIOutput,
  AICommentary,
  AIOverlay,
  ArenaEvent,
  AIEmojiBurst,
} from "./types";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 10000;

// ─── Fallback pool when AI is unavailable ────────────────────────────────────
const FALLBACKS: AIOutput[] = [
  {
    commentary: [
      {
        id: "f1",
        text: "The arena pulses with raw energy — anything can happen!",
        tone: "hype",
        createdAt: 0,
      },
    ],
    overlay: {
      id: "f1",
      title: "CHAOS INCOMING!",
      severity: "high",
      durationMs: 3500,
    },
    emojiBurst: { emoji: "🔥", target: "all" },
    arenaEvent: { type: "spawn_random_hazard" },
  },
  {
    commentary: [
      {
        id: "f2",
        text: "The leader is getting cocky. Time for a reality check.",
        tone: "dramatic",
        createdAt: 0,
      },
    ],
    overlay: {
      id: "f2",
      title: "TARGET: THE LEADER",
      subtitle: "Everyone, rally together!",
      severity: "medium",
      durationMs: 4000,
    },
    emojiBurst: { emoji: "🎯", target: "leader" },
    arenaEvent: { type: "spotlight_player" },
  },
  {
    commentary: [
      {
        id: "f3",
        text: "Tick tock tick tock... survival is getting spicy!",
        tone: "tense",
        createdAt: 0,
      },
    ],
    overlay: {
      id: "f3",
      title: "SUDDEN PRESSURE",
      subtitle: "The arena shrinks...",
      severity: "critical",
      durationMs: 4500,
    },
    emojiBurst: { emoji: "😱", target: "all" },
    arenaEvent: { type: "shrink_boundary" },
  },
  {
    commentary: [
      {
        id: "f4",
        text: "LOL look at them go! Pure madness.",
        tone: "funny",
        createdAt: 0,
      },
    ],
    overlay: {
      id: "f4",
      title: "SPEED RUSH!",
      severity: "medium",
      durationMs: 3000,
    },
    emojiBurst: { emoji: "⚡", target: "all" },
    arenaEvent: { type: "speed_up" },
  },
  {
    commentary: [
      {
        id: "f5",
        text: "Everything... s l o w s... d o w n.",
        tone: "dramatic",
        createdAt: 0,
      },
    ],
    overlay: {
      id: "f5",
      title: "SLOW MOTION!",
      severity: "medium",
      durationMs: 3000,
    },
    emojiBurst: { emoji: "🐢", target: "all" },
    arenaEvent: { type: "slow_mo" },
  },
];

let fallbackIndex = 0;
export function getFallback(): AIOutput {
  const fb = FALLBACKS[fallbackIndex % FALLBACKS.length];
  fallbackIndex++;
  const now = Date.now();
  return {
    ...fb,
    commentary: fb.commentary.map((c) => ({
      ...c,
      id: `fb_${now}`,
      createdAt: now,
    })),
    overlay: fb.overlay ? { ...fb.overlay, id: `fbo_${now}` } : null,
  };
}

// ─── Game-specific context ───────────────────────────────────────────────────
const GAME_CONTEXT: Record<string, string> = {
  grass: `GRASS COLLECT MODE: A high-energy collection sprint where players scramble to gather glowing 'Grass' tiles across the arena. Players must mow grass patches (2 cuts to fully clear), avoid deadly MINES that stun, and grab BOOSTERS for speed advantages. It's a 60-second survival sprint where every tile matters. The AI Game Master can mess with physics, spawn hazards, or give advantages to create chaos.`,

  red_dynamite: `HOT DYNAMITE MODE: An elimination brawl where a ticking DYNAMITE bomb is passed between players like a deadly game of tag. Move into another player to PASS the dynamite before the timer hits zero. When it EXPLODES, the holder is eliminated instantly with full-screen chaos. The timer gets FASTER as players drop. The AI Game Master controls arena slip/drift, spawns decoy bombs, and can mess with movement to make passing harder or easier. Last survivor wins.`,

  turf_soccer: `TURF SOCCER MODE: A chaotic 2-team soccer match where players battle for ball control and goals. Teams spawn on opposite sides, compete to score by kicking the ball into opponent goals (30 pts per goal, 50 pt win bonus). The AI Game Master can shift momentum, spotlight key players, adjust speed, or create dramatic moments. Fast-paced, team-based mayhem where every goal changes the game.`,
};

// ─── Prompt builder ───────────────────────────────────────────────────────────
function buildPrompt(input: AIInput): string {
  const leaderStr = input.leader
    ? `${input.leader.name} (${input.leader.score} pts)`
    : "none yet";
  const weakestStr = input.weakest
    ? `${input.weakest.name} (${input.weakest.score} pts)`
    : "none";
  const eventStr =
    input.recentEvents.length > 0
      ? input.recentEvents.slice(-5).join("; ")
      : "nothing notable";
  const chatStr =
    input.chatHighlights.length > 0
      ? input.chatHighlights.slice(-3).join(" | ")
      : "(quiet)";
  const gameContext =
    GAME_CONTEXT[input.roomType] ?? "A chaotic multiplayer arena battle.";

  return `You are the AI GAME MASTER for CHAOS ARENA — a sadistic, hype, chaotic commentator who loves drama and close calls.

CURRENT GAME: ${gameContext}

LIVE STATUS:
- Players: ${input.aliveCount}/${input.totalPlayers} alive
- Time: ${Math.round(input.timeRemaining)}s remaining
- Leader: ${leaderStr}
- Most at-risk: ${weakestStr}
- Recent: ${eventStr}
- Chat: ${chatStr}

YOUR ROLE: React to the action like a hyped-up sports commentator mixed with a chaos demon. Reference specific game mechanics (grass patches, dynamite passes, goals, etc). Call out leaders getting cocky, underdogs rising, clutch moments, and brutal eliminations. Make it PERSONAL and DRAMATIC.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "commentary": [{ "text": "1-2 sentences, max 120 chars, reference actual game mechanics", "tone": "hype|tense|funny|dramatic" }],
  "overlay": { "title": "ALL CAPS 2-3 words", "subtitle": "optional drama", "severity": "low|medium|high|critical", "durationMs": 3000 } or null,
  "emojiBurst": { "emoji": "single emoji", "target": "all|leader|weakest" } or null,
  "arenaEvent": { "type": "none|shrink_boundary|spawn_random_hazard|speed_up|slow_mo|spotlight_player", "payload": {} }
}

Keep it spicy, reference the game mode, and make every moment feel like it matters!`;
}

// ─── Main AI call ─────────────────────────────────────────────────────────────
export async function callGemini(input: AIInput): Promise<AIOutput> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[AI] GEMINI_API_KEY not set, using fallback");
    return getFallback();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${GEMINI_REST_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 1.2,
          maxOutputTokens: 256,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[AI] Gemini HTTP error ${res.status}, using fallback`);
      return getFallback();
    }

    const json = (await res.json()) as any;
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    const parsed = JSON.parse(raw) as any;
    const now = Date.now();

    const commentary: AICommentary[] = (parsed.commentary ?? []).map(
      (c: any, i: number) => ({
        id: `ai_${now}_${i}`,
        text: String(c.text ?? "").slice(0, 140),
        tone: ["hype", "tense", "funny", "dramatic"].includes(c.tone)
          ? c.tone
          : "hype",
        createdAt: now,
      }),
    );

    const rawOverlay = parsed.overlay;
    const overlay: AIOverlay | null = rawOverlay
      ? {
          id: `aio_${now}`,
          title: String(rawOverlay.title ?? "CHAOS!")
            .slice(0, 30)
            .toUpperCase(),
          subtitle: rawOverlay.subtitle
            ? String(rawOverlay.subtitle).slice(0, 60)
            : undefined,
          severity: ["low", "medium", "high", "critical"].includes(
            rawOverlay.severity,
          )
            ? rawOverlay.severity
            : "medium",
          durationMs: Math.min(
            8000,
            Math.max(1500, Number(rawOverlay.durationMs ?? 3000)),
          ),
        }
      : null;

    const rawBurst = parsed.emojiBurst;
    const emojiBurst: AIEmojiBurst | null = rawBurst
      ? {
          emoji: String(rawBurst.emoji ?? "🔥"),
          target: ["all", "leader", "weakest"].includes(rawBurst.target)
            ? rawBurst.target
            : "all",
        }
      : null;

    const ALLOWED_EVENTS = new Set([
      "none",
      "shrink_boundary",
      "spawn_random_hazard",
      "speed_up",
      "slow_mo",
      "spotlight_player",
    ]);
    const rawEvent = parsed.arenaEvent ?? {};
    const arenaEvent: ArenaEvent = {
      type: ALLOWED_EVENTS.has(rawEvent.type) ? rawEvent.type : "none",
      payload: typeof rawEvent.payload === "object" ? rawEvent.payload : {},
    };

    console.log(
      `[AI] Gemini response received → ${commentary[0]?.text ?? "(empty)"}`,
    );
    return { commentary, overlay, emojiBurst, arenaEvent };
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn(
      `[AI] Gemini call failed (${err?.message ?? err}), using fallback`,
    );
    return getFallback();
  }
}
