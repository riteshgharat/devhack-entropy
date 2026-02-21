import React from 'react';
import { PixelCard } from './PixelCard';
import { User, Check, X, Crown, Shield } from 'lucide-react';

const players = [
  { id: 1, name: "PixelKing", status: "ready", avatar: "bg-red-400", isHost: true },
  { id: 2, name: "GlitchWitch", status: "ready", avatar: "bg-purple-400", isHost: false },
  { id: 3, name: "BitBrawler", status: "not-ready", avatar: "bg-green-400", isHost: false },
  { id: 4, name: "RetroRogue", status: "ready", avatar: "bg-blue-400", isHost: false },
];

interface LobbyProps {
  nightMode?: boolean;
}

export const Lobby = ({ nightMode = false }: LobbyProps) => {
  return (
    <PixelCard title="Lobby" className="w-full max-w-sm" nightMode={nightMode}>
      <div className="space-y-3 mt-2">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center gap-3 p-2 border-2 transition-colors duration-700 cursor-pointer group ${nightMode
                ? 'bg-slate-700 border-slate-600 hover:bg-slate-600'
                : 'bg-slate-100 border-slate-300 hover:bg-white'
              }`}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 ${player.avatar} border-2 border-black flex items-center justify-center relative`}>
              <User size={20} className="text-black/50" />
              {player.isHost && (
                <div className="absolute -top-2 -right-2 text-yellow-500 drop-shadow-sm">
                  <Crown size={14} fill="currentColor" />
                </div>
              )}
            </div>

            {/* Name */}
            <div className="flex-1">
              <div className={`font-display text-xs transition-colors duration-700 ${nightMode ? 'text-slate-200' : 'text-slate-800'
                }`}>{player.name}</div>
              <div className={`font-body text-sm leading-none transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-500'
                }`}>Lvl. {Math.floor(Math.random() * 50) + 1}</div>
            </div>

            {/* Status */}
            <div className={`
              px-2 py-1 border-2 text-[10px] font-display uppercase flex items-center gap-1
              ${player.status === 'ready'
                ? 'bg-green-100 border-green-500 text-green-700'
                : 'bg-red-100 border-red-500 text-red-700'}
            `}>
              {player.status === 'ready' ? <Check size={10} /> : <X size={10} />}
              {player.status === 'ready' ? 'RDY' : 'WAIT'}
            </div>
          </div>
        ))}

        {/* Empty Slot */}
        <div className={`flex items-center justify-center gap-2 p-3 border-2 border-dashed font-body text-lg transition-colors duration-700 cursor-pointer ${nightMode
            ? 'border-slate-600 text-slate-500 hover:bg-slate-700 hover:border-slate-500 hover:text-slate-400'
            : 'border-slate-300 text-slate-400 hover:bg-slate-50 hover:border-slate-400 hover:text-slate-500'
          }`}>
          <span>Waiting for players...</span>
        </div>
      </div>

      <div className={`mt-4 pt-4 border-t-2 flex justify-between items-center transition-colors duration-700 ${nightMode ? 'border-slate-600' : 'border-slate-200'
        }`}>
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className={`font-body transition-colors duration-700 ${nightMode ? 'text-slate-400' : 'text-slate-600'
            }`}>4/8 Players</span>
        </div>
        <div className={`font-display text-[10px] transition-colors duration-700 ${nightMode ? 'text-slate-500' : 'text-slate-400'
          }`}>Region: US-East</div>
      </div>
    </PixelCard>
  );
};
