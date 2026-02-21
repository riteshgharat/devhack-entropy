import React, { useEffect, useRef, useState } from 'react';
import { Room } from 'colyseus.js';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from './PixelCard';
import { PixelButton } from './PixelButton';
import { Trophy, Timer, Users, Zap, AlertTriangle } from 'lucide-react';

interface GameArenaProps {
    room: Room;
    nightMode: boolean;
    onLeave: () => void;
}

export const GameArena: React.FC<GameArenaProps> = ({ room, nightMode, onLeave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<any>(room.state);
    const [showEndScreen, setShowEndScreen] = useState(false);
    const [lastEvent, setLastEvent] = useState("");

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
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
            if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
            if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;

            room.send("move", { dx, dy });
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [room]);

    // Room state sync
    useEffect(() => {
        room.onStateChange((state) => {
            setGameState({ ...state });
            if (state.matchEnded) {
                setShowEndScreen(true);
            } else {
                setShowEndScreen(false);
            }
            if (state.lastEvent && state.lastEvent !== lastEvent) {
                setLastEvent(state.lastEvent);
            }
        });

        room.onMessage("match_end", (data) => {
            console.log("Match ended:", data);
        });

        return () => {
            room.removeAllListeners();
        };
    }, [room, lastEvent]);

    // Canvas Rendering
    useEffect(() => {
        if (!canvasRef.current || !gameState) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        const render = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw Background (Grid)
            ctx.strokeStyle = nightMode ? 'rgba(99, 102, 241, 0.1)' : 'rgba(0, 0, 0, 0.05)';
            ctx.lineWidth = 1;
            const gridSize = 40;
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

            // Draw Arena Boundary
            ctx.strokeStyle = nightMode ? '#6366f1' : '#ef4444';
            ctx.lineWidth = 4;
            ctx.strokeRect(0, 0, gameState.arenaBoundaryX, gameState.arenaBoundaryY);

            // Draw Grass
            if (gameState.grasses) {
                gameState.grasses.forEach((grass: any) => {
                    ctx.fillStyle = '#22c55e';
                    ctx.beginPath();
                    ctx.arc(grass.x, grass.y, 8, 0, Math.PI * 2);
                    ctx.fill();

                    // Highlight
                    ctx.fillStyle = '#4ade80';
                    ctx.beginPath();
                    ctx.arc(grass.x - 2, grass.y - 2, 3, 0, Math.PI * 2);
                    ctx.fill();
                });
            }

            // Draw Players
            if (gameState.players) {
                gameState.players.forEach((player: any, sessionId: string) => {
                    const isLocal = sessionId === room.sessionId;

                    // Shadow
                    ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    ctx.beginPath();
                    ctx.ellipse(player.x, player.y + 15, 12, 6, 0, 0, Math.PI * 2);
                    ctx.fill();

                    // Stickman Body
                    ctx.fillStyle = isLocal ? (nightMode ? '#818cf8' : '#3b82f6') : '#ef4444';
                    if (player.stunTimer > 0) ctx.fillStyle = '#94a3b8'; // Stunned color

                    ctx.strokeStyle = '#111';
                    ctx.lineWidth = 3;

                    // Head
                    ctx.beginPath();
                    ctx.arc(player.x, player.y - 10, 10, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();

                    // Eyes (if local player)
                    if (isLocal) {
                        ctx.fillStyle = '#fff';
                        ctx.beginPath();
                        ctx.arc(player.x - 3, player.y - 12, 2, 0, Math.PI * 2);
                        ctx.arc(player.x + 3, player.y - 12, 2, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    // Body
                    ctx.beginPath();
                    ctx.moveTo(player.x, player.y);
                    ctx.lineTo(player.x, player.y + 15);
                    ctx.stroke();

                    // Name Tag
                    ctx.fillStyle = nightMode ? '#fff' : '#000';
                    ctx.font = 'bold 12px "Courier New", monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(`${player.displayName} (${player.score})`, player.x, player.y - 25);

                    if (isLocal) {
                        ctx.fillStyle = nightMode ? '#818cf8' : '#3b82f6';
                        ctx.beginPath();
                        ctx.moveTo(player.x - 5, player.y - 45);
                        ctx.lineTo(player.x + 5, player.y - 45);
                        ctx.lineTo(player.x, player.y - 35);
                        ctx.fill();
                    }
                });
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [gameState, nightMode, room.sessionId]);

    return (
        <div className="relative w-full max-w-4xl mx-auto mt-8 flex flex-col items-center">
            {/* HUD */}
            <div className="w-full flex justify-between items-end mb-4 px-4">
                <div className="flex flex-col gap-2">
                    <div className={`px-4 py-2 border-2 flex items-center gap-3 ${nightMode ? 'bg-indigo-900/50 border-indigo-500 text-indigo-100' : 'bg-white border-slate-300'}`}>
                        <Timer size={18} className="text-red-500" />
                        <span className="font-display text-lg tracking-widest">
                            {Math.ceil(gameState.matchTimer)}s
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    <div className={`px-4 py-2 border-2 flex items-center gap-3 ${nightMode ? 'bg-indigo-900/50 border-indigo-500 text-indigo-100' : 'bg-white border-slate-300'}`}>
                        <Users size={18} className="text-blue-500" />
                        <span className="font-display text-lg tracking-widest">
                            {gameState.players?.size || 0} PLAYERS
                        </span>
                    </div>
                </div>
            </div>

            {/* Event Notification */}
            <AnimatePresence>
                {lastEvent && (
                    <motion.div
                        key={lastEvent}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className={`absolute top-20 z-20 px-6 py-2 border-4 font-display text-sm uppercase tracking-tighter ${nightMode ? 'bg-slate-900 border-indigo-500 text-indigo-300' : 'bg-yellow-100 border-yellow-500 text-yellow-800'
                            }`}
                    >
                        {lastEvent}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Canvas Container */}
            <div className={`relative border-8 p-1 ${nightMode ? 'border-indigo-800 bg-slate-900' : 'border-slate-800 bg-slate-50'}`}>
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="w-full h-auto max-w-full block"
                    style={{ imageRendering: 'pixelated' }}
                />

                {/* Countdown Overlay */}
                <AnimatePresence>
                    {gameState.countdown > 0 && (
                        <motion.div
                            initial={{ scale: 2, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.5, opacity: 0 }}
                            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30"
                        >
                            <div className="text-center">
                                <motion.div
                                    key={gameState.countdown}
                                    initial={{ scale: 1.5, rotate: -10 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    className="font-display text-9xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]"
                                >
                                    {gameState.countdown}
                                </motion.div>
                                <div className="font-display text-2xl text-yellow-400 mt-4 tracking-widest">
                                    GET READY!
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Waiting Overlay */}
                {!gameState.matchStarted && gameState.countdown === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-md z-10">
                        <div className="text-center text-white space-y-4">
                            <Users size={64} className="mx-auto text-indigo-400 animate-bounce" />
                            <h2 className="font-display text-3xl tracking-widest">WAITING FOR PLAYERS</h2>
                            <p className="font-body opacity-70">Need {2 - (gameState.players?.size || 0)} more player(s) to start</p>
                        </div>
                    </div>
                )}
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
                                    <Trophy size={80} className="mx-auto text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" />

                                    <div>
                                        <p className="font-display text-sm uppercase text-slate-500 mb-1">Winner</p>
                                        <h2 className={`font-display text-4xl uppercase tracking-tighter ${nightMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                                            {gameState.winnerId ? (gameState.players?.get(gameState.winnerId)?.displayName || "Winner") : "Draw"}
                                        </h2>
                                    </div>

                                    <div className={`grid grid-cols-2 gap-4 border-y-2 py-4 ${nightMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                        <div>
                                            <p className="font-display text-[10px] uppercase text-slate-500">Your Score</p>
                                            <p className={`font-display text-2xl ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                {gameState.players?.get(room.sessionId)?.score || 0}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-display text-[10px] uppercase text-slate-500">Total Players</p>
                                            <p className={`font-display text-2xl ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                                {gameState.players?.size || 0}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-4">
                                        <PixelButton variant="primary" size="lg" className="flex-1" onClick={onLeave}>
                                            MainMenu
                                        </PixelButton>
                                    </div>
                                </div>
                            </PixelCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Footer Actions */}
            <div className="mt-8">
                <PixelButton variant="secondary" size="sm" onClick={onLeave}>
                    Exit to Menu
                </PixelButton>
            </div>
        </div>
    );
};
