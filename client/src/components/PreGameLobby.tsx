import React, { useEffect, useState } from "react";
import { Room } from "colyseus.js";
import { motion, AnimatePresence } from "motion/react";
import { PixelButton } from "./PixelButton";
import {
  CheckCircle2,
  Circle,
  Crown,
  Sun,
  Moon,
  Zap,
  Bomb,
  Rocket,
} from "lucide-react";

interface PreGameLobbyProps {
  room: Room;
  nightMode: boolean;
  setNightMode: (val: boolean) => void;
  onGameStart: () => void;
  onLeave: () => void;
}

const MAX_PLAYERS = 8;

export const PreGameLobby: React.FC<PreGameLobbyProps> = ({
  room,
  nightMode,
  setNightMode,
  onGameStart,
  onLeave,
}) => {
  // Use a tick counter to force re-render when Colyseus state changes.
  // We read from room.state directly instead of spreading — schema objects
  // like MapSchema don't survive a shallow spread properly.
  const [, setTick] = useState(0);
  const [isMyReady, setIsMyReady] = useState(false);
  const gameState = room.state as any;

  useEffect(() => {
    // 'alive' prevents stale callbacks from firing after this component unmounts
    // or after the game has started. We must NOT call room.removeAllListeners()
    // because the game components (GrassGame etc.) attach their own listeners
    // after this lobby unmounts — removing them would break the game.
    let alive = true;

    room.onStateChange((state) => {
      if (!alive) return;
      // Force re-render by bumping tick
      setTick((t) => t + 1);

      // Check if local player is ready
      const me = state.players?.get(room.sessionId);
      if (me) setIsMyReady(!!me.isReady);

      // Game started — transition out of lobby
      if (state.matchStarted || state.countdown > 0) {
        alive = false;
        onGameStart();
      }
    });

    // Also listen for the match_start message (some rooms use this)
    room.onMessage("match_start", () => {
      if (!alive) return;
      alive = false;
      onGameStart();
    });

    return () => {
      alive = false;
      // Do NOT call room.removeAllListeners() here — the game component needs the room
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const handleReady = () => {
    room.send("ready");
  };

  const players: [string, any][] = gameState.players
    ? Array.from(gameState.players)
    : [];

  const readyCount = players.filter(([, p]) => p.isReady).length;
  const totalCount = players.length;

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-6 relative ${
        nightMode ? "bg-slate-950" : "bg-amber-50"
      }`}
    >
      {/* Animated background tint */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          nightMode
            ? "bg-[radial-gradient(ellipse_at_center,#1e1b4b_0%,transparent_70%)]"
            : "bg-[radial-gradient(ellipse_at_center,#fef3c7_0%,transparent_70%)]"
        }`}
      />

      {/* Day/Night Toggle — fixed top-left */}
      <motion.button
        onClick={() => setNightMode(!nightMode)}
        className={`fixed top-4 left-4 z-50 w-14 h-14 border-4 flex items-center justify-center transition-colors duration-500 cursor-pointer ${
          nightMode
            ? "bg-indigo-600 border-indigo-800 hover:bg-indigo-500"
            : "bg-amber-400 border-amber-600 hover:bg-amber-300"
        }`}
        whileHover={{ scale: 1.1, rotate: 15 }}
        whileTap={{ scale: 0.9 }}
        title={nightMode ? "Switch to Day" : "Switch to Night"}
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

      {/* Night/Day label */}
      <div
        className={`fixed top-5 left-20 z-50 font-display text-[10px] uppercase tracking-widest px-3 py-1 border-2 transition-colors duration-500 ${
          nightMode
            ? "bg-indigo-900/80 border-indigo-600 text-indigo-300"
            : "bg-amber-100/80 border-amber-500 text-amber-800"
        }`}
      >
        {nightMode ? "🌙 Night" : "☀️ Day"}
      </div>

      {/* Main 2-column card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8"
      >
        {/* ── LEFT: Players & Ready ── */}
        <div className="space-y-6">
          {/* Title */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`px-2 py-1 ${
                  nightMode ? "bg-indigo-600" : "bg-amber-500"
                }`}
              >
                <span className="font-display text-[10px] text-white uppercase tracking-tighter">
                  Lobby Room
                </span>
              </div>
              <span
                className={`font-display text-sm tabular-nums ${
                  nightMode ? "text-slate-400" : "text-amber-700"
                }`}
              >
                ID: {room.id}
              </span>
            </div>
            <h2
              className={`font-display text-4xl tracking-widest uppercase ${
                nightMode ? "text-white" : "text-amber-900"
              }`}
              style={{
                textShadow: nightMode ? "4px 4px 0 #4f46e5" : "4px 4px 0 #fbbf24",
              }}
            >
              Are you Ready?
            </h2>
            <p
              className={`font-sans text-sm mt-2 ${
                nightMode ? "text-slate-400" : "text-amber-700/80"
              }`}
            >
              Game starts automatically when all players are ready.
            </p>
          </div>

          {/* Ready counter */}
          <div
            className={`flex items-center gap-3 px-4 py-2 border-2 ${
              nightMode
                ? "bg-slate-900/60 border-indigo-700"
                : "bg-white/70 border-amber-400"
            }`}
          >
            <span
              className={`font-display text-xs uppercase ${
                nightMode ? "text-slate-400" : "text-amber-600"
              }`}
            >
              Ready:
            </span>
            <span
              className={`font-display text-2xl tabular-nums ${
                readyCount === totalCount && totalCount > 0
                  ? "text-green-400"
                  : nightMode
                  ? "text-white"
                  : "text-amber-900"
              }`}
            >
              {readyCount}/{totalCount}
            </span>
            {/* Mini progress bar */}
            <div
              className={`flex-1 h-2 border ${
                nightMode ? "bg-slate-800 border-slate-700" : "bg-amber-100 border-amber-300"
              }`}
            >
              <motion.div
                className="h-full bg-green-500"
                animate={{ width: totalCount > 0 ? `${(readyCount / totalCount) * 100}%` : "0%" }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Player list */}
          <div
            className={`border-4 p-4 space-y-2 ${
              nightMode
                ? "bg-slate-900/50 border-indigo-500/30"
                : "bg-amber-50/80 border-amber-400/50"
            }`}
          >
            <div
              className={`flex justify-between items-center mb-3 pb-2 border-b ${
                nightMode ? "border-white/10" : "border-amber-300/40"
              }`}
            >
              <span
                className={`font-display text-xs ${
                  nightMode ? "text-indigo-300" : "text-amber-700"
                }`}
              >
                Players ({totalCount}/{MAX_PLAYERS})
              </span>
              <span
                className={`font-display text-[10px] uppercase ${
                  nightMode ? "text-white/40" : "text-amber-600/60"
                }`}
              >
                Status
              </span>
            </div>

            {players.map(([id, p]) => {
              const isLocal = id === room.sessionId;
              const isOwner = id === gameState.ownerId;
              return (
                <motion.div
                  key={id}
                  layout
                  className={`flex items-center gap-3 p-3 border-2 transition-colors ${
                    p.isReady
                      ? "border-green-500/50 bg-green-500/10"
                      : nightMode
                      ? "border-white/5 bg-white/5"
                      : "border-amber-300/30 bg-amber-100/30"
                  }`}
                >
                  {/* Avatar swatch */}
                  <div
                    className="w-8 h-8 border-2 border-black/40 shrink-0"
                    style={{
                      backgroundColor: p.color || p.avatarColor || "#ef4444",
                    }}
                  />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-display text-sm truncate ${
                          isLocal
                            ? "text-yellow-400"
                            : nightMode
                            ? "text-white"
                            : "text-amber-900"
                        }`}
                      >
                        {p.displayName}
                        {isLocal && " (You)"}
                      </span>
                      {isOwner && <Crown size={12} className="text-yellow-500" />}
                    </div>
                    <span
                      className={`font-sans text-[10px] block leading-tight ${
                        nightMode ? "text-white/40" : "text-amber-700/60"
                      }`}
                    >
                      {isOwner ? "Room Creator" : "Challenger"}
                    </span>
                  </div>
                  {/* Ready status */}
                  {p.isReady ? (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <span className="font-display text-[10px] uppercase">
                        Ready
                      </span>
                      <CheckCircle2 size={16} />
                    </div>
                  ) : (
                    <div
                      className={`flex items-center gap-1.5 ${
                        nightMode ? "text-white/20" : "text-amber-400/60"
                      }`}
                    >
                      <span className="font-display text-[10px] uppercase">
                        Waiting
                      </span>
                      <Circle size={16} />
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Empty slots placeholder */}
            {Array.from({
              length: Math.max(0, 2 - totalCount),
            }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className={`flex items-center gap-3 p-3 border-2 border-dashed opacity-30 ${
                  nightMode ? "border-white/10" : "border-amber-400/30"
                }`}
              >
                <div
                  className={`w-8 h-8 border-2 border-dashed ${
                    nightMode
                      ? "bg-white/5 border-white/20"
                      : "bg-amber-200/20 border-amber-400/30"
                  }`}
                />
                <span
                  className={`font-display text-[10px] uppercase tracking-widest ${
                    nightMode ? "text-white/40" : "text-amber-700/50"
                  }`}
                >
                  Waiting for player...
                </span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <PixelButton
              variant={isMyReady ? "secondary" : "primary"}
              className="flex-1 py-4 text-sm"
              onClick={handleReady}
            >
              {isMyReady ? "CANCEL READY" : "I AM READY! ✓"}
            </PixelButton>
            <PixelButton variant="accent" className="px-6" onClick={onLeave}>
              EXIT
            </PixelButton>
          </div>
        </div>

        {/* ── RIGHT: Game Rules ── */}
        <div
          className={`border-4 p-6 flex flex-col justify-between ${
            nightMode
              ? "bg-indigo-950/20 border-indigo-900/50"
              : "bg-amber-50/80 border-amber-400/50"
          }`}
        >
          <div className="space-y-6">
            <div className="space-y-4">
              <h3
                className={`font-display text-xl uppercase tracking-wider flex items-center gap-2 ${
                  nightMode ? "text-yellow-400" : "text-amber-700"
                }`}
              >
                <div
                  className={`w-2 h-6 ${
                    nightMode ? "bg-yellow-400" : "bg-amber-500"
                  }`}
                />
                How to Play
              </h3>

              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div
                    className={`p-2 border font-display text-xs shrink-0 ${
                      nightMode
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-amber-100 border-amber-300 text-amber-800"
                    }`}
                  >
                    MV
                  </div>
                  <div>
                    <p
                      className={`font-display text-[11px] uppercase mb-1 ${
                        nightMode ? "text-white" : "text-amber-900"
                      }`}
                    >
                      Movement
                    </p>
                    <p
                      className={`font-sans text-xs ${
                        nightMode ? "text-slate-400" : "text-amber-700"
                      }`}
                    >
                      Use WASD or Arrow Keys to move around the arena and
                      collect tiles.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div
                    className={`p-2 border font-display text-xs shrink-0 ${
                      nightMode
                        ? "bg-slate-800 border-slate-700 text-white"
                        : "bg-amber-100 border-amber-300 text-amber-800"
                    }`}
                  >
                    SC
                  </div>
                  <div>
                    <p
                      className={`font-display text-[11px] uppercase mb-1 ${
                        nightMode ? "text-white" : "text-amber-900"
                      }`}
                    >
                      Score Points
                    </p>
                    <p
                      className={`font-sans text-xs ${
                        nightMode ? "text-slate-400" : "text-amber-700"
                      }`}
                    >
                      Collect grass tiles, score goals, or survive longest
                      depending on the game mode.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Power-ups grid */}
            <div className="space-y-3">
              <h4
                className={`font-display text-[11px] uppercase tracking-widest pb-2 border-b ${
                  nightMode
                    ? "text-indigo-300 border-white/5"
                    : "text-amber-600 border-amber-300/40"
                }`}
              >
                Power-Ups & Hazards
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: "💣", label: "Bomb Trap", color: nightMode ? "text-red-300" : "text-red-600" },
                  { icon: "🚀", label: "Nuke Rocket", color: nightMode ? "text-orange-300" : "text-orange-600" },
                  { icon: "⚡", label: "Super Speed", color: nightMode ? "text-yellow-300" : "text-yellow-600" },
                  { icon: "🌿", label: "Double Grass", color: nightMode ? "text-green-300" : "text-green-600" },
                ].map(({ icon, label, color }) => (
                  <div
                    key={label}
                    className={`p-2 flex items-center gap-2 border ${
                      nightMode
                        ? "bg-black/20 border-white/5"
                        : "bg-amber-100/50 border-amber-300/40"
                    }`}
                  >
                    <span className="text-xl">{icon}</span>
                    <span className={`font-display text-[9px] uppercase ${color}`}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pro tip */}
          <div
            className={`mt-8 p-4 border ${
              nightMode
                ? "bg-yellow-400/10 border-yellow-400/20"
                : "bg-amber-100/60 border-amber-400/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`animate-pulse w-2 h-2 rounded-full shrink-0 ${
                  nightMode
                    ? "bg-yellow-400 shadow-[0_0_8px_#facc15]"
                    : "bg-amber-500 shadow-[0_0_8px_#f59e0b]"
                }`}
              />
              <p
                className={`font-sans text-[11px] leading-relaxed italic ${
                  nightMode ? "text-yellow-100/80" : "text-amber-800"
                }`}
              >
                "Pro Tip: Use the Rocket only when opponents are about to clear
                a large patch!"
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
