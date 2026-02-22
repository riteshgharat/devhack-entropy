import React from "react";
import { motion } from "motion/react";

interface BackgroundProps {
  nightMode?: boolean;
}

export const Background = ({ nightMode = false }: BackgroundProps) => {
  return (
    <div
      className={`fixed inset-0 z-0 pointer-events-none overflow-hidden transition-colors duration-1000 ${
        nightMode ? "bg-slate-900" : "bg-sky-300"
      }`}
    >
      {/* Sun (day) / Moon (night) */}
      <motion.div
        className="absolute top-10 right-20 w-24 h-24 rounded-full border-4"
        animate={{
          backgroundColor: nightMode ? "#e2e8f0" : "#fde047",
          borderColor: nightMode ? "#94a3b8" : "#eab308",
          boxShadow: nightMode
            ? "0 0 60px rgba(226,232,240,0.3)"
            : "0 0 40px rgba(253,224,71,0.5)",
        }}
        transition={{ duration: 1 }}
      >
        {/* Moon craters */}
        {nightMode && (
          <>
            <div className="absolute top-3 left-4 w-4 h-4 bg-slate-300 rounded-full opacity-50" />
            <div className="absolute top-10 right-3 w-3 h-3 bg-slate-300 rounded-full opacity-40" />
            <div className="absolute bottom-4 left-6 w-2 h-2 bg-slate-300 rounded-full opacity-30" />
          </>
        )}
      </motion.div>

      {/* ═══ NIGHT MODE EXTRAS ═══ */}

      {/* Stars — twinkling */}
      {nightMode &&
        [...Array(50)].map((_, i) => (
          <motion.div
            key={`star-${i}`}
            className="absolute bg-white rounded-full"
            style={{
              width: `${1 + Math.random() * 3}px`,
              height: `${1 + Math.random() * 3}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 55}%`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.1, 0.9, 0.1] }}
            transition={{
              duration: 1.5 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 3,
            }}
          />
        ))}

      {/* Aurora Borealis — gradient waves */}
      {nightMode && (
        <>
          <motion.div
            className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{
              height: "35%",
              background:
                "linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(139,92,246,0.06) 40%, transparent 100%)",
            }}
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-0 left-[20%] right-[20%] pointer-events-none"
            style={{
              height: "28%",
              background:
                "linear-gradient(180deg, rgba(34,197,94,0.1) 0%, rgba(56,189,248,0.05) 60%, transparent 100%)",
              borderRadius: "0 0 50% 50%",
            }}
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scaleX: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />
          <motion.div
            className="absolute top-[5%] left-[40%] right-[10%] pointer-events-none"
            style={{
              height: "20%",
              background:
                "linear-gradient(180deg, rgba(168,85,247,0.08) 0%, rgba(236,72,153,0.04) 50%, transparent 100%)",
              borderRadius: "0 0 40% 40%",
            }}
            animate={{
              opacity: [0.15, 0.45, 0.15],
              scaleX: [1.1, 0.7, 1.1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 4,
            }}
          />
        </>
      )}

      {/* Shooting stars */}
      {nightMode &&
        [0, 1, 2].map((i) => (
          <motion.div
            key={`shoot-${i}`}
            className="absolute"
            style={{
              top: `${5 + i * 12}%`,
              left: "-5%",
              width: "2px",
              height: "2px",
              backgroundColor: "#fff",
              boxShadow:
                "0 0 4px #fff, -20px 0 6px rgba(255,255,255,0.5), -40px 0 4px rgba(255,255,255,0.2)",
              borderRadius: "50%",
            }}
            animate={{
              x: [0, window.innerWidth * 0.8],
              y: [0, window.innerHeight * 0.3],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 1.2,
              delay: 3 + i * 5,
              repeat: Infinity,
              repeatDelay: 8 + i * 3,
              ease: "easeOut",
            }}
          />
        ))}

      {/* Fireflies — small glowing dots that drift */}
      {nightMode &&
        [...Array(15)].map((_, i) => (
          <motion.div
            key={`fly-${i}`}
            className="absolute rounded-full"
            style={{
              width: "4px",
              height: "4px",
              backgroundColor: "#facc15",
              boxShadow: "0 0 8px 2px rgba(250,204,21,0.6)",
              left: `${10 + Math.random() * 80}%`,
              top: `${40 + Math.random() * 45}%`,
            }}
            animate={{
              x: [0, (Math.random() - 0.5) * 60, (Math.random() - 0.5) * 40, 0],
              y: [0, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30, 0],
              opacity: [0, 0.8, 0.3, 0.9, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 4,
              repeat: Infinity,
              delay: Math.random() * 6,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* ═══ SHARED ELEMENTS ═══ */}

      {/* Clouds */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: -200 }}
          animate={{ x: "120vw" }}
          transition={{
            duration: 20 + Math.random() * 20,
            repeat: Infinity,
            ease: "linear",
            delay: i * 5,
          }}
          className="absolute"
          style={{ top: `${10 + Math.random() * 40}%` }}
        >
          <div className="relative">
            <div
              className={`w-32 h-12 rounded-full transition-colors duration-1000 ${
                nightMode ? "bg-slate-700/40" : "bg-white"
              }`}
            />
            <div
              className={`absolute -top-6 left-4 w-12 h-12 rounded-full transition-colors duration-1000 ${
                nightMode ? "bg-slate-700/40" : "bg-white"
              }`}
            />
            <div
              className={`absolute -top-8 left-12 w-16 h-16 rounded-full transition-colors duration-1000 ${
                nightMode ? "bg-slate-700/40" : "bg-white"
              }`}
            />
          </div>
        </motion.div>
      ))}

      {/* Floating Particles */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={`p-${i}`}
          animate={{
            y: [0, -100],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
          className={`absolute w-2 h-2 transition-colors duration-1000 ${
            nightMode ? "bg-indigo-400/20" : "bg-white/50"
          }`}
          style={{
            left: `${Math.random() * 100}%`,
            top: `${50 + Math.random() * 50}%`,
          }}
        />
      ))}

      {/* Ground */}
      <div
        className={`absolute bottom-0 left-0 right-0 h-32 border-t-8 transition-colors duration-1000 ${
          nightMode
            ? "bg-slate-800 border-slate-900"
            : "bg-green-500 border-green-700"
        }`}
      >
        <div
          className={`w-full h-4 transition-colors duration-1000 ${
            nightMode ? "bg-slate-700/30" : "bg-green-400/30"
          }`}
        />
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className={`absolute bottom-full w-2 h-2 transition-colors duration-1000 ${
              nightMode ? "bg-slate-700" : "bg-green-600"
            }`}
            style={{ left: `${i * 5 + Math.random() * 2}%` }}
          />
        ))}
      </div>

      {/* Night ground glow */}
      {nightMode && (
        <motion.div
          className="absolute bottom-28 left-0 right-0 pointer-events-none"
          style={{
            height: "60px",
            background:
              "linear-gradient(to top, rgba(99,102,241,0.06) 0%, transparent 100%)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
};
