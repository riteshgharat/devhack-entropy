import React, { useEffect, useRef, useState, useCallback } from "react";
import { Room } from "colyseus.js";
import { motion, AnimatePresence } from "motion/react";
import { PixelCard } from "./PixelCard";
import { PixelButton } from "./PixelButton";
import {
  Trophy,
  Timer,
  Zap,
  Rocket,
  Bomb,
  Sun,
  Moon,
  CheckCircle2,
  Circle,
  Crown,
} from "lucide-react";

interface GameArenaProps {
  room: Room;
  nightMode: boolean;
  setNightMode: (val: boolean) => void;
  onLeave: () => void;
}

const MAX_PLAYERS = 8;

/* ── Visual effect types ── */
interface VFX {
  id: number;
  type: "bomb" | "rocket" | "speed" | "collect";
  x: number;
  y: number;
  timer: number;
  maxTimer: number;
  data?: any;
}

interface RocketProjectile {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  timer: number;
  trail: { x: number; y: number; alpha: number }[];
}

interface SpeedParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  timer: number;
  maxTimer: number;
  color: string;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  timer: number;
}

/* ── Player colors for up to 8 players ── */
const PLAYER_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#ec4899",
  "#06b6d4",
];

export const GameArena: React.FC<GameArenaProps> = ({
  room,
  nightMode,
  setNightMode,
  onLeave,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<any>(room.state);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [lastEvent, setLastEvent] = useState("");
  const [eventIcon, setEventIcon] = useState<"bomb" | "rocket" | "speed" | "">(
    "",
  );

  // Visual effects state (managed via refs for performance in animation loop)
  const vfxRef = useRef<VFX[]>([]);
  const rocketsRef = useRef<RocketProjectile[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const speedParticlesRef = useRef<SpeedParticle[]>([]);
  const playerColorsRef = useRef<Map<string, string>>(new Map());
  const colorIndexRef = useRef(0);
  const vfxIdRef = useRef(0);
  const prevGrassCountRef = useRef(-1);
  const prevScoresRef = useRef<Map<string, number>>(new Map());
  const timeRef = useRef(0);

  const getPlayerColor = useCallback((sessionId: string, avatarColor?: string): string => {
    if (avatarColor) return avatarColor;
    if (!playerColorsRef.current.has(sessionId)) {
      playerColorsRef.current.set(
        sessionId,
        PLAYER_COLORS[colorIndexRef.current % PLAYER_COLORS.length],
      );
      colorIndexRef.current++;
    }
    return playerColorsRef.current.get(sessionId)!;
  }, []);

  // Input handling
  useEffect(() => {
    const keys: { [key: string]: boolean } = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      updateMovement();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
      updateMovement();
    };

    const updateMovement = () => {
      let dx = 0;
      let dy = 0;
      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) dx -= 1;
      if (keys["ArrowRight"] || keys["d"] || keys["D"]) dx += 1;
      if (keys["ArrowUp"] || keys["w"] || keys["W"]) dy -= 1;
      if (keys["ArrowDown"] || keys["s"] || keys["S"]) dy += 1;

      room.send("move", { dx, dy });
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [room]);

  // Room state sync + VFX triggers
  useEffect(() => {
    room.onStateChange((state) => {
      setGameState({ ...state });
      if (state.matchEnded) {
        setShowEndScreen(true);
      } else {
        setShowEndScreen(false);
      }

      // Detect event changes for VFX
      if (state.lastEvent && state.lastEvent !== lastEvent) {
        setLastEvent(state.lastEvent);
        const evt = state.lastEvent as string;

        if (evt.includes("Bomb")) {
          setEventIcon("bomb");
          // Find the player who triggered it
          state.players?.forEach((player: any, sid: string) => {
            if (evt.includes(player.displayName) && player.stunTimer > 0) {
              spawnBombVFX(player.x, player.y);
            }
          });
        } else if (evt.includes("Rocket")) {
          setEventIcon("rocket");
          // Find the player who launched it
          state.players?.forEach((player: any, sid: string) => {
            if (evt.includes(player.displayName)) {
              spawnRocketVFX(player.x, player.y, getPlayerColor(sid, player.color));
            }
          });
        } else if (evt.includes("Speed")) {
          setEventIcon("speed");
          state.players?.forEach((player: any, sid: string) => {
            if (evt.includes(player.displayName)) {
              spawnSpeedVFX(player.x, player.y, getPlayerColor(sid, player.color));
            }
          });
        } else {
          setEventIcon("");
        }

        // Clear icon after 3s
        setTimeout(() => setEventIcon(""), 3000);
      }

      // Detect score changes for floating text
      state.players?.forEach((player: any, sid: string) => {
        const prevScore = prevScoresRef.current.get(sid) || 0;
        if (player.score > prevScore) {
          floatingTextsRef.current.push({
            id: vfxIdRef.current++,
            x: player.x,
            y: player.y - 30,
            text: `+${player.score - prevScore}`,
            color: "#22c55e",
            timer: 1.0,
          });
        }
        prevScoresRef.current.set(sid, player.score);

        // Speed particle trail
        if (player.speedMultiplier > 1) {
          const color = getPlayerColor(sid, player.color);
          for (let i = 0; i < 2; i++) {
            speedParticlesRef.current.push({
              id: vfxIdRef.current++,
              x: player.x + (Math.random() - 0.5) * 20,
              y: player.y + (Math.random() - 0.5) * 20,
              vx: (Math.random() - 0.5) * 60,
              vy: (Math.random() - 0.5) * 60 - 20,
              timer: 0.5 + Math.random() * 0.3,
              maxTimer: 0.8,
              color,
            });
          }
        }
      });
    });

    room.onMessage("match_end", (data) => {
      console.log("Match ended:", data);
    });

    return () => {
      room.removeAllListeners();
    };
  }, [room, lastEvent]);

  /* ── VFX Spawn Functions ── */
  const spawnBombVFX = (x: number, y: number) => {
    // Shockwave rings
    vfxRef.current.push({
      id: vfxIdRef.current++,
      type: "bomb",
      x,
      y,
      timer: 1.8,
      maxTimer: 1.8,
    });
    // Debris particles
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 / 12) * i;
      speedParticlesRef.current.push({
        id: vfxIdRef.current++,
        x, y,
        vx: Math.cos(angle) * (80 + Math.random() * 80),
        vy: Math.sin(angle) * (80 + Math.random() * 80),
        timer: 1.0 + Math.random() * 0.5,
        maxTimer: 1.5,
        color: i % 2 === 0 ? "#ef4444" : "#f97316",
      });
    }
  };

  const spawnRocketVFX = (x: number, y: number, _color: string) => {
    // 8 rockets in all directions
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -0.707, dy: -0.707 }, { dx: 0.707, dy: -0.707 },
      { dx: -0.707, dy: 0.707 }, { dx: 0.707, dy: 0.707 },
    ];
    directions.forEach((d) => {
      rocketsRef.current.push({
        id: vfxIdRef.current++,
        x, y,
        dx: d.dx * 320,
        dy: d.dy * 320,
        timer: 2.2,
        trail: [],
      });
    });
    // Central explosion flash
    vfxRef.current.push({
      id: vfxIdRef.current++,
      type: "rocket",
      x,
      y,
      timer: 0.8,
      maxTimer: 0.8,
    });
  };

  const spawnSpeedVFX = (x: number, y: number, _color: string) => {
    vfxRef.current.push({
      id: vfxIdRef.current++,
      type: "speed",
      x,
      y,
      timer: 2.0,
      maxTimer: 2.0,
    });
    // Burst of lightning-yellow particles upward
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      speedParticlesRef.current.push({
        id: vfxIdRef.current++,
        x: x + (Math.random() - 0.5) * 20,
        y,
        vx: Math.cos(angle) * (60 + Math.random() * 80),
        vy: Math.sin(angle) * (100 + Math.random() * 60),
        timer: 0.8 + Math.random() * 0.4,
        maxTimer: 1.2,
        color: "#fbbf24",
      });
    }
  };

  // Canvas Rendering
  useEffect(() => {
    if (!canvasRef.current || !gameState) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      timeRef.current += dt;
      const _time = timeRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // ── BACKGROUND: Dirt/soil base ──
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (nightMode) {
        bgGrad.addColorStop(0, "#0f1729");
        bgGrad.addColorStop(1, "#1a2744");
      } else {
        bgGrad.addColorStop(0, "#87CEEB");
        bgGrad.addColorStop(0.3, "#87CEEB");
        bgGrad.addColorStop(0.31, "#7CB342");
        bgGrad.addColorStop(1, "#558B2F");
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // ── PIXEL GRID overlay (subtle) ──
      ctx.globalAlpha = nightMode ? 0.08 : 0.06;
      ctx.strokeStyle = nightMode ? "#6366f1" : "#33691E";
      ctx.lineWidth = 1;
      const gridSize = 20;
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // ── ARENA BOUNDARY (pixelated border) ──
      const bx = gameState.arenaBoundaryX || 800;
      const by = gameState.arenaBoundaryY || 600;
      ctx.strokeStyle = nightMode ? "#818cf8" : "#4E342E";
      ctx.lineWidth = 6;
      ctx.setLineDash([8, 4]);
      ctx.strokeRect(3, 3, bx - 6, by - 6);
      ctx.setLineDash([]);

      // Corner posts
      const cornerSize = 12;
      ctx.fillStyle = nightMode ? "#6366f1" : "#3E2723";
      ctx.fillRect(0, 0, cornerSize, cornerSize);
      ctx.fillRect(bx - cornerSize, 0, cornerSize, cornerSize);
      ctx.fillRect(0, by - cornerSize, cornerSize, cornerSize);
      ctx.fillRect(bx - cornerSize, by - cornerSize, cornerSize, cornerSize);
      // Inner dots on corners
      ctx.fillStyle = nightMode ? "#a5b4fc" : "#8D6E63";
      ctx.fillRect(3, 3, 6, 6);
      ctx.fillRect(bx - 9, 3, 6, 6);
      ctx.fillRect(3, by - 9, 6, 6);
      ctx.fillRect(bx - 9, by - 9, 6, 6);

      // ── DRAW GRASS (pixelated tufts) ──
      if (gameState.grasses) {
        gameState.grasses.forEach((grass: any) => {
          drawPixelGrass(ctx, grass.x, grass.y, nightMode);
        });
      }

      // ── UPDATE & DRAW VFX ──
      // Update timers
      vfxRef.current = vfxRef.current.filter((v) => {
        v.timer -= dt;
        return v.timer > 0;
      });
      floatingTextsRef.current = floatingTextsRef.current.filter((ft) => {
        ft.timer -= dt;
        ft.y -= 40 * dt;
        return ft.timer > 0;
      });

      // Update rockets with trail
      rocketsRef.current = rocketsRef.current.filter((r) => {
        r.timer -= dt;
        r.trail.push({ x: r.x, y: r.y, alpha: 1.0 });
        if (r.trail.length > 12) r.trail.shift();
        r.trail.forEach((t) => { t.alpha -= dt * 3; });
        r.x += r.dx * dt;
        r.y += r.dy * dt;
        return r.timer > 0;
      });

      // Update & draw speed particles
      speedParticlesRef.current = speedParticlesRef.current.filter((p) => {
        p.timer -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt; // gravity
        return p.timer > 0;
      });
      speedParticlesRef.current.forEach((p) => {
        const alpha = p.timer / p.maxTimer;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 * alpha, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Draw bomb VFX
      vfxRef.current.forEach((v) => {
        if (v.type === "bomb") drawBombEffect(ctx, v);
        else if (v.type === "rocket") drawRocketExplosion(ctx, v);
        else if (v.type === "speed") drawSpeedEffect(ctx, v);
      });

      // Draw rocket projectiles with trails
      rocketsRef.current.forEach((rocket) => {
        rocket.trail.forEach((t, i) => {
          const a = Math.max(0, t.alpha) * (i / rocket.trail.length);
          ctx.globalAlpha = a * 0.6;
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3 * (i / rocket.trail.length), 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        drawRocketProjectile(ctx, rocket);
      });

      // ── DRAW PLAYERS ──
      if (gameState.players) {
        gameState.players.forEach((player: any, sessionId: string) => {
          const isLocal = sessionId === room.sessionId;
          const color = getPlayerColor(sessionId, player.color);
          drawPixelStickman(ctx, player, color, isLocal, nightMode);
        });
      }

      // Draw floating texts on top
      floatingTextsRef.current.forEach((ft) => {
        const alpha = Math.min(1, ft.timer * 2);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 16px "Press Start 2P", monospace';
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1.0;
      });

      // ── GRASS REMAINING indicator (bottom bar) ──
      const totalGrass = 50;
      const remaining = gameState.grasses?.length || 0;
      const barWidth = bx - 40;
      const barHeight = 8;
      const barX = 20;
      const barY = by - 20;
      const fillRatio = remaining / totalGrass;

      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      const grassBarGrad = ctx.createLinearGradient(
        barX,
        0,
        barX + barWidth * fillRatio,
        0,
      );
      grassBarGrad.addColorStop(0, "#22c55e");
      grassBarGrad.addColorStop(1, "#4ade80");
      ctx.fillStyle = grassBarGrad;
      ctx.fillRect(barX, barY, barWidth * fillRatio, barHeight);
      ctx.strokeStyle = nightMode ? "#334155" : "#1B5E20";
      ctx.lineWidth = 2;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      // Grass icon
      ctx.fillStyle = "#22c55e";
      ctx.font = '10px "Press Start 2P", monospace';
      ctx.textAlign = "left";
      ctx.fillText(`🌿 ${remaining}/${totalGrass}`, barX, barY - 4);

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, nightMode, room.sessionId, getPlayerColor]);

  /* ════════════════════════════════════════════════
       DRAWING HELPER FUNCTIONS
       ════════════════════════════════════════════════ */

  function drawPixelGrass(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    night: boolean,
  ) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Grass base (dark patch of earth)
    ctx.fillStyle = night ? "#1a3a1a" : "#6D4C41";
    ctx.fillRect(x - 6, y + 4, 12, 4);

    // Main grass blades (3 tufts)
    const bladeColors = night
      ? ["#2d6b2d", "#3a8a3a", "#1f5e1f"]
      : ["#43A047", "#66BB6A", "#2E7D32"];

    // Left blade
    ctx.fillStyle = bladeColors[0];
    ctx.fillRect(x - 6, y - 6, 4, 10);
    ctx.fillRect(x - 8, y - 8, 4, 4);

    // Center blade (tallest)
    ctx.fillStyle = bladeColors[1];
    ctx.fillRect(x - 2, y - 10, 4, 14);
    ctx.fillRect(x - 2, y - 14, 4, 4);

    // Right blade
    ctx.fillStyle = bladeColors[2];
    ctx.fillRect(x + 2, y - 4, 4, 8);
    ctx.fillRect(x + 4, y - 8, 4, 4);

    // Highlight pixels
    ctx.fillStyle = night ? "#4ade80" : "#A5D6A7";
    ctx.fillRect(x - 1, y - 12, 2, 2);
    ctx.fillRect(x - 5, y - 6, 2, 2);
    ctx.fillRect(x + 3, y - 6, 2, 2);

    // Hidden item indicator (subtle sparkle)
    const sparkle = (Math.sin(Date.now() * 0.005 + x + y) + 1) / 2;
    if (sparkle > 0.8) {
      ctx.fillStyle = `rgba(255, 255, 100, ${(sparkle - 0.8) * 5})`;
      ctx.fillRect(x - 1, y - 16, 2, 2);
    }

    ctx.restore();
  }

  function drawPixelStickman(
    ctx: CanvasRenderingContext2D,
    player: any,
    color: string,
    isLocal: boolean,
    night: boolean,
  ) {
    const px = player.x;
    const py = player.y;
    const stunned = player.stunTimer > 0;
    const boosted = player.speedMultiplier > 1;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // ── Speed boost trail ──
    if (boosted) {
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.15 * i;
        ctx.fillStyle = "#fbbf24";
        const offsetX = -player.velocityX * 0.003 * i * 10;
        const offsetY = -player.velocityY * 0.003 * i * 10;
        drawStickmanBody(ctx, px + offsetX, py + offsetY, color, false);
      }
      ctx.globalAlpha = 1.0;

      // Lightning bolts around player
      const flash = Math.sin(Date.now() * 0.02) > 0;
      if (flash) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        // small zigzag bolt
        ctx.beginPath();
        ctx.moveTo(px - 15, py - 20);
        ctx.lineTo(px - 10, py - 14);
        ctx.lineTo(px - 14, py - 10);
        ctx.lineTo(px - 8, py - 4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(px + 15, py - 18);
        ctx.lineTo(px + 10, py - 12);
        ctx.lineTo(px + 14, py - 8);
        ctx.lineTo(px + 8, py - 2);
        ctx.stroke();
      }
    }

    // ── Stun effect (dizzy stars) ──
    if (stunned) {
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
      const ang = Date.now() * 0.003;
      ctx.fillStyle = "#fbbf24";
      ctx.font = '12px "Press Start 2P", monospace';
      ctx.fillText(
        "💫",
        px + Math.cos(ang) * 16 - 6,
        py - 25 + Math.sin(ang) * 5,
      );
      ctx.fillText(
        "💫",
        px + Math.cos(ang + Math.PI) * 16 - 6,
        py - 25 + Math.sin(ang + Math.PI) * 5,
      );
      ctx.fillText(
        "💫",
        px + Math.cos(ang + Math.PI / 2) * 14 - 6,
        py - 28 + Math.sin(ang + Math.PI / 2) * 4,
      );
      ctx.globalAlpha = 1.0;
    }

    // ── Shadow ──
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(px, py + 18, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Draw the stickman ──
    const drawColor = stunned ? "#94a3b8" : color;
    drawStickmanBody(ctx, px, py, drawColor, isLocal);

    // ── Local player indicator arrow ──
    if (isLocal) {
      const bounce = Math.sin(Date.now() * 0.005) * 3;
      ctx.fillStyle = "#fbbf24";
      // Down arrow
      ctx.beginPath();
      ctx.moveTo(px - 6, py - 42 + bounce);
      ctx.lineTo(px + 6, py - 42 + bounce);
      ctx.lineTo(px, py - 34 + bounce);
      ctx.fill();
      // "YOU" label
      ctx.fillStyle = "#fbbf24";
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = "center";
      ctx.fillText("YOU", px, py - 46 + bounce);
    }

    // ── Name tag + score ──
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    // Background bar for name
    const nameText = `${player.displayName}`;
    const scoreText = `${player.score}`;
    const nameWidth = ctx.measureText(nameText).width;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(px - nameWidth / 2 - 4, py - 34, nameWidth + 8, 12);
    ctx.fillStyle = isLocal ? "#fbbf24" : night ? "#e2e8f0" : "#fff";
    ctx.fillText(nameText, px, py - 24);

    // Score badge
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(px + nameWidth / 2 + 6, py - 34, 24, 12);
    ctx.fillStyle = "#fff";
    ctx.font = 'bold 8px "Press Start 2P", monospace';
    ctx.fillText(scoreText, px + nameWidth / 2 + 18, py - 24);

    // Speed indicator
    if (boosted) {
      ctx.fillStyle = "#fbbf24";
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText("⚡FAST", px, py + 26);
    }

    ctx.restore();
  }

  function drawStickmanBody(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    color: string,
    isLocal: boolean,
  ) {
    // Head (square, pixelated)
    ctx.fillStyle = color;
    ctx.fillRect(px - 8, py - 22, 16, 16);
    // Head border
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 8, py - 22, 16, 16);
    // Head highlight
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(px - 6, py - 20, 4, 4);

    // Eyes
    ctx.fillStyle = "#fff";
    ctx.fillRect(px - 5, py - 16, 4, 4);
    ctx.fillRect(px + 1, py - 16, 4, 4);
    // Pupils
    ctx.fillStyle = "#111";
    ctx.fillRect(px - 4, py - 15, 2, 2);
    ctx.fillRect(px + 2, py - 15, 2, 2);

    // Mouth
    ctx.fillStyle = "#111";
    ctx.fillRect(px - 3, py - 10, 6, 2);

    // Neck
    ctx.fillStyle = color;
    ctx.fillRect(px - 3, py - 6, 6, 3);

    // Body (torso)
    ctx.fillStyle = color;
    ctx.fillRect(px - 7, py - 3, 14, 14);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 7, py - 3, 14, 14);
    // Body highlight
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(px - 5, py - 1, 4, 6);

    // Belt
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(px - 7, py + 8, 14, 3);
    // Belt buckle
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(px - 2, py + 8, 4, 3);

    // Arms
    ctx.fillStyle = color;
    // Left arm
    ctx.fillRect(px - 12, py - 3, 5, 12);
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - 12, py - 3, 5, 12);
    // Right arm
    ctx.fillRect(px + 7, py - 3, 5, 12);
    ctx.strokeRect(px + 7, py - 3, 5, 12);

    // Legs
    const legBrightness = "brightness(0.85)";
    ctx.fillStyle = color;
    ctx.filter = legBrightness;
    // Left leg
    ctx.fillRect(px - 6, py + 11, 5, 12);
    // Right leg
    ctx.fillRect(px + 1, py + 11, 5, 12);
    ctx.filter = "none";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px - 6, py + 11, 5, 12);
    ctx.strokeRect(px + 1, py + 11, 5, 12);

    // Boots
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(px - 8, py + 21, 8, 4);
    ctx.fillRect(px, py + 21, 8, 4);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(px - 8, py + 21, 8, 4);
    ctx.strokeRect(px, py + 21, 8, 4);
  }

  function drawBombEffect(ctx: CanvasRenderingContext2D, vfx: VFX) {
    const progress = 1 - vfx.timer / vfx.maxTimer;
    ctx.save();

    if (progress < 0.3) {
      // Bomb icon phase
      const scale = 1 + progress * 2;
      ctx.font = `${20 * scale}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("💣", vfx.x, vfx.y);
    } else {
      // Explosion phase
      const explosionProgress = (progress - 0.3) / 0.7;
      const radius = explosionProgress * 60;

      // Shockwave ring
      ctx.strokeStyle = `rgba(239, 68, 68, ${1 - explosionProgress})`;
      ctx.lineWidth = 4 - explosionProgress * 3;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      const innerGrad = ctx.createRadialGradient(
        vfx.x,
        vfx.y,
        0,
        vfx.x,
        vfx.y,
        radius * 0.6,
      );
      innerGrad.addColorStop(
        0,
        `rgba(255, 200, 50, ${0.8 * (1 - explosionProgress)})`,
      );
      innerGrad.addColorStop(
        0.5,
        `rgba(239, 68, 68, ${0.5 * (1 - explosionProgress)})`,
      );
      innerGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(vfx.x, vfx.y, radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Flying debris pixels
      for (let i = 0; i < 12; i++) {
        const angle = ((Math.PI * 2) / 12) * i + explosionProgress * 2;
        const dist = radius * 0.8 + Math.sin(i * 3) * 10;
        const dx = vfx.x + Math.cos(angle) * dist;
        const dy = vfx.y + Math.sin(angle) * dist;
        ctx.fillStyle =
          i % 3 === 0 ? "#ef4444" : i % 3 === 1 ? "#fbbf24" : "#f97316";
        ctx.globalAlpha = 1 - explosionProgress;
        ctx.fillRect(dx - 2, dy - 2, 4, 4);
      }
      ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  }

  function drawRocketProjectile(
    ctx: CanvasRenderingContext2D,
    rocket: RocketProjectile,
  ) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const alpha = Math.min(1, rocket.timer);
    ctx.globalAlpha = alpha;

    // Calculate rotation from direction
    const angle = Math.atan2(rocket.dy, rocket.dx);

    ctx.translate(rocket.x, rocket.y);
    ctx.rotate(angle + Math.PI / 2);

    // Rocket body
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-3, -8, 6, 12);
    // Nose cone
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.moveTo(-3, -8);
    ctx.lineTo(0, -14);
    ctx.lineTo(3, -8);
    ctx.fill();
    // Window
    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(-2, -5, 4, 3);
    // Fins
    ctx.fillStyle = "#b91c1c";
    ctx.fillRect(-6, 2, 3, 4);
    ctx.fillRect(3, 2, 3, 4);

    // Exhaust flame
    const flameFlicker = Math.sin(Date.now() * 0.03 + rocket.x) * 2;
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(-2, 4, 4, 4 + flameFlicker);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(-1, 6, 2, 4 + flameFlicker);

    // Trail particles
    ctx.rotate(-(angle + Math.PI / 2));
    ctx.translate(-rocket.x, -rocket.y);

    for (let i = 1; i <= 4; i++) {
      const trailX = rocket.x - rocket.dx * 0.002 * i * 10;
      const trailY = rocket.y - rocket.dy * 0.002 * i * 10;
      ctx.globalAlpha = alpha * (1 - i * 0.2);
      ctx.fillStyle = i % 2 === 0 ? "#fbbf24" : "#f97316";
      ctx.fillRect(trailX - 1, trailY - 1, 3, 3);
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  function drawRocketExplosion(ctx: CanvasRenderingContext2D, vfx: VFX) {
    const progress = 1 - vfx.timer / vfx.maxTimer;
    ctx.save();

    // Central rocket emoji
    if (progress < 0.2) {
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🚀", vfx.x, vfx.y);
    }

    // Expanding ring
    const ringRadius = progress * 40;
    ctx.strokeStyle = `rgba(249, 115, 22, ${1 - progress})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(vfx.x, vfx.y, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawSpeedEffect(ctx: CanvasRenderingContext2D, vfx: VFX) {
    const progress = 1 - vfx.timer / vfx.maxTimer;
    ctx.save();

    // Lightning burst
    ctx.globalAlpha = 1 - progress;

    // Central flash
    ctx.fillStyle = "#fbbf24";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText("⚡", vfx.x, vfx.y);

    // Expanding speed lines
    for (let i = 0; i < 8; i++) {
      const angle = ((Math.PI * 2) / 8) * i;
      const len = 15 + progress * 40;
      const sx = vfx.x + Math.cos(angle) * 10;
      const sy = vfx.y + Math.sin(angle) * 10;
      const ex = vfx.x + Math.cos(angle) * len;
      const ey = vfx.y + Math.sin(angle) * len;

      ctx.strokeStyle = i % 2 === 0 ? "#fbbf24" : "#fde68a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;
    ctx.restore();
  }

  /* ── Build sorted scoreboard from state ── */
  const getScoreboard = () => {
    if (!gameState.players) return [];
    const entries: {
      name: string;
      score: number;
      id: string;
      color: string;
    }[] = [];
    gameState.players.forEach((p: any, id: string) => {
      entries.push({
        name: p.displayName,
        score: p.score,
        id,
        color: getPlayerColor(id, p.color),
      });
    });
    return entries.sort((a, b) => b.score - a.score);
  };

  return (
    <div className={`relative w-full max-w-5xl mx-auto mt-4 flex flex-col items-center ${nightMode ? 'text-white' : ''}`}>

      {/* Day/Night Toggle — fixed top-left */}
      <motion.button
        onClick={() => setNightMode(!nightMode)}
        className={`fixed top-4 left-4 z-50 w-14 h-14 border-4 flex items-center justify-center transition-colors duration-500 cursor-pointer pixel-corners ${
          nightMode
            ? 'bg-indigo-600 border-indigo-800 hover:bg-indigo-500'
            : 'bg-amber-400 border-amber-600 hover:bg-amber-300'
        }`}
        whileHover={{ scale: 1.1, rotate: 15 }}
        whileTap={{ scale: 0.9 }}
        title={nightMode ? 'Switch to Day' : 'Switch to Night'}
      >
        <AnimatePresence mode="wait">
          {nightMode ? (
            <motion.div
              key="moon"
              initial={{ rotate: -90, opacity: 0, scale: 0 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Moon size={24} className="text-yellow-200" fill="currentColor" />
            </motion.div>
          ) : (
            <motion.div
              key="sun"
              initial={{ rotate: 90, opacity: 0, scale: 0 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Sun size={24} className="text-amber-800" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Day/Night label — fixed top-left */}
      <motion.div
        className={`fixed top-5 left-20 z-50 font-display text-[10px] uppercase tracking-widest px-3 py-1 border-2 transition-colors duration-500 ${
          nightMode
            ? 'bg-indigo-900/80 border-indigo-600 text-indigo-300'
            : 'bg-amber-100/80 border-amber-500 text-amber-800'
        }`}
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {nightMode ? '🌙 Night' : '☀️ Day'}
      </motion.div>
      {/* HUD - Top bar */}
      <div className="w-full flex justify-between items-start mb-3 px-2 gap-4">
        {/* Left: Timer + Grass count */}
        <div className="flex flex-col gap-2">
          <div
            className={`px-4 py-2 border-4 flex items-center gap-3 font-display ${
              nightMode
                ? "bg-slate-900/90 border-red-500/80 text-red-300"
                : "bg-white/90 border-red-500 text-red-600"
            }`}
            style={{ minWidth: "140px" }}
          >
            <Timer size={20} className="text-red-500 animate-pulse" />
            <span className="text-xl tracking-widest tabular-nums">
              {Math.ceil(gameState.matchTimer || 0)}s
            </span>
          </div>
          <div
            className={`px-4 py-2 border-4 flex items-center gap-3 font-display text-sm ${
              nightMode
                ? "bg-slate-900/90 border-green-500/80 text-green-300"
                : "bg-white/90 border-green-600 text-green-700"
            }`}
          >
            <span>🌿</span>
            <span className="tracking-wider">
              {gameState.grasses?.length || 0} / 50 GRASS
            </span>
          </div>
        </div>

        {/* Center: Event notification */}
        <AnimatePresence>
          {lastEvent && (
            <motion.div
              key={lastEvent}
              initial={{ opacity: 0, y: -20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className={`px-5 py-3 border-4 font-display text-xs uppercase tracking-wider text-center max-w-xs ${
                nightMode
                  ? "bg-slate-900/95 border-yellow-500/80 text-yellow-300"
                  : "bg-yellow-50/95 border-yellow-500 text-yellow-800"
              }`}
            >
              <div className="flex items-center gap-2 justify-center">
                {eventIcon === "bomb" && (
                  <Bomb size={16} className="text-red-500" />
                )}
                {eventIcon === "rocket" && (
                  <Rocket size={16} className="text-orange-500" />
                )}
                {eventIcon === "speed" && (
                  <Zap size={16} className="text-yellow-400" />
                )}
                <span>{lastEvent}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: Scoreboard */}
        <div
          className={`border-4 font-display text-xs ${
            nightMode
              ? "bg-slate-900/90 border-indigo-500/80 text-slate-200"
              : "bg-white/90 border-slate-700 text-slate-800"
          }`}
          style={{ minWidth: "180px" }}
        >
          <div
            className={`px-3 py-1 text-center uppercase tracking-widest border-b-2 ${
              nightMode
                ? "border-indigo-700 bg-indigo-900/50"
                : "border-slate-300 bg-slate-100"
            }`}
          >
            <Trophy size={12} className="inline mr-2 text-yellow-500" />
            Scores
          </div>
          <div className="px-3 py-1">
            {getScoreboard().map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center gap-2 py-1 ${
                  entry.id === room.sessionId ? "font-bold" : ""
                }`}
              >
                <span className="text-[10px]">
                  {i === 0 ? "👑" : `${i + 1}.`}
                </span>
                <div
                  className="w-3 h-3 border border-black/30"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="flex-1 truncate text-[10px]">
                  {entry.name}
                </span>
                <span className="text-green-400 text-[10px]">
                  {entry.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div
        className={`relative border-8 ${
          nightMode
            ? "border-indigo-900/80 shadow-[0_0_30px_rgba(99,102,241,0.3)]"
            : "border-amber-900 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
        }`}
        style={{ imageRendering: "pixelated" }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="w-full h-auto max-w-full block"
          style={{ imageRendering: "pixelated" }}
        />

        {/* Countdown Overlay */}
        <AnimatePresence>
          {gameState.countdown > 0 && (
            <motion.div
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30"
            >
              <div className="text-center">
                <motion.div
                  key={gameState.countdown}
                  initial={{ scale: 2, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="font-display text-9xl text-white"
                  style={{
                    textShadow:
                      "6px 6px 0 #000, -3px -3px 0 #ef4444, 0 0 30px rgba(255,255,255,0.5)",
                  }}
                >
                  {gameState.countdown}
                </motion.div>
                <div
                  className="font-display text-2xl text-yellow-400 mt-4 tracking-widest"
                  style={{ textShadow: "3px 3px 0 #000" }}
                >
                  GET READY!
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Waiting Overlay — Premium Lobby */}
        {!gameState.matchStarted && gameState.countdown === 0 && (
          <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-xl z-20 p-6 overflow-y-auto ${nightMode ? 'bg-black/80' : 'bg-amber-50/90'}`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              {/* LEFT SIDE: Player List */}
              <div className="space-y-5">
                <div className="text-left">
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`px-2 py-1 ${nightMode ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                      <span className="font-display text-[10px] text-white uppercase tracking-tighter">Lobby</span>
                    </div>
                    <span className={`font-display text-sm tabular-nums ${nightMode ? 'text-slate-400' : 'text-amber-700'}`}>ID: {room.id}</span>
                  </div>
                  <h2 className={`font-display text-3xl tracking-widest uppercase ${nightMode ? 'text-white' : 'text-amber-900'}`} style={{ textShadow: nightMode ? '4px 4px 0 #4f46e5' : '4px 4px 0 #fbbf24' }}>
                    Are you Ready?
                  </h2>
                  <p className={`font-body text-sm mt-2 ${nightMode ? 'text-slate-400' : 'text-amber-700/80'}`}>
                    Mark yourself ready. Game starts when all players are set.
                  </p>
                </div>

                <div className={`border-4 p-4 space-y-2 ${nightMode ? 'bg-slate-900/50 border-indigo-500/30' : 'bg-amber-50/80 border-amber-400/50'}`}>
                  <div className={`flex justify-between items-center mb-3 pb-2 border-b ${nightMode ? 'border-white/10' : 'border-amber-300/40'}`}>
                    <span className={`font-display text-xs ${nightMode ? 'text-indigo-300' : 'text-amber-700'}`}>Players ({gameState.players?.size || 0}/{MAX_PLAYERS})</span>
                    <span className={`font-display text-[10px] uppercase ${nightMode ? 'text-white/40' : 'text-amber-600/60'}`}>Status</span>
                  </div>

                  {Array.from(gameState.players || []).map(([id, p]: [string, any]) => {
                    const isLocal = id === room.sessionId;
                    const isOwner = id === gameState.ownerId;
                    return (
                      <motion.div
                        key={id}
                        layout
                        className={`flex items-center gap-3 p-3 border-2 transition-colors ${
                          p.isReady
                            ? 'border-green-500/50 bg-green-500/10'
                            : nightMode ? 'border-white/5 bg-white/5' : 'border-amber-300/30 bg-amber-100/30'
                        }`}
                      >
                        <div
                          className="w-8 h-8 border-2 border-black/40 shrink-0"
                          style={{ backgroundColor: getPlayerColor(id, p.color) }}
                        />
                        <div className="flex-1 overflow-hidden">
                          <div className="flex items-center gap-2">
                            <span className={`font-display text-sm truncate ${isLocal ? 'text-yellow-400' : nightMode ? 'text-white' : 'text-amber-900'}`}>
                              {p.displayName}{isLocal && ' (You)'}
                            </span>
                            {isOwner && <Crown size={12} className="text-yellow-500" />}
                          </div>
                          <span className={`font-body text-[10px] block leading-tight ${nightMode ? 'text-white/40' : 'text-amber-700/60'}`}>
                            {isOwner ? 'Room Master' : 'Challenger'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.isReady ? (
                            <div className="flex items-center gap-1.5 text-green-400">
                              <span className="font-display text-[10px] uppercase">Ready</span>
                              <CheckCircle2 size={16} />
                            </div>
                          ) : (
                            <div className={`flex items-center gap-1.5 ${nightMode ? 'text-white/20' : 'text-amber-400/60'}`}>
                              <span className="font-display text-[10px] uppercase">Waiting</span>
                              <Circle size={16} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  {Array.from({ length: Math.max(0, 2 - (gameState.players?.size || 0)) }).map((_, i) => (
                    <div key={`empty-${i}`} className={`flex items-center gap-3 p-3 border-2 border-dashed opacity-30 ${nightMode ? 'border-white/10' : 'border-amber-400/30'}`}>
                      <div className={`w-8 h-8 border-2 border-dashed ${nightMode ? 'bg-white/5 border-white/20' : 'bg-amber-200/20 border-amber-400/30'}`} />
                      <span className={`font-display text-[10px] uppercase tracking-widest ${nightMode ? 'text-white/40' : 'text-amber-700/50'}`}>Waiting for player...</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-1">
                  <PixelButton
                    variant={gameState.players?.get(room.sessionId)?.isReady ? 'secondary' : 'primary'}
                    className="flex-1 py-4 text-sm"
                    onClick={() => room.send('ready')}
                  >
                    {gameState.players?.get(room.sessionId)?.isReady ? 'CANCEL READY' : 'I AM READY!'}
                  </PixelButton>
                  <PixelButton variant="accent" className="px-5" onClick={onLeave}>EXIT</PixelButton>
                </div>
              </div>

              {/* RIGHT SIDE: Game Rules */}
              <div className={`border-4 p-5 flex flex-col justify-between ${nightMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-amber-50/80 border-amber-400/50'}`}>
                <div className="space-y-5">
                  <h3 className={`font-display text-lg uppercase tracking-wider flex items-center gap-2 ${nightMode ? 'text-yellow-400' : 'text-amber-700'}`}>
                    <div className={`w-2 h-5 ${nightMode ? 'bg-yellow-400' : 'bg-amber-500'}`} />
                    How to Play
                  </h3>
                  <div className="space-y-3">
                    <div className="flex gap-3 items-start">
                      <div className={`p-2 border font-display text-xs shrink-0 ${nightMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-800'}`}>MV</div>
                      <div>
                        <p className={`font-display text-[11px] uppercase mb-1 ${nightMode ? 'text-white' : 'text-amber-900'}`}>Movement</p>
                        <p className={`font-body text-xs ${nightMode ? 'text-slate-400' : 'text-amber-700'}`}>Use WASD or Arrow Keys to collect grass tiles.</p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className={`p-2 border font-display text-xs shrink-0 ${nightMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-800'}`}>GR</div>
                      <div>
                        <p className={`font-display text-[11px] uppercase mb-1 ${nightMode ? 'text-white' : 'text-amber-900'}`}>Two-Phase Harvest</p>
                        <p className={`font-body text-xs ${nightMode ? 'text-slate-400' : 'text-amber-700'}`}>Touch Big Grass (2pts) → Small Grass. Wait 0.5s and collect again (1pt).</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className={`font-display text-[11px] uppercase tracking-widest pb-2 border-b ${nightMode ? 'text-indigo-300 border-white/5' : 'text-amber-600 border-amber-300/40'}`}>Power-ups</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {[['💣', 'Bomb Trap', 'text-red-300', 'text-red-600'], ['🚀', 'Nuke Rocket', 'text-orange-300', 'text-orange-600'], ['⚡', 'Super Speed', 'text-blue-300', 'text-blue-600'], ['🌿', 'Double Grass', 'text-green-300', 'text-green-600']].map(([icon, label, nightC, dayC]) => (
                        <div key={label} className={`p-2 flex items-center gap-2 border ${nightMode ? 'bg-black/20 border-white/5' : 'bg-amber-100/50 border-amber-300/40'}`}>
                          <span className="text-lg">{icon}</span>
                          <span className={`font-display text-[9px] uppercase ${nightMode ? nightC : dayC}`}>{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`mt-5 p-3 border ${nightMode ? 'bg-yellow-400/10 border-yellow-400/20' : 'bg-amber-100/60 border-amber-400/40'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`animate-pulse w-2 h-2 rounded-full ${nightMode ? 'bg-yellow-400' : 'bg-amber-500'}`} />
                    <p className={`font-body text-[11px] leading-relaxed italic ${nightMode ? 'text-yellow-100/80' : 'text-amber-800'}`}>
                      "Pro Tip: Use the Rocket only when opponents are about to clear a large patch!"
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div
        className={`mt-3 px-4 py-2 border-2 font-display text-[8px] uppercase tracking-widest ${
          nightMode
            ? "bg-slate-900/80 border-slate-700 text-slate-500"
            : "bg-white/80 border-slate-300 text-slate-500"
        }`}
      >
        WASD / Arrow Keys to move • Collect grass • Watch for powerups!
      </div>

      {/* End Screen Modal */}
      <AnimatePresence>
        {showEndScreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="w-full max-w-md mx-4"
            >
              <PixelCard title="Match Result" nightMode={nightMode}>
                <div className="text-center py-6 space-y-6">
                  <motion.div
                    animate={{ rotate: [0, -5, 5, -5, 0], scale: [1, 1.1, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Trophy
                      size={80}
                      className="mx-auto text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]"
                    />
                  </motion.div>

                  <div>
                    <p className="font-display text-sm uppercase text-slate-500 mb-1">
                      Winner
                    </p>
                    <h2
                      className={`font-display text-3xl uppercase tracking-tighter ${nightMode ? "text-indigo-300" : "text-indigo-600"}`}
                    >
                      {gameState.winnerId
                        ? gameState.players?.get(gameState.winnerId)
                            ?.displayName || "Winner"
                        : "Draw!"}
                    </h2>
                  </div>

                  {/* Final Scoreboard */}
                  <div
                    className={`border-2 py-3 ${nightMode ? "border-slate-700" : "border-slate-200"}`}
                  >
                    <p className="font-display text-[10px] uppercase text-slate-500 mb-2">
                      Final Standings
                    </p>
                    {getScoreboard().map((entry, i) => (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-3 px-6 py-1 ${
                          entry.id === room.sessionId ? "font-bold" : ""
                        }`}
                      >
                        <span className="font-display text-sm w-6">
                          {i === 0
                            ? "🥇"
                            : i === 1
                              ? "🥈"
                              : i === 2
                                ? "🥉"
                                : `${i + 1}.`}
                        </span>
                        <div
                          className="w-4 h-4 border-2 border-black/30"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span
                          className={`flex-1 text-left font-display text-xs ${nightMode ? "text-slate-300" : "text-slate-700"}`}
                        >
                          {entry.name}
                        </span>
                        <span className="font-display text-sm text-green-400">
                          {entry.score} 🌿
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <PixelButton
                      variant="primary"
                      size="lg"
                      className="flex-1"
                      onClick={onLeave}
                    >
                      Main Menu
                    </PixelButton>
                  </div>
                </div>
              </PixelCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer Actions */}
      <div className="mt-4">
        <PixelButton variant="secondary" size="sm" onClick={onLeave}>
          Exit to Menu
        </PixelButton>
      </div>
    </div>
  );
};
