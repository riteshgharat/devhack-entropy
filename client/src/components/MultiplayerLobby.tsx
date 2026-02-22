import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from './PixelCard';
import { PixelButton } from './PixelButton';
import {
    Users,
    Copy,
    Check,
    X,
    Zap,
    DoorOpen,
    Plus,
    Wifi,
    WifiOff,
    Crown,
    Swords,
    ArrowLeft,
    Loader2,
    Trophy,
} from 'lucide-react';
import { gameClient } from '../services/gameClient';

/* ── Fake friends data ── */
const ONLINE_FRIENDS = [
    { id: 1, name: 'PixelKing', color: '#ef4444', level: 42, status: 'online' as const },
    { id: 2, name: 'GlitchWitch', color: '#a855f7', level: 38, status: 'in-game' as const },
    { id: 3, name: 'BitBrawler', color: '#22c55e', level: 27, status: 'online' as const },
    { id: 4, name: 'RetroRogue', color: '#3b82f6', level: 55, status: 'online' as const },
    { id: 5, name: 'NeonNinja', color: '#eab308', level: 19, status: 'in-game' as const },
];

const OFFLINE_FRIENDS = [
    { id: 6, name: 'VoxelViking', color: '#6b7280', level: 31, status: 'offline' as const },
    { id: 7, name: 'ByteBarb', color: '#6b7280', level: 14, status: 'offline' as const },
];

/* ── Mini stickman avatar ── */
const MiniStickman: React.FC<{ color: string; size?: number }> = ({ color, size = 28 }) => {
    const s = (v: number) => `${(v / 48) * size}px`;
    return (
        <div
            className="relative"
            style={{
                width: `${size}px`,
                height: `${(80 / 48) * size}px`,
                imageRendering: 'pixelated',
            }}
        >
            <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: 0, width: s(20), height: s(20), backgroundColor: color, border: `${s(3)} solid #111` }}
            >
                <div
                    className="absolute"
                    style={{ top: s(5), left: s(3), width: s(4), height: s(4), backgroundColor: '#fff', boxShadow: `${s(6)} 0 0 0 #fff` }}
                />
            </div>
            <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: s(20), width: s(14), height: s(24), backgroundColor: color, border: `${s(3)} solid #111` }}
            />
            <div className="absolute" style={{ top: s(20), left: 0, width: s(8), height: s(14), backgroundColor: color, border: `${s(2)} solid #111` }} />
            <div className="absolute" style={{ top: s(20), right: 0, width: s(8), height: s(14), backgroundColor: color, border: `${s(2)} solid #111` }} />
            <div className="absolute" style={{ top: s(44), left: s(10), width: s(10), height: s(20), backgroundColor: color, border: `${s(2)} solid #111`, filter: 'brightness(0.85)' }} />
            <div className="absolute" style={{ top: s(44), right: s(10), width: s(10), height: s(20), backgroundColor: color, border: `${s(2)} solid #111`, filter: 'brightness(0.85)' }} />
        </div>
    );
};

/* ── Tabs type ── */
type LobbyTab = 'leaderboard' | 'join' | 'create' | 'quick';

interface MultiplayerLobbyProps {
    nightMode?: boolean;
    characterColor?: string;
    playerId: string;
    displayName: string;
    onClose: () => void;
    onJoin: (room: any) => void;
    initialTab?: LobbyTab;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ nightMode = false, characterColor = '#ef4444', playerId, displayName, onClose, onJoin, initialTab = 'leaderboard' }) => {
    const [activeTab, setActiveTab] = useState<LobbyTab>(initialTab);
    const [inviteCode, setInviteCode] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [copied, setCopied] = useState(false);
    const [searching, setSearching] = useState(false);
    const [searchDots, setSearchDots] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'leaderboard') {
            const headers: Record<string, string> = {};
            if (import.meta.env.VITE_NGROK === 'true') {
                headers['ngrok-skip-browser-warning'] = 'true';
            }
            fetch(`${import.meta.env.VITE_BACKEND_URL}/api/leaderboard`, { headers })
                .then(res => res.json())
                .then(data => setLeaderboard(data.leaderboard || []))
                .catch(err => console.error("Failed to fetch leaderboard", err));
        }
    }, [activeTab]);

    const handleJoinOrCreate = async (mode: 'join' | 'create' | 'quick', code?: string) => {
        setIsConnecting(true);
        setError(null);
        try {
            let room;
            if (mode === 'create') {
                room = await gameClient.create("arena_room", { customRoomId: generatedCode, displayName, playerId, color: characterColor });
            } else if (mode === 'join' && code) {
                room = await gameClient.join(code, { displayName, playerId, color: characterColor });
            } else if (mode === 'quick') {
                room = await gameClient.joinOrCreate("arena_room", { displayName, playerId, color: characterColor });
            }

            if (room) {
                onJoin(room);
            }
        } catch (err: any) {
            setError(err.message || "Failed to connect to game server");
            setSearching(false);
        } finally {
            setIsConnecting(false);
        }
    };

    // Generate a random invite code
    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        setGeneratedCode(code);
        setCopied(false);
    };

    const copyCode = () => {
        navigator.clipboard.writeText(generatedCode).catch(() => { });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Quick match searching animation
    useEffect(() => {
        if (!searching) return;
        const interval = setInterval(() => {
            setSearchDots((d) => (d.length >= 3 ? '' : d + '.'));
        }, 500);
        return () => clearInterval(interval);
    }, [searching]);

    const tabBtnClass = (tab: LobbyTab) =>
        `flex-1 py-2 border-2 font-display text-[10px] uppercase transition-all duration-300 ${activeTab === tab
            ? nightMode
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : 'bg-blue-500 border-blue-700 text-white'
            : nightMode
                ? 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'
                : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-100'
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.7, opacity: 0, y: 40 }}
                transition={{ type: 'spring', bounce: 0.3 }}
                className="w-full max-w-lg mx-4"
            >
                <PixelCard title="Multiplayer" nightMode={nightMode}>
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className={`absolute top-2 right-2 p-1 border-2 transition-colors z-10 ${nightMode
                            ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                            : 'border-slate-300 text-slate-500 hover:bg-slate-100'
                            }`}
                    >
                        <X size={14} />
                    </button>

                    {/* Tab bar */}
                    <div className="flex gap-1.5 mt-2 mb-4">
                        <button className={tabBtnClass('leaderboard')} onClick={() => setActiveTab('leaderboard')}>
                            <Trophy size={12} className="inline mr-1" />Leaderboard
                        </button>
                        <button className={tabBtnClass('join')} onClick={() => setActiveTab('join')}>
                            <DoorOpen size={12} className="inline mr-1" />Join
                        </button>
                        <button className={tabBtnClass('create')} onClick={() => setActiveTab('create')}>
                            <Plus size={12} className="inline mr-1" />Create
                        </button>
                        <button className={tabBtnClass('quick')} onClick={() => { setActiveTab('quick'); setSearching(false); }}>
                            <Zap size={12} className="inline mr-1" />Quick
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {/* ═══════ LEADERBOARD TAB ═══════ */}
                        {activeTab === 'leaderboard' && (
                            <motion.div
                                key="leaderboard"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-2"
                            >
                                <div className={`font-display text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1.5 ${nightMode ? 'text-yellow-400' : 'text-yellow-600'
                                    }`}>
                                    <Trophy size={10} />
                                    Top Players
                                </div>

                                {leaderboard.length === 0 ? (
                                    <div className={`text-center py-4 font-body text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        No data available yet.
                                    </div>
                                ) : (
                                    leaderboard.map((player, index) => {
                                        const isMe = player.id === playerId;
                                        return (
                                            <motion.div
                                                key={player.id}
                                                className={`flex items-center gap-3 p-2 border-2 transition-colors ${isMe
                                                    ? (nightMode ? 'bg-indigo-900/50 border-indigo-500' : 'bg-blue-100 border-blue-400')
                                                    : (nightMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200')
                                                    }`}
                                                whileHover={{ x: 4 }}
                                            >
                                                <div className={`font-display text-lg w-6 text-center ${index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                    #{index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className={`font-display text-[12px] ${isMe ? (nightMode ? 'text-indigo-300' : 'text-blue-700') : (nightMode ? 'text-slate-200' : 'text-slate-800')}`}>
                                                        {player.displayName} {isMe && '(You)'}
                                                    </div>
                                                    <div className={`font-body text-[10px] ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {player.wins} Wins • {player.matches} Matches
                                                    </div>
                                                </div>
                                                <div className={`px-2 py-1 border text-[10px] font-display uppercase ${nightMode ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'bg-blue-100 border-blue-400 text-blue-700'}`}>
                                                    {player.score} PTS
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </motion.div>
                        )}

                        {/* ═══════ JOIN ROOM TAB ═══════ */}
                        {activeTab === 'join' && (
                            <motion.div
                                key="join"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="text-center">
                                    <DoorOpen size={32} className={`mx-auto mb-3 ${nightMode ? 'text-indigo-400' : 'text-blue-500'}`} />
                                    <p className={`font-display text-xs uppercase mb-1 ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Join a Room
                                    </p>
                                    <p className={`font-body text-sm ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Enter the 6-character invite code from your friend
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        maxLength={6}
                                        placeholder="ABC123"
                                        value={inviteCode}
                                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                        className={`flex-1 px-4 py-3 border-4 font-display text-xl uppercase tracking-[0.5em] text-center outline-none transition-colors ${nightMode
                                            ? 'bg-slate-700 border-slate-500 text-white placeholder-slate-600 focus:border-indigo-400'
                                            : 'bg-white border-slate-300 text-slate-800 placeholder-slate-300 focus:border-blue-400'
                                            }`}
                                    />
                                </div>

                                <PixelButton
                                    variant="primary"
                                    size="lg"
                                    className="w-full text-sm"
                                    onClick={() => handleJoinOrCreate('join', inviteCode)}
                                    disabled={isConnecting || inviteCode.length < 3}
                                >
                                    {isConnecting ? (
                                        <Loader2 size={16} className="inline mr-2 animate-spin" />
                                    ) : (
                                        <DoorOpen size={16} className="inline mr-2" />
                                    )}
                                    Join Room
                                </PixelButton>

                                {error && (
                                    <p className="text-red-500 text-[10px] text-center font-display uppercase">
                                        {error}
                                    </p>
                                )}
                            </motion.div>
                        )}

                        {/* ═══════ CREATE ROOM TAB ═══════ */}
                        {activeTab === 'create' && (
                            <motion.div
                                key="create"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="text-center">
                                    <Crown size={32} className={`mx-auto mb-3 ${nightMode ? 'text-yellow-400' : 'text-yellow-500'}`} />
                                    <p className={`font-display text-xs uppercase mb-1 ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Create a Room
                                    </p>
                                    <p className={`font-body text-sm ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Generate an invite code and share it with friends
                                    </p>
                                </div>

                                {!generatedCode ? (
                                    <PixelButton
                                        variant="accent"
                                        size="lg"
                                        className="w-full text-sm"
                                        onClick={generateCode}
                                    >
                                        <Plus size={16} className="inline mr-2" />
                                        Generate Room Code
                                    </PixelButton>
                                ) : (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="space-y-3"
                                    >
                                        {/* Generated code display */}
                                        <div className={`relative py-4 border-4 text-center ${nightMode
                                            ? 'bg-slate-700 border-indigo-500'
                                            : 'bg-slate-50 border-blue-400'
                                            }`}>
                                            <p className={`font-display text-3xl tracking-[0.6em] ${nightMode ? 'text-indigo-300' : 'text-blue-600'
                                                }`}>
                                                {generatedCode}
                                            </p>
                                            <p className={`font-body text-xs mt-1 ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                Share this code with friends
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            <PixelButton
                                                variant="secondary"
                                                size="md"
                                                className="flex-1 text-xs"
                                                onClick={copyCode}
                                            >
                                                {copied ? <Check size={14} className="inline mr-1" /> : <Copy size={14} className="inline mr-1" />}
                                                {copied ? 'Copied!' : 'Copy Code'}
                                            </PixelButton>
                                            <PixelButton
                                                variant="primary"
                                                size="md"
                                                className="flex-1 text-xs"
                                                onClick={() => handleJoinOrCreate('create')}
                                                disabled={isConnecting}
                                            >
                                                {isConnecting ? (
                                                    <Loader2 size={14} className="inline mr-1 animate-spin" />
                                                ) : (
                                                    <Zap size={14} className="inline mr-1" />
                                                )}
                                                Start Room
                                            </PixelButton>
                                        </div>

                                        {error && (
                                            <p className="text-red-500 text-[10px] text-center font-display uppercase">
                                                {error}
                                            </p>
                                        )}

                                        <button
                                            onClick={generateCode}
                                            className={`w-full py-1 font-body text-xs underline ${nightMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            Regenerate code
                                        </button>
                                    </motion.div>
                                )}
                            </motion.div>
                        )}

                        {/* ═══════ QUICK MATCH TAB ═══════ */}
                        {activeTab === 'quick' && (
                            <motion.div
                                key="quick"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                            >
                                <div className="text-center">
                                    <Swords size={32} className={`mx-auto mb-3 ${nightMode ? 'text-red-400' : 'text-red-500'}`} />
                                    <p className={`font-display text-xs uppercase mb-1 ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        Quick Match
                                    </p>
                                    <p className={`font-body text-sm ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Jump into a game with random players instantly
                                    </p>
                                </div>

                                {!searching ? (
                                    <PixelButton
                                        variant="danger"
                                        size="lg"
                                        className="w-full text-sm animate-pulse"
                                        onClick={() => {
                                            setSearching(true);
                                            // Simulate search then join
                                            setTimeout(() => handleJoinOrCreate('quick'), 2000);
                                        }}
                                        disabled={isConnecting}
                                    >
                                        {isConnecting ? (
                                            <Loader2 size={16} className="inline mr-2 animate-spin" />
                                        ) : (
                                            <Zap size={16} className="inline mr-2" />
                                        )}
                                        Find Match
                                    </PixelButton>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center space-y-4"
                                    >
                                        {/* Searching animation */}
                                        <div className="flex justify-center gap-3 py-4">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-4 h-4"
                                                    style={{ backgroundColor: ['#ef4444', '#3b82f6', '#22c55e'][i] }}
                                                    animate={{
                                                        y: [0, -16, 0],
                                                        rotate: [0, 180, 360],
                                                    }}
                                                    transition={{
                                                        duration: 0.8,
                                                        repeat: Infinity,
                                                        delay: i * 0.15,
                                                        ease: 'easeInOut',
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        <p className={`font-display text-xs ${nightMode ? 'text-indigo-300' : 'text-blue-600'}`}>
                                            SEARCHING FOR MATCH{searchDots}
                                        </p>
                                        <p className={`font-body text-sm ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                            Estimated wait: ~15 seconds
                                        </p>

                                        <PixelButton
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => setSearching(false)}
                                            className="text-[10px]"
                                        >
                                            Cancel
                                        </PixelButton>
                                    </motion.div>
                                )}

                                {/* Match settings
                                <div className={`border-t-2 pt-3 mt-3 ${nightMode ? 'border-slate-600' : 'border-slate-200'}`}>
                                    <p className={`font-display text-[10px] uppercase mb-2 ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Match Settings
                                    </p>
                                    <div className="flex gap-2">
                                        <button className={`flex-1 py-1.5 border-2 font-display text-[9px] uppercase ${nightMode
                                            ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300'
                                            : 'border-blue-400 bg-blue-100 text-blue-700'
                                            }`}>
                                            1v1
                                        </button>
                                        <button className={`flex-1 py-1.5 border-2 font-display text-[9px] uppercase ${nightMode
                                            ? 'border-slate-600 bg-slate-700 text-slate-400'
                                            : 'border-slate-300 bg-white text-slate-500'
                                            }`}>
                                            2v2
                                        </button>
                                        <button className={`flex-1 py-1.5 border-2 font-display text-[9px] uppercase ${nightMode
                                            ? 'border-slate-600 bg-slate-700 text-slate-400'
                                            : 'border-slate-300 bg-white text-slate-500'
                                            }`}>
                                            FFA
                                        </button>
                                    </div>
                                </div> */}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Back button at bottom */}
                    <div className={`mt-4 pt-3 border-t-2 ${nightMode ? 'border-slate-600' : 'border-slate-200'}`}>
                        <PixelButton variant="secondary" size="sm" onClick={onClose} className="text-[10px]">
                            <ArrowLeft size={12} className="inline mr-1" />
                            Back to Menu
                        </PixelButton>
                    </div>
                </PixelCard>
            </motion.div>
        </div>
    );
};
