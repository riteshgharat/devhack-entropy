import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PixelStickman, STICKMAN_COLORS } from "./PixelCharacter";

interface ArenaEntryScreenProps {
  characterColor?: string;
  onComplete: () => void;
}

export const ArenaEntryScreen: React.FC<ArenaEntryScreenProps> = ({
  characterColor,
  onComplete,
}) => {
  const color = characterColor || STICKMAN_COLORS[0].hex;
  const [phase, setPhase] = useState<"enter" | "hold" | "zoom" | "done">("enter");

  useEffect(() => {
    // Phase timeline: enter(0.8s) → hold(1.2s) → zoom(0.8s) → done
    const t1 = setTimeout(() => setPhase("hold"), 800);
    const t2 = setTimeout(() => setPhase("zoom"), 2000);
    const t3 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          className="fixed inset-0 z-100 flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a15 70%, #000 100%)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Animated grid lines background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Horizontal scanlines */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.02) 3px, rgba(255,255,255,0.02) 4px)",
              }}
            />
            {/* Radial glow behind character */}
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: 400,
                height: 400,
                background: `radial-gradient(circle, ${color}33 0%, transparent 70%)`,
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Ground sparks / particles */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: Math.random() * 4 + 2,
                  height: Math.random() * 4 + 2,
                  backgroundColor: i % 3 === 0 ? color : i % 3 === 1 ? "#fbbf24" : "#fff",
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  y: [0, -(Math.random() * 200 + 50)],
                  x: [0, (Math.random() - 0.5) * 100],
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                }}
                transition={{
                  duration: Math.random() * 2 + 1,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "easeOut",
                }}
              />
            ))}
          </div>

          {/* Character + text container — this zooms in during zoom phase */}
          <motion.div
            className="relative flex flex-col items-center z-10"
            initial={{ y: 300, opacity: 0, scale: 0.5 }}
            animate={
              phase === "enter"
                ? { y: 300, opacity: 0, scale: 0.5 }
                : phase === "hold"
                  ? { y: 0, opacity: 1, scale: 1 }
                  : { y: -40, opacity: 0, scale: 8 }
            }
            transition={
              phase === "hold"
                ? { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }
                : phase === "zoom"
                  ? { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
                  : { duration: 0 }
            }
          >
            {/* Character with idle bounce */}
            <motion.div
              animate={
                phase === "hold"
                  ? { y: [0, -12, 0], rotate: [0, -2, 0, 2, 0] }
                  : {}
              }
              transition={
                phase === "hold"
                  ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                  : {}
              }
            >
              <PixelStickman color={color} scale={3.5} weapon="sword" />
            </motion.div>

            {/* Ground shadow */}
            <motion.div
              className="rounded-full mt-2"
              style={{
                width: 160,
                height: 16,
                background: `radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)`,
              }}
              animate={
                phase === "hold"
                  ? { scaleX: [0.9, 1.1, 0.9], opacity: [0.3, 0.6, 0.3] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Text — separate from character so it doesn't zoom with it */}
          <motion.div
            className="relative z-10 mt-8 flex flex-col items-center"
            initial={{ opacity: 0, y: 40 }}
            animate={
              phase === "enter"
                ? { opacity: 0, y: 40 }
                : phase === "hold"
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: -20 }
            }
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* Main text */}
            <motion.h1
              className="font-display text-4xl md:text-5xl uppercase tracking-wider text-center"
              style={{
                color: "#fff",
                textShadow: `0 0 20px ${color}, 0 0 40px ${color}88, 0 2px 0 #000`,
              }}
              animate={
                phase === "hold"
                  ? { textShadow: [`0 0 20px ${color}, 0 0 40px ${color}88, 0 2px 0 #000`, `0 0 30px ${color}, 0 0 60px ${color}cc, 0 2px 0 #000`, `0 0 20px ${color}, 0 0 40px ${color}88, 0 2px 0 #000`] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Entering the Arena...!!
            </motion.h1>

            {/* Decorative underline */}
            <motion.div
              className="mt-3 h-1 rounded-full"
              style={{ backgroundColor: color }}
              initial={{ width: 0 }}
              animate={phase === "hold" ? { width: 200 } : { width: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            />

            {/* Sub-text dots animation */}
            <motion.p
              className="mt-4 font-display text-sm tracking-widest uppercase"
              style={{ color: `${color}aa` }}
              animate={
                phase === "hold"
                  ? { opacity: [0.4, 1, 0.4] }
                  : {}
              }
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              Prepare for battle
            </motion.p>
          </motion.div>

          {/* Top & bottom decorative bars */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            initial={{ scaleX: 0 }}
            animate={phase !== "enter" ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 h-1"
            style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
            initial={{ scaleX: 0 }}
            animate={phase !== "enter" ? { scaleX: 1 } : { scaleX: 0 }}
            transition={{ duration: 0.5 }}
          />

          {/* Corner decorations */}
          {["top-4 left-4", "top-4 right-4", "bottom-4 left-4", "bottom-4 right-4"].map((pos, i) => (
            <motion.div
              key={i}
              className={`absolute ${pos} w-6 h-6 border-2`}
              style={{
                borderColor: color,
                borderTopWidth: pos.includes("top") ? 2 : 0,
                borderBottomWidth: pos.includes("bottom") ? 2 : 0,
                borderLeftWidth: pos.includes("left") ? 2 : 0,
                borderRightWidth: pos.includes("right") ? 2 : 0,
              }}
              initial={{ opacity: 0 }}
              animate={phase !== "enter" ? { opacity: 0.6 } : { opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.3 + i * 0.1 }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
