import React from 'react';
import { motion } from 'motion/react';
import { PixelCard } from './PixelCard';
import { Trophy, Flame, Target, Swords, Shield, Star, TrendingUp } from 'lucide-react';

interface PlayerStatsProps {
    nightMode?: boolean;
}

/* Rank tier data */
const RANK_TIERS = [
    { name: 'Bronze', color: '#cd7f32', min: 0 },
    { name: 'Silver', color: '#c0c0c0', min: 500 },
    { name: 'Gold', color: '#ffd700', min: 1200 },
    { name: 'Platinum', color: '#2dd4bf', min: 2000 },
    { name: 'Diamond', color: '#818cf8', min: 3000 },
    { name: 'Champion', color: '#f43f5e', min: 4500 },
];

/* Progress bar */
const PixelBar: React.FC<{ value: number; max: number; color: string; nightMode: boolean }> = ({
    value,
    max,
    color,
    nightMode,
}) => {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div
            className={`relative h-4 border-2 overflow-hidden ${nightMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300'
                }`}
        >
            <motion.div
                className="h-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
            />
            {/* pixel notches */}
            {[25, 50, 75].map((n) => (
                <div
                    key={n}
                    className="absolute top-0 bottom-0 w-px"
                    style={{ left: `${n}%`, backgroundColor: nightMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                />
            ))}
        </div>
    );
};

export const PlayerStats: React.FC<PlayerStatsProps> = ({ nightMode = false }) => {
    const currentRank = RANK_TIERS[3]; // Platinum
    const nextRank = RANK_TIERS[4]; // Diamond
    const currentElo = 2640;
    const progress = ((currentElo - currentRank.min) / (nextRank.min - currentRank.min)) * 100;

    const stats = [
        { icon: Swords, label: 'Matches', value: '347', color: '#ef4444' },
        { icon: Trophy, label: 'Wins', value: '198', color: '#eab308' },
        { icon: Target, label: 'Win Rate', value: '57%', color: '#22c55e' },
        { icon: Flame, label: 'Streak', value: '7 🔥', color: '#f97316' },
    ];

    const recentMatches = [
        { result: 'W', opponent: 'GlitchWitch', score: '3-1', time: '2m ago' },
        { result: 'W', opponent: 'RetroRogue', score: '3-2', time: '18m ago' },
        { result: 'L', opponent: 'NeonNinja', score: '1-3', time: '1h ago' },
        { result: 'W', opponent: 'ByteBarb', score: '3-0', time: '2h ago' },
    ];

    return (
        <PixelCard title="Your Stats" className="w-full max-w-sm" nightMode={nightMode}>
            <div className="space-y-4 mt-2">
                {/* Rank Badge */}
                <motion.div
                    className={`flex items-center gap-3 p-3 border-2 ${nightMode ? 'bg-slate-700/50 border-slate-600' : 'bg-gradient-to-r from-slate-50 to-white border-slate-200'
                        }`}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <motion.div
                        className="w-12 h-12 border-2 border-black flex items-center justify-center"
                        style={{ backgroundColor: currentRank.color }}
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                    >
                        <Shield size={20} className="text-white drop-shadow-md" fill="currentColor" />
                    </motion.div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <span
                                className="font-display text-sm uppercase"
                                style={{ color: currentRank.color }}
                            >
                                {currentRank.name}
                            </span>
                            <span className={`font-body text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                #{currentElo}
                            </span>
                        </div>
                        <div className="mt-1">
                            <PixelBar value={progress} max={100} color={nextRank.color} nightMode={nightMode} />
                        </div>
                        <div className={`flex justify-between mt-0.5 font-body text-[10px] ${nightMode ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                            <span>{currentRank.name}</span>
                            <span className="flex items-center gap-0.5">
                                <TrendingUp size={8} /> {nextRank.name}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-2">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            className={`p-2 border-2 text-center ${nightMode ? 'bg-slate-700/50 border-slate-600' : 'bg-white border-slate-200'
                                }`}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 + i * 0.1 }}
                        >
                            <stat.icon
                                size={14}
                                className="mx-auto mb-1"
                                style={{ color: stat.color }}
                            />
                            <div className={`font-display text-xs ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                {stat.value}
                            </div>
                            <div className={`font-body text-[10px] ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Recent Matches */}
                <div>
                    <div className={`font-display text-[10px] uppercase tracking-wider mb-2 ${nightMode ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                        Recent Matches
                    </div>
                    <div className="space-y-1">
                        {recentMatches.map((m, i) => (
                            <motion.div
                                key={i}
                                className={`flex items-center gap-2 px-2 py-1.5 border ${nightMode ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'
                                    } transition-colors`}
                                initial={{ x: 10, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.5 + i * 0.08 }}
                            >
                                <div
                                    className={`w-5 h-5 flex items-center justify-center font-display text-[9px] text-white border ${m.result === 'W' ? 'bg-green-500 border-green-700' : 'bg-red-500 border-red-700'
                                        }`}
                                >
                                    {m.result}
                                </div>
                                <span className={`font-display text-[10px] flex-1 ${nightMode ? 'text-slate-300' : 'text-slate-700'
                                    }`}>
                                    {m.opponent}
                                </span>
                                <span className={`font-body text-[11px] ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {m.score}
                                </span>
                                <span className={`font-body text-[10px] ${nightMode ? 'text-slate-600' : 'text-slate-300'}`}>
                                    {m.time}
                                </span>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Season badge */}
                <div className={`flex items-center gap-2 pt-2 border-t-2 ${nightMode ? 'border-slate-600' : 'border-slate-200'
                    }`}>
                    <Star size={12} className="text-yellow-400" fill="currentColor" />
                    <span className={`font-display text-[10px] ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Season 4 — 23 days left
                    </span>
                </div>
            </div>
        </PixelCard>
    );
};
