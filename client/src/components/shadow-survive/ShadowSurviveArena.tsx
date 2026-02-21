import React, { useEffect, useRef, useState } from 'react';
import { Room } from 'colyseus.js';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from '../PixelCard';
import { PixelButton } from '../PixelButton';
import { Zap, ArrowUp } from 'lucide-react';

interface ShadowSurviveArenaProps {
    room: Room;
    nightMode: boolean;
    onLeave: () => void;
}

export const ShadowSurviveArena: React.FC<ShadowSurviveArenaProps> = ({ room, nightMode, onLeave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<any>(room.state);
    const [showEndScreen, setShowEndScreen] = useState(false);
    const [lastEvent, setLastEvent] = useState("");
    const [uiState, setUiState] = useState({ score: 0, level: 1, countdown: 0, matchStarted: false, matchEnded: false, matchTimer: 0, winnerId: '', winnerName: '' });

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
            let jump = false;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
            if (keys['ArrowUp'] || keys['w'] || keys['W'] || keys[' ']) jump = true;
            room.send("move", { dx, jump });
        };

        const handleMouseDown = (e: MouseEvent) => {
            e.preventDefault();
            const side = e.button === 2 ? 1 : -1;
            room.send("move", { dx: side, jump: true });
        };

        const handleContextMenu = (e: MouseEvent) => e.preventDefault();

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('contextmenu', handleContextMenu);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('contextmenu', handleContextMenu);
        };
    }, [room]);

    // Room state sync — only update ref, don't trigger re-render for canvas
    useEffect(() => {
        const onStateChange = (state: any) => {
            gameStateRef.current = state;

            const score = Math.floor(state?.players?.get?.(room.sessionId)?.score || 0);
            const winnerPlayer = state?.winnerId ? state?.players?.get?.(state.winnerId) : null;

            setUiState({
                score,
                level: state?.level || 1,
                countdown: state?.countdown || 0,
                matchStarted: !!state?.matchStarted,
                matchEnded: !!state?.matchEnded,
                matchTimer: state?.matchTimer || 0,
                winnerId: state?.winnerId || '',
                winnerName: winnerPlayer?.displayName || 'Nobody',
            });

            if (state.matchEnded) setShowEndScreen(true);
            else setShowEndScreen(false);

            if (state.lastEvent && state.lastEvent !== lastEvent) {
                setLastEvent(state.lastEvent);
            }
        };

        room.onStateChange(onStateChange);
        return () => { room.removeAllListeners(); };
    }, [room, lastEvent]);

    // Canvas Rendering — runs on its own RAF loop, reads from ref
    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            const gs = gameStateRef.current;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // ── Background: Clean White ──
            ctx.fillStyle = '#fafafa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Subtle grid pattern
            ctx.strokeStyle = 'rgba(0,0,0,0.04)';
            ctx.lineWidth = 1;
            for (let gx = 0; gx < canvas.width; gx += 40) {
                ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
            }
            for (let gy = 0; gy < canvas.height; gy += 40) {
                ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
            }

            // ── Draw Platforms ──
            if (gs?.platforms) {
                gs.platforms.forEach((plat: any) => {
                    if (plat.id === 'goal_core') {
                        drawGoal(ctx, plat);
                    } else {
                        drawBlock(ctx, plat);
                    }
                });
            }

            // ── Draw Players ──
            if (gs?.players) {
                gs.players.forEach((player: any, sessionId: string) => {
                    if (!player.isAlive) return;
                    drawPlayer(ctx, player, sessionId === room.sessionId);
                });
            }

            // ── HUD ──
            if (gs?.matchStarted && !gs?.matchEnded) {
                drawHUD(ctx, gs);
            }

            animationFrameId = requestAnimationFrame(render);
        };

        // ── Drawing Functions ──

        function drawGoal(ctx: CanvasRenderingContext2D, plat: any) {
            ctx.save();
            // Outer glow ring
            const t = Date.now() / 600;
            const pulse = 1 + Math.sin(t) * 0.08;
            const r = (plat.width / 2) * pulse;

            ctx.shadowBlur = 25;
            ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(plat.x, plat.y, r, 0, Math.PI * 2);
            ctx.fill();

            // Inner white highlight
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath();
            ctx.arc(plat.x - r * 0.2, plat.y - r * 0.25, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function drawBlock(ctx: CanvasRenderingContext2D, plat: any) {
            const x = plat.x - plat.width / 2;
            const y = plat.y - plat.height / 2;

            // Soft drop shadow
            ctx.fillStyle = 'rgba(0,0,0,0.08)';
            ctx.fillRect(x + 3, y + 3, plat.width, plat.height);

            // Block body — dark with slight rounded feel via layering
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(x, y, plat.width, plat.height);

            // Top bevel highlight
            ctx.fillStyle = 'rgba(255,255,255,0.10)';
            ctx.fillRect(x, y, plat.width, 4);

            // Left bevel highlight
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.fillRect(x, y, 4, plat.height);
        }

        function drawPlayer(ctx: CanvasRenderingContext2D, player: any, isLocal: boolean) {
            const px = player.x;
            const py = player.y;
            ctx.save();

            // Squash & stretch
            const baseSize = 28;
            let sx = 1, sy = 1;
            const vy = player.velocityY || 0;
            if (Math.abs(vy) > 100) {
                sy = 1 + Math.min(0.3, Math.abs(vy) / 2500);
                sx = 1 / sy;
            } else if (player.isGrounded) {
                sy = 0.88; sx = 1.12;
            }
            const w = baseSize * sx;
            const h = baseSize * sy;

            // Subtle shadow on ground
            if (player.isGrounded) {
                ctx.fillStyle = 'rgba(0,0,0,0.12)';
                ctx.beginPath();
                ctx.ellipse(px, py + h / 2 + 2, w * 0.6, 4, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Body
            ctx.fillStyle = isLocal ? '#111111' : '#444444';
            ctx.fillRect(px - w / 2, py - h / 2, w, h);

            // Eyes
            ctx.fillStyle = '#ffffff';
            const eyeOff = Math.min(6, (player.velocityX || 0) / 60);
            ctx.beginPath();
            ctx.arc(px - 6 + eyeOff, py - h * 0.15, 3.5 * sx, 0, Math.PI * 2);
            ctx.arc(px + 6 + eyeOff, py - h * 0.15, 3.5 * sx, 0, Math.PI * 2);
            ctx.fill();

            // Pupils
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(px - 5 + eyeOff * 1.3, py - h * 0.15, 1.5 * sx, 0, Math.PI * 2);
            ctx.arc(px + 7 + eyeOff * 1.3, py - h * 0.15, 1.5 * sx, 0, Math.PI * 2);
            ctx.fill();

            // Name tag
            ctx.fillStyle = isLocal ? '#ef4444' : '#888';
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(player.displayName, px, py - h / 2 - 10);

            ctx.restore();
        }

        function drawHUD(ctx: CanvasRenderingContext2D, state: any) {
            ctx.save();

            // Level — top left
            ctx.fillStyle = '#333';
            ctx.font = 'bold 14px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`LVL ${state?.level || 1}`, 24, 36);

            // Score — top right
            const score = Math.floor(state?.players?.get?.(room.sessionId)?.score || 0);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ef4444';
            ctx.fillText(`${score}`, canvas.width - 24, 36);

            // Timer — top center
            const t = Math.floor(state?.matchTimer || 0);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#aaa';
            ctx.font = '10px "Press Start 2P", monospace';
            ctx.fillText(`${t}s`, canvas.width / 2, 36);

            ctx.restore();
        }

        render();
        return () => cancelAnimationFrame(animationFrameId);
    }, []); // empty deps — runs once, reads ref

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="relative rounded-2xl overflow-hidden shadow-xl border border-gray-200" style={{ background: '#fafafa' }}>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="max-w-full h-auto"
                    style={{ imageRendering: 'auto' }}
                />

                {/* Event Message */}
                <AnimatePresence>
                    {lastEvent && (
                        <motion.div
                            key={lastEvent}
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute top-12 left-0 right-0 pointer-events-none flex justify-center"
                        >
                            <div className="bg-white/90 border border-gray-200 px-5 py-2 rounded-full shadow-md backdrop-blur-sm">
                                <p className="text-gray-700 font-display text-xs uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={12} className="text-red-400" />
                                    {lastEvent}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Countdown */}
                <AnimatePresence>
                    {uiState.countdown > 0 && (
                        <motion.div
                            key="countdown"
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 1.5, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <span className="text-9xl font-display text-gray-900/80 italic">
                                {uiState.countdown}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Match End Screen */}
            <AnimatePresence>
                {showEndScreen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-lg">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="w-full max-w-md"
                        >
                            <PixelCard title="Match Over" nightMode={true}>
                                <div className="text-center space-y-6 mt-4">
                                    <div className="py-4 border-y-2 border-indigo-900">
                                        <p className="font-display text-sm text-slate-400 uppercase mb-2">Winner</p>
                                        <h3 className="font-display text-3xl text-yellow-400 tracking-tighter">
                                            {uiState.winnerName}
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-indigo-950/30 border-2 border-indigo-800 pixel-corners">
                                            <p className="font-display text-[10px] text-indigo-400 uppercase mb-1">Time</p>
                                            <p className="font-display text-xl text-white">{Math.floor(uiState.matchTimer)}s</p>
                                        </div>
                                        <div className="p-3 bg-indigo-950/30 border-2 border-indigo-800 pixel-corners">
                                            <p className="font-display text-[10px] text-indigo-400 uppercase mb-1">Score</p>
                                            <p className="font-display text-xl text-white">{uiState.score}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        <PixelButton variant="primary" className="flex-1" onClick={() => setShowEndScreen(false)}>
                                            Continue
                                        </PixelButton>
                                        <PixelButton variant="secondary" className="flex-1" onClick={onLeave}>
                                            Leave
                                        </PixelButton>
                                    </div>
                                </div>
                            </PixelCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <div className="mt-6 flex gap-4">
                <PixelButton variant="secondary" onClick={onLeave}>
                    Exit Arena
                </PixelButton>
            </div>

            {/* Controls */}
            <div className="mt-3 flex gap-6 text-[10px] font-display text-gray-400 uppercase">
                <span className="flex items-center gap-1"><Zap size={10} /> A/D: Steer</span>
                <span className="flex items-center gap-1"><ArrowUp size={10} /> Left Click: Bounce Left</span>
                <span className="flex items-center gap-1"><ArrowUp size={10} /> Right Click: Bounce Right</span>
            </div>
        </div>
    );
};
