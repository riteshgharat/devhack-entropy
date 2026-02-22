import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface AIOverlayData {
  id: string;
  title: string;
  subtitle?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  durationMs: number;
}

interface Props {
  overlay: AIOverlayData | null;
}

const SEVERITY_STYLES: Record<string, { border: string; glow: string; text: string; bg: string }> = {
  low: {
    border: 'border-green-500',
    glow: 'drop-shadow-[0_0_20px_rgba(34,197,94,0.7)]',
    text: 'text-green-300',
    bg: 'bg-green-950/80',
  },
  medium: {
    border: 'border-yellow-400',
    glow: 'drop-shadow-[0_0_30px_rgba(250,204,21,0.8)]',
    text: 'text-yellow-300',
    bg: 'bg-yellow-950/80',
  },
  high: {
    border: 'border-orange-500',
    glow: 'drop-shadow-[0_0_40px_rgba(249,115,22,0.9)]',
    text: 'text-orange-300',
    bg: 'bg-orange-950/80',
  },
  critical: {
    border: 'border-red-500',
    glow: 'drop-shadow-[0_0_50px_rgba(239,68,68,1)]',
    text: 'text-red-300',
    bg: 'bg-red-950/80',
  },
};

export const BigOverlayBanner: React.FC<Props> = ({ overlay }) => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState<AIOverlayData | null>(null);

  useEffect(() => {
    if (!overlay) return;
    setCurrent(overlay);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), overlay.durationMs);
    return () => clearTimeout(t);
  }, [overlay?.id]);

  const styles = SEVERITY_STYLES[current?.severity ?? 'medium'];

  return (
    <AnimatePresence>
      {visible && current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, scale: 0.6, y: -60 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 1.1, y: -30 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          className={`
            absolute top-6 left-1/2 -translate-x-1/2 z-50
            pointer-events-none select-none
            px-8 py-4 border-4 backdrop-blur-md
            ${styles.bg} ${styles.border} ${styles.glow}
            min-w-[280px] max-w-[480px] text-center
          `}
        >
          <motion.p
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
            className={`font-display text-3xl md:text-4xl uppercase tracking-[0.15em] font-black ${styles.text}`}
          >
            {current.title}
          </motion.p>
          {current.subtitle && (
            <p className="font-display text-sm text-slate-300 mt-1 tracking-widest uppercase">
              {current.subtitle}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
