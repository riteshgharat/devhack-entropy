import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

/* ── Pixel Stickman (pure CSS divs) ── */
interface StickmanProps {
    color: string;
    eyeColor?: string;
    scale?: number;
}

const PixelStickman: React.FC<StickmanProps> = ({ color, eyeColor = '#fff', scale = 1 }) => {
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
                        backgroundColor: eyeColor,
                        boxShadow: `${s(6)} 0 0 0 ${eyeColor}`,
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

/* ── Scanline overlay ── */
const ScanLines = () => (
    <div
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
            background:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        }}
    />
);

/* ── Pixel particle squares ── */
const PixelParticles = () => {
    const particles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 4,
        size: 2 + Math.random() * 4,
        color: ['#ef4444', '#3b82f6', '#22c55e', '#eab308'][Math.floor(Math.random() * 4)],
    }));

    return (
        <div className="fixed inset-0 pointer-events-none z-[5]">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute"
                    style={{
                        left: `${p.x}%`,
                        bottom: '-10px',
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        backgroundColor: p.color,
                        imageRendering: 'pixelated',
                    }}
                    animate={{
                        y: [0, -window.innerHeight - 50],
                        opacity: [0, 1, 1, 0],
                    }}
                    transition={{
                        delay: p.delay,
                        duration: p.duration,
                        repeat: Infinity,
                        ease: 'linear',
                    }}
                />
            ))}
        </div>
    );
};

/* ── (ScreenShake removed — shake now wraps all content directly) ── */

/* ── Main Splash Screen ── */
interface SplashScreenProps {
    onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
    const [phase, setPhase] = useState(0);
    const [shakeKey, setShakeKey] = useState(0);
    // 0 = black
    // 1 = red SLAMS in (shake!)
    // 2 = others emerge & line up
    // 3 = title SLAMS in (shake!)
    // 4 = zoom transition out

    const memoizedOnComplete = useCallback(onComplete, []);

    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];

        timers.push(setTimeout(() => { setPhase(1); setShakeKey(k => k + 1); }, 800));
        timers.push(setTimeout(() => setPhase(2), 2500));
        timers.push(setTimeout(() => { setPhase(3); setShakeKey(k => k + 1); }, 4800));
        timers.push(setTimeout(() => setPhase(4), 7200));
        timers.push(setTimeout(() => memoizedOnComplete(), 8400));

        return () => timers.forEach(clearTimeout);
    }, [memoizedOnComplete]);

    return (
        <AnimatePresence>
            {phase < 5 && (
                <motion.div
                    className="fixed inset-0 z-[999] overflow-hidden"
                    style={{ backgroundColor: '#0a0a0a' }}
                    // Phase 4: the whole screen zooms in and fades
                    animate={
                        phase >= 4
                            ? { scale: 3, opacity: 0, filter: 'blur(8px)' }
                            : { scale: 1, opacity: 1, filter: 'blur(0px)' }
                    }
                    transition={
                        phase >= 4
                            ? { duration: 1.2, ease: [0.76, 0, 0.24, 1] }
                            : { duration: 0.3 }
                    }
                >
                    <ScanLines />
                    {phase >= 2 && <PixelParticles />}

                    {/* ══ Shake wrapper — ALL visible content goes inside ══ */}
                    <motion.div
                        key={shakeKey}
                        className="fixed inset-0"
                        animate={{
                            x: [0, -12, 10, -7, 5, -2, 0],
                            y: [0, 6, -10, 5, -3, 1, 0],
                        }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                    >

                        {/* Dark vignette */}
                        <div
                            className="fixed inset-0 pointer-events-none z-[2]"
                            style={{
                                background:
                                    'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.8) 100%)',
                            }}
                        />

                        {/* ═══════ BOTTOM HALF: Characters ═══════ */}
                        <div
                            className="absolute z-[10] w-full flex items-end justify-center"
                            style={{ bottom: '15%' }}
                        >
                            {/* Ground line */}
                            <motion.div
                                className="absolute bottom-0 left-[10%] right-[10%] z-[1]"
                                style={{
                                    height: '4px',
                                    backgroundColor: '#333',
                                    imageRendering: 'pixelated',
                                }}
                                initial={{ scaleX: 0 }}
                                animate={phase >= 1 ? { scaleX: 1 } : {}}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />

                            {/* Ground dots */}
                            {phase >= 1 && (
                                <div className="absolute bottom-0 left-[10%] right-[10%] z-[1]">
                                    {[15, 30, 50, 65, 80].map((x) => (
                                        <motion.div
                                            key={x}
                                            className="absolute"
                                            style={{
                                                left: `${x}%`,
                                                top: '6px',
                                                width: '6px',
                                                height: '6px',
                                                backgroundColor: '#292929',
                                            }}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: 0.5 }}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* ── RED stickman — SLAMS from top ── */}
                            <AnimatePresence>
                                {phase >= 1 && (
                                    <motion.div
                                        style={{ zIndex: 10, marginBottom: '4px' }}
                                        initial={{ y: -600, opacity: 0, scale: 1.5 }}
                                        animate={{
                                            y: 0,
                                            opacity: 1,
                                            scale: 1,
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                    >
                                        {/* Impact flash on landing */}
                                        <motion.div
                                            className="absolute -bottom-4 left-1/2 -translate-x-1/2"
                                            style={{
                                                width: '120px',
                                                height: '20px',
                                                borderRadius: '50%',
                                            }}
                                            initial={{
                                                backgroundColor: 'rgba(239,68,68,0.8)',
                                                scale: 2,
                                                opacity: 1
                                            }}
                                            animate={{
                                                backgroundColor: 'rgba(239,68,68,0.2)',
                                                scale: 1,
                                                opacity: 0.5
                                            }}
                                            transition={{ duration: 0.8 }}
                                        />

                                        {/* Bounce after slam */}
                                        <motion.div
                                            animate={{ y: [0, -10, 0] }}
                                            transition={{
                                                delay: 0.5,
                                                duration: 1.5,
                                                repeat: Infinity,
                                                ease: 'easeInOut',
                                            }}
                                        >
                                            <PixelStickman color="#ef4444" scale={1.8} />
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ── BLUE — emerges left ── */}
                            {phase >= 2 && (
                                <motion.div
                                    className="absolute"
                                    style={{ zIndex: 5, marginBottom: '4px' }}
                                    initial={{ x: 0, y: 40, opacity: 0, scale: 0.2 }}
                                    animate={{
                                        x: -130,
                                        y: 0,
                                        opacity: 1,
                                        scale: 1,
                                    }}
                                    transition={{
                                        duration: 0.7,
                                        ease: [0.34, 1.56, 0.64, 1],
                                    }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -6, 0] }}
                                        transition={{ delay: 0.7, duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <PixelStickman color="#3b82f6" scale={1.4} />
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* ── GREEN — emerges right ── */}
                            {phase >= 2 && (
                                <motion.div
                                    className="absolute"
                                    style={{ zIndex: 5, marginBottom: '4px' }}
                                    initial={{ x: 0, y: 40, opacity: 0, scale: 0.2 }}
                                    animate={{
                                        x: 130,
                                        y: 0,
                                        opacity: 1,
                                        scale: 1,
                                    }}
                                    transition={{
                                        duration: 0.7,
                                        delay: 0.2,
                                        ease: [0.34, 1.56, 0.64, 1],
                                    }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -6, 0] }}
                                        transition={{ delay: 0.9, duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <PixelStickman color="#22c55e" scale={1.4} />
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* ── YELLOW — emerges far left ── */}
                            {phase >= 2 && (
                                <motion.div
                                    className="absolute"
                                    style={{ zIndex: 4, marginBottom: '4px' }}
                                    initial={{ x: 0, y: 40, opacity: 0, scale: 0.2 }}
                                    animate={{
                                        x: -250,
                                        y: 0,
                                        opacity: 1,
                                        scale: 1,
                                    }}
                                    transition={{
                                        duration: 0.7,
                                        delay: 0.4,
                                        ease: [0.34, 1.56, 0.64, 1],
                                    }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ delay: 1.1, duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <PixelStickman color="#eab308" scale={1.2} />
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* ── PURPLE — emerges far right ── */}
                            {phase >= 2 && (
                                <motion.div
                                    className="absolute"
                                    style={{ zIndex: 4, marginBottom: '4px' }}
                                    initial={{ x: 0, y: 40, opacity: 0, scale: 0.2 }}
                                    animate={{
                                        x: 250,
                                        y: 0,
                                        opacity: 1,
                                        scale: 1,
                                    }}
                                    transition={{
                                        duration: 0.7,
                                        delay: 0.55,
                                        ease: [0.34, 1.56, 0.64, 1],
                                    }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ delay: 1.2, duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                                    >
                                        <PixelStickman color="#a855f7" scale={1.2} />
                                    </motion.div>
                                </motion.div>
                            )}
                        </div>

                        {/* ═══════ TOP HALF: Title ═══════ */}
                        <AnimatePresence>
                            {phase >= 3 && (
                                <motion.div
                                    className="absolute z-[20] w-full flex flex-col items-center"
                                    style={{ top: '6%' }}
                                    // SLAM from above — violent drop with overshoot
                                    initial={{ y: -800, opacity: 0, scale: 3.5, rotate: -5 }}
                                    animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                    transition={{
                                        duration: 0.45,
                                        ease: [0.16, 1, 0.3, 1],
                                    }}
                                >
                                    {/* Decorative line top */}
                                    <motion.div
                                        className="mb-4"
                                        style={{
                                            width: '280px',
                                            height: '6px',
                                            backgroundColor: '#ef4444',
                                            imageRendering: 'pixelated',
                                        }}
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: 0.3, duration: 0.3 }}
                                    />

                                    <h1
                                        className="font-display text-center leading-tight"
                                        style={{
                                            fontSize: 'clamp(3rem, 10vw, 7rem)',
                                            color: '#facc15',
                                            textShadow:
                                                '6px 6px 0 #000, -3px -3px 0 #ef4444, 10px 10px 0 rgba(0,0,0,0.4)',
                                            imageRendering: 'pixelated',
                                            letterSpacing: '-0.05em',
                                        }}
                                    >
                                        CHAOS
                                        <br />
                                        <span style={{ color: '#ef4444', textShadow: '6px 6px 0 #000, -3px -3px 0 #facc15' }}>
                                            ARENA
                                        </span>
                                    </h1>

                                    {/* Decorative line bottom */}
                                    <motion.div
                                        className="mt-4"
                                        style={{
                                            width: '280px',
                                            height: '6px',
                                            backgroundColor: '#ef4444',
                                            imageRendering: 'pixelated',
                                        }}
                                        initial={{ scaleX: 0 }}
                                        animate={{ scaleX: 1 }}
                                        transition={{ delay: 0.5, duration: 0.3 }}
                                    />

                                    {/* Subtitle */}
                                    <motion.p
                                        className="font-body text-white/80 mt-4 tracking-[0.3em] uppercase"
                                        style={{ fontSize: 'clamp(0.8rem, 2vw, 1.25rem)' }}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 }}
                                    >
                                        BRAWL · PIXEL · WIN
                                    </motion.p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ═══════ ENTERING ARENA — fixed near center, above characters ═══════ */}
                        <AnimatePresence>
                            {phase >= 3 && phase < 4 && (
                                <motion.p
                                    className="absolute z-[25] font-display text-xs text-white/50"
                                    style={{ top: '48%', left: '50%', transform: 'translateX(-50%)' }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 1, 0] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: 1 }}
                                >
                                    ENTERING ARENA...
                                </motion.p>
                            )}
                        </AnimatePresence>

                        {/* ═══════ IMPACT FLASH when red slams ═══════ */}
                        {phase === 1 && (
                            <motion.div
                                className="fixed inset-0 z-[30] pointer-events-none"
                                style={{ backgroundColor: '#ef4444' }}
                                initial={{ opacity: 0.7 }}
                                animate={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                            />
                        )}

                        {/* ═══════ IMPACT FLASH when title slams — WHITE flash for max impact ═══════ */}
                        {phase === 3 && (
                            <motion.div
                                className="fixed inset-0 z-[30] pointer-events-none"
                                style={{ backgroundColor: '#ffffff' }}
                                initial={{ opacity: 0.9 }}
                                animate={{ opacity: 0 }}
                                transition={{ duration: 0.5 }}
                            />
                        )}

                        {/* Bottom radial glow once characters arrive */}
                        {phase >= 2 && (
                            <motion.div
                                className="fixed bottom-0 left-0 right-0 pointer-events-none z-[3]"
                                style={{
                                    height: '35%',
                                    background: 'linear-gradient(to top, rgba(239,68,68,0.08) 0%, transparent 100%)',
                                }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 1 }}
                            />
                        )}

                    </motion.div>{/* ←── end of shake wrapper */}
                </motion.div>
            )}
        </AnimatePresence>
    );
};
