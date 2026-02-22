import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PixelStickman, STICKMAN_COLORS } from './PixelCharacter';
import { soundManager } from '../services/soundManager';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
}

export const PixelButton = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: PixelButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyles = "relative font-display uppercase transition-all duration-200 active:scale-95 focus:outline-none pixel-corners cursor-pointer";

  const variants = {
    primary: "bg-green-400 text-green-900 hover:bg-green-300 border-b-4 border-green-700 active:border-b-0 active:translate-y-1 shadow-[4px_4px_0_rgba(0,0,0,0.2)]",
    secondary: "bg-blue-400 text-blue-900 hover:bg-blue-300 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 shadow-[4px_4px_0_rgba(0,0,0,0.2)]",
    accent: "bg-yellow-400 text-yellow-900 hover:bg-yellow-300 border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1 shadow-[4px_4px_0_rgba(0,0,0,0.2)]",
    danger: "bg-red-400 text-red-900 hover:bg-red-300 border-b-4 border-red-700 active:border-b-0 active:translate-y-1 shadow-[4px_4px_0_rgba(0,0,0,0.2)]",
  };

  const sizes = {
    sm: "text-xs py-2 px-4",
    md: "text-sm py-3 px-6",
    lg: "text-base py-4 px-8",
  };

  const randomColor = STICKMAN_COLORS[Math.floor(Math.random() * STICKMAN_COLORS.length)].hex;

  return (
    <div className="relative inline-block">
      {/* ── Hovering Character (Half Body) ── */}
      <AnimatePresence>
        {isHovered && !props.disabled && (
          <motion.div
            initial={{ opacity: 0, x: -40, y: '-50%', scale: 0.8 }}
            animate={{ opacity: 1, x: -60, y: '-50%', scale: 1 }}
            exit={{ opacity: 0, x: -30, y: '-50%', scale: 0.8 }}
            className="absolute top-1/2 left-0 z-20 pointer-events-none"
          >
            <motion.div
              animate={{ x: [0, -5, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <PixelStickman color={randomColor} scale={0.7} halfBody={true} pointing="right" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => {
          soundManager.playClick();
          if (props.onClick) (props.onClick as React.MouseEventHandler<HTMLButtonElement>)(e);
        }}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${props.disabled ? 'opacity-50 cursor-not-allowed grayscale pointer-events-none' : ''} ${className}`}
        {...(({ onClick: _, ...rest }) => rest)(props as any)}
      >
        <span className="relative z-10">{children}</span>
      </motion.button>
    </div>
  );
};