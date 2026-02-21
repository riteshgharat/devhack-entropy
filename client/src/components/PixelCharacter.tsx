import React from 'react';
import { motion } from 'motion/react';

export const PixelCharacter = () => {
  return (
    <div className="relative w-64 h-64 flex items-center justify-center">
      <motion.div
        animate={{ 
          y: [0, -8, 0],
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="relative w-32 h-48"
      >
        {/* Head */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-16 bg-orange-200 border-4 border-black shadow-[inset_-4px_-4px_0_0_rgba(0,0,0,0.1)]">
          {/* Eyes */}
          <div className="absolute top-6 left-3 w-2 h-2 bg-black animate-blink" />
          <div className="absolute top-6 right-3 w-2 h-2 bg-black animate-blink" />
          {/* Mouth */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-6 h-2 bg-red-400" />
          {/* Hair/Hat */}
          <div className="absolute -top-2 left-0 w-full h-4 bg-blue-500" />
        </div>

        {/* Body */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-12 h-16 bg-blue-500 border-4 border-black">
           {/* Logo on shirt */}
           <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-400 rounded-sm" />
        </div>

        {/* Arms */}
        <motion.div 
          animate={{ rotate: [0, 10, 0, -10, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="absolute top-16 left-2 w-4 h-16 bg-orange-200 border-4 border-black origin-top" 
        />
        <motion.div 
          animate={{ rotate: [0, -10, 0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0.5 }}
          className="absolute top-16 right-2 w-4 h-16 bg-orange-200 border-4 border-black origin-top" 
        />

        {/* Legs */}
        <div className="absolute top-32 left-8 w-5 h-16 bg-slate-700 border-4 border-black" />
        <div className="absolute top-32 right-8 w-5 h-16 bg-slate-700 border-4 border-black" />

        {/* Shadow */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 h-4 bg-black/20 rounded-full blur-sm" />
      </motion.div>

      {/* Speech Bubble */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute -top-8 -right-8 bg-white border-2 border-black p-3 pixel-corners-sm"
      >
        <p className="font-display text-[10px] text-black">READY!</p>
        <div className="absolute bottom-0 left-0 w-2 h-2 bg-white border-l-2 border-b-2 border-black -translate-x-1/2 translate-y-1/2 rotate-45" />
      </motion.div>
    </div>
  );
};
