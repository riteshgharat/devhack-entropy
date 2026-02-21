import React from 'react';
import { Background } from './components/Background';
import { PixelButton } from './components/PixelButton';
import { PixelCharacter } from './components/PixelCharacter';
import { PlayerStats } from './components/PlayerStats';
import { SplashScreen } from './components/SplashScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Volume2, Monitor, Sun, Moon } from 'lucide-react';
import { PixelCard } from './components/PixelCard';

function App() {
  const [showSettings, setShowSettings] = React.useState(false);
  const [showSplash, setShowSplash] = React.useState(true);
  const [nightMode, setNightMode] = React.useState(true); // default NIGHT
  const [showMultiplayer, setShowMultiplayer] = React.useState(false);
  const [characterColor, setCharacterColor] = React.useState('#ef4444');

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  return (
    <div className="min-h-screen relative flex flex-col">
      <Background nightMode={nightMode} />

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
            <PixelButton size="lg" className="w-64 text-xl tracking-widest animate-pulse">
              Start Game
            </PixelButton>

            <PixelButton
              variant="secondary"
              size="md"
              className="w-64"
              onClick={() => setShowMultiplayer(true)}
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

      {/* Multiplayer Lobby Modal */}
      <AnimatePresence>
        {showMultiplayer && (
          <MultiplayerLobby
            nightMode={nightMode}
            onClose={() => setShowMultiplayer(false)}
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
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    <Volume2 size={14} /> Audio
                  </label>
                  <input type="range" className={`w-full h-4 rounded-none appearance-none cursor-pointer ${nightMode ? 'accent-indigo-500 bg-slate-600' : 'accent-green-500 bg-slate-200'
                    }`} />
                </div>

                <div className="space-y-2">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    <Monitor size={14} /> Graphics
                  </label>
                  <div className="flex gap-2">
                    <button className={`flex-1 py-2 border-2 font-display text-xs ${nightMode
                        ? 'border-indigo-500 bg-indigo-900/50 text-indigo-300'
                        : 'border-green-500 bg-green-100 text-green-700'
                      }`}>High</button>
                    <button className={`flex-1 py-2 border-2 font-display text-xs ${nightMode
                        ? 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500'
                        : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
                      }`}>Med</button>
                    <button className={`flex-1 py-2 border-2 font-display text-xs ${nightMode
                        ? 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500'
                        : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400'
                      }`}>Low</button>
                  </div>
                </div>

                {/* Theme toggle inside settings */}
                <div className="space-y-2">
                  <label className={`font-display text-xs uppercase flex items-center gap-2 transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                    {nightMode ? <Moon size={14} /> : <Sun size={14} />} Theme
                  </label>
                  <button
                    onClick={() => setNightMode(!nightMode)}
                    className={`w-full py-2 border-2 font-display text-xs uppercase transition-colors duration-300 ${nightMode
                        ? 'border-amber-500 bg-amber-900/30 text-amber-300 hover:bg-amber-900/50'
                        : 'border-indigo-500 bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                      }`}
                  >
                    {nightMode ? '☀️ Switch to Day' : '🌙 Switch to Night'}
                  </button>
                </div>

                <div className={`flex justify-end pt-4 border-t-2 transition-colors duration-700 ${nightMode ? 'border-slate-600' : 'border-slate-100'
                  }`}>
                  <PixelButton variant="secondary" size="sm" onClick={() => setShowSettings(false)}>
                    Close
                  </PixelButton>
                </div>
              </div>
            </PixelCard>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default App;
