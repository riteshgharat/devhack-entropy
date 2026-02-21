import React, { useEffect, useRef, useState } from 'react';
import { Room } from 'colyseus.js';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from '../PixelCard';
import { PixelButton } from '../PixelButton';
import { Flame, Trophy, ArrowUp } from 'lucide-react';

interface HotDynamiteArenaProps {
    room: Room;
    nightMode: boolean;
    onLeave: () => void;
}

const CX = 400, CY = 300, IR = 250; // Island center & radius (must match backend)

export const HotDynamiteArena: React.FC<HotDynamiteArenaProps> = ({ room, nightMode, onLeave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gsRef = useRef<any>(room.state);
    const [showEndScreen, setShowEndScreen] = useState(false);
    const [lastEvent, setLastEvent] = useState("");
    const lastEventRef = useRef("");
    const [uiState, setUiState] = useState({
        round: 0, dynamiteTimer: 0, countdown: 0,
        matchStarted: false, matchEnded: false, matchTimer: 0,
        winnerId: '', winnerName: '', dynamiteHolderId: '',
    });

    // ── Input ──
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
        const kd = (e: KeyboardEvent) => { keys[e.key] = true; send(); };
        const ku = (e: KeyboardEvent) => { keys[e.key] = false; send(); };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }, [room]);

    // ── State Sync (lightweight — only update ref + UI state, no re-render for canvas) ──
    useEffect(() => {
        const onState = (state: any) => {
            gsRef.current = state;
            const wp = state?.winnerId ? state?.players?.get?.(state.winnerId) : null;
            setUiState({
                round: state?.round || 0,
                dynamiteTimer: state?.dynamiteTimer || 0,
                countdown: state?.countdown || 0,
                matchStarted: !!state?.matchStarted,
                matchEnded: !!state?.matchEnded,
                matchTimer: state?.matchTimer || 0,
                winnerId: state?.winnerId || '',
                winnerName: wp?.displayName || 'Nobody',
                dynamiteHolderId: state?.dynamiteHolderId || '',
            });
            if (state.matchEnded) setShowEndScreen(true);
            else setShowEndScreen(false);
            if (state.lastEvent && state.lastEvent !== lastEventRef.current) {
                lastEventRef.current = state.lastEvent;
                setLastEvent(state.lastEvent);
            }
        };
        room.onStateChange(onState);
        return () => { room.removeAllListeners(); };
    }, [room]);

    // ── Canvas Render Loop (reads ref, never depends on React state) ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        if (!ctx) return;
        let raf: number;

        // Pre-generate water noise for performance
        const waterPixels: { x: number; y: number; phase: number }[] = [];
        for (let i = 0; i < 60; i++) {
            waterPixels.push({
                x: Math.random() * 800,
                y: Math.random() * 600,
                phase: Math.random() * Math.PI * 2,
            });
        }

        const render = () => {
            const gs = gsRef.current;
            const t = Date.now() / 1000;
            ctx.clearRect(0, 0, 800, 600);

            // ══════ WATER BACKGROUND ══════
            const waterGrad = ctx.createRadialGradient(400, 300, 200, 400, 300, 500);
            waterGrad.addColorStop(0, '#1e3a5f');
            waterGrad.addColorStop(0.5, '#0f2847');
            waterGrad.addColorStop(1, '#0a1929');
            ctx.fillStyle = waterGrad;
            ctx.fillRect(0, 0, 800, 600);

            // Water ripples
            ctx.globalAlpha = 0.06;
            waterPixels.forEach(wp => {
                const sy = Math.sin(t * 0.8 + wp.phase) * 6;
                ctx.fillStyle = '#60a5fa';
                ctx.beginPath();
                ctx.ellipse(wp.x, wp.y + sy, 20 + Math.sin(t + wp.phase) * 5, 3, 0, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            // ══════ ISLAND ══════
            ctx.save();

            // Island shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(CX + 4, CY + 6, IR + 5, IR + 5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Island base (sandy/earthy)
            const islandGrad = ctx.createRadialGradient(CX - 30, CY - 30, 20, CX, CY, IR);
            islandGrad.addColorStop(0, '#8fbc5e');
            islandGrad.addColorStop(0.6, '#6a9f3a');
            islandGrad.addColorStop(0.85, '#5a8f2a');
            islandGrad.addColorStop(0.95, '#c4a265');
            islandGrad.addColorStop(1, '#a08040');
            ctx.fillStyle = islandGrad;
            ctx.beginPath();
            ctx.arc(CX, CY, IR, 0, Math.PI * 2);
            ctx.fill();

            // Shore / beach ring
            ctx.strokeStyle = '#d4b87a';
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(CX, CY, IR - 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Grass texture dots
            ctx.fillStyle = '#4a7a22';
            for (let i = 0; i < 80; i++) {
                const a = (i / 80) * Math.PI * 2 + 0.3;
                const r = 30 + (i * 37 % 200);
                if (r > IR - 20) continue;
                const gx = CX + Math.cos(a) * r;
                const gy = CY + Math.sin(a) * r;
                ctx.globalAlpha = 0.15 + (i % 3) * 0.05;
                ctx.beginPath();
                ctx.arc(gx, gy, 3 + (i % 3), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            // Small trees/bushes for decoration
            const trees = [
                { x: CX - 180, y: CY - 140 }, { x: CX + 160, y: CY - 100 },
                { x: CX - 100, y: CY + 150 }, { x: CX + 120, y: CY + 130 },
                { x: CX - 200, y: CY + 30 }, { x: CX + 190, y: CY - 20 },
            ];
            trees.forEach(tr => {
                const dx = tr.x - CX, dy = tr.y - CY;
                if (Math.sqrt(dx * dx + dy * dy) > IR - 30) return;
                // Trunk
                ctx.fillStyle = '#5c3d1e';
                ctx.fillRect(tr.x - 2, tr.y - 2, 4, 8);
                // Canopy
                ctx.fillStyle = '#2d6b1e';
                ctx.beginPath();
                ctx.arc(tr.x, tr.y - 6, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#3a8a28';
                ctx.beginPath();
                ctx.arc(tr.x - 2, tr.y - 8, 5, 0, Math.PI * 2);
                ctx.fill();
            });

            ctx.restore();

            // ══════ DANGER ZONE INDICATOR (pulsing boundary when dynamite active) ══════
            if (gs?.dynamiteHolderId) {
                const pulse = 0.15 + Math.sin(t * 4) * 0.1;
                ctx.strokeStyle = `rgba(239, 68, 68, ${pulse})`;
                ctx.lineWidth = 4;
                ctx.setLineDash([12, 8]);
                ctx.beginPath();
                ctx.arc(CX, CY, IR, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // ══════ DRAW PLAYERS ══════
            if (gs?.players) {
                // Draw dead players first (behind alive ones)
                gs.players.forEach((p: any, _sid: string) => { if (!p.isAlive) drawGhost(ctx, p); });
                gs.players.forEach((p: any, sid: string) => {
                    if (!p.isAlive) return;
                    drawStickman(ctx, p, sid === room.sessionId, p.hasDynamite, t);
                });
            }

            // ══════ DYNAMITE HUD ══════
            if (gs?.matchStarted && !gs?.matchEnded && gs?.dynamiteHolderId) {
                drawDynamiteHUD(ctx, gs, t);
            }

            // ══════ INFO HUD ══════
            if (gs?.matchStarted && !gs?.matchEnded) {
                drawInfoHUD(ctx, gs);
            }

            raf = requestAnimationFrame(render);
        };

        // ── Drawing Functions ──

        function drawStickman(ctx: CanvasRenderingContext2D, p: any, isLocal: boolean, hasBomb: boolean, t: number) {
            const px = p.x, py = p.y;
            ctx.save();

            // Danger aura
            if (hasBomb) {
                const pulse = 1 + Math.sin(t * 8) * 0.25;
                const aR = 32 * pulse;
                const aura = ctx.createRadialGradient(px, py, 4, px, py, aR);
                aura.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
                aura.addColorStop(0.6, 'rgba(249, 115, 22, 0.15)');
                aura.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = aura;
                ctx.beginPath();
                ctx.arc(px, py, aR, 0, Math.PI * 2);
                ctx.fill();
            }

            // Ground shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath();
            ctx.ellipse(px, py + 20, 10, 3.5, 0, 0, Math.PI * 2);
            ctx.fill();

            // Shake if stunned
            const shake = p.stunTimer > 0 ? Math.sin(t * 40) * 3 : 0;
            const sx = px + shake;
            const stunned = p.stunTimer > 0;
            const col = stunned ? '#778899' : (p.color || '#ef4444');

            // Head
            ctx.fillStyle = col;
            ctx.fillRect(sx - 8, py - 22, 16, 16);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx - 8, py - 22, 16, 16);
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.fillRect(sx - 6, py - 20, 4, 4);

            // Eyes
            if (stunned) {
                // Dizzy X eyes
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1.5;
                [-4, 3].forEach(ox => {
                    ctx.beginPath(); ctx.moveTo(sx + ox - 1, py - 17); ctx.lineTo(sx + ox + 3, py - 13); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(sx + ox + 3, py - 17); ctx.lineTo(sx + ox - 1, py - 13); ctx.stroke();
                });
            } else {
                ctx.fillStyle = '#fff';
                ctx.fillRect(sx - 5, py - 17, 4, 5);
                ctx.fillRect(sx + 1, py - 17, 4, 5);
                // Pupils follow velocity
                const velOff = Math.min(1, (Math.abs(p.velocityX || 0) + Math.abs(p.velocityY || 0)) / 300);
                const pupilX = Math.sign(p.velocityX || 0) * velOff * 1.5;
                const pupilY = Math.sign(p.velocityY || 0) * velOff * 1.5;
                ctx.fillStyle = '#111';
                ctx.fillRect(sx - 4 + pupilX, py - 16 + pupilY, 2, 3);
                ctx.fillRect(sx + 2 + pupilX, py - 16 + pupilY, 2, 3);
            }

            // Mouth
            ctx.fillStyle = hasBomb ? '#ef4444' : '#111';
            if (hasBomb) {
                // Scared open mouth
                ctx.fillRect(sx - 2, py - 10, 4, 4);
            } else {
                ctx.fillRect(sx - 3, py - 10, 6, 2);
            }

            // Body
            ctx.fillStyle = col;
            ctx.fillRect(sx - 7, py - 4, 14, 14);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(sx - 7, py - 4, 14, 14);

            // Arms
            ctx.fillStyle = col;
            ctx.fillRect(sx - 12, py - 3, 5, 11);
            ctx.fillRect(sx + 7, py - 3, 5, 11);

            // Legs
            ctx.filter = 'brightness(0.85)';
            ctx.fillStyle = col;
            ctx.fillRect(sx - 6, py + 10, 5, 11);
            ctx.fillRect(sx + 1, py + 10, 5, 11);
            ctx.filter = 'none';

            // Boots
            ctx.fillStyle = '#1c1917';
            ctx.fillRect(sx - 7, py + 19, 7, 3);
            ctx.fillRect(sx, py + 19, 7, 3);

            // ── Dynamite above head ──
            if (hasBomb) {
                const bob = Math.sin(t * 5) * 2;
                const dx = sx, dy = py - 36 + bob;

                // Stick
                ctx.fillStyle = '#dc2626';
                ctx.fillRect(dx - 4, dy, 8, 12);
                ctx.strokeStyle = '#7f1d1d';
                ctx.lineWidth = 1;
                ctx.strokeRect(dx - 4, dy, 8, 12);
                // Label
                ctx.fillStyle = '#fbbf24';
                ctx.fillRect(dx - 4, dy + 3, 8, 3);
                // Fuse
                ctx.strokeStyle = '#a3a3a3';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(dx, dy);
                ctx.quadraticCurveTo(dx + 5, dy - 5, dx + 2, dy - 9);
                ctx.stroke();
                // Spark
                const flicker = Math.sin(t * 15) > 0;
                if (flicker) {
                    ctx.fillStyle = '#fef08a';
                    ctx.beginPath(); ctx.arc(dx + 2, dy - 9, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#fff';
                    ctx.beginPath(); ctx.arc(dx + 2, dy - 9, 1.2, 0, Math.PI * 2); ctx.fill();
                }
            }

            // Local indicator
            if (isLocal && !hasBomb) {
                const b = Math.sin(t * 3) * 3;
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.moveTo(px - 5, py - 34 + b);
                ctx.lineTo(px + 5, py - 34 + b);
                ctx.lineTo(px, py - 27 + b);
                ctx.fill();
                ctx.font = '6px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.fillText('YOU', px, py - 38 + b);
            }

            // Name
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = isLocal ? '#fbbf24' : 'rgba(200,200,220,0.7)';
            ctx.fillText(p.displayName, px, py + 30);

            ctx.restore();
        }

        function drawGhost(ctx: CanvasRenderingContext2D, p: any) {
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.font = '18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💀', p.x, p.y);
            ctx.font = '6px "Press Start 2P", monospace';
            ctx.fillStyle = '#64748b';
            ctx.fillText(p.displayName, p.x, p.y + 16);
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        function drawDynamiteHUD(ctx: CanvasRenderingContext2D, gs: any, t: number) {
            ctx.save();
            const timer = gs.dynamiteTimer || 0;
            const holder = gs.players?.get?.(gs.dynamiteHolderId);
            const isMe = gs.dynamiteHolderId === room.sessionId;
            const urgency = Math.max(0, 1 - timer / 10);
            const flash = timer < 3 && Math.sin(t * 12) > 0;

            // Timer text
            ctx.textAlign = 'center';
            ctx.font = 'bold 40px "Press Start 2P", monospace';
            ctx.shadowBlur = 15 + urgency * 25;
            ctx.shadowColor = timer < 3 ? '#ef4444' : '#f97316';
            ctx.fillStyle = flash ? '#fff' : (timer < 3 ? '#ef4444' : '#fb923c');
            ctx.fillText(timer.toFixed(1), 400, 50);
            ctx.shadowBlur = 0;

            // Sub label
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillStyle = 'rgba(239,68,68,0.5)';
            ctx.fillText('🧨 DYNAMITE', 400, 66);

            // Holder name
            if (holder) {
                ctx.font = '9px "Press Start 2P", monospace';
                ctx.fillStyle = isMe ? '#ef4444' : '#94a3b8';
                ctx.fillText(isMe ? '⚠ YOU! PASS IT!' : `${holder.displayName} has it`, 400, 84);
            }

            ctx.restore();
        }

        function drawInfoHUD(ctx: CanvasRenderingContext2D, gs: any) {
            ctx.save();
            // Round
            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px "Press Start 2P", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`ROUND ${gs.round || 0}`, 14, 590);

            // Alive
            let alive = 0;
            gs.players?.forEach((p: any) => { if (p.isAlive) alive++; });
            ctx.textAlign = 'right';
            ctx.fillStyle = '#4ade80';
            ctx.fillText(`${alive} ALIVE`, 786, 590);

            // Time
            ctx.textAlign = 'center';
            ctx.fillStyle = '#475569';
            ctx.font = '7px "Press Start 2P", monospace';
            ctx.fillText(`${Math.floor(gs.matchTimer || 0)}s`, 400, 590);
            ctx.restore();
        }

        render();
        return () => cancelAnimationFrame(raf);
    }, []); // no deps — reads from ref, runs once

    return (
        <div className="flex flex-col items-center justify-center p-4">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border-2 border-orange-900/40" style={{ background: '#0a1929' }}>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="max-w-full h-auto"
                />

                {/* Event Toast */}
                <AnimatePresence>
                    {lastEvent && (
                        <motion.div
                            key={lastEvent}
                            initial={{ opacity: 0, y: -16, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="absolute top-24 left-0 right-0 pointer-events-none flex justify-center"
                        >
                            <div className="bg-black/80 border border-orange-600/40 px-5 py-2 rounded-full shadow-lg backdrop-blur-sm">
                                <p className="text-orange-200 font-display text-[11px] uppercase tracking-widest flex items-center gap-2">
                                    <Flame size={12} className="text-orange-400" />
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
                            exit={{ scale: 1.4, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <span className="text-9xl font-display text-orange-400/80 italic drop-shadow-[0_0_40px_rgba(249,115,22,0.5)]">
                                {uiState.countdown}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* End Screen */}
            <AnimatePresence>
                {showEndScreen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-lg">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="w-full max-w-md"
                        >
                            <PixelCard title="💥 Game Over" nightMode={true}>
                                <div className="text-center space-y-6 mt-4">
                                    <div className="py-4 border-y-2 border-orange-800">
                                        <p className="font-display text-sm text-slate-400 uppercase mb-2">Last One Standing</p>
                                        <h3 className="font-display text-3xl text-yellow-400 tracking-tighter flex items-center justify-center gap-2">
                                            <Trophy size={28} className="text-yellow-400" />
                                            {uiState.winnerName}
                                        </h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-3 bg-orange-950/30 border-2 border-orange-800 pixel-corners">
                                            <p className="font-display text-[10px] text-orange-400 uppercase mb-1">Time</p>
                                            <p className="font-display text-xl text-white">{Math.floor(uiState.matchTimer)}s</p>
                                        </div>
                                        <div className="p-3 bg-orange-950/30 border-2 border-orange-800 pixel-corners">
                                            <p className="font-display text-[10px] text-orange-400 uppercase mb-1">Rounds</p>
                                            <p className="font-display text-xl text-white">{uiState.round}</p>
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

            <div className="mt-3 flex gap-6 text-[10px] font-display text-gray-400 uppercase">
                <span className="flex items-center gap-1"><ArrowUp size={10} /> WASD / Arrows: Move</span>
                <span className="flex items-center gap-1"><Flame size={10} className="text-orange-400" /> Collide to pass the bomb!</span>
            </div>
        </div>
    );
};
