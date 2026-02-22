import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* Color palette — matches the splash screen stickmen */
export const STICKMAN_COLORS = [
  { name: 'Red', hex: '#ef4444' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Yellow', hex: '#eab308' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Cyan', hex: '#06b6d4' },
];

interface PixelCharacterProps {
  color?: string;
  onColorChange?: (color: string) => void;
}

/* ── Same PixelStickman as splash screen ── */
export interface StickmanProps {
    color: string;
    eyeColor?: string;
    scale?: number;
    weapon?: 'sword' | 'shield' | 'none';
    crown?: boolean;
    halfBody?: boolean;
    pointing?: 'left' | 'right' | 'none';
    swordState?: 'idle' | 'unsheathed' | 'unsheathing';
}

export const PixelStickman: React.FC<StickmanProps> = ({
    color,
    eyeColor = '#fff',
    scale = 1,
    weapon = 'none',
    crown = false,
    halfBody = false,
    pointing = 'none',
    swordState = 'idle',
}) => {
    const s = (v: number) => `${v * scale}px`;
    return (
        <div className="relative" style={{ width: s(56), height: s(90), imageRendering: 'pixelated' }}>
            {/* Crown for leader */}
            {crown && (
                <div className="absolute left-1/2 -translate-x-1/2" style={{ top: s(-10), zIndex: 20 }}>
                    <div style={{
                        width: s(24), height: s(10),
                        background: 'linear-gradient(180deg, #fbbf24 0%, #d97706 100%)',
                        border: `${s(2)} solid #92400e`,
                        clipPath: 'polygon(0% 100%, 0% 30%, 25% 0%, 50% 40%, 75% 0%, 100% 30%, 100% 100%)',
                    }} />
                </div>
            )}

            {/* Head */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{
                top: 0, width: s(22), height: s(22),
                backgroundColor: color,
                border: `${s(3)} solid #111`,
                boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25), inset ${s(2)} ${s(2)} 0 0 rgba(255,255,255,0.15)`,
            }}>
                {/* Eyes */}
                <div className="absolute" style={{
                    top: s(6), left: s(3), width: s(4), height: s(4),
                    backgroundColor: eyeColor,
                    boxShadow: `${s(7)} 0 0 0 ${eyeColor}`,
                }} />
                {/* Mouth grin */}
                <div className="absolute" style={{
                    bottom: s(3), left: s(4), width: s(14), height: s(2),
                    backgroundColor: '#111',
                    boxShadow: `${s(-4)} 0 0 0 #111, ${s(4)} 0 0 0 #111`,
                }} />
            </div>

            {/* Neck */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{
                top: s(22), width: s(8), height: s(4), backgroundColor: color,
            }} />

            {/* Body */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{
                top: s(26), width: s(16), height: s(26),
                backgroundColor: color,
                border: `${s(3)} solid #111`,
                boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25), inset ${s(2)} ${s(2)} 0 0 rgba(255,255,255,0.1)`,
            }}>
                {/* Belt */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: s(5), backgroundColor: 'rgba(0,0,0,0.4)',
                }} />
                {/* Belt buckle */}
                <div style={{
                    position: 'absolute', bottom: s(1), left: '50%',
                    transform: 'translateX(-50%)',
                    width: s(4), height: s(4), backgroundColor: '#fbbf24',
                    border: `${s(1)} solid #92400e`,
                }} />
            </div>

            {/* Left Arm */}
            <motion.div 
                className="absolute" 
                style={{
                    top: s(26), left: s(-2), width: s(9), height: s(20),
                    backgroundColor: color,
                    border: `${s(2)} solid #111`,
                    boxShadow: `inset ${s(-2)} ${s(-2)} 0 0 rgba(0,0,0,0.2)`,
                    transformOrigin: 'top center',
                }}
                animate={
                    pointing === 'left' ? { rotate: 90, x: -5 } : 
                    swordState === 'unsheathing' ? { rotate: 120 } : 
                    swordState === 'unsheathed' ? { rotate: 140 } : 
                    { rotate: 0, x: 0 }
                }
            />

            {/* Right Arm */}
            <motion.div 
                className="absolute" 
                style={{
                    top: s(26), right: s(-2), width: s(9), height: s(20),
                    backgroundColor: color,
                    border: `${s(2)} solid #111`,
                    boxShadow: `inset ${s(-2)} ${s(-2)} 0 0 rgba(0,0,0,0.2)`,
                    transformOrigin: 'top center',
                }}
                animate={
                    pointing === 'right' ? { rotate: -90, x: 5 } : 
                    swordState === 'unsheathing' ? { rotate: -40 } : 
                    swordState === 'unsheathed' ? { rotate: -60 } : 
                    { rotate: 0, x: 0 }
                }
            />

            {/* Weapon - Sword */}
            {weapon === 'sword' && (
                <motion.div 
                    className="absolute" 
                    style={{ 
                        top: s(18), 
                        right: s(-14), 
                        width: s(8), 
                        height: s(40), 
                        zIndex: 20,
                        transformOrigin: 'bottom center'
                    }}
                    animate={
                        swordState === 'unsheathing' ? { y: [-20, -40], opacity: [0, 1], rotate: [45, 0] } :
                        swordState === 'unsheathed' ? { y: -40, opacity: 1, scale: 1.2 } :
                        { y: 0, opacity: 0, rotate: 45 }
                    }
                >
                    {/* Blade */}
                    <div style={{
                        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                        width: s(4), height: s(28),
                        background: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 50%, #64748b 100%)',
                        border: `${s(1)} solid #334155`,
                        clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0 100%)',
                    }} />
                    {/* Guard */}
                    <div style={{
                        position: 'absolute', top: s(26), left: 0,
                        width: s(8), height: s(4),
                        backgroundColor: '#d97706',
                        border: `${s(1)} solid #92400e`,
                    }} />
                    {/* Handle */}
                    <div style={{
                        position: 'absolute', top: s(30), left: '50%', transform: 'translateX(-50%)',
                        width: s(3), height: s(10),
                        backgroundColor: '#92400e',
                        border: `${s(1)} solid #451a03`,
                    }} />
                </motion.div>
            )}

            {/* Weapon - Shield */}
            {weapon === 'shield' && (
                <div className="absolute" style={{ top: s(22), left: s(-20), width: s(18), height: s(22), zIndex: 20 }}>
                    <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        border: `${s(3)} solid #1e3a8a`,
                        clipPath: 'polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{ width: s(6), height: s(6), backgroundColor: '#fbbf24', border: `${s(1)} solid #92400e` }} />
                    </div>
                </div>
            )}

            {/* Legs - Only if not half-body */}
            {!halfBody && (
                <>
                    {/* Left Leg */}
                    <div className="absolute" style={{
                        top: s(52), left: s(11), width: s(11), height: s(26),
                        backgroundColor: color,
                        border: `${s(2)} solid #111`,
                        filter: 'brightness(0.8)',
                    }} />

                    {/* Right Leg */}
                    <div className="absolute" style={{
                        top: s(52), right: s(11), width: s(11), height: s(26),
                        backgroundColor: color,
                        border: `${s(2)} solid #111`,
                        filter: 'brightness(0.8)',
                    }} />

                    {/* Boots */}
                    <div className="absolute" style={{
                        top: s(76), left: s(7), width: s(16), height: s(9),
                        backgroundColor: '#1c1917',
                        border: `${s(2)} solid #000`,
                        boxShadow: `inset ${s(2)} 0 0 0 rgba(255,255,255,0.1)`,
                    }} />
                    <div className="absolute" style={{
                        top: s(76), right: s(7), width: s(16), height: s(9),
                        backgroundColor: '#1c1917',
                        border: `${s(2)} solid #000`,
                        boxShadow: `inset ${s(2)} 0 0 0 rgba(255,255,255,0.1)`,
                    }} />
                </>
            )}
        </div>
    );
};

export const PixelCharacter: React.FC<PixelCharacterProps> = ({
  color: externalColor,
  onColorChange,
}) => {
  const [colorIndex, setColorIndex] = useState(0);
  const [showPalette, setShowPalette] = useState(false);

  const currentColor = externalColor || STICKMAN_COLORS[colorIndex].hex;
  const currentName =
    STICKMAN_COLORS.find((c) => c.hex === currentColor)?.name || 'Custom';

  const cycleColor = () => {
    const nextIndex = (colorIndex + 1) % STICKMAN_COLORS.length;
    setColorIndex(nextIndex);
    onColorChange?.(STICKMAN_COLORS[nextIndex].hex);
    setShowPalette(true);
    // Hide palette after 2.5s
    setTimeout(() => setShowPalette(false), 2500);
  };

  return (
    <div className="relative w-80 h-96 flex items-center justify-center">
      {/* Clickable character */}
      <motion.div
        className="cursor-pointer relative"
        onClick={cycleColor}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92, rotate: -5 }}
      >
        {/* Idle bounce animation */}
        <motion.div
          animate={{ y: [0, -10, 0] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <PixelStickman color={currentColor} scale={2.8} />
        </motion.div>

        {/* Color glow under feet */}
        <motion.div
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: '110px',
            height: '18px',
            backgroundColor: currentColor,
            opacity: 0.3,
            filter: 'blur(10px)',
          }}
          animate={{ opacity: [0.2, 0.5, 0.2], scale: [0.9, 1.1, 0.9] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Shadow */}
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black/25 rounded-full blur-sm" />
      </motion.div>

      {/* Speech bubble */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute -top-2 -right-2 z-10"
      >
        <motion.div
          className="bg-white border-3 p-2.5 px-3 relative"
          style={{ borderColor: currentColor, borderWidth: '3px' }}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <p className="font-display text-[9px] text-black whitespace-nowrap">
            🎨 TAP TO
          </p>
          <p className="font-display text-[9px] whitespace-nowrap" style={{ color: currentColor }}>
            RECOLOR!
          </p>
          <div
            className="absolute bottom-0 left-3 w-3 h-3 bg-white -translate-x-1/2 translate-y-1/2 rotate-45"
            style={{ borderRight: `3px solid ${currentColor}`, borderBottom: `3px solid ${currentColor}` }}
          />
        </motion.div>
      </motion.div>

      {/* Color name popup */}
      <AnimatePresence>
        {showPalette && (
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0, scale: 0.8 }}
            className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-4 py-1 border-2 border-black z-20"
            style={{ backgroundColor: currentColor }}
          >
            <p className="font-display text-[10px] text-white whitespace-nowrap"
              style={{ textShadow: '1px 1px 0 #000' }}
            >
              {currentName.toUpperCase()}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Small color dots row indicating available colors */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex gap-1.5">
        {STICKMAN_COLORS.map((c, i) => (
          <motion.div
            key={c.hex}
            className="border border-black/40 cursor-pointer"
            style={{
              width: '10px',
              height: '10px',
              backgroundColor: c.hex,
              opacity: c.hex === currentColor ? 1 : 0.4,
              boxShadow: c.hex === currentColor ? `0 0 6px ${c.hex}` : 'none',
            }}
            whileHover={{ scale: 1.5 }}
            onClick={(e) => {
              e.stopPropagation();
              setColorIndex(i);
              onColorChange?.(c.hex);
              setShowPalette(true);
              setTimeout(() => setShowPalette(false), 2500);
            }}
          />
        ))}
      </div>
    </div>
  );
};
