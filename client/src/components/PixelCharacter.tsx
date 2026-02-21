import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* Color palette — matches the splash screen stickmen */
const STICKMAN_COLORS = [
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
const PixelStickman: React.FC<{ color: string; scale?: number }> = ({ color, scale = 1 }) => {
  const s = (v: number) => `${v * scale}px`;
  return (
    <div
      className="relative"
      style={{
        width: s(48),
        height: s(80),
        imageRendering: 'pixelated',
      }}
    >
      {/* Head */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 0,
          width: s(20),
          height: s(20),
          backgroundColor: color,
          border: `${s(3)} solid #111`,
          boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25)`,
        }}
      >
        <div
          className="absolute"
          style={{
            top: s(5),
            left: s(3),
            width: s(4),
            height: s(4),
            backgroundColor: '#fff',
            boxShadow: `${s(6)} 0 0 0 #fff`,
          }}
        />
      </div>

      {/* Body */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: s(20),
          width: s(14),
          height: s(24),
          backgroundColor: color,
          border: `${s(3)} solid #111`,
          boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25)`,
        }}
      />

      {/* Left Arm */}
      <div
        className="absolute"
        style={{
          top: s(20),
          left: 0,
          width: s(8),
          height: s(18),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          boxShadow: `inset ${s(-2)} ${s(-2)} 0 0 rgba(0,0,0,0.2)`,
        }}
      />

      {/* Right Arm */}
      <div
        className="absolute"
        style={{
          top: s(20),
          right: 0,
          width: s(8),
          height: s(18),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          boxShadow: `inset ${s(-2)} ${s(-2)} 0 0 rgba(0,0,0,0.2)`,
        }}
      />

      {/* Left Leg */}
      <div
        className="absolute"
        style={{
          top: s(44),
          left: s(10),
          width: s(10),
          height: s(24),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          filter: 'brightness(0.85)',
        }}
      />

      {/* Right Leg */}
      <div
        className="absolute"
        style={{
          top: s(44),
          right: s(10),
          width: s(10),
          height: s(24),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          filter: 'brightness(0.85)',
        }}
      />

      {/* Feet */}
      <div
        className="absolute"
        style={{
          top: s(66),
          left: s(6),
          width: s(14),
          height: s(8),
          backgroundColor: '#222',
          border: `${s(2)} solid #000`,
        }}
      />
      <div
        className="absolute"
        style={{
          top: s(66),
          right: s(6),
          width: s(14),
          height: s(8),
          backgroundColor: '#222',
          border: `${s(2)} solid #000`,
        }}
      />
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
