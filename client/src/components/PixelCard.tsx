import React from "react";

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  nightMode?: boolean;
}

export const PixelCard = ({
  children,
  className = "",
  title,
  nightMode = false,
}: PixelCardProps) => {
  return (
    <div
      className={`relative border-4 shadow-[8px_8px_0_0_rgba(0,0,0,0.2)] p-6 transition-colors duration-700 ${
        nightMode
          ? "bg-slate-800 border-slate-600"
          : "bg-white border-slate-800"
      } ${className}`}
    >
      {/* Pixel corners decoration */}
      <div
        className={`absolute -top-1 -left-1 w-2 h-2 ${nightMode ? "bg-slate-600" : "bg-slate-800"}`}
      />
      <div
        className={`absolute -top-1 -right-1 w-2 h-2 ${nightMode ? "bg-slate-600" : "bg-slate-800"}`}
      />
      <div
        className={`absolute -bottom-1 -left-1 w-2 h-2 ${nightMode ? "bg-slate-600" : "bg-slate-800"}`}
      />
      <div
        className={`absolute -bottom-1 -right-1 w-2 h-2 ${nightMode ? "bg-slate-600" : "bg-slate-800"}`}
      />

      {title && (
        <div
          className={`absolute -top-5 left-1/2 -translate-x-1/2 border-2 px-4 py-1 shadow-[4px_4px_0_0_rgba(0,0,0,0.1)] transition-colors duration-700 ${
            nightMode
              ? "bg-indigo-500 border-indigo-700"
              : "bg-yellow-300 border-slate-800"
          }`}
        >
          <h3
            className={`font-display text-xs uppercase tracking-wider transition-colors duration-700 ${
              nightMode ? "text-white" : "text-slate-900"
            }`}
          >
            {title}
          </h3>
        </div>
      )}

      {children}
    </div>
  );
};
