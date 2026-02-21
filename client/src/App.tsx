import React from 'react';
import { Background } from './components/Background';
import { PixelButton } from './components/PixelButton';
import { PixelCharacter } from './components/PixelCharacter';
import { Lobby } from './components/Lobby';
import { motion } from 'motion/react';
import { Settings, Volume2, Monitor } from 'lucide-react';
import { PixelCard } from './components/PixelCard';

function App() {
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <div className="min-h-screen relative flex flex-col">
      <Background />

      {/* Header / Logo */}
      <header className="relative z-10 pt-12 pb-6 text-center">
        <motion.h1 
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="font-display text-6xl md:text-8xl text-yellow-400 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] tracking-tighter"
          style={{ textShadow: '4px 4px 0 #000, -2px -2px 0 #ef4444' }}
        >
          CHAOS ARENA
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="font-body text-2xl text-white drop-shadow-md mt-2"
        >
          BRAWL. PIXEL. WIN.
        </motion.p>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center h-full">
          
          {/* Left: Character */}
          <div className="flex justify-center lg:justify-end order-2 lg:order-1">
            <PixelCharacter />
          </div>

          {/* Center: Menu */}
          <div className="flex flex-col gap-6 items-center justify-center order-1 lg:order-2">
            <PixelButton size="lg" className="w-64 text-xl tracking-widest animate-pulse">
              Start Game
            </PixelButton>
            
            <PixelButton variant="secondary" size="md" className="w-64">
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
            
            <PixelButton variant="danger" size="md" className="w-64">
              Exit
            </PixelButton>
          </div>

          {/* Right: Lobby */}
          <div className="flex justify-center lg:justify-start order-3">
            <Lobby />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-4 text-center font-body text-white/80 text-lg">
        <p>v1.0.4-beta • Server Status: <span className="text-green-400">ONLINE</span></p>
      </footer>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md"
          >
            <PixelCard title="Settings" className="mx-4">
              <div className="space-y-6 mt-4">
                <div className="space-y-2">
                  <label className="font-display text-xs uppercase text-slate-500 flex items-center gap-2">
                    <Volume2 size={14} /> Audio
                  </label>
                  <input type="range" className="w-full accent-green-500 h-4 bg-slate-200 rounded-none appearance-none cursor-pointer" />
                </div>
                
                <div className="space-y-2">
                  <label className="font-display text-xs uppercase text-slate-500 flex items-center gap-2">
                    <Monitor size={14} /> Graphics
                  </label>
                  <div className="flex gap-2">
                     <button className="flex-1 py-2 border-2 border-green-500 bg-green-100 font-display text-xs text-green-700">High</button>
                     <button className="flex-1 py-2 border-2 border-slate-300 bg-white font-display text-xs text-slate-500 hover:border-slate-400">Med</button>
                     <button className="flex-1 py-2 border-2 border-slate-300 bg-white font-display text-xs text-slate-500 hover:border-slate-400">Low</button>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t-2 border-slate-100">
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
