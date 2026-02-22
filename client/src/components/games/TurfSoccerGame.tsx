import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Room } from 'colyseus.js';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from '../PixelCard';
import { PixelButton } from '../PixelButton';
import { Trophy, Users } from 'lucide-react';

interface TurfSoccerGameProps {
    room: Room;
    nightMode: boolean;
    onLeave: () => void;
    onNextGame?: (roomId: string, roomName: string) => void;
}

// ─── Field Constants ────────────────────────────────────
const FIELD_WIDTH = 1200;
const FIELD_HEIGHT = 800;
const FW = FIELD_WIDTH;
const FH = FIELD_HEIGHT;
const FIELD_CX = FW / 2;
const FIELD_CY = FH / 2;
const GOAL_WIDTH = 60;
const GOAL_HEIGHT = 160;
const BALL_RADIUS = 14;
const PLAYER_SIZE = 32;
const TILE_SIZE = 40;

// ─── Colors ─────────────────────────────────────────────
const FIELD_GREEN = '#3a8c3f';
const FIELD_GREEN_ALT = '#348537';
const FIELD_LINE = 'rgba(255,255,255,0.7)';
const GOAL_NET = 'rgba(255,255,255,0.3)';
const GOAL_POST = '#fff';

// ─── Particle ───────────────────────────────────────────
class Particle {
    x: number; y: number; vx: number; vy: number;
    life: number; decay: number; size: number; color: string;
    constructor(x: number, y: number, color1: string, color2: string, velMod = 100) {
        this.x = x + (Math.random() - 0.5) * 10;
        this.y = y + (Math.random() - 0.5) * 10;
        this.vx = (Math.random() - 0.5) * velMod * 2;
        this.vy = (Math.random() - 0.5) * velMod * 2;
        this.life = 1.0;
        this.decay = 1.5 + Math.random();
        this.size = 4 + Math.random() * 6;
        this.color = Math.random() > 0.5 ? color1 : color2;
    }
    update(dt: number) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= this.decay * dt; }
    draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = this.color;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

export const TurfSoccerGame: React.FC<TurfSoccerGameProps> = ({ room, nightMode, onLeave, onNextGame }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<any>(room.state);
    const [showEndScreen, setShowEndScreen] = useState(false);
    const [nextGameTimer, setNextGameTimer] = useState(5);
    const particlesRef = useRef<Particle[]>([]);
    const gameStateRef = useRef(gameState);
    gameStateRef.current = gameState;

    // ── End-screen countdown ──
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (showEndScreen && nextGameTimer > 0) {
            interval = setInterval(() => setNextGameTimer(prev => prev - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [showEndScreen, nextGameTimer]);

    // ── Keyboard input ──
    useEffect(() => {
        const keys: Record<string, boolean> = {};
        const send = () => {
            let dx = 0, dy = 0;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
            if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
            if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;
            room.send("move", { dx, dy });
        };
        const down = (e: KeyboardEvent) => { keys[e.key] = true; send(); };
        const up = (e: KeyboardEvent) => { keys[e.key] = false; send(); };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    }, [room]);

    // ── Mobile joystick ──
    const joystickAreaRef = useRef<HTMLDivElement>(null);
    const joystickKnobRef = useRef<HTMLDivElement>(null);
    const joystickActiveRef = useRef(false);

    useEffect(() => {
        const area = joystickAreaRef.current;
        const knob = joystickKnobRef.current;
        if (!area || !knob) return;
        const start = (e: TouchEvent) => { e.preventDefault(); joystickActiveRef.current = true; move(e.touches[0]); };
        const moveEvt = (e: TouchEvent) => { if (!joystickActiveRef.current) return; e.preventDefault(); move(e.touches[0]); };
        const end = () => { joystickActiveRef.current = false; knob.style.transform = `translate(0px,0px)`; room.send("move", { dx: 0, dy: 0 }); };
        const move = (t: Touch) => {
            const r = area.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            let dx = t.clientX - cx, dy = t.clientY - cy;
            const m = r.width / 2, d = Math.sqrt(dx * dx + dy * dy);
            if (d > m) { dx = (dx / d) * m; dy = (dy / d) * m; }
            knob.style.transform = `translate(${dx}px,${dy}px)`;
            room.send("move", { dx: dx / m, dy: dy / m });
        };
        area.addEventListener('touchstart', start, { passive: false });
        area.addEventListener('touchmove', moveEvt, { passive: false });
        area.addEventListener('touchend', end);
        area.addEventListener('touchcancel', end);
        return () => { area.removeEventListener('touchstart', start); area.removeEventListener('touchmove', moveEvt); area.removeEventListener('touchend', end); area.removeEventListener('touchcancel', end); };
    }, [room]);

    // ── Refs for stale closure / duplicate guards ──
    const onNextGameRef = useRef(onNextGame);
    onNextGameRef.current = onNextGame;
    const nextGameFiredRef = useRef(false);
    const hasMatchStartedRef = useRef(false);

    // ── Colyseus state sync ──
    useEffect(() => {
        nextGameFiredRef.current = false;
        hasMatchStartedRef.current = false;

        room.onMessage("next_game", (data: { roomId: string; roomName: string }) => {
            if (nextGameFiredRef.current) return;
            nextGameFiredRef.current = true;
            onNextGameRef.current?.(data.roomId, data.roomName);
        });

        room.onMessage("match_start", (data: { countdown: number }) => {
            console.log("[TurfSoccerGame] match_start received:", data);
        });

        room.onMessage("match_over", () => {
            console.log("[TurfSoccerGame] match_over received");
        });

        room.onMessage("goal", (data: any) => {
            // Spawn goal celebation particles around the ball
            const ball = gameStateRef.current?.ball;
            if (ball) {
                for (let i = 0; i < 80; i++) {
                    particlesRef.current.push(new Particle(ball.x, ball.y, '#ffeb3b', '#fff', 200));
                }
            }
        });

        room.onMessage("ball_reset", () => {
            // Quick flash particles at center
            for (let i = 0; i < 30; i++) {
                particlesRef.current.push(new Particle(FIELD_CX, FIELD_CY, '#90caf9', '#e3f2fd', 60));
            }
        });

        room.onStateChange((state) => {
            setGameState({ ...state });
            if (state.matchStarted && !state.matchEnded) hasMatchStartedRef.current = true;
            if (state.matchEnded && hasMatchStartedRef.current) setShowEndScreen(true);
            if (!state.matchStarted && !state.matchEnded) { hasMatchStartedRef.current = false; setShowEndScreen(false); }
        });

        return () => {};
    }, [room]);

    // ── Canvas render loop ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let raf: number;
        let lastTime = performance.now();

        const render = (time: number) => {
            const dt = (time - lastTime) / 1000;
            lastTime = time;

            // ── Background ──
            ctx.fillStyle = '#1b5e20';
            ctx.fillRect(0, 0, FW, FH);

            // ── Grass stripes ──
            const stripeH = FH / 10;
            for (let i = 0; i < 10; i++) {
                ctx.fillStyle = i % 2 === 0 ? FIELD_GREEN : FIELD_GREEN_ALT;
                ctx.fillRect(0, i * stripeH, FW, stripeH);
            }

            // ── Field lines ──
            ctx.strokeStyle = FIELD_LINE;
            ctx.lineWidth = 3;
            ctx.strokeRect(2, 2, FW - 4, FH - 4);     // Outer bounds
            ctx.beginPath(); ctx.moveTo(FIELD_CX, 0); ctx.lineTo(FIELD_CX, FH); ctx.stroke();  // Center line
            ctx.beginPath(); ctx.arc(FIELD_CX, FIELD_CY, 80, 0, Math.PI * 2); ctx.stroke();    // Center circle
            ctx.fillStyle = FIELD_LINE; ctx.beginPath(); ctx.arc(FIELD_CX, FIELD_CY, 5, 0, Math.PI * 2); ctx.fill(); // Center dot

            // Penalty boxes
            const pBoxW = 120, pBoxH = 300;
            ctx.strokeRect(0, FIELD_CY - pBoxH / 2, pBoxW, pBoxH);
            ctx.strokeRect(FW - pBoxW, FIELD_CY - pBoxH / 2, pBoxW, pBoxH);
            const pBoxSmW = 50, pBoxSmH = 160;
            ctx.strokeRect(0, FIELD_CY - pBoxSmH / 2, pBoxSmW, pBoxSmH);
            ctx.strokeRect(FW - pBoxSmW, FIELD_CY - pBoxSmH / 2, pBoxSmW, pBoxSmH);

            // ── Goals ──
            const gHalf = GOAL_HEIGHT / 2;
            // Left goal (behind left edge)
            ctx.fillStyle = GOAL_NET;
            ctx.fillRect(-GOAL_WIDTH, FIELD_CY - gHalf, GOAL_WIDTH, GOAL_HEIGHT);
            // Net crosshatch
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            for (let yy = FIELD_CY - gHalf; yy < FIELD_CY + gHalf; yy += 12) {
                ctx.beginPath(); ctx.moveTo(-GOAL_WIDTH, yy); ctx.lineTo(0, yy); ctx.stroke();
            }
            for (let xx = -GOAL_WIDTH; xx <= 0; xx += 12) {
                ctx.beginPath(); ctx.moveTo(xx, FIELD_CY - gHalf); ctx.lineTo(xx, FIELD_CY + gHalf); ctx.stroke();
            }
            // Posts
            ctx.fillStyle = GOAL_POST;
            ctx.fillRect(-4, FIELD_CY - gHalf - 4, 8, 8);
            ctx.fillRect(-4, FIELD_CY + gHalf - 4, 8, 8);
            ctx.fillRect(0, FIELD_CY - gHalf, 4, GOAL_HEIGHT);

            // Right goal
            ctx.fillStyle = GOAL_NET;
            ctx.fillRect(FW, FIELD_CY - gHalf, GOAL_WIDTH, GOAL_HEIGHT);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            for (let yy = FIELD_CY - gHalf; yy < FIELD_CY + gHalf; yy += 12) {
                ctx.beginPath(); ctx.moveTo(FW, yy); ctx.lineTo(FW + GOAL_WIDTH, yy); ctx.stroke();
            }
            for (let xx = FW; xx <= FW + GOAL_WIDTH; xx += 12) {
                ctx.beginPath(); ctx.moveTo(xx, FIELD_CY - gHalf); ctx.lineTo(xx, FIELD_CY + gHalf); ctx.stroke();
            }
            ctx.fillStyle = GOAL_POST;
            ctx.fillRect(FW - 4, FIELD_CY - gHalf - 4, 8, 8);
            ctx.fillRect(FW - 4, FIELD_CY + gHalf - 4, 8, 8);
            ctx.fillRect(FW - 4, FIELD_CY - gHalf, 4, GOAL_HEIGHT);

            // ── Update & draw particles ──
            for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                const p = particlesRef.current[i];
                p.update(dt);
                if (p.life <= 0) particlesRef.current.splice(i, 1);
                else p.draw(ctx);
            }

            // ── Draw players ──
            const state = gameStateRef.current;
            if (state?.players) {
                const all: any[] = [];
                state.players.forEach((p: any, id: string) => all.push({ id, ...p }));
                all.sort((a: any, b: any) => a.y - b.y);

                all.forEach((player: any) => {
                    const s = PLAYER_SIZE;
                    const color = player.color || '#e53935';
                    const isLocal = player.id === room.sessionId;

                    ctx.save();
                    ctx.translate(player.x, player.y);

                    const moving = Math.abs(player.vx) > 10 || Math.abs(player.vy) > 10;
                    const wiggleY = moving ? Math.sin(time / 50) * 3 : 0;

                    // Local player ring
                    if (isLocal) {
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc(0, 0, s, 0, Math.PI * 2);
                        ctx.stroke();
                    }

                    // Shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.fillRect(-s / 2 + 2, -s / 2 + 5 + s, s, s * 0.2);

                    // Body
                    ctx.fillStyle = color;
                    ctx.fillRect(-s / 2, -s / 2 + wiggleY, s, s * 0.8);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)';
                    ctx.fillRect(-s / 2, -s / 2 + wiggleY, s, s * 0.2);
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.fillRect(-s / 2, -s / 2 + wiggleY + s * 0.6, s, s * 0.2);

                    // Eyes
                    const fx = (player.facingX ?? 1);
                    const eyeOff = fx * (s * 0.1);
                    ctx.fillStyle = 'white';
                    ctx.fillRect(-s / 4 + eyeOff, -s / 4 + wiggleY, s * 0.2, s * 0.2);
                    ctx.fillRect(s / 8 + eyeOff, -s / 4 + wiggleY, s * 0.2, s * 0.2);
                    ctx.fillStyle = 'black';
                    ctx.fillRect(-s / 4 + s * 0.1 + eyeOff, -s / 4 + s * 0.1 + wiggleY, s * 0.1, s * 0.1);
                    ctx.fillRect(s / 8 + s * 0.1 + eyeOff, -s / 4 + s * 0.1 + wiggleY, s * 0.1, s * 0.1);

                    // Team indicator stripe at feet
                    ctx.fillStyle = player.team === 1 ? 'rgba(244,67,54,0.7)' : 'rgba(33,150,243,0.7)';
                    ctx.fillRect(-s / 2, -s / 2 + wiggleY + s * 0.7, s, s * 0.1);

                    // Name tag
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 11px "Courier New", monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(player.displayName || 'Player', 0, -s / 2 - 8);
                    if (player.isBot) {
                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                        ctx.font = '9px "Courier New", monospace';
                        ctx.fillText('BOT', 0, -s / 2 - 20);
                    }

                    ctx.restore();
                });
            }

            // ── Draw ball ──
            if (state?.ball) {
                const b = state.ball;
                // Ball shadow
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.beginPath();
                ctx.ellipse(b.x + 3, b.y + 5, BALL_RADIUS, BALL_RADIUS * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                // Ball body
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
                ctx.fill();
                // Ball pentagons
                ctx.fillStyle = '#333';
                const rot = (time / 300);
                for (let i = 0; i < 5; i++) {
                    const a = rot + (i / 5) * Math.PI * 2;
                    const px = b.x + Math.cos(a) * BALL_RADIUS * 0.5;
                    const py = b.y + Math.sin(a) * BALL_RADIUS * 0.5;
                    ctx.fillRect(px - 2, py - 2, 4, 4);
                }
                // Outline
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
                ctx.stroke();
            }

            // ── Goal scored flash ──
            if (state?.roundState === 'goal') {
                ctx.fillStyle = 'rgba(255,235,59,0.15)';
                ctx.fillRect(0, 0, FW, FH);
            }

            raf = requestAnimationFrame(render);
        };

        raf = requestAnimationFrame(render);
        return () => cancelAnimationFrame(raf);
    }, [gameState, room]);

    // ── Scoreboard helper ──
    const getScoreboard = useCallback(() => {
        if (!gameState?.players) return [];
        const list: { id: string; name: string; score: number; team: number; color: string; isBot: boolean }[] = [];
        gameState.players.forEach((p: any, id: string) => {
            list.push({ id, name: p.displayName || 'Player', score: p.score ?? 0, team: p.team ?? 1, color: p.color || '#888', isBot: !!p.isBot });
        });
        return list.sort((a, b) => b.score - a.score);
    }, [gameState]);

    const myTeam = (() => {
        if (!gameState?.players) return 0;
        const me = gameState.players.get(room.sessionId);
        return me?.team ?? 0;
    })();

    return (
        <div className="flex flex-col items-center w-full max-w-7xl mx-auto">
            {/* Header HUD */}
            <div className="w-full flex justify-center items-center mb-3 px-4 gap-6">
                {/* Team 1 Score */}
                <div className={`flex items-center gap-3 px-6 py-2 border-4 font-display text-2xl ${nightMode ? 'bg-red-900/40 border-red-600 text-red-300' : 'bg-red-100 border-red-500 text-red-700'}`}>
                    <span className="text-sm uppercase tracking-wider opacity-70">Red</span>
                    <span className="text-3xl font-bold">{gameState?.scoreTeam1 ?? 0}</span>
                </div>
                {/* Timer */}
                <div className={`px-8 py-2 border-4 font-display text-3xl ${nightMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-white border-slate-400 text-slate-800'}`}>
                    {Math.max(0, Math.ceil(gameState?.matchTimer ?? 90))}
                </div>
                {/* Team 2 Score */}
                <div className={`flex items-center gap-3 px-6 py-2 border-4 font-display text-2xl ${nightMode ? 'bg-blue-900/40 border-blue-600 text-blue-300' : 'bg-blue-100 border-blue-500 text-blue-700'}`}>
                    <span className="text-sm uppercase tracking-wider opacity-70">Blue</span>
                    <span className="text-3xl font-bold">{gameState?.scoreTeam2 ?? 0}</span>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full">
                {/* Game Canvas Container */}
                <div
                    className={`relative flex-1 aspect-[3/2] border-4 overflow-hidden ${nightMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-slate-100'}`}
                    style={{ imageRendering: 'pixelated' }}
                >
                    <canvas
                        ref={canvasRef}
                        width={FIELD_WIDTH}
                        height={FIELD_HEIGHT}
                        className="w-full h-full block"
                        style={{ imageRendering: 'pixelated' }}
                    />

                    {/* Mobile Joystick */}
                    <div className="md:hidden absolute bottom-4 left-4 w-32 h-32 bg-white/10 rounded-full pointer-events-auto" ref={joystickAreaRef}>
                        <div className="absolute w-12 h-12 bg-white/50 rounded-full top-10 left-10" ref={joystickKnobRef} />
                    </div>

                    {/* Countdown Overlay */}
                    <AnimatePresence>
                        {gameState?.countdown > 0 && (
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
                                        style={{ textShadow: '6px 6px 0 #000, -3px -3px 0 #4caf50, 0 0 30px rgba(255,255,255,0.5)' }}
                                    >
                                        {gameState.countdown}
                                    </motion.div>
                                    <div className="font-display text-2xl text-yellow-400 mt-4 tracking-widest"
                                        style={{ textShadow: '3px 3px 0 #000' }}>
                                        KICK OFF!
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Goal Scored Flash */}
                    <AnimatePresence>
                        {gameState?.roundState === 'goal' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                            >
                                <div className="font-display text-8xl text-yellow-400"
                                    style={{ textShadow: '6px 6px 0 #000, 0 0 40px rgba(255,235,59,0.8)' }}>
                                    GOAL!
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Waiting Overlay */}
                    {!gameState?.matchStarted && (gameState?.countdown ?? 0) === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md z-10">
                            <div className="text-center text-white space-y-4">
                                <Users size={64} className="mx-auto text-green-400 animate-bounce" />
                                <h2 className="font-display text-3xl tracking-widest" style={{ textShadow: '4px 4px 0 #000' }}>
                                    WAITING FOR PLAYERS
                                </h2>
                                <p className="font-body text-xl opacity-70">
                                    Need {2 - (gameState?.players?.size || 0)} more player(s) to start
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Leaderboard (Right Side) */}
                <div className={`w-full md:w-64 border-4 p-4 flex flex-col ${nightMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-300 bg-white/80'}`}>
                    <h3 className={`font-display text-xl mb-4 text-center ${nightMode ? 'text-white' : 'text-slate-800'}`}>SCOREBOARD</h3>

                    {/* Teams */}
                    <div className="mb-3">
                        <div className={`font-display text-xs uppercase mb-1 ${nightMode ? 'text-red-400' : 'text-red-600'}`}>Team Red</div>
                        {getScoreboard().filter(p => p.team === 1).map((p) => (
                            <div key={p.id} className={`flex items-center gap-2 p-1.5 mb-1 border-2 ${nightMode ? 'border-red-800 bg-red-900/30' : 'border-red-200 bg-red-50'}`}>
                                <div className="w-3 h-3" style={{ backgroundColor: p.color }} />
                                <span className={`flex-1 truncate font-display text-xs ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {p.name} {p.isBot ? '🤖' : ''}
                                </span>
                                <span className="font-bold font-display text-xs text-green-500">{p.score}</span>
                            </div>
                        ))}
                    </div>
                    <div>
                        <div className={`font-display text-xs uppercase mb-1 ${nightMode ? 'text-blue-400' : 'text-blue-600'}`}>Team Blue</div>
                        {getScoreboard().filter(p => p.team === 2).map((p) => (
                            <div key={p.id} className={`flex items-center gap-2 p-1.5 mb-1 border-2 ${nightMode ? 'border-blue-800 bg-blue-900/30' : 'border-blue-200 bg-blue-50'}`}>
                                <div className="w-3 h-3" style={{ backgroundColor: p.color }} />
                                <span className={`flex-1 truncate font-display text-xs ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}>
                                    {p.name} {p.isBot ? '🤖' : ''}
                                </span>
                                <span className="font-bold font-display text-xs text-green-500">{p.score}</span>
                            </div>
                        ))}
                    </div>

                    {/* Your team badge */}
                    {myTeam > 0 && (
                        <div className={`mt-auto pt-3 text-center font-display text-xs uppercase tracking-wider ${myTeam === 1
                            ? nightMode ? 'text-red-400' : 'text-red-600'
                            : nightMode ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                            You are Team {myTeam === 1 ? 'Red' : 'Blue'}
                        </div>
                    )}
                </div>
            </div>

            {/* Controls hint */}
            <div className={`mt-3 px-4 py-2 border-2 font-display text-[8px] uppercase tracking-widest ${nightMode
                ? 'bg-slate-900/80 border-slate-700 text-slate-500'
                : 'bg-white/80 border-slate-300 text-slate-500'
                }`}>
                WASD / Arrow Keys to move • Score more goals to win! ⚽
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
                                        <Trophy size={80} className="mx-auto text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]" />
                                    </motion.div>

                                    {/* Score display */}
                                    <div className="flex items-center justify-center gap-6">
                                        <div className="text-center">
                                            <p className="font-display text-sm text-red-400">Red</p>
                                            <p className="font-display text-5xl text-white">{gameState?.scoreTeam1 ?? 0}</p>
                                        </div>
                                        <p className="font-display text-2xl text-slate-500">vs</p>
                                        <div className="text-center">
                                            <p className="font-display text-sm text-blue-400">Blue</p>
                                            <p className="font-display text-5xl text-white">{gameState?.scoreTeam2 ?? 0}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="font-display text-sm uppercase text-slate-500 mb-1">
                                            {(gameState?.scoreTeam1 ?? 0) === (gameState?.scoreTeam2 ?? 0) ? 'Result' : 'Winner'}
                                        </p>
                                        <h2 className={`font-display text-3xl uppercase tracking-tighter ${nightMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                            {(gameState?.scoreTeam1 ?? 0) === (gameState?.scoreTeam2 ?? 0)
                                                ? 'Draw!'
                                                : `Team ${(gameState?.scoreTeam1 ?? 0) > (gameState?.scoreTeam2 ?? 0) ? 'Red' : 'Blue'} Wins!`
                                            }
                                        </h2>
                                        {myTeam > 0 && (
                                            <p className={`mt-2 font-display text-sm ${
                                                (gameState?.scoreTeam1 ?? 0) === (gameState?.scoreTeam2 ?? 0) ? 'text-slate-400' :
                                                (myTeam === 1 && (gameState?.scoreTeam1 ?? 0) > (gameState?.scoreTeam2 ?? 0)) ||
                                                (myTeam === 2 && (gameState?.scoreTeam2 ?? 0) > (gameState?.scoreTeam1 ?? 0))
                                                    ? 'text-green-400' : 'text-red-400'
                                            }`}>
                                                {(gameState?.scoreTeam1 ?? 0) === (gameState?.scoreTeam2 ?? 0) ? "It's a tie!"
                                                    : (myTeam === 1 && (gameState?.scoreTeam1 ?? 0) > (gameState?.scoreTeam2 ?? 0)) ||
                                                      (myTeam === 2 && (gameState?.scoreTeam2 ?? 0) > (gameState?.scoreTeam1 ?? 0))
                                                        ? 'Your team won! 🎉' : 'Better luck next time!'
                                                }
                                            </p>
                                        )}
                                    </div>

                                    {/* Final Scoreboard */}
                                    <div className={`border-2 py-3 ${nightMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                        <p className="font-display text-[10px] uppercase text-slate-500 mb-2">Final Standings</p>
                                        {getScoreboard().filter(p => !p.isBot).map((entry, i) => (
                                            <div key={entry.id}
                                                className={`flex items-center gap-3 px-6 py-1 ${entry.id === room.sessionId ? 'font-bold' : ''}`}
                                            >
                                                <span className="font-display text-sm w-6">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                                                <div className="w-4 h-4 border-2 border-black/30" style={{ backgroundColor: entry.color }} />
                                                <span className={`flex-1 text-left font-display text-xs ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {entry.name}
                                                </span>
                                                <span className="font-display text-sm text-green-400">
                                                    {entry.score} pts
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-4">
                                        <PixelButton variant="danger" size="lg" className="flex-1" onClick={() => {
                                            if (window.confirm("Are you sure you want to exit the game?")) {
                                                onLeave();
                                            }
                                        }}>
                                            Exit Game
                                        </PixelButton>
                                    </div>
                                    <div className="text-center mt-4">
                                        <p className={`font-display text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            Results in {nextGameTimer}s...
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
