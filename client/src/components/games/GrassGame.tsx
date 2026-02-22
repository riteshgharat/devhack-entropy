import React, { useEffect, useRef, useState, useCallback } from "react";
import { Room } from "colyseus.js";
import { motion, AnimatePresence } from "motion/react";
import { PixelCard } from "../PixelCard";
import { PixelButton } from "../PixelButton";
import { Trophy, Users } from "lucide-react";

interface GrassGameProps {
  room: Room;
  nightMode: boolean;
  onLeave: () => void;
  onNextGame?: (roomId: string, roomName: string) => void;
}

// Game Constants
const TILE_SIZE = 40;
const COLS = 20;
const ROWS = 15;
const CANVAS_WIDTH = COLS * TILE_SIZE;
const CANVAS_HEIGHT = ROWS * TILE_SIZE;

// Colors
const PALETTE = {
  dirt: "#8c6b4e",
  dirtDark: "#6b5038",
  grassBase: "#4CAF50",
  grassLight: "#81C784",
  grassDark: "#2E7D32",
  p1: "#e53935",
  p2: "#43a047",
  p3: "#fdd835",
  p4: "#1e88e5",
  p5: "#a855f7",
  p6: "#f97316",
  p7: "#ec4899",
  p8: "#06b6d4",
};

const PLAYER_COLORS = [
  PALETTE.p1,
  PALETTE.p2,
  PALETTE.p3,
  PALETTE.p4,
  PALETTE.p5,
  PALETTE.p6,
  PALETTE.p7,
  PALETTE.p8,
];

class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;

  constructor(
    x: number,
    y: number,
    color1: string,
    color2: string,
    velMod = 100,
  ) {
    this.x = x + ((Math.random() - 0.5) * TILE_SIZE) / 2;
    this.y = y + ((Math.random() - 0.5) * TILE_SIZE) / 2;
    this.vx = (Math.random() - 0.5) * velMod * 2;
    this.vy = (Math.random() - 0.5) * velMod * 2 - velMod / 2;
    this.life = 1.0;
    this.decay = 1.5 + Math.random();
    this.size = 3 + Math.random() * 5;
    this.color = Math.random() > 0.5 ? color1 : color2;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 400 * dt;
    this.life -= this.decay * dt;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1.0;
  }
}

export const GrassGame: React.FC<GrassGameProps> = ({
  room,
  nightMode,
  onLeave,
  onNextGame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<any>(room.state);
  const [showEndScreen, setShowEndScreen] = useState(false);
  const [nextGameTimer, setNextGameTimer] = useState(5);

  const particlesRef = useRef<Particle[]>([]);
  const explosionsRef = useRef<
    { x: number; y: number; radius: number; life: number }[]
  >([]);
  const playerColorsRef = useRef<Map<string, string>>(new Map());
  const colorIndexRef = useRef(0);
  const prevGridRef = useRef<number[]>([]);
  const prevItemsRef = useRef<Map<string, boolean>>(new Map());

  const getPlayerColor = useCallback((sessionId: string): string => {
    if (!playerColorsRef.current.has(sessionId)) {
      playerColorsRef.current.set(
        sessionId,
        PLAYER_COLORS[colorIndexRef.current % PLAYER_COLORS.length],
      );
      colorIndexRef.current++;
    }
    return playerColorsRef.current.get(sessionId)!;
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (showEndScreen && nextGameTimer > 0) {
      interval = setInterval(() => {
        setNextGameTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showEndScreen, nextGameTimer]);

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

  // Mobile Joystick State
  const joystickAreaRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickActiveRef = useRef(false);

  useEffect(() => {
    const joystickArea = joystickAreaRef.current;
    const joystickKnob = joystickKnobRef.current;
    if (!joystickArea || !joystickKnob) return;

    const handleJoystickStart = (e: TouchEvent) => {
      e.preventDefault();
      joystickActiveRef.current = true;
      updateJoystick(e.touches[0]);
    };
    const handleJoystickMove = (e: TouchEvent) => {
      if (!joystickActiveRef.current) return;
      e.preventDefault();
      updateJoystick(e.touches[0]);
    };
    const handleJoystickEnd = () => {
      joystickActiveRef.current = false;
      joystickKnob.style.transform = `translate(0px, 0px)`;
      room.send("move", { dx: 0, dy: 0 });
    };

    const updateJoystick = (touch: Touch) => {
      const rect = joystickArea.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;
      const maxDist = rect.width / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
      }
      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

      // Send normalized vector
      room.send("move", { dx: dx / maxDist, dy: dy / maxDist });
    };

    joystickArea.addEventListener("touchstart", handleJoystickStart, {
      passive: false,
    });
    joystickArea.addEventListener("touchmove", handleJoystickMove, {
      passive: false,
    });
    joystickArea.addEventListener("touchend", handleJoystickEnd);
    joystickArea.addEventListener("touchcancel", handleJoystickEnd);

    return () => {
      joystickArea.removeEventListener("touchstart", handleJoystickStart);
      joystickArea.removeEventListener("touchmove", handleJoystickMove);
      joystickArea.removeEventListener("touchend", handleJoystickEnd);
      joystickArea.removeEventListener("touchcancel", handleJoystickEnd);
    };
  }, [room]);

  // Refs to prevent stale closures and duplicate listener registration
  const onNextGameRef = useRef(onNextGame);
  onNextGameRef.current = onNextGame;
  const nextGameFiredRef = useRef(false);
  // Only show the end screen if we witnessed the match START during this session.
  // Prevents showing the winner box immediately when quick-joining a room that
  // just finished (room.state isn't fully synced at mount time so we can't use
  // room.state.matchEnded as a reliable initial check).
  const hasMatchStartedRef = useRef(false);

  // Colyseus State Sync
  useEffect(() => {
    // Reset the once-guard whenever the room instance changes
    nextGameFiredRef.current = false;
    hasMatchStartedRef.current = false;

    room.onMessage(
      "next_game",
      (data: { roomId: string; roomName: string }) => {
        console.log("[GrassGame] next_game received:", data);
        // Guard: Colyseus appends listeners on every registration, so only fire once
        if (nextGameFiredRef.current) return;
        nextGameFiredRef.current = true;
        onNextGameRef.current?.(data.roomId, data.roomName);
      },
    );

    room.onMessage("match_start", (data: { countdown: number }) => {
      console.log("[GrassGame] match_start received:", data);
    });

    room.onMessage("match_over", () => {
      console.log("[GrassGame] match_over received");
    });

    room.onStateChange((state) => {
      setGameState({ ...state });

      // Mark that we saw an active match (needed to guard the end screen below)
      if (state.matchStarted && !state.matchEnded) {
        hasMatchStartedRef.current = true;
      }

      // Only show end screen when we witnessed the match running — not when
      // we joined into an already-ended room (quick connect edge case)
      if (state.matchEnded && hasMatchStartedRef.current) {
        setShowEndScreen(true);
      }

      // Reset for the next round
      if (!state.matchStarted && !state.matchEnded) {
        hasMatchStartedRef.current = false;
        setShowEndScreen(false);
      }

      // Detect grid changes for particles
      if (prevGridRef.current.length > 0 && state.grid) {
        for (let i = 0; i < state.grid.length; i++) {
          if (state.grid[i] < prevGridRef.current[i]) {
            const r = Math.floor(i / COLS);
            const c = i % COLS;
            const x = c * TILE_SIZE + TILE_SIZE / 2;
            const y = r * TILE_SIZE + TILE_SIZE / 2;
            const color1 =
              state.grid[i] === 1 ? PALETTE.grassLight : PALETTE.dirt;
            for (let p = 0; p < 8; p++) {
              particlesRef.current.push(
                new Particle(x, y, PALETTE.grassBase, color1),
              );
            }
          }
        }
      }
      if (state.grid) {
        prevGridRef.current = Array.from(state.grid);
      }

      // Detect item explosions
      if (state.items) {
        state.items.forEach((item: any) => {
          const wasActive = prevItemsRef.current.get(item.id) ?? true;
          if (wasActive && !item.active && item.type === "mine") {
            // Mine exploded
            explosionsRef.current.push({
              x: item.x,
              y: item.y,
              radius: 0,
              life: 1,
            });
            for (let i = 0; i < 15; i++) {
              particlesRef.current.push(
                new Particle(item.x, item.y, "#ff9800", "#f44336", 150),
              );
            }
          } else if (wasActive && !item.active && item.type === "booster") {
            // Booster collected
            for (let i = 0; i < 10; i++) {
              particlesRef.current.push(
                new Particle(item.x, item.y, "#00bcd4", "#e0f7fa", 100),
              );
            }
          }
          prevItemsRef.current.set(item.id, item.active);
        });
      }
    });

    // No removeAllListeners - only remove what we own
    return () => {};
  }, [room]); // onNextGame intentionally excluded — stored in ref to avoid duplicate listener registration

  // Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Clear background
      ctx.fillStyle = PALETTE.dirt;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw Grid
      if (gameState.grid) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const idx = r * COLS + c;
            const val = gameState.grid[idx];
            const x = c * TILE_SIZE;
            const y = r * TILE_SIZE;

            if (val === 2) {
              // Full Grass
              ctx.fillStyle = PALETTE.grassBase;
              ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
              ctx.fillStyle = PALETTE.grassLight;
              ctx.fillRect(x + 4, y + 4, 8, 8);
              ctx.fillRect(x + 20, y + 8, 8, 8);
              ctx.fillStyle = PALETTE.grassDark;
              ctx.fillRect(x + TILE_SIZE - 12, y + TILE_SIZE - 12, 8, 8);
              ctx.fillStyle = "rgba(0,0,0,0.1)";
              ctx.fillRect(x, y + TILE_SIZE - 4, TILE_SIZE, 4);
              ctx.fillRect(x + TILE_SIZE - 4, y, 4, TILE_SIZE);
            } else if (val === 1) {
              // Half cut
              if ((r + c) % 2 === 0) {
                ctx.fillStyle = PALETTE.dirtDark;
                ctx.fillRect(
                  x + TILE_SIZE / 2 - 4,
                  y + TILE_SIZE / 2 - 4,
                  8,
                  8,
                );
              }
              ctx.fillStyle = PALETTE.grassBase;
              ctx.fillRect(x + 4, y + 4, 12, 12);
              ctx.fillRect(
                x + TILE_SIZE / 2 + 2,
                y + TILE_SIZE / 2 + 2,
                10,
                10,
              );
            } else {
              // Dirt
              if ((r + c) % 2 === 0) {
                ctx.fillStyle = PALETTE.dirtDark;
                ctx.fillRect(
                  x + TILE_SIZE / 2 - 4,
                  y + TILE_SIZE / 2 - 4,
                  8,
                  8,
                );
              }
            }
          }
        }
      }

      // Draw Items
      if (gameState.items) {
        gameState.items.forEach((item: any) => {
          if (!item.active || !item.revealed) return;
          ctx.save();
          ctx.translate(item.x, item.y);

          if (item.type === "mine") {
            ctx.fillStyle = "#222";
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#795548";
            ctx.fillRect(-2, -14, 4, 6); // fuse
            // Flashing red center based on timer
            const flashPhase = (time / 100) * (6 - item.timer);
            if (Math.sin(flashPhase) > 0) {
              ctx.fillStyle = "#f44336";
              ctx.beginPath();
              ctx.arc(0, 0, 4, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (item.type === "booster") {
            const yOffset = Math.sin(time / 200) * 4;
            ctx.translate(0, yOffset);
            ctx.fillStyle = "#00bcd4";
            ctx.shadowColor = "#00bcd4";
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.moveTo(-4, -10);
            ctx.lineTo(6, -10);
            ctx.lineTo(1, 0);
            ctx.lineTo(6, 0);
            ctx.lineTo(-6, 12);
            ctx.lineTo(-2, 2);
            ctx.lineTo(-8, 2);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
          }
          ctx.restore();
        });
      }

      // Update & Draw Explosions
      for (let i = explosionsRef.current.length - 1; i >= 0; i--) {
        const ex = explosionsRef.current[i];
        ex.radius += dt * 300;
        ex.life -= dt * 3;
        if (ex.life <= 0) {
          explosionsRef.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = `rgba(255, 87, 34, ${ex.life})`;
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, Math.max(0, ex.radius), 0, Math.PI * 2);
        ctx.fill();
      }

      // Update & Draw Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.update(dt);
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          p.draw(ctx);
        }
      }

      // Draw Players
      if (gameState.players) {
        const playersArray = Array.from(gameState.players.entries()).map(
          ([id, p]: [string, any]) => ({ id, ...p }),
        );
        playersArray.sort((a, b) => a.y - b.y);

        playersArray.forEach((player) => {
          const s = TILE_SIZE * 0.7;
          // Use the server-assigned color (from join options) so all clients see the same color
          const color = player.color || getPlayerColor(player.id);
          const isStunned = player.stunTimer > 0;
          const isBuffed = player.speedMultiplier > 1;

          ctx.save();
          ctx.translate(player.x, player.y);

          if (isStunned) {
            ctx.filter = "grayscale(80%)";
          } else if (isBuffed) {
            ctx.shadowColor = "#00bcd4";
            ctx.shadowBlur = 15;
          }

          let wiggleY = 0;
          if (
            !isStunned &&
            (player.velocityX !== 0 || player.velocityY !== 0)
          ) {
            wiggleY = Math.sin(time / 50) * 3;
          }

          // Shadow
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.fillRect(-s / 2 + 2, -s / 2 + 5 + s, s, s * 0.2);

          if (isBuffed) {
            ctx.shadowBlur = 15;
          }

          // Body
          ctx.fillStyle = color;
          ctx.fillRect(-s / 2, -s / 2 + wiggleY, s, s * 0.8);
          ctx.fillStyle = "rgba(255,255,255,0.2)";
          ctx.fillRect(-s / 2, -s / 2 + wiggleY, s, s * 0.2);
          ctx.fillStyle = "rgba(0,0,0,0.2)";
          ctx.fillRect(-s / 2, -s / 2 + wiggleY + s * 0.6, s, s * 0.2);

          // Eyes
          ctx.fillStyle = "white";
          const facingX =
            player.velocityX > 0 ? 1 : player.velocityX < 0 ? -1 : 1;
          const eyeOffX = facingX * (s * 0.1);

          if (isStunned) {
            ctx.fillStyle = "#111";
            ctx.fillRect(
              -s / 4 + eyeOffX,
              -s / 4 + wiggleY + s * 0.1,
              s * 0.2,
              3,
            );
            ctx.fillRect(
              s / 8 + eyeOffX,
              -s / 4 + wiggleY + s * 0.1,
              s * 0.2,
              3,
            );
          } else {
            ctx.fillRect(-s / 4 + eyeOffX, -s / 4 + wiggleY, s * 0.2, s * 0.2);
            ctx.fillRect(s / 8 + eyeOffX, -s / 4 + wiggleY, s * 0.2, s * 0.2);
            ctx.fillStyle = "black";
            ctx.fillRect(
              -s / 4 + s * 0.1 + eyeOffX,
              -s / 4 + s * 0.1 + wiggleY,
              s * 0.1,
              s * 0.1,
            );
            ctx.fillRect(
              s / 8 + s * 0.1 + eyeOffX,
              -s / 4 + s * 0.1 + wiggleY,
              s * 0.1,
              s * 0.1,
            );
          }

          ctx.filter = "none";
          ctx.shadowBlur = 0;

          // Stun stars
          if (isStunned) {
            ctx.fillStyle = "#ffeb3b";
            let t = time / 150;
            ctx.fillRect(Math.cos(t) * 15, -s / 2 - 10 + Math.sin(t) * 5, 5, 5);
            ctx.fillRect(
              Math.cos(t + Math.PI) * 15,
              -s / 2 - 10 + Math.sin(t + Math.PI) * 5,
              5,
              5,
            );
          }

          // Name tag
          ctx.fillStyle = "white";
          ctx.font = '10px "Courier New", monospace';
          ctx.textAlign = "center";
          ctx.fillText(player.displayName || "Player", 0, -s / 2 - 15);

          ctx.restore();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState]);

  const getScoreboard = () => {
    if (!gameState.players) return [];
    const players = Array.from(gameState.players.entries()).map(
      ([id, p]: [string, any]) => ({
        id,
        name: p.displayName || "Player",
        score: p.score,
        // Use the server-assigned color so leaderboard matches in-game player color
        color: (p as any).color || getPlayerColor(id),
      }),
    );
    return players.sort((a, b) => b.score - a.score);
  };

  return (
    <div className="flex flex-col items-center w-full max-w-6xl mx-auto">
      {/* Header HUD */}
      <div className="w-full flex justify-between items-center mb-4 px-4">
        <div
          className={`font-display text-2xl ${nightMode ? "text-white" : "text-slate-800"}`}
        >
          TIME:{" "}
          {Math.ceil(
            gameState.countdown > 0
              ? gameState.countdown
              : gameState.matchEnded
                ? 0
                : (gameState.matchTimer ?? 60),
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 w-full">
        {/* Game Canvas Container */}
        <div
          className={`relative flex-1 aspect-4/3 border-4 overflow-hidden ${
            nightMode
              ? "border-slate-700 bg-slate-900"
              : "border-slate-300 bg-slate-100"
          }`}
          style={{ imageRendering: "pixelated" }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full h-full block"
            style={{ imageRendering: "pixelated" }}
          />

          {/* Mobile Joystick */}
          <div
            className="md:hidden absolute bottom-4 left-4 w-32 h-32 bg-white/10 rounded-full pointer-events-auto"
            ref={joystickAreaRef}
          >
            <div
              className="absolute w-12 h-12 bg-white/50 rounded-full top-10 left-10"
              ref={joystickKnobRef}
            />
          </div>

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

          {/* Waiting Overlay */}
          {!gameState.matchStarted && gameState.countdown === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-10">
              <div className="text-center text-white space-y-4">
                <Users
                  size={64}
                  className="mx-auto text-indigo-400 animate-bounce"
                />
                <h2
                  className="font-display text-3xl tracking-widest"
                  style={{ textShadow: "4px 4px 0 #000" }}
                >
                  WAITING FOR PLAYERS
                </h2>
                <p className="font-body text-xl opacity-70">
                  Need {2 - (gameState.players?.size || 0)} more player(s) to
                  start
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard (Right Side) */}
        <div
          className={`w-full md:w-64 border-4 p-4 flex flex-col ${nightMode ? "border-slate-700 bg-slate-800/80" : "border-slate-300 bg-white/80"}`}
        >
          <h3
            className={`font-display text-xl mb-4 text-center ${nightMode ? "text-white" : "text-slate-800"}`}
          >
            LEADERBOARD
          </h3>
          <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
            {getScoreboard().map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 p-2 border-2 ${nightMode ? "border-slate-600 bg-slate-900" : "border-slate-200 bg-slate-50"}`}
                style={{ borderColor: p.color }}
              >
                <span className="font-display text-sm w-4">{i + 1}.</span>
                <div className="w-4 h-4" style={{ backgroundColor: p.color }} />
                <span
                  className={`flex-1 truncate font-display text-sm ${nightMode ? "text-slate-200" : "text-slate-700"}`}
                >
                  {p.name}
                </span>
                <span className="font-bold font-display text-green-500">
                  {p.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls hint */}
      <div
        className={`mt-3 px-4 py-2 border-2 font-display text-[8px] uppercase tracking-widest ${
          nightMode
            ? "bg-slate-900/80 border-slate-700 text-slate-500"
            : "bg-white/80 border-slate-300 text-slate-500"
        }`}
      >
        WASD / Arrow Keys to move • Grass takes 2 cuts • Watch for Mines!
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
                      variant="danger"
                      size="lg"
                      className="flex-1"
                      onClick={() => {
                        if (
                          window.confirm(
                            "Are you sure you want to exit the game?",
                          )
                        ) {
                          onLeave();
                        }
                      }}
                    >
                      Exit Game
                    </PixelButton>
                  </div>
                  <div className="text-center mt-4">
                    <p
                      className={`font-display text-sm ${nightMode ? "text-slate-400" : "text-slate-600"}`}
                    >
                      Next game starting in {nextGameTimer}s...
                    </p>
                  </div>
                </div>
              </PixelCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
