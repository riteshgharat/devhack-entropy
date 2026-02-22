import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

/* ── Pixel Stickman (enhanced with weapon/accessory) ── */
interface StickmanProps {
  color: string;
  eyeColor?: string;
  scale?: number;
  weapon?: "sword" | "shield" | "none";
  crown?: boolean;
}

const PixelStickman: React.FC<StickmanProps> = ({
  color,
  eyeColor = "#fff",
  scale = 1,
  weapon = "none",
  crown = false,
}) => {
  const s = (v: number) => `${v * scale}px`;
  return (
    <div
      className="relative"
      style={{ width: s(56), height: s(90), imageRendering: "pixelated" }}
    >
      {/* Crown for leader */}
      {crown && (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ top: s(-10), zIndex: 20 }}
        >
          <div
            style={{
              width: s(24),
              height: s(10),
              background: "linear-gradient(180deg, #fbbf24 0%, #d97706 100%)",
              border: `${s(2)} solid #92400e`,
              clipPath:
                "polygon(0% 100%, 0% 30%, 25% 0%, 50% 40%, 75% 0%, 100% 30%, 100% 100%)",
            }}
          />
        </div>
      )}

      {/* Head */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 0,
          width: s(22),
          height: s(22),
          backgroundColor: color,
          border: `${s(3)} solid #111`,
          boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25), inset ${s(2)} ${s(2)} 0 0 rgba(255,255,255,0.15)`,
        }}
      >
        {/* Eyes */}
        <div
          className="absolute"
          style={{
            top: s(6),
            left: s(3),
            width: s(4),
            height: s(4),
            backgroundColor: eyeColor,
            boxShadow: `${s(7)} 0 0 0 ${eyeColor}`,
          }}
        />
        {/* Mouth grin */}
        <div
          className="absolute"
          style={{
            bottom: s(3),
            left: s(4),
            width: s(14),
            height: s(2),
            backgroundColor: "#111",
            boxShadow: `${s(-4)} 0 0 0 #111, ${s(4)} 0 0 0 #111`,
          }}
        />
      </div>

      {/* Neck */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: s(22),
          width: s(8),
          height: s(4),
          backgroundColor: color,
        }}
      />

      {/* Body */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: s(26),
          width: s(16),
          height: s(26),
          backgroundColor: color,
          border: `${s(3)} solid #111`,
          boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25), inset ${s(2)} ${s(2)} 0 0 rgba(255,255,255,0.1)`,
        }}
      >
        {/* Belt */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: s(5),
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        />
        {/* Belt buckle */}
        <div
          style={{
            position: "absolute",
            bottom: s(1),
            left: "50%",
            transform: "translateX(-50%)",
            width: s(4),
            height: s(4),
            backgroundColor: "#fbbf24",
            border: `${s(1)} solid #92400e`,
          }}
        />
      </div>

      {/* Left Arm */}
      <div
        className="absolute"
        style={{
          top: s(26),
          left: s(-2),
          width: s(9),
          height: s(20),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          boxShadow: `inset ${s(-2)} ${s(-2)} 0 0 rgba(0,0,0,0.2)`,
          transformOrigin: "top center",
        }}
      />

      {/* Right Arm */}
      <div
        className="absolute"
        style={{
          top: s(26),
          right: s(-2),
          width: s(9),
          height: s(20),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          boxShadow: `inset ${s(-2)} ${s(-2)} 0 0 rgba(0,0,0,0.2)`,
        }}
      />

      {/* Weapon - Sword */}
      {weapon === "sword" && (
        <div
          className="absolute"
          style={{
            top: s(18),
            right: s(-14),
            width: s(8),
            height: s(40),
            zIndex: 20,
          }}
        >
          {/* Blade */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "50%",
              transform: "translateX(-50%)",
              width: s(4),
              height: s(28),
              background:
                "linear-gradient(180deg, #e2e8f0 0%, #94a3b8 50%, #64748b 100%)",
              border: `${s(1)} solid #334155`,
              clipPath: "polygon(20% 0, 80% 0, 100% 100%, 0 100%)",
            }}
          />
          {/* Guard */}
          <div
            style={{
              position: "absolute",
              top: s(26),
              left: 0,
              width: s(8),
              height: s(4),
              backgroundColor: "#d97706",
              border: `${s(1)} solid #92400e`,
            }}
          />
          {/* Handle */}
          <div
            style={{
              position: "absolute",
              top: s(30),
              left: "50%",
              transform: "translateX(-50%)",
              width: s(3),
              height: s(10),
              backgroundColor: "#92400e",
              border: `${s(1)} solid #451a03`,
            }}
          />
        </div>
      )}

      {/* Weapon - Shield */}
      {weapon === "shield" && (
        <div
          className="absolute"
          style={{
            top: s(22),
            left: s(-20),
            width: s(18),
            height: s(22),
            zIndex: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              border: `${s(3)} solid #1e3a8a`,
              clipPath: "polygon(0 0, 100% 0, 100% 65%, 50% 100%, 0 65%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: s(6),
                height: s(6),
                backgroundColor: "#fbbf24",
                border: `${s(1)} solid #92400e`,
              }}
            />
          </div>
        </div>
      )}

      {/* Left Leg */}
      <div
        className="absolute"
        style={{
          top: s(52),
          left: s(11),
          width: s(11),
          height: s(26),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          filter: "brightness(0.8)",
        }}
      />

      {/* Right Leg */}
      <div
        className="absolute"
        style={{
          top: s(52),
          right: s(11),
          width: s(11),
          height: s(26),
          backgroundColor: color,
          border: `${s(2)} solid #111`,
          filter: "brightness(0.8)",
        }}
      />

      {/* Boots */}
      <div
        className="absolute"
        style={{
          top: s(76),
          left: s(7),
          width: s(16),
          height: s(9),
          backgroundColor: "#1c1917",
          border: `${s(2)} solid #000`,
          boxShadow: `inset ${s(2)} 0 0 0 rgba(255,255,255,0.1)`,
        }}
      />
      <div
        className="absolute"
        style={{
          top: s(76),
          right: s(7),
          width: s(16),
          height: s(9),
          backgroundColor: "#1c1917",
          border: `${s(2)} solid #000`,
          boxShadow: `inset ${s(2)} 0 0 0 rgba(255,255,255,0.1)`,
        }}
      />
    </div>
  );
};

/* ── CRT Scanlines ── */
const ScanLines = () => (
  <div
    className="fixed inset-0 pointer-events-none z-100"
    style={{
      background:
        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.06) 2px, rgba(0,0,0,0.06) 4px)",
      animation: "crt-flicker 8s infinite",
    }}
  />
);

/* ── Pixel particles ── */
const PixelParticles = () => {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 4,
    duration: 2.5 + Math.random() * 5,
    size: 2 + Math.floor(Math.random() * 3) * 2,
    color: ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316"][
      Math.floor(Math.random() * 6)
    ],
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-5">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            bottom: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            imageRendering: "pixelated",
          }}
          animate={{
            y: [0, -window.innerHeight - 50],
            opacity: [0, 1, 1, 0],
            rotate: [0, Math.random() > 0.5 ? 90 : -90],
          }}
          transition={{
            delay: p.delay,
            duration: p.duration,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
};

/* ── Lightning bolt effect ── */
const LightningBolt: React.FC<{ x: number; delay: number }> = ({
  x,
  delay,
}) => (
  <motion.div
    className="absolute pointer-events-none z-8"
    style={{
      left: `${x}%`,
      top: 0,
      width: "3px",
      height: "100vh",
      background: "linear-gradient(180deg, transparent, #fbbf24, transparent)",
      filter: "blur(2px)",
    }}
    initial={{ opacity: 0, scaleY: 0 }}
    animate={{ opacity: [0, 1, 0], scaleY: [0, 1, 1] }}
    transition={{
      delay,
      duration: 0.3,
      repeat: Infinity,
      repeatDelay: 4 + Math.random() * 3,
    }}
  />
);

/* ── Star field background ── */
const StarField = () => {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() > 0.8 ? 3 : 2,
    blink: Math.random() * 3,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-1">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          style={{
            position: "absolute",
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            backgroundColor: "#fff",
            imageRendering: "pixelated",
          }}
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 2 + star.blink,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

/* ── Pixel Fire effect at base ── */
const PixelFire: React.FC<{ color: string; x: number }> = ({ color, x }) => {
  const flames = Array.from({ length: 6 }, (_, i) => i);
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: `${x}%`, bottom: 0, zIndex: 15 }}
    >
      {flames.map((i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            left: i * 5 - 15,
            bottom: 0,
            width: 4,
            height: 12,
            backgroundColor: i % 2 === 0 ? color : "#fbbf24",
            imageRendering: "pixelated",
          }}
          animate={{
            scaleY: [1, 1.5, 0.8, 1.3, 1],
            opacity: [1, 0.8, 1, 0.6, 1],
          }}
          transition={{
            duration: 0.3 + i * 0.05,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
};

/* ── Combo counter popup ── */
const ComboText: React.FC<{ text: string; show: boolean }> = ({
  text,
  show,
}) => (
  <AnimatePresence>
    {show && (
      <motion.div
        className="absolute z-50 left-1/2 -translate-x-1/2"
        style={{
          top: "30%",
          fontFamily: '"Press Start 2P", system-ui',
          fontSize: "14px",
          color: "#fbbf24",
          textShadow: "3px 3px 0 #000, -1px -1px 0 #ef4444",
          whiteSpace: "nowrap",
        }}
        initial={{ y: 0, opacity: 0, scale: 0.5 }}
        animate={{ y: -60, opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1.1, 1] }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
      >
        {text}
      </motion.div>
    )}
  </AnimatePresence>
);

/* ── Main Splash Screen ── */
interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState(0);
  const [shakeKeyChars, setShakeKeyChars] = useState(0);
  const [shakeKeyTitle, setShakeKeyTitle] = useState(0);
  const [comboText, setComboText] = useState("");
  const [showCombo, setShowCombo] = useState(false);
  const memoizedOnComplete = useCallback(onComplete, []);

  const triggerCombo = (text: string) => {
    setComboText(text);
    setShowCombo(true);
    setTimeout(() => setShowCombo(false), 1600);
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        setPhase(1);
        setShakeKeyChars((k) => k + 1);
      }, 800),
    );
    timers.push(
      setTimeout(() => {
        setPhase(2);
        triggerCombo("ALL FIGHTERS READY!");
      }, 2600),
    );
    timers.push(
      setTimeout(() => {
        setPhase(3);
        setShakeKeyTitle((k) => k + 1);
      }, 5000),
    );
    timers.push(setTimeout(() => setPhase(4), 7500));
    timers.push(setTimeout(() => memoizedOnComplete(), 8800));
    return () => timers.forEach(clearTimeout);
  }, [memoizedOnComplete]);

  return (
    <AnimatePresence>
      {phase < 5 && (
        <motion.div
          className="fixed inset-0 z-999 overflow-hidden"
          style={{ backgroundColor: "#050508" }}
          animate={
            phase >= 4
              ? {
                  scale: 2.5,
                  opacity: 0,
                  filter: "blur(12px)",
                  backgroundColor: "#050508",
                }
              : { scale: 1, opacity: 1, filter: "blur(0px)" }
          }
          transition={
            phase >= 4
              ? { duration: 1.3, ease: [0.76, 0, 0.24, 1] }
              : { duration: 0.3 }
          }
        >
          <ScanLines />
          <StarField />
          {phase >= 1 && <LightningBolt x={15} delay={2} />}
          {phase >= 1 && <LightningBolt x={78} delay={5} />}
          {phase >= 2 && <PixelParticles />}

          {/* Ambient glow top */}
          <div
            className="fixed inset-0 pointer-events-none z-2"
            style={{
              background:
                phase >= 3
                  ? "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(239,68,68,0.15) 0%, transparent 70%)"
                  : "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.85) 100%)",
              transition: "background 1s ease",
            }}
          />

          {/* Vignette */}
          <div
            className="fixed inset-0 pointer-events-none z-2"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)",
            }}
          />

          <ComboText text={comboText} show={showCombo} />

          {/* ══ CHARACTER shake wrapper — only shakes on red slam (phase 1) ══ */}
          <motion.div
            key={shakeKeyChars}
            className="fixed inset-0"
            animate={{
              x: [0, -14, 12, -8, 6, -3, 0],
              y: [0, 8, -12, 6, -4, 1, 0],
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* ═══ BACKGROUND GRID ═══ */}
            <div
              className="fixed inset-0 z-1 pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />

            {/* ═══ CHARACTERS ═══ */}
            <div
              className="absolute z-10 w-full flex items-end justify-center"
              style={{ bottom: "12%" }}
            >
              {/* Ground platform */}
              <motion.div
                className="absolute bottom-0 left-[5%] right-[5%] z-1"
                style={{
                  height: "6px",
                  backgroundColor: "#1e293b",
                  boxShadow: "0 4px 0 #0f172a, 0 8px 0 #0a0f1a",
                }}
                initial={{ scaleX: 0 }}
                animate={phase >= 1 ? { scaleX: 1 } : {}}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
              {/* Ground tiles */}
              {phase >= 1 && (
                <div
                  className="absolute bottom-0 left-[5%] right-[5%] z-1"
                  style={{ height: "6px", display: "flex", overflow: "hidden" }}
                >
                  {Array.from({ length: 30 }, (_, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        borderRight: "1px solid rgba(255,255,255,0.05)",
                        height: "100%",
                      }}
                    />
                  ))}
                </div>
              )}

              {/* Fire effects under arena */}
              {phase >= 2 && <PixelFire color="#ef4444" x={50} />}
              {phase >= 2 && <PixelFire color="#3b82f6" x={20} />}
              {phase >= 2 && <PixelFire color="#22c55e" x={80} />}

              {/* ── RED (HERO) — drops from top ── */}
              <AnimatePresence>
                {phase >= 1 && (
                  <motion.div
                    style={{ zIndex: 10, marginBottom: "6px" }}
                    initial={{ y: -700, opacity: 0, scale: 2 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {/* Impact shockwave */}
                    <motion.div
                      className="absolute -bottom-3 left-1/2 -translate-x-1/2"
                      style={{
                        width: "100px",
                        height: "12px",
                        borderRadius: "50%",
                        border: "3px solid #ef4444",
                        backgroundColor: "transparent",
                      }}
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 3, opacity: 0 }}
                      transition={{ duration: 0.8, delay: 0.5 }}
                    />
                    {/* Glow under */}
                    <motion.div
                      className="absolute -bottom-4 left-1/2 -translate-x-1/2"
                      style={{
                        width: "80px",
                        height: "16px",
                        borderRadius: "50%",
                        backgroundColor: "#ef4444",
                        filter: "blur(8px)",
                        opacity: 0.5,
                      }}
                      animate={{ opacity: [0.5, 0.2, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{
                        delay: 0.6,
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <PixelStickman
                        color="#ef4444"
                        scale={2}
                        crown={true}
                        weapon="sword"
                      />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── BLUE — charges from left ── */}
              {phase >= 2 && (
                <motion.div
                  className="absolute"
                  style={{ zIndex: 5, marginBottom: "6px" }}
                  initial={{ x: -500, y: 0, opacity: 0 }}
                  animate={{ x: -150, y: 0, opacity: 1 }}
                  transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
                >
                  <motion.div
                    style={{
                      width: "60px",
                      height: "8px",
                      backgroundColor: "#3b82f6",
                      opacity: 0.3,
                      filter: "blur(4px)",
                      position: "absolute",
                      left: -60,
                      top: "60%",
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                  />
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      delay: 0.8,
                      duration: 1.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <PixelStickman
                      color="#3b82f6"
                      scale={1.5}
                      weapon="shield"
                    />
                  </motion.div>
                </motion.div>
              )}

              {/* ── GREEN — drops from top right ── */}
              {phase >= 2 && (
                <motion.div
                  className="absolute"
                  style={{ zIndex: 5, marginBottom: "6px" }}
                  initial={{ x: 500, y: -400, opacity: 0, rotate: 15 }}
                  animate={{ x: 150, y: 0, opacity: 1, rotate: 0 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.15,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      delay: 1.0,
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <PixelStickman color="#22c55e" scale={1.5} />
                  </motion.div>
                </motion.div>
              )}

              {/* ── YELLOW — slides from left far ── */}
              {phase >= 2 && (
                <motion.div
                  className="absolute"
                  style={{ zIndex: 4, marginBottom: "6px" }}
                  initial={{ x: -600, opacity: 0, scale: 0.5 }}
                  animate={{ x: -290, opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.35,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      delay: 1.2,
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <PixelStickman color="#eab308" scale={1.25} />
                  </motion.div>
                </motion.div>
              )}

              {/* ── PURPLE — slides from right far ── */}
              {phase >= 2 && (
                <motion.div
                  className="absolute"
                  style={{ zIndex: 4, marginBottom: "6px" }}
                  initial={{ x: 600, opacity: 0, scale: 0.5 }}
                  animate={{ x: 290, opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.5,
                    ease: [0.34, 1.56, 0.64, 1],
                  }}
                >
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      delay: 1.3,
                      duration: 1.3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <PixelStickman color="#a855f7" scale={1.25} />
                  </motion.div>
                </motion.div>
              )}
            </div>

            {/* ═══ IMPACT FLASH when red slams ═══ */}
            {phase === 1 && (
              <motion.div
                className="fixed inset-0 z-30 pointer-events-none"
                style={{ backgroundColor: "#ef4444" }}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
              />
            )}

            {/* Red bottom glow */}
            {phase >= 1 && (
              <motion.div
                className="fixed bottom-0 left-0 right-0 pointer-events-none z-3"
                style={{
                  height: "40%",
                  background:
                    "linear-gradient(to top, rgba(239,68,68,0.12) 0%, transparent 100%)",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
              />
            )}
          </motion.div>
          {/* ← end character shake wrapper */}

          {/* ══ TITLE shake wrapper — only shakes on title slam (phase 3) ══ */}
          <motion.div
            key={`title-${shakeKeyTitle}`}
            className="fixed inset-0 pointer-events-none"
            animate={{
              x: [0, -14, 12, -8, 6, -3, 0],
              y: [0, 8, -12, 6, -4, 1, 0],
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            {/* ═══ TITLE ═══ */}
            <AnimatePresence>
              {phase >= 3 && (
                <motion.div
                  className="absolute z-20 w-full flex flex-col items-center pointer-events-auto"
                  style={{ top: "5%" }}
                  initial={{ y: -900, opacity: 0, scale: 4, rotate: -8 }}
                  animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Top ornament bar */}
                  <motion.div
                    className="flex items-center gap-3 mb-3"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.4, duration: 0.4 }}
                  >
                    <div
                      style={{
                        width: "60px",
                        height: "4px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#fbbf24",
                        transform: "rotate(45deg)",
                      }}
                    />
                    <div
                      style={{
                        width: "120px",
                        height: "4px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#fbbf24",
                        transform: "rotate(45deg)",
                      }}
                    />
                    <div
                      style={{
                        width: "60px",
                        height: "4px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                  </motion.div>

                  {/* Main title */}
                  <h1
                    style={{
                      fontFamily: '"Press Start 2P", system-ui',
                      fontSize: "clamp(2.5rem, 9vw, 6.5rem)",
                      color: "#facc15",
                      textShadow:
                        "6px 6px 0 #000, -4px -4px 0 #ef4444, 10px 10px 20px rgba(0,0,0,0.5)",
                      letterSpacing: "-0.03em",
                      lineHeight: 1.1,
                      textAlign: "center",
                    }}
                  >
                    CHAOS
                    <br />
                    <motion.span
                      style={{
                        color: "#ef4444",
                        textShadow: "6px 6px 0 #000, -4px -4px 0 #facc15",
                      }}
                      animate={{
                        textShadow: [
                          "6px 6px 0 #000, -4px -4px 0 #facc15",
                          "6px 6px 0 #000, -4px -4px 0 #a855f7",
                          "6px 6px 0 #000, -4px -4px 0 #facc15",
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      ARENA
                    </motion.span>
                  </h1>

                  {/* Bottom ornament bar */}
                  <motion.div
                    className="flex items-center gap-3 mt-3"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  >
                    <div
                      style={{
                        width: "60px",
                        height: "4px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#fbbf24",
                        transform: "rotate(45deg)",
                      }}
                    />
                    <div
                      style={{
                        width: "120px",
                        height: "4px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        backgroundColor: "#fbbf24",
                        transform: "rotate(45deg)",
                      }}
                    />
                    <div
                      style={{
                        width: "60px",
                        height: "4px",
                        backgroundColor: "#ef4444",
                      }}
                    />
                  </motion.div>

                  {/* Subtitle */}
                  <motion.p
                    style={{
                      fontFamily: '"Press Start 2P"',
                      fontSize: "clamp(0.5rem, 1.5vw, 0.9rem)",
                      color: "rgba(255,255,255,0.6)",
                      letterSpacing: "0.35em",
                      marginTop: "12px",
                    }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                  >
                    BRAWL · PIXEL · WIN
                  </motion.p>

                  {/* Entering arena text */}
                  <motion.div
                    style={{
                      marginTop: "18px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1 }}
                  >
                    <span
                      style={{
                        fontFamily: '"Press Start 2P"',
                        fontSize: "clamp(0.55rem, 1.4vw, 0.85rem)",
                        color: "rgba(220,220,230,0.85)",
                        letterSpacing: "0.12em",
                      }}
                    >
                      Entering in arena..
                    </span>
                    <motion.span
                      style={{
                        display: "inline-block",
                        width: "10px",
                        height: "10px",
                        backgroundColor: "rgba(220,220,230,0.85)",
                      }}
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* White flash when title slams */}
            {phase === 3 && (
              <motion.div
                className="fixed inset-0 z-30 pointer-events-none"
                style={{ backgroundColor: "#ffffff" }}
                initial={{ opacity: 0.9 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              />
            )}
          </motion.div>
          {/* ← end title shake wrapper */}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
