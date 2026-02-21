import React from 'react';

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const PixelCard = ({ children, className = '', title }: PixelCardProps) => {
  return (
    <div className={`relative bg-white border-4 border-slate-800 shadow-[8px_8px_0_0_rgba(0,0,0,0.2)] p-6 ${className}`}>
      {/* Pixel corners decoration */}
      <div className="absolute -top-1 -left-1 w-2 h-2 bg-slate-800" />
      <div className="absolute -top-1 -right-1 w-2 h-2 bg-slate-800" />
      <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-slate-800" />
      <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-slate-800" />
      
      {title && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-yellow-300 border-2 border-slate-800 px-4 py-1 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)]">
          <h3 className="font-display text-xs text-slate-900 uppercase tracking-wider">{title}</h3>
        </div>
      )}
      
      {children}
    </div>
  );
};
