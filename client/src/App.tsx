import React from 'react';
import { Background } from './components/Background';
import { PixelButton } from './components/PixelButton';
import { PixelCharacter, PixelStickman } from './components/PixelCharacter';
import { PlayerStats } from './components/PlayerStats';
import { SplashScreen } from './components/SplashScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Volume2, Sun, Moon, User, Zap, Pencil, Gamepad2, Activity, Vibrate } from 'lucide-react';
import { PixelCard } from './components/PixelCard';
import { GameArena } from './components/GameArena';
import { gameClient } from './services/gameClient';
import { Room } from 'colyseus.js';
import {
  AuthScreen,
  AuthGatePrompt,
  PlayerProfileBadge,
  getStoredSession,
  clearSession,
  type UserProfile,
} from './components/AuthScreen';

const AVATAR_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308',
  '#a855f7', '#f97316', '#ec4899', '#06b6d4',
  '#14b8a6', '#f43f5e', '#8b5cf6', '#84cc16',
];

function App() {
  const [showSettings, setShowSettings] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [nightMode, setNightMode] = React.useState(true); // default NIGHT
  const [showMultiplayer, setShowMultiplayer] = React.useState(false);
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [characterColor, setCharacterColor] = React.useState(localStorage.getItem('playerColor') || '#ef4444');
  const [activeRoom, setActiveRoom] = React.useState<Room | null>(null);
  const [displayName, setDisplayName] = React.useState(localStorage.getItem('displayName') || `Player_${Math.floor(Math.random() * 1000)}`);
  const [showFps, setShowFps] = React.useState(localStorage.getItem('showFps') === 'true');
  const [screenShake, setScreenShake] = React.useState(localStorage.getItem('screenShake') !== 'false');
  const [playerId] = React.useState(() => {
    let id = localStorage.getItem('playerId');
    if (!id) {
      id = `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('playerId', id);
    }
    return id;
  });

  /* ── Auth state ── */
  const [currentUser, setCurrentUser] = React.useState<UserProfile | null>(() => getStoredSession());
  const [showAuthGate, setShowAuthGate] = React.useState(false);
  const [showAuthScreen, setShowAuthScreen] = React.useState(false);
  const [authInitialTab, setAuthInitialTab] = React.useState<'signin' | 'signup'>('signin');
  const [isMatchmaking, setIsMatchmaking] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem('displayName', displayName);
  }, [displayName]);

  React.useEffect(() => {
    localStorage.setItem('playerColor', characterColor);
  }, [characterColor]);

  React.useEffect(() => {
    const token = sessionStorage.getItem('reconnectionToken');
    if (token) {
      gameClient.reconnect(token).then((room) => {
        setActiveRoom(room);
        setShowSplash(false);
      }).catch((err) => {
        console.error("Failed to reconnect", err);
        sessionStorage.removeItem('reconnectionToken');
      });
    }
  }, []);

  const handleJoinRoom = (room: Room) => {
    setIsMatchmaking(true);
    // Smooth transition to arena
    setTimeout(() => {
      setActiveRoom(room);
      sessionStorage.setItem('reconnectionToken', room.reconnectionToken);
      setShowMultiplayer(false);
      setIsMatchmaking(false);
    }, 2000);
  };

  const handleLeaveRoom = () => {
    gameClient.leave();
    setActiveRoom(null);
    sessionStorage.removeItem('reconnectionToken');
  };

  /* ── Auth flow: clicked "Start Game" or "Multiplayer" ── */
  const handlePlayAction = () => {
    if (currentUser) {
      setShowMultiplayer(true);
    } else {
      setShowAuthGate(true);
    }
  };

  /* ── Auth callbacks ── */
  const handleAuthComplete = (user: UserProfile) => {
    setCurrentUser(user);
    setDisplayName(user.username);
    setCharacterColor(user.avatarColor);
    setShowAuthScreen(false);
    setShowAuthGate(false);
    setTimeout(() => setShowMultiplayer(true), 300);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
  };

  const handleAuthGateSignIn = () => {
    setShowAuthGate(false);
    setAuthInitialTab('signin');
    setShowAuthScreen(true);
  };

  const handleAuthGateSignUp = () => {
    setShowAuthGate(false);
    setAuthInitialTab('signup');
    setShowAuthScreen(true);
  };

  const handleAuthGateGuest = () => {
    setShowAuthGate(false);
    const guestName = `Guest_${Math.floor(Math.random() * 9000 + 1000)}`;
    const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#ec4899', '#06b6d4'];
    const guestColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const guestProfile: UserProfile = {
      id: playerId,
      username: guestName,
      isGuest: true,
      avatarColor: guestColor,
      level: 1,
      xp: 0,
      wins: 0,
      matches: 0,
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem('chaos_arena_session', JSON.stringify(guestProfile));
    localStorage.setItem('displayName', guestName);
    localStorage.setItem('playerColor', guestColor);
    setCurrentUser(guestProfile);
    setDisplayName(guestName);
    setCharacterColor(guestColor);
    setTimeout(() => setShowMultiplayer(true), 300);
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      <Background nightMode={nightMode} />

      {activeRoom ? (
        <div className="relative z-10 flex-1">
          <header className="pt-8 text-center">
            <h1 className={`font-display text-4xl uppercase tracking-tighter ${nightMode ? 'text-indigo-300' : 'text-yellow-400'}`}>
              CHAOS ARENA
            </h1>
          </header>
          <GameArena
            room={activeRoom}
            nightMode={nightMode}
            setNightMode={setNightMode}
            onLeave={handleLeaveRoom}
          />
        </div>
      ) : (
        <>

          {/* Day/Night Toggle — fixed top-left */}
      <motion.button
        onClick={() => setNightMode(!nightMode)}
        className={`fixed top-4 left-4 z-50 w-14 h-14 border-4 flex items-center justify-center transition-colors duration-500 cursor-pointer pixel-corners ${nightMode
          ? 'bg-indigo-600 border-indigo-800 hover:bg-indigo-500'
          : 'bg-amber-400 border-amber-600 hover:bg-amber-300'
          }`}
        whileHover={{ scale: 1.1, rotate: 15 }}
        whileTap={{ scale: 0.9 }}
        title={nightMode ? 'Switch to Day' : 'Switch to Night'}
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

          {/* Day/Night label indicator */}
          <motion.div
            className={`fixed top-5 left-20 z-50 font-display text-[10px] uppercase tracking-widest px-3 py-1 border-2 transition-colors duration-500 ${nightMode
              ? 'bg-indigo-900/80 border-indigo-600 text-indigo-300'
              : 'bg-amber-100/80 border-amber-500 text-amber-800'
              }`}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {nightMode ? '🌙 Night' : '☀️ Day'}
          </motion.div>

          {/* ═══ Player Profile Badge (top-right) ═══ */}
          {currentUser && (
            <PlayerProfileBadge
              user={currentUser}
              nightMode={nightMode}
              onLogout={handleLogout}
              onEditProfile={() => setShowEditProfile(true)}
            />
          )}

          {/* Header / Logo */}
          <header className="relative z-10 pt-12 pb-6 text-center">
            <motion.h1
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className={`font-display text-6xl md:text-8xl drop-shadow-[4px_4px_0_rgba(0,0,0,1)] tracking-tighter transition-colors duration-700 ${nightMode ? 'text-indigo-300' : 'text-yellow-400'
                }`}
              style={{
                textShadow: nightMode
                  ? '4px 4px 0 #000, -2px -2px 0 #6366f1'
                  : '4px 4px 0 #000, -2px -2px 0 #ef4444'
              }}
            >
              CHAOS ARENA
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={`font-body text-2xl drop-shadow-md mt-2 transition-colors duration-700 ${nightMode ? 'text-slate-300' : 'text-white'
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
                  onClick={handlePlayAction}
                >
                  Start Game
                </PixelButton>

                <PixelButton
                  variant="secondary"
                  size="md"
                  className="w-64"
                  onClick={handlePlayAction}
                >
                  Multiplayer
                </PixelButton>

                <PixelButton
                  variant="accent"
                  size="md"
                  className="w-64"
                  onClick={() => setShowSettings(true)}
                >
                  Settings
                </PixelButton>

                {/* Sign In / Sign Up button if not logged in */}
                {!currentUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                  >
                    <PixelButton
                      variant="secondary"
                      size="sm"
                      className="w-64"
                      onClick={() => { setAuthInitialTab('signin'); setShowAuthScreen(true); }}
                    >
                      🔑 Sign In / Sign Up
                    </PixelButton>
                  </motion.div>
                )}
              </div>

              {/* Right: Player Stats */}
              <div className="flex justify-center lg:justify-start order-3">
                <PlayerStats nightMode={nightMode} />
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className={`relative z-10 p-4 text-center font-body text-lg transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-white/80'
            }`}>
            <p>v1.0.4-beta • Server Status: <span className="text-green-400">ONLINE</span></p>
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
          />
        )}
      </AnimatePresence>

      {/* ═══ Auth Gate Prompt ("You're not logged in!") ═══ */}
      <AnimatePresence>
        {showAuthGate && (
          <AuthGatePrompt
            nightMode={nightMode}
            onSignIn={handleAuthGateSignIn}
            onSignUp={handleAuthGateSignUp}
            onGuest={handleAuthGateGuest}
            onClose={() => setShowAuthGate(false)}
          />
        )}
      </AnimatePresence>

      {/* ═══ Full Auth Screen (Sign In / Sign Up) ═══ */}
      <AnimatePresence>
        {showAuthScreen && (
          <AuthScreen
            nightMode={nightMode}
            onAuth={handleAuthComplete}
            onClose={() => setShowAuthScreen(false)}
            initialTab={authInitialTab}
          />
        )}
      </AnimatePresence>

      {/* ═══ Cinematic "Entering Arena" Overlay ═══ */}
      <AnimatePresence>
        {isMatchmaking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
          >
            {/* Background Zooming Grid */}
            <motion.div 
              initial={{ scale: 1 }}
              animate={{ scale: 1.5 }}
              transition={{ duration: 4, ease: "easeOut" }}
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(${nightMode ? '#312e81' : '#047857'} 1px, transparent 1px), linear-gradient(90deg, ${nightMode ? '#312e81' : '#047857'} 1px, transparent 1px)`,
                backgroundSize: '40px 40px'
              }}
            />

            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1.5, opacity: 1, y: 0 }}
              transition={{ 
                duration: 1.5, 
                ease: [0.16, 1, 0.3, 1],
                delay: 0.2
              }}
              className="relative z-10 text-center"
            >
              {/* Character Unsheathing Sword */}
              <div className="mb-12 relative flex items-center justify-center">
                <motion.div
                  initial={{ rotate: -10 }}
                  animate={{ rotate: 0 }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                >
                  <PixelStickman 
                    color={currentUser?.color || '#3b82f6'} 
                    scale={1.8} 
                    weapon="sword"
                    swordState={isMatchmaking ? 'unsheathing' : 'idle'} 
                  />
                </motion.div>

                {/* Impact Flash behind character */}
                <motion.div 
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 2, 0], opacity: [0, 0.4, 0] }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  className="absolute inset-0 bg-white rounded-full blur-3xl"
                />
              </div>

              {/* Cinematic Text Overlay */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.8 }}
              >
                <h2 className={`font-display text-3xl md:text-5xl uppercase tracking-[0.4em] mb-2 ${nightMode ? 'text-indigo-300' : 'text-yellow-400'}`}
                    style={{ textShadow: '0 0 20px currentColor' }}>
                  Entering into Arena
                </h2>
                
                {/* Loading Status Bar */}
                <div className="w-64 h-1 bg-white/10 mx-auto mt-6 relative overflow-hidden">
                  <motion.div 
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className={`absolute inset-0 w-1/2 ${nightMode ? 'bg-indigo-500' : 'bg-yellow-400'}`}
                  />
                </div>
              </motion.div>
            </motion.div>

            {/* Final Warp Effect */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: 2.8, duration: 0.4 }}
              className="absolute inset-0 bg-white z-[110] pointer-events-none"
            />
          </motion.div>
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
              <div className="space-y-5 mt-4">

                {/* Edit Profile shortcut */}
                <button
                  onClick={() => { setShowSettings(false); setShowEditProfile(true); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 border-2 font-display text-xs uppercase transition-colors cursor-pointer ${nightMode
                    ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300 hover:bg-indigo-900/50'
                    : 'border-indigo-400 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    }`}
                >
                  <Pencil size={14} />
                  <span>Edit Profile</span>
                  <span className="ml-auto text-[9px] opacity-60">Name, Avatar</span>
                </button>

                {/* Audio */}
                <div className="space-y-2">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Volume2 size={14} /> Music & SFX
                  </label>
                  <div className="flex gap-3 items-center">
                    <span className={`font-body text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>🔇</span>
                    <input type="range" defaultValue={80} className={`flex-1 h-4 rounded-none appearance-none cursor-pointer ${nightMode ? 'accent-indigo-500 bg-slate-600' : 'accent-green-500 bg-slate-200'}`} />
                    <span className={`font-body text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>🔊</span>
                  </div>
                </div>

                {/* Theme toggle */}
                <div className="space-y-2">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {nightMode ? <Moon size={14} /> : <Sun size={14} />} Theme
                  </label>
                  <button
                    onClick={() => setNightMode(!nightMode)}
                    className={`w-full py-2 border-2 font-display text-xs uppercase transition-colors duration-300 cursor-pointer ${nightMode
                      ? 'border-amber-500 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50'
                      : 'border-indigo-500 bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      }`}
                  >
                    {nightMode ? '☀️ Switch to Day' : '🌙 Switch to Night'}
                  </button>
                </div>

                {/* FPS Counter toggle */}
                <div className="flex items-center justify-between">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Activity size={14} /> Show FPS Counter
                  </label>
                  <button
                    onClick={() => { setShowFps(!showFps); localStorage.setItem('showFps', String(!showFps)); }}
                    className={`w-12 h-6 border-2 relative transition-colors cursor-pointer ${showFps
                      ? (nightMode ? 'bg-indigo-600 border-indigo-400' : 'bg-green-500 border-green-600')
                      : (nightMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300')
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 transition-all ${showFps ? 'left-6' : 'left-0.5'} ${nightMode ? 'bg-white' : 'bg-white'}`} />
                  </button>
                </div>

                {/* Screen Shake toggle */}
                <div className="flex items-center justify-between">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Vibrate size={14} /> Screen Shake
                  </label>
                  <button
                    onClick={() => { setScreenShake(!screenShake); localStorage.setItem('screenShake', String(!screenShake)); }}
                    className={`w-12 h-6 border-2 relative transition-colors cursor-pointer ${screenShake
                      ? (nightMode ? 'bg-indigo-600 border-indigo-400' : 'bg-green-500 border-green-600')
                      : (nightMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-200 border-slate-300')
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 transition-all ${screenShake ? 'left-6' : 'left-0.5'} ${nightMode ? 'bg-white' : 'bg-white'}`} />
                  </button>
                </div>

                {/* Controls reference */}
                <div className="space-y-2">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Gamepad2 size={14} /> Controls
                  </label>
                  <div className={`grid grid-cols-2 gap-2 p-3 border-2 font-body text-xs ${nightMode
                    ? 'bg-slate-700/50 border-slate-600 text-slate-300'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <div>⬆️⬇️⬅️➡️ <span className="opacity-60">Move</span></div>
                    <div>SPACE <span className="opacity-60">Action</span></div>
                    <div>E <span className="opacity-60">Interact</span></div>
                    <div>ESC <span className="opacity-60">Pause</span></div>
                  </div>
                </div>

                <div className={`flex justify-end pt-4 border-t-2 transition-colors duration-700 ${nightMode ? 'border-slate-600' : 'border-slate-100'}`}>
                  <PixelButton variant="secondary" size="sm" onClick={() => setShowSettings(false)}>
                    Close
                  </PixelButton>
                </div>
              </div>
            </PixelCard>
          </motion.div>
        </div>
      )}

      {/* ═══ Edit Profile Modal ═══ */}
      <AnimatePresence>
        {showEditProfile && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ type: 'spring', bounce: 0.3 }}
              className="w-full max-w-md mx-4"
            >
              <PixelCard title="Edit Profile" className="" nightMode={nightMode}>
                <div className="space-y-5 mt-4">

                  {/* Avatar preview */}
                  <div className="flex flex-col items-center gap-3">
                    <motion.div
                      className="w-20 h-20 border-4 border-black/30 flex items-center justify-center relative"
                      style={{ backgroundColor: characterColor }}
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <div className="absolute top-3 left-3 w-3 h-3 bg-white" />
                      <div className="absolute top-3 right-3 w-3 h-3 bg-white" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-6 h-2 bg-black/40" />
                    </motion.div>
                    <p className={`font-display text-xs uppercase ${nightMode ? 'text-indigo-300' : 'text-indigo-600'}`}>
                      {currentUser?.isGuest ? '👻 Guest' : `⚔️ Level ${currentUser?.level || 1}`}
                    </p>
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <label className={`font-display text-xs uppercase flex items-center gap-2 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <User size={14} /> Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDisplayName(val);
                        if (currentUser) {
                          const updated = { ...currentUser, username: val };
                          setCurrentUser(updated);
                          localStorage.setItem('chaos_arena_session', JSON.stringify(updated));
                          localStorage.setItem('displayName', val);
                        }
                      }}
                      className={`w-full p-3 border-4 font-display text-sm outline-none transition-colors ${nightMode
                        ? 'bg-slate-700 border-slate-500 text-white focus:border-indigo-400'
                        : 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500'
                      }`}
                      maxLength={16}
                      placeholder="Enter your name..."
                    />
                  </div>

                  {/* Avatar Color */}
                  <div className="space-y-2">
                    <label className={`font-display text-xs uppercase flex items-center gap-2 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      <Zap size={14} /> Avatar Color
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {AVATAR_COLORS.map((c) => (
                        <motion.button
                          key={c}
                          onClick={() => {
                            setCharacterColor(c);
                            localStorage.setItem('playerColor', c);
                            if (currentUser) {
                              const updated = { ...currentUser, avatarColor: c };
                              setCurrentUser(updated);
                              localStorage.setItem('chaos_arena_session', JSON.stringify(updated));
                            }
                          }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.8 }}
                          className={`w-9 h-9 border-3 cursor-pointer transition-all ${characterColor === c
                            ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.5)] scale-110'
                            : nightMode
                              ? 'border-slate-600 hover:border-slate-400'
                              : 'border-slate-300 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: c }}
                        >
                          {characterColor === c && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-full h-full flex items-center justify-center"
                            >
                              <div className="w-2 h-2 bg-white" />
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Stats row */}
                  {currentUser && (
                    <div className={`grid grid-cols-3 gap-0 border-2 ${nightMode ? 'border-slate-600' : 'border-slate-200'}`}>
                      <div className={`p-2 text-center border-r-2 ${nightMode ? 'border-slate-600' : 'border-slate-200'}`}>
                        <p className={`font-display text-base ${nightMode ? 'text-yellow-400' : 'text-yellow-600'}`}>{currentUser.wins}</p>
                        <p className={`font-display text-[7px] uppercase ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>Wins</p>
                      </div>
                      <div className={`p-2 text-center border-r-2 ${nightMode ? 'border-slate-600' : 'border-slate-200'}`}>
                        <p className={`font-display text-base ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>{currentUser.matches}</p>
                        <p className={`font-display text-[7px] uppercase ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>Matches</p>
                      </div>
                      <div className="p-2 text-center">
                        <p className={`font-display text-base ${nightMode ? 'text-indigo-300' : 'text-indigo-600'}`}>{currentUser.level}</p>
                        <p className={`font-display text-[7px] uppercase ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>Level</p>
                      </div>
                    </div>
                  )}

                  {/* Save / Close */}
                  <div className={`flex gap-3 pt-4 border-t-2 ${nightMode ? 'border-slate-600' : 'border-slate-100'}`}>
                    <PixelButton variant="primary" size="md" className="flex-1 text-xs" onClick={() => setShowEditProfile(false)}>
                      ✓ Save Changes
                    </PixelButton>
                    <PixelButton variant="secondary" size="md" className="text-xs" onClick={() => setShowEditProfile(false)}>
                      Cancel
                    </PixelButton>
                  </div>
                </div>
              </PixelCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
