import React from "react";
import { Background } from "./components/Background";
import { PixelButton } from "./components/PixelButton";
import { PixelCharacter } from "./components/PixelCharacter";
import { PlayerStats } from "./components/PlayerStats";
import { SplashScreen } from "./components/SplashScreen";
import { MultiplayerLobby } from "./components/MultiplayerLobby";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Volume2, Monitor, Sun, Moon, User } from "lucide-react";
import { PixelCard } from "./components/PixelCard";
import { GameArena } from "./components/GameArena";
import { GrassGame } from "./components/games/GrassGame";
import { RedDynamiteGame } from "./components/games/RedDynamiteGame";
import { TurfSoccerGame } from "./components/games/TurfSoccerGame";
import { CommunicationHub } from "./components/CommunicationHub";
import { BigOverlayBanner, AIOverlayData } from "./components/BigOverlayBanner";
import { gameClient } from "./services/gameClient";
import { Room } from "colyseus.js";
import {
  VoiceSettings,
  loadVoiceSettings,
  saveVoiceSettings,
} from "./services/voiceCommentary";
import { Mic, MicOff } from "lucide-react";

function App() {
  const [showSettings, setShowSettings] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [nightMode, setNightMode] = React.useState(true); // default NIGHT
  const [showMultiplayer, setShowMultiplayer] = React.useState(false);
  const [lobbyInitialTab, setLobbyInitialTab] = React.useState<
    "leaderboard" | "join" | "create" | "quick"
  >("quick");
  const [characterColor, setCharacterColor] = React.useState(
    localStorage.getItem("playerColor") || "#ef4444",
  );
  const [activeRoom, setActiveRoom] = React.useState<Room | null>(null);
  const [aiOverlay, setAiOverlay] = React.useState<AIOverlayData | null>(null);
  const [voiceSettings, setVoiceSettings] =
    React.useState<VoiceSettings>(loadVoiceSettings);

  // Persist voice settings whenever they change
  React.useEffect(() => {
    saveVoiceSettings(voiceSettings);
  }, [voiceSettings]);
  const [displayName, setDisplayName] = React.useState(
    localStorage.getItem("displayName") ||
      `Player_${Math.floor(Math.random() * 1000)}`,
  );
  const [playerId] = React.useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  React.useEffect(() => {
    localStorage.setItem("displayName", displayName);

    const debounceTimer = setTimeout(async () => {
      // 1. Sync to active room if exists
      if (activeRoom) {
        gameClient.sendUpdateName(displayName);
      }

      // 2. Sync to backend persistently
      try {
        const backendUrl =
          import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (import.meta.env.VITE_NGROK === "true") {
          headers["ngrok-skip-browser-warning"] = "true";
        }

        await fetch(`${backendUrl}/api/player/name`, {
          method: "POST",
          headers,
          body: JSON.stringify({ playerId, displayName }),
        });
      } catch (err) {
        console.error("Failed to sync name to backend", err);
      }
    }, 1000);

    return () => clearTimeout(debounceTimer);
  }, [displayName, activeRoom, playerId]);

  React.useEffect(() => {
    localStorage.setItem("playerColor", characterColor);
  }, [characterColor]);

  // Cumulative scores across all games in a session
  const [cumulativeScores, setCumulativeScores] = React.useState<
    Record<string, { displayName: string; score: number }>
  >({});
  const [showFinalLeaderboard, setShowFinalLeaderboard] = React.useState(false);

  // Refs so handleNextGame always reads current values without stale closure
  const displayNameRef = React.useRef(displayName);
  displayNameRef.current = displayName;
  const characterColorRef = React.useRef(characterColor);
  characterColorRef.current = characterColor;
  const playerIdRef = React.useRef(playerId);

  // Guards and counters for game transitions
  const isTransitioningRef = React.useRef(false);
  const gameCountRef = React.useRef(0); // how many next_game transitions have fired

  // Handle transition to the next game room - called by game components directly
  const handleNextGame = React.useCallback(
    async (roomId: string, _roomName: string) => {
      // Prevent double-execution (safety net on top of the per-room guard in game components)
      if (isTransitioningRef.current) {
        console.warn(
          "[App] handleNextGame called while already transitioning — ignored",
        );
        return;
      }
      isTransitioningRef.current = true;

      const currentRoom = gameClient.getRoom();

      // Collect scores from the current room before leaving
      const myScore: number =
        (currentRoom?.state?.players as any)?.get(currentRoom?.sessionId)
          ?.score ?? 0;
      const finalScores: Record<
        string,
        { displayName: string; score: number }
      > = {};
      (currentRoom?.state?.players as any)?.forEach((player: any) => {
        if (player.playerId) {
          finalScores[player.playerId] = {
            displayName: player.displayName,
            score: player.score ?? 0,
          };
        }
      });

      gameCountRef.current += 1;
      console.log(
        `[App] handleNextGame — game #${gameCountRef.current}, myScore: ${myScore}`,
      );

      // After 3 games (arena → dynamite → soccer → final), show the overall leaderboard
      if (gameCountRef.current >= 3) {
        setCumulativeScores(finalScores);
        setShowFinalLeaderboard(true);
        // Leave the old room immediately so it can dispose and we don't hold stale connections
        try {
          currentRoom?.leave();
        } catch (_e) {
          /* ok */
        }
        setActiveRoom(null);
        isTransitioningRef.current = false;
        return;
      }

      try {
        const newRoom = await gameClient.joinNew(roomId, {
          displayName: displayNameRef.current,
          playerId: playerIdRef.current,
          color: characterColorRef.current,
          previousScore: myScore,
        });
        // Leave the old room after successfully connecting to new one
        try {
          currentRoom?.leave();
        } catch (_e) {
          /* ok */
        }
        setActiveRoom(newRoom);
      } catch (err) {
        console.error("[App] Failed to join next game room:", err);
      } finally {
        isTransitioningRef.current = false;
      }
    },
    [],
  );

  // Clean up any stale reconnection tokens on mount
  // (rooms don't support allowReconnection, so tokens are never valid after leave/reload)
  React.useEffect(() => {
    sessionStorage.removeItem("reconnectionToken");
  }, []);

  // Reset AI overlay when the active room changes (avoids stale overlays between games)
  React.useEffect(() => {
    setAiOverlay(null);
  }, [activeRoom?.roomId]);

  const handleJoinRoom = (room: Room) => {
    setActiveRoom(room);
    setShowMultiplayer(false);
  };

  const handleLeaveRoom = () => {
    gameClient.leave();
    setActiveRoom(null);
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      <Background nightMode={nightMode} />

      {activeRoom ? (
        <div className="relative z-10 flex-1 flex flex-col">
          <header className="pt-6 pb-2 text-center relative shrink-0">
            <h1
              className={`font-display text-3xl uppercase tracking-tighter ${nightMode ? "text-indigo-300" : "text-yellow-400"}`}
            >
              CHAOS ARENA
            </h1>
            <div
              className={`absolute top-6 right-4 font-display text-[10px] px-2 py-1 border-2 opacity-50 ${nightMode ? "border-slate-700 text-slate-500" : "border-slate-300 text-slate-400"}`}
            >
              ROOM: {activeRoom.roomId}
            </div>
          </header>

          {/* Game + Communication Hub side by side */}
          <div className="flex flex-1 gap-2 px-2 pb-2 min-h-0 items-start overflow-auto">
            {/* Game canvas area with AI overlay banner */}
            <div className="relative flex-1 min-w-0">
              <BigOverlayBanner overlay={aiOverlay} />
              {activeRoom.name === "red_dynamite_room" ? (
                <RedDynamiteGame
                  room={activeRoom}
                  nightMode={nightMode}
                  onLeave={handleLeaveRoom}
                  onNextGame={handleNextGame}
                />
              ) : activeRoom.name === "turf_soccer_room" ? (
                <TurfSoccerGame
                  room={activeRoom}
                  nightMode={nightMode}
                  onLeave={handleLeaveRoom}
                  onNextGame={handleNextGame}
                />
              ) : (
                <GrassGame
                  room={activeRoom}
                  nightMode={nightMode}
                  onLeave={handleLeaveRoom}
                  onNextGame={handleNextGame}
                />
              )}
            </div>

            {/* Communication Hub sidebar */}
            <div
              className="shrink-0"
              style={{
                width: 256,
                minHeight: 480,
                maxHeight: "85vh",
                position: "sticky",
                top: 0,
              }}
            >
              <CommunicationHub
                room={activeRoom}
                nightMode={nightMode}
                mySessionId={activeRoom.sessionId}
                onOverlay={setAiOverlay}
                voiceSettings={voiceSettings}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Day/Night Toggle — fixed top-left */}
          <motion.button
            onClick={() => setNightMode(!nightMode)}
            className={`fixed top-4 left-4 z-50 w-14 h-14 border-4 flex items-center justify-center transition-colors duration-500 cursor-pointer pixel-corners ${
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
                  <Moon
                    size={24}
                    className="text-yellow-200"
                    fill="currentColor"
                  />
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

          {/* Day/Night label indicator */}
          <motion.div
            className={`fixed top-5 left-20 z-50 font-display text-[10px] uppercase tracking-widest px-3 py-1 border-2 transition-colors duration-500 ${
              nightMode
                ? "bg-indigo-900/80 border-indigo-600 text-indigo-300"
                : "bg-amber-100/80 border-amber-500 text-amber-800"
            }`}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {nightMode ? "🌙 Night" : "☀️ Day"}
          </motion.div>

          {/* Header / Logo */}
          <header className="relative z-10 pt-12 pb-6 text-center">
            <motion.h1
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className={`font-display text-6xl md:text-8xl drop-shadow-[4px_4px_0_rgba(0,0,0,1)] tracking-tighter transition-colors duration-700 ${
                nightMode ? "text-indigo-300" : "text-yellow-400"
              }`}
              style={{
                textShadow: nightMode
                  ? "4px 4px 0 #000, -2px -2px 0 #6366f1"
                  : "4px 4px 0 #000, -2px -2px 0 #ef4444",
              }}
            >
              CHAOS ARENA
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`font-body text-2xl drop-shadow-md mt-2 transition-colors duration-700 ${
                nightMode ? "text-slate-300" : "text-white"
              }`}
            >
              BRAWL. PIXEL. WIN.
            </motion.p>
          </header>

          {/* Main Content */}
          <main className="flex-1 relative z-10 container mx-auto px-4 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center h-full">
              {/* Left: Character — clickable to change color */}
              <div className="flex justify-center lg:justify-end order-2 lg:order-1">
                <PixelCharacter
                  color={characterColor}
                  onColorChange={setCharacterColor}
                />
              </div>

              {/* Center: Menu */}
              <div className="flex flex-col gap-6 items-center justify-center order-1 lg:order-2">
                <PixelButton
                  size="lg"
                  className="w-64 text-xl tracking-widest animate-pulse"
                  onClick={() => {
                    setLobbyInitialTab("quick");
                    setShowMultiplayer(true);
                  }}
                >
                  Start Game
                </PixelButton>

                <PixelButton
                  variant="secondary"
                  size="md"
                  className="w-64"
                  onClick={() => {
                    setLobbyInitialTab("quick");
                    setShowMultiplayer(true);
                  }}
                >
                  Multiplayer
                </PixelButton>

                <PixelButton
                  variant="accent"
                  size="md"
                  className="w-64"
                  onClick={() => {
                    setLobbyInitialTab("leaderboard");
                    setShowMultiplayer(true);
                  }}
                >
                  Global Leaderboard
                </PixelButton>

                <PixelButton
                  variant="accent"
                  size="md"
                  className="w-64"
                  onClick={() => setShowSettings(true)}
                >
                  Settings
                </PixelButton>
              </div>

              {/* Right: Player Stats */}
              <div className="flex justify-center lg:justify-start order-3">
                <PlayerStats nightMode={nightMode} />
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer
            className={`relative z-10 p-4 text-center font-body text-lg transition-colors duration-700 ${
              nightMode ? "text-slate-400" : "text-white/80"
            }`}
          >
            <p>
              v1.0.4-beta • Server Status:{" "}
              <span className="text-green-400">ONLINE</span>
            </p>
          </footer>
        </>
      )}

      {/* Multiplayer Lobby Modal */}
      <AnimatePresence>
        {showMultiplayer && (
          <MultiplayerLobby
            nightMode={nightMode}
            characterColor={characterColor}
            playerId={playerId}
            displayName={displayName}
            onClose={() => setShowMultiplayer(false)}
            onJoin={handleJoinRoom}
            initialTab={lobbyInitialTab}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <PixelCard title="Settings" className="mx-4" nightMode={nightMode}>
              <div className="space-y-6 mt-4">
                <div className="space-y-2">
                  <label
                    className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${
                      nightMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <User size={14} /> Player Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={`w-full p-2 border-2 font-display text-xs outline-none transition-colors duration-700 ${
                      nightMode
                        ? "bg-slate-700 border-slate-600 text-slate-200 focus:border-indigo-500"
                        : "bg-white border-slate-300 text-slate-800 focus:border-green-500"
                    }`}
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${
                      nightMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <Volume2 size={14} /> Audio
                  </label>
                  <input
                    type="range"
                    className={`w-full h-4 rounded-none appearance-none cursor-pointer ${
                      nightMode
                        ? "accent-indigo-500 bg-slate-600"
                        : "accent-green-500 bg-slate-200"
                    }`}
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${
                      nightMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    <Monitor size={14} /> Graphics
                  </label>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 py-2 border-2 font-display text-xs ${
                        nightMode
                          ? "border-indigo-500 bg-indigo-900/50 text-indigo-300"
                          : "border-green-500 bg-green-100 text-green-700"
                      }`}
                    >
                      High
                    </button>
                    <button
                      className={`flex-1 py-2 border-2 font-display text-xs ${
                        nightMode
                          ? "border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                      }`}
                    >
                      Med
                    </button>
                    <button
                      className={`flex-1 py-2 border-2 font-display text-xs ${
                        nightMode
                          ? "border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                      }`}
                    >
                      Low
                    </button>
                  </div>
                </div>

                {/* ── Voice Commentary ── */}
                <div className="space-y-3">
                  <label
                    className={`font-display text-xs uppercase flex items-center gap-2 ${nightMode ? "text-slate-400" : "text-slate-500"}`}
                  >
                    {voiceSettings.enabled ? (
                      <Mic size={14} />
                    ) : (
                      <MicOff size={14} />
                    )}{" "}
                    AI Voice Commentary
                  </label>

                  <button
                    onClick={() =>
                      setVoiceSettings((v) => ({ ...v, enabled: !v.enabled }))
                    }
                    className={`w-full py-2 border-2 font-display text-xs uppercase transition-colors duration-300 ${
                      voiceSettings.enabled
                        ? nightMode
                          ? "border-emerald-500 bg-emerald-900/40 text-emerald-300"
                          : "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : nightMode
                          ? "border-slate-600 bg-slate-700 text-slate-400"
                          : "border-slate-300 bg-white text-slate-500"
                    }`}
                  >
                    {voiceSettings.enabled
                      ? "🎙️ Commentary ON"
                      : "🔇 Commentary OFF"}
                  </button>

                  {voiceSettings.enabled && (
                    <>
                      <div>
                        <p
                          className={`font-display text-[10px] uppercase mb-1 ${nightMode ? "text-slate-500" : "text-slate-400"}`}
                        >
                          Language
                        </p>
                        <div className="flex gap-2">
                          {(["en-IN", "hi-IN"] as const).map((lang) => (
                            <button
                              key={lang}
                              onClick={() =>
                                setVoiceSettings((v) => ({
                                  ...v,
                                  language: lang,
                                }))
                              }
                              className={`flex-1 py-1.5 border-2 font-display text-xs uppercase transition-colors ${
                                voiceSettings.language === lang
                                  ? nightMode
                                    ? "border-indigo-400 bg-indigo-900/50 text-indigo-300"
                                    : "border-indigo-500 bg-indigo-100 text-indigo-700"
                                  : nightMode
                                    ? "border-slate-600 bg-slate-700 text-slate-400"
                                    : "border-slate-200 bg-white text-slate-500"
                              }`}
                            >
                              {lang === "en-IN" ? "🇬🇧 English" : "🇮🇳 Hindi"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p
                          className={`font-display text-[10px] uppercase mb-1 ${nightMode ? "text-slate-500" : "text-slate-400"}`}
                        >
                          Host Voice
                        </p>
                        <div className="flex gap-2">
                          {(["both", "male", "female"] as const).map((g) => (
                            <button
                              key={g}
                              onClick={() =>
                                setVoiceSettings((v) => ({ ...v, gender: g }))
                              }
                              className={`flex-1 py-1.5 border-2 font-display text-xs uppercase transition-colors ${
                                voiceSettings.gender === g
                                  ? nightMode
                                    ? "border-purple-400 bg-purple-900/50 text-purple-300"
                                    : "border-purple-500 bg-purple-100 text-purple-700"
                                  : nightMode
                                    ? "border-slate-600 bg-slate-700 text-slate-400"
                                    : "border-slate-200 bg-white text-slate-500"
                              }`}
                            >
                              {g === "both"
                                ? "⚡ Duo"
                                : g === "male"
                                  ? "👨 Male"
                                  : "👩 Female"}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p
                          className={`font-display text-[10px] uppercase mb-1 ${nightMode ? "text-slate-500" : "text-slate-400"}`}
                        >
                          Volume {Math.round(voiceSettings.volume * 100)}%
                        </p>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={voiceSettings.volume}
                          onChange={(e) =>
                            setVoiceSettings((v) => ({
                              ...v,
                              volume: Number(e.target.value),
                            }))
                          }
                          className={`w-full h-3 rounded-none appearance-none cursor-pointer ${
                            nightMode
                              ? "accent-purple-500 bg-slate-600"
                              : "accent-purple-500 bg-slate-200"
                          }`}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Theme toggle inside settings */}
                <div className="space-y-2">
                  <label
                    className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${
                      nightMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {nightMode ? <Moon size={14} /> : <Sun size={14} />} Theme
                  </label>
                  <button
                    onClick={() => setNightMode(!nightMode)}
                    className={`w-full py-2 border-2 font-display text-xs uppercase transition-colors duration-300 ${
                      nightMode
                        ? "border-amber-500 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50"
                        : "border-indigo-500 bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                    }`}
                  >
                    {nightMode ? "☀️ Switch to Day" : "🌙 Switch to Night"}
                  </button>
                </div>

                <div
                  className={`flex justify-end pt-4 border-t-2 transition-colors duration-700 ${
                    nightMode ? "border-slate-600" : "border-slate-100"
                  }`}
                >
                  <PixelButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowSettings(false)}
                  >
                    Close
                  </PixelButton>
                </div>
              </div>
            </PixelCard>
          </motion.div>
        </div>
      )}

      {/* Final Leaderboard — shown after both games complete */}
      <AnimatePresence>
        {showFinalLeaderboard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-md"
            >
              <PixelCard
                title="🏆 FINAL RESULTS"
                className="mx-4"
                nightMode={nightMode}
              >
                <div className="text-center mb-4">
                  <p
                    className={`font-body text-base ${nightMode ? "text-slate-300" : "text-slate-600"}`}
                  >
                    All games complete! Final standings:
                  </p>
                </div>
                <div className="space-y-3 mb-6">
                  {(
                    Object.entries(cumulativeScores) as [
                      string,
                      { displayName: string; score: number },
                    ][]
                  )
                    .sort(([, a], [, b]) => b.score - a.score)
                    .map(([id, data], idx) => (
                      <div
                        key={id}
                        className={`flex items-center justify-between p-3 border-2 ${
                          idx === 0
                            ? nightMode
                              ? "border-yellow-400 bg-yellow-900/30"
                              : "border-yellow-500 bg-yellow-50"
                            : nightMode
                              ? "border-slate-600 bg-slate-800/50"
                              : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-display text-xl ${idx === 0 ? "text-yellow-400" : "text-slate-400"}`}
                          >
                            {idx === 0 ? "👑" : `#${idx + 1}`}
                          </span>
                          <span
                            className={`font-display text-sm uppercase ${nightMode ? "text-white" : "text-slate-800"}`}
                          >
                            {data.displayName}
                          </span>
                        </div>
                        <span
                          className={`font-display text-lg font-bold ${idx === 0 ? "text-yellow-400" : nightMode ? "text-indigo-300" : "text-green-600"}`}
                        >
                          {data.score}{" "}
                          <span className="text-xs font-normal opacity-70">
                            pts
                          </span>
                        </span>
                      </div>
                    ))}
                </div>
                <PixelButton
                  className="w-full"
                  onClick={() => {
                    setShowFinalLeaderboard(false);
                    setCumulativeScores({});
                    gameCountRef.current = 0;
                    isTransitioningRef.current = false;
                    // Room was already left when the leaderboard was shown,
                    // so just make sure the client state is clean
                    try {
                      gameClient.leave();
                    } catch (_e) {
                      /* ok, may already be null */
                    }
                    setActiveRoom(null);
                  }}
                >
                  Play Again
                </PixelButton>
              </PixelCard>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
