import React, { ButtonHTMLAttributes } from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

interface PixelButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

export const PixelButton = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  className = '',
  ...props 
}: PixelButtonProps) => {
  
  const baseStyles = "relative font-display uppercase transition-transform active:scale-95 focus:outline-none pixel-corners";
  
  const variants = {
    primary: "bg-green-400 text-green-900 hover:bg-green-300 border-b-4 border-green-700 active:border-b-0 active:translate-y-1",
    secondary: "bg-blue-400 text-blue-900 hover:bg-blue-300 border-b-4 border-blue-700 active:border-b-0 active:translate-y-1",
    accent: "bg-yellow-400 text-yellow-900 hover:bg-yellow-300 border-b-4 border-yellow-700 active:border-b-0 active:translate-y-1",
    danger: "bg-red-400 text-red-900 hover:bg-red-300 border-b-4 border-red-700 active:border-b-0 active:translate-y-1",
  };

  const sizes = {
    sm: "text-xs py-2 px-4",
    md: "text-sm py-3 px-6",
    lg: "text-base py-4 px-8",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
};
