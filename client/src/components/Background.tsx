import React from 'react';
import { motion } from 'motion/react';

export const Background = () => {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-sky-300">
      {/* Sun */}
      <div className="absolute top-10 right-20 w-24 h-24 bg-yellow-300 rounded-full border-4 border-yellow-500 shadow-[0_0_40px_rgba(253,224,71,0.5)]" />

      {/* Clouds */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: -200 }}
          animate={{ x: '120vw' }}
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
             <div className="w-32 h-12 bg-white rounded-full" />
             <div className="absolute -top-6 left-4 w-12 h-12 bg-white rounded-full" />
             <div className="absolute -top-8 left-12 w-16 h-16 bg-white rounded-full" />
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
          className="absolute w-2 h-2 bg-white/50"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${50 + Math.random() * 50}%`,
          }}
        />
      ))}

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-green-500 border-t-8 border-green-700">
        {/* Grass details */}
        <div className="w-full h-4 bg-green-400/30" />
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className="absolute bottom-full w-2 h-2 bg-green-600"
            style={{ left: `${i * 5 + Math.random() * 2}%` }} 
          />
        ))}
      </div>
    </div>
  );
};
