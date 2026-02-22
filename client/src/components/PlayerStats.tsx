import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PixelCard } from "./PixelCard";
import {
  Trophy,
  Flame,
  Target,
  Swords,
  Shield,
  Star,
  TrendingUp,
} from "lucide-react";

interface PlayerStatsProps {
  nightMode?: boolean;
}

/* Rank tier data */
const RANK_TIERS = [
  { name: "Bronze", color: "#cd7f32", min: 0 },
  { name: "Silver", color: "#c0c0c0", min: 500 },
  { name: "Gold", color: "#ffd700", min: 1200 },
  { name: "Platinum", color: "#2dd4bf", min: 2000 },
  { name: "Diamond", color: "#818cf8", min: 3000 },
  { name: "Champion", color: "#f43f5e", min: 4500 },
];

/* Progress bar */
const PixelBar: React.FC<{
  value: number;
  max: number;
  color: string;
  nightMode: boolean;
}> = ({ value, max, color, nightMode }) => {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div
      className={`relative h-4 border-2 overflow-hidden ${
        nightMode
          ? "bg-slate-700 border-slate-600"
          : "bg-slate-200 border-slate-300"
      }`}
    >
      <motion.div
        className="h-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
      />
      {/* pixel notches */}
      {[25, 50, 75].map((n) => (
        <div
          key={n}
          className="absolute top-0 bottom-0 w-px"
          style={{
            left: `${n}%`,
            backgroundColor: nightMode
              ? "rgba(255,255,255,0.08)"
              : "rgba(0,0,0,0.08)",
          }}
        />
      ))}
    </div>
  );
};

export const PlayerStats: React.FC<PlayerStatsProps> = ({
  nightMode = false,
}) => {
  const [playerData, setPlayerData] = useState<any>(null);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const headers: Record<string, string> = {};
        if (import.meta.env.VITE_NGROK === "true") {
          headers["ngrok-skip-browser-warning"] = "true";
        }

        const playerId = localStorage.getItem("playerId");
        if (playerId) {
          const res = await fetch(
            `${import.meta.env.VITE_BACKEND_URL}/api/player/${playerId}`,
            { headers },
          );
          if (res.ok) {
            const data = await res.json();
            setPlayerData(data.stats);
          }
        }

        const matchesRes = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/matches`,
          { headers },
        );
        if (matchesRes.ok) {
          const data = await matchesRes.json();
          setRecentMatches(data.matches || []);
        }
      } catch (err) {
        console.error("Failed to fetch stats", err);
      }
    };
    fetchStats();
  }, []);

  const currentElo = playerData ? playerData.score : 0;
  let currentRank = RANK_TIERS[0];
  let nextRank = RANK_TIERS[1];
  for (let i = 0; i < RANK_TIERS.length; i++) {
    if (currentElo >= RANK_TIERS[i].min) {
      currentRank = RANK_TIERS[i];
      nextRank = RANK_TIERS[i + 1] || RANK_TIERS[i];
    }
  }
  const progress =
    nextRank.min > currentRank.min
      ? ((currentElo - currentRank.min) / (nextRank.min - currentRank.min)) *
        100
      : 100;

  const stats = [
    {
      icon: Swords,
      label: "Matches",
      value: playerData ? playerData.matches : 0,
      color: "#ef4444",
    },
    {
      icon: Trophy,
      label: "Wins",
      value: playerData ? playerData.wins : 0,
      color: "#eab308",
    },
    {
      icon: Target,
      label: "Win Rate",
      value:
        playerData && playerData.matches > 0
          ? `${Math.round((playerData.wins / playerData.matches) * 100)}%`
          : "0%",
      color: "#22c55e",
    },
    {
      icon: Flame,
      label: "Score",
      value: playerData ? playerData.score : 0,
      color: "#f97316",
    },
  ];

  return (
    <PixelCard
      title="Your Stats"
      className="w-full max-w-sm"
      nightMode={nightMode}
    >
      <div className="space-y-4 mt-2">
        {/* Rank Badge */}
        <motion.div
          className={`flex items-center gap-3 p-3 border-2 ${
            nightMode
              ? "bg-slate-700/50 border-slate-600"
              : "bg-linear-to-r from-slate-50 to-white border-slate-200"
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
            <Shield
              size={20}
              className="text-white drop-shadow-md"
              fill="currentColor"
            />
          </motion.div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span
                className="font-display text-sm uppercase"
                style={{ color: currentRank.color }}
              >
                {currentRank.name}
              </span>
              <span
                className={`font-body text-xs ${nightMode ? "text-slate-500" : "text-slate-400"}`}
              >
                #{playerData ? playerData.rank : 0}
              </span>
            </div>
            <div className="mt-1">
              <PixelBar
                value={progress}
                max={100}
                color={nextRank.color}
                nightMode={nightMode}
              />
            </div>
            <div
              className={`flex justify-between mt-0.5 font-body text-[10px] ${
                nightMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
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
              className={`p-2 border-2 text-center ${
                nightMode
                  ? "bg-slate-700/50 border-slate-600"
                  : "bg-white border-slate-200"
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
              <div
                className={`font-display text-xs ${nightMode ? "text-slate-200" : "text-slate-800"}`}
              >
                {stat.value}
              </div>
              <div
                className={`font-body text-[10px] ${nightMode ? "text-slate-500" : "text-slate-400"}`}
              >
                {stat.label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recent Matches */}
        <div>
          <div
            className={`font-display text-[10px] uppercase tracking-wider mb-2 ${
              nightMode ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Recent Matches
          </div>
          <div className="space-y-1">
            {recentMatches.slice(0, 4).map((m, i) => {
              const myId = localStorage.getItem("playerId");
              const isWin = m.winnerId === myId;
              const isDraw = m.isDraw;
              return (
                <motion.div
                  key={i}
                  className={`flex items-center gap-2 px-2 py-1.5 border ${
                    nightMode
                      ? "border-slate-700 hover:bg-slate-700/50"
                      : "border-slate-100 hover:bg-slate-50"
                  } transition-colors`}
                  initial={{ x: 10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.08 }}
                >
                  <div
                    className={`w-5 h-5 flex items-center justify-center font-display text-[9px] text-white border ${
                      isDraw
                        ? "bg-slate-400 border-slate-600"
                        : isWin
                          ? "bg-green-500 border-green-700"
                          : "bg-red-500 border-red-700"
                    }`}
                  >
                    {isDraw ? "D" : isWin ? "W" : "L"}
                  </div>
                  <span
                    className={`font-display text-[10px] flex-1 truncate ${
                      nightMode ? "text-slate-300" : "text-slate-700"
                    }`}
                  >
                    {isDraw
                      ? "Draw"
                      : isWin
                        ? `🏆 Victory`
                        : `vs ${m.winnerName || "Unknown"}`}
                  </span>
                  <span
                    className={`font-body text-[11px] ${
                      nightMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {m.playerCount}P
                  </span>
                  <span
                    className={`font-body text-[10px] ${
                      nightMode ? "text-slate-600" : "text-slate-300"
                    }`}
                  >
                    {Math.round(m.matchDuration)}s
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Season badge */}
        <div
          className={`flex items-center gap-2 pt-2 border-t-2 ${
            nightMode ? "border-slate-600" : "border-slate-200"
          }`}
        >
          <Star size={12} className="text-yellow-400" fill="currentColor" />
          <span
            className={`font-display text-[10px] ${nightMode ? "text-slate-400" : "text-slate-500"}`}
          >
            Season 4 — 23 days left
          </span>
        </div>
      </div>
    </PixelCard>
  );
};
