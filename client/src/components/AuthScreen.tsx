import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PixelButton } from './PixelButton';
import { PixelCard } from './PixelCard';
import {
    User, Mail, Lock, Eye, EyeOff, UserPlus, LogIn, Ghost, Swords,
    Shield, ChevronRight, Sparkles, AlertTriangle, CheckCircle, X,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */

export interface UserProfile {
    id: string;
    username: string;
    email?: string;
    isGuest: boolean;
    avatarColor: string;
    level: number;
    xp: number;
    wins: number;
    matches: number;
    createdAt: string;
}

interface AuthScreenProps {
    nightMode: boolean;
    onAuth: (user: UserProfile) => void;
    onClose: () => void;
    initialTab?: 'signin' | 'signup';
}

/* ═══════════════════════════════════════════════════════
   Helper: localStorage user DB (simulated)
   ═══════════════════════════════════════════════════════ */

const USERS_KEY = 'chaos_arena_users';
const SESSION_KEY = 'chaos_arena_session';

function getStoredUsers(): Record<string, { username: string; email: string; password: string; profile: UserProfile }> {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    } catch { return {}; }
}

function saveStoredUsers(users: Record<string, any>) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function generateId(): string {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const AVATAR_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308',
    '#a855f7', '#f97316', '#ec4899', '#06b6d4',
];

/* ═══════════════════════════════════════════════════════
   Mini Stickman Avatar for preview
   ═══════════════════════════════════════════════════════ */

const MiniStickman: React.FC<{ color: string; size?: number; animate?: boolean }> = ({
    color, size = 48, animate = false,
}) => {
    const s = (v: number) => `${(v / 60) * size}px`;
    return (
        <motion.div
            className="relative"
            style={{ width: `${size}px`, height: `${(90 / 60) * size}px`, imageRendering: 'pixelated' }}
            animate={animate ? { y: [0, -4, 0] } : {}}
            transition={animate ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
            {/* Head */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{
                top: 0, width: s(22), height: s(22), backgroundColor: color,
                border: `${s(3)} solid #111`,
                boxShadow: `inset ${s(-3)} ${s(-3)} 0 0 rgba(0,0,0,0.25), inset ${s(2)} ${s(2)} 0 0 rgba(255,255,255,0.15)`,
            }}>
                {/* Eyes */}
                <div className="absolute" style={{
                    top: s(6), left: s(3), width: s(4), height: s(4), backgroundColor: '#fff',
                    boxShadow: `${s(7)} 0 0 0 #fff`,
                }} />
                {/* Mouth */}
                <div className="absolute" style={{
                    bottom: s(3), left: s(5), width: s(8), height: s(2), backgroundColor: '#111',
                }} />
            </div>
            {/* Body */}
            <div className="absolute left-1/2 -translate-x-1/2" style={{
                top: s(24), width: s(16), height: s(22), backgroundColor: color,
                border: `${s(3)} solid #111`,
            }}>
                {/* Belt */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: s(4), backgroundColor: 'rgba(0,0,0,0.4)',
                }} />
                <div style={{
                    position: 'absolute', bottom: s(0.5), left: '50%', transform: 'translateX(-50%)',
                    width: s(4), height: s(3), backgroundColor: '#fbbf24',
                    border: `${s(0.5)} solid #92400e`,
                }} />
            </div>
            {/* Arms */}
            <div className="absolute" style={{
                top: s(24), left: s(4), width: s(8), height: s(16), backgroundColor: color,
                border: `${s(2)} solid #111`,
            }} />
            <div className="absolute" style={{
                top: s(24), right: s(4), width: s(8), height: s(16), backgroundColor: color,
                border: `${s(2)} solid #111`,
            }} />
            {/* Legs */}
            <div className="absolute" style={{
                top: s(46), left: s(14), width: s(10), height: s(20), backgroundColor: color,
                border: `${s(2)} solid #111`, filter: 'brightness(0.8)',
            }} />
            <div className="absolute" style={{
                top: s(46), right: s(14), width: s(10), height: s(20), backgroundColor: color,
                border: `${s(2)} solid #111`, filter: 'brightness(0.8)',
            }} />
            {/* Boots */}
            <div className="absolute" style={{
                top: s(64), left: s(10), width: s(14), height: s(7), backgroundColor: '#1c1917',
                border: `${s(1.5)} solid #000`,
            }} />
            <div className="absolute" style={{
                top: s(64), right: s(10), width: s(14), height: s(7), backgroundColor: '#1c1917',
                border: `${s(1.5)} solid #000`,
            }} />
        </motion.div>
    );
};

/* ═══════════════════════════════════════════════════════
   Pixel Input Component
   ═══════════════════════════════════════════════════════ */

const PixelInput: React.FC<{
    icon: React.ReactNode;
    type: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    nightMode: boolean;
    error?: string;
    showToggle?: boolean;
}> = ({ icon, type, placeholder, value, onChange, nightMode, error, showToggle }) => {
    const [showPassword, setShowPassword] = useState(false);
    const actualType = showToggle ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="space-y-1">
            <div className={`flex items-center gap-3 px-4 py-3 border-4 transition-all duration-300 ${error
                ? 'border-red-500 bg-red-500/10'
                : nightMode
                    ? 'border-slate-600 bg-slate-700/50 focus-within:border-indigo-400 focus-within:bg-slate-700'
                    : 'border-slate-300 bg-white focus-within:border-indigo-500 focus-within:bg-indigo-50/30'
                }`}
            >
                <div className={`${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                    {icon}
                </div>
                <input
                    type={actualType}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`flex-1 bg-transparent outline-none font-body text-xl placeholder:opacity-40 ${nightMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-800 placeholder:text-slate-400'
                        }`}
                />
                {showToggle && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`${nightMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </div>
            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-red-400 font-body text-sm flex items-center gap-1 pl-1"
                >
                    <AlertTriangle size={12} /> {error}
                </motion.p>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════
   Floating pixel particles background
   ═══════════════════════════════════════════════════════ */

const AuthParticles: React.FC = () => {
    const particles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 6,
        size: 3 + Math.floor(Math.random() * 2) * 2,
        color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    }));
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
            {particles.map((p) => (
                <motion.div key={p.id} className="absolute"
                    style={{
                        left: `${p.x}%`, bottom: '-10px',
                        width: `${p.size}px`, height: `${p.size}px`,
                        backgroundColor: p.color, imageRendering: 'pixelated',
                        opacity: 0.3,
                    }}
                    animate={{ y: [0, -600], opacity: [0, 0.4, 0.4, 0] }}
                    transition={{ delay: p.delay, duration: p.duration, repeat: Infinity, ease: 'linear' }}
                />
            ))}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════
   Auth Gate Prompt (the "not logged in" nudge)
   ═══════════════════════════════════════════════════════ */

export const AuthGatePrompt: React.FC<{
    nightMode: boolean;
    onSignIn: () => void;
    onSignUp: () => void;
    onGuest: () => void;
    onClose: () => void;
}> = ({ nightMode, onSignIn, onSignUp, onGuest, onClose }) => {
    return (
        <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <motion.div
                initial={{ scale: 0.7, opacity: 0, y: 40 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0.3 }}
                className="w-full max-w-sm mx-4"
            >
                <PixelCard nightMode={nightMode} title="Hold Up!">
                    <div className="text-center space-y-5 pt-4">
                        {/* Shield icon */}
                        <motion.div
                            animate={{ rotate: [0, -5, 5, -5, 0], scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <Shield size={56} className={`mx-auto ${nightMode ? 'text-indigo-400' : 'text-indigo-500'}`} />
                        </motion.div>

                        <div>
                            <h2 className={`font-display text-sm uppercase tracking-wider mb-2 ${nightMode ? 'text-slate-200' : 'text-slate-800'
                                }`}>
                                Authentication Required
                            </h2>
                            <p className={`font-body text-lg ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                Create an account or sign in to join the battle.<br />
                                Or hop in as a guest — your call!
                            </p>
                        </div>

                        <div className="space-y-3">
                            <PixelButton variant="primary" size="md" className="w-full" onClick={onSignUp}>
                                <UserPlus size={16} className="inline mr-2" /> Sign Up
                            </PixelButton>
                            <PixelButton variant="secondary" size="md" className="w-full" onClick={onSignIn}>
                                <LogIn size={16} className="inline mr-2" /> Sign In
                            </PixelButton>
                            <div className="relative py-2">
                                <div className={`absolute inset-0 flex items-center ${nightMode ? 'opacity-30' : 'opacity-20'}`}>
                                    <div className="w-full border-t-2 border-dashed border-slate-400" />
                                </div>
                                <div className={`relative flex justify-center ${nightMode ? 'bg-slate-800' : 'bg-white'}`}>
                                    <span className={`px-3 font-display text-[8px] uppercase ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        or
                                    </span>
                                </div>
                            </div>
                            <PixelButton variant="accent" size="sm" className="w-full" onClick={onGuest}>
                                <Ghost size={16} className="inline mr-2" /> Play as Guest
                            </PixelButton>
                        </div>

                        <button
                            onClick={onClose}
                            className={`font-body text-base underline mt-2 ${nightMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                                } transition-colors`}
                        >
                            Back to Menu
                        </button>
                    </div>
                </PixelCard>
            </motion.div>
        </motion.div>
    );
};

/* ═══════════════════════════════════════════════════════
   Main Auth Screen
   ═══════════════════════════════════════════════════════ */

export const AuthScreen: React.FC<AuthScreenProps> = ({ nightMode, onAuth, onClose, initialTab = 'signin' }) => {
    const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
    const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]);

    // Sign In state
    const [siUsername, setSiUsername] = useState('');
    const [siPassword, setSiPassword] = useState('');
    const [siErrors, setSiErrors] = useState<Record<string, string>>({});

    // Sign Up state
    const [suUsername, setSuUsername] = useState('');
    const [suEmail, setSuEmail] = useState('');
    const [suPassword, setSuPassword] = useState('');
    const [suConfirm, setSuConfirm] = useState('');
    const [suErrors, setSuErrors] = useState<Record<string, string>>({});

    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    /* ── Sign In handler ── */
    const handleSignIn = async () => {
        const errs: Record<string, string> = {};
        if (!siUsername.trim()) errs.username = 'Username is required';
        if (!siPassword) errs.password = 'Password is required';
        if (Object.keys(errs).length) { setSiErrors(errs); return; }

        setIsLoading(true);
        setSiErrors({});

        // Simulate network delay
        await new Promise(r => setTimeout(r, 800));

        const users = getStoredUsers();
        const userEntry = Object.values(users).find(
            u => u.username.toLowerCase() === siUsername.trim().toLowerCase()
        );

        if (!userEntry) {
            setSiErrors({ username: 'No account found with that username' });
            setIsLoading(false);
            return;
        }

        if (userEntry.password !== siPassword) {
            setSiErrors({ password: 'Incorrect password' });
            setIsLoading(false);
            return;
        }

        // Success! — sync to app's main keys too
        localStorage.setItem(SESSION_KEY, JSON.stringify(userEntry.profile));
        localStorage.setItem('playerId', userEntry.profile.id);
        localStorage.setItem('displayName', userEntry.profile.username);
        localStorage.setItem('playerColor', userEntry.profile.avatarColor);
        setSuccessMsg('Welcome back, warrior!');
        setTimeout(() => onAuth(userEntry.profile), 1200);
    };

    /* ── Sign Up handler ── */
    const handleSignUp = async () => {
        const errs: Record<string, string> = {};
        if (!suUsername.trim()) errs.username = 'Pick a warrior name';
        else if (suUsername.trim().length < 3) errs.username = 'At least 3 characters';
        else if (suUsername.trim().length > 16) errs.username = 'Max 16 characters';

        if (!suEmail.trim()) errs.email = 'Email is required';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(suEmail)) errs.email = 'Invalid email format';

        if (!suPassword) errs.password = 'Password is required';
        else if (suPassword.length < 4) errs.password = 'At least 4 characters';

        if (suPassword !== suConfirm) errs.confirm = 'Passwords don\'t match';

        if (Object.keys(errs).length) { setSuErrors(errs); return; }

        setIsLoading(true);
        setSuErrors({});

        await new Promise(r => setTimeout(r, 1000));

        const users = getStoredUsers();
        const existing = Object.values(users).find(
            u => u.username.toLowerCase() === suUsername.trim().toLowerCase()
        );
        if (existing) {
            setSuErrors({ username: 'That name is already taken!' });
            setIsLoading(false);
            return;
        }

        const emailUsed = Object.values(users).find(
            u => u.email.toLowerCase() === suEmail.trim().toLowerCase()
        );
        if (emailUsed) {
            setSuErrors({ email: 'Email already registered' });
            setIsLoading(false);
            return;
        }

        // Create user
        const profile: UserProfile = {
            id: generateId(),
            username: suUsername.trim(),
            email: suEmail.trim(),
            isGuest: false,
            avatarColor: selectedColor,
            level: 1,
            xp: 0,
            wins: 0,
            matches: 0,
            createdAt: new Date().toISOString(),
        };

        users[profile.id] = {
            username: suUsername.trim(),
            email: suEmail.trim(),
            password: suPassword,
            profile,
        };
        saveStoredUsers(users);
        localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
        localStorage.setItem('playerId', profile.id);
        localStorage.setItem('displayName', profile.username);
        localStorage.setItem('playerColor', profile.avatarColor);

        setSuccessMsg('Account created — ready to brawl!');
        setTimeout(() => onAuth(profile), 1200);
    };

    /* ── Guest handler ── */
    const handleGuest = () => {
        setIsLoading(true);
        setTimeout(() => {
            const guestName = `Guest_${Math.floor(Math.random() * 9000 + 1000)}`;
            // Reuse existing playerId if present
            const existingId = localStorage.getItem('playerId');
            const profile: UserProfile = {
                id: existingId || generateId(),
                username: guestName,
                isGuest: true,
                avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
                level: 1,
                xp: 0,
                wins: 0,
                matches: 0,
                createdAt: new Date().toISOString(),
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
            localStorage.setItem('playerId', profile.id);
            localStorage.setItem('displayName', profile.username);
            localStorage.setItem('playerColor', profile.avatarColor);
            setSuccessMsg(`Welcome, ${guestName}!`);
            setTimeout(() => onAuth(profile), 800);
        }, 600);
    };

    return (
        <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-lg" onClick={onClose} />

            <AuthParticles />

            {/* Main card */}
            <motion.div
                initial={{ scale: 0.8, opacity: 0, y: 60, rotateX: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0, rotateX: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: -20 }}
                transition={{ type: 'spring', bounce: 0.25, duration: 0.6 }}
                className="relative z-10 w-full max-w-lg mx-4"
            >
                {/* Close button */}
                <motion.button
                    whileHover={{ scale: 1.2, rotate: 90 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={onClose}
                    className={`absolute -top-3 -right-3 z-30 w-10 h-10 border-4 flex items-center justify-center cursor-pointer ${nightMode
                        ? 'bg-slate-700 border-slate-500 text-slate-300 hover:bg-red-600 hover:border-red-500 hover:text-white'
                        : 'bg-white border-slate-400 text-slate-600 hover:bg-red-500 hover:border-red-600 hover:text-white'
                        } transition-colors`}
                >
                    <X size={18} />
                </motion.button>

                <div className={`border-4 shadow-[8px_8px_0_0_rgba(0,0,0,0.3)] overflow-hidden transition-colors duration-700 ${nightMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-800'
                    }`}
                >
                    {/* ═══ HEADER WITH STICKMAN ═══ */}
                    <div className={`relative px-6 pt-6 pb-4 ${nightMode
                        ? 'bg-gradient-to-br from-indigo-900/60 via-slate-800 to-purple-900/40'
                        : 'bg-gradient-to-br from-yellow-100 via-white to-indigo-50'
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <motion.h1
                                    className={`font-display text-xl uppercase tracking-tighter ${nightMode ? 'text-indigo-300' : 'text-indigo-600'}`}
                                    style={{
                                        textShadow: nightMode
                                            ? '3px 3px 0 #000, -1px -1px 0 #6366f1'
                                            : '2px 2px 0 rgba(0,0,0,0.15)',
                                    }}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.15 }}
                                >
                                    {tab === 'signin' ? 'Welcome Back' : 'Join Arena'}
                                </motion.h1>
                                <motion.p
                                    className={`font-body text-lg mt-1 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.25 }}
                                >
                                    {tab === 'signin' ? 'Enter your credentials to continue' : 'Create your warrior profile'}
                                </motion.p>
                            </div>

                            <motion.div
                                initial={{ scale: 0, rotate: -30 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', bounce: 0.5, delay: 0.3 }}
                            >
                                <MiniStickman
                                    color={tab === 'signup' ? selectedColor : (nightMode ? '#818cf8' : '#6366f1')}
                                    size={50}
                                    animate
                                />
                            </motion.div>
                        </div>

                        {/* Tabs */}
                        <div className="flex mt-4 gap-0">
                            {(['signin', 'signup'] as const).map((t) => (
                                <motion.button
                                    key={t}
                                    onClick={() => { setTab(t); setSiErrors({}); setSuErrors({}); setSuccessMsg(''); }}
                                    className={`flex-1 py-2.5 font-display text-[10px] uppercase tracking-widest border-b-4 transition-all duration-300 cursor-pointer ${tab === t
                                        ? nightMode
                                            ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300'
                                            : 'bg-indigo-50 border-indigo-500 text-indigo-700'
                                        : nightMode
                                            ? 'bg-transparent border-slate-700 text-slate-500 hover:text-slate-400 hover:border-slate-600'
                                            : 'bg-transparent border-slate-200 text-slate-400 hover:text-slate-500 hover:border-slate-300'
                                        }`}
                                    whileTap={{ scale: 0.97 }}
                                >
                                    {t === 'signin' ? (
                                        <><LogIn size={14} className="inline mr-1.5 -mt-0.5" /> Sign In</>
                                    ) : (
                                        <><UserPlus size={14} className="inline mr-1.5 -mt-0.5" /> Sign Up</>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* ═══ FORM BODY ═══ */}
                    <div className="px-6 py-5 space-y-4">
                        {/* Success message overlay */}
                        <AnimatePresence>
                            {successMsg && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className={`text-center py-6 space-y-3`}
                                >
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                                        transition={{ duration: 0.6 }}
                                    >
                                        <CheckCircle size={56} className="mx-auto text-green-400" />
                                    </motion.div>
                                    <p className={`font-display text-sm uppercase ${nightMode ? 'text-green-300' : 'text-green-600'}`}>
                                        {successMsg}
                                    </p>
                                    <motion.div
                                        className="flex justify-center gap-1 mt-2"
                                        animate={{ opacity: [0.4, 1, 0.4] }}
                                        transition={{ duration: 1.2, repeat: Infinity }}
                                    >
                                        {[0, 1, 2].map(i => (
                                            <div key={i} className="w-2 h-2 bg-green-400" style={{ imageRendering: 'pixelated' }} />
                                        ))}
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Sign In Form */}
                        {!successMsg && tab === 'signin' && (
                            <motion.div
                                key="signin"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-4"
                            >
                                <PixelInput
                                    icon={<User size={18} />}
                                    type="text"
                                    placeholder="Username"
                                    value={siUsername}
                                    onChange={setSiUsername}
                                    nightMode={nightMode}
                                    error={siErrors.username}
                                />
                                <PixelInput
                                    icon={<Lock size={18} />}
                                    type="password"
                                    placeholder="Password"
                                    value={siPassword}
                                    onChange={setSiPassword}
                                    nightMode={nightMode}
                                    error={siErrors.password}
                                    showToggle
                                />

                                <PixelButton
                                    variant="primary"
                                    size="lg"
                                    className="w-full text-sm"
                                    onClick={handleSignIn}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <motion.span
                                            animate={{ opacity: [1, 0.5, 1] }}
                                            transition={{ duration: 0.8, repeat: Infinity }}
                                        >
                                            Authenticating...
                                        </motion.span>
                                    ) : (
                                        <>
                                            <LogIn size={16} className="inline mr-2" />
                                            Enter Arena
                                        </>
                                    )}
                                </PixelButton>

                                <p className={`text-center font-body text-base ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Don't have an account?{' '}
                                    <button
                                        onClick={() => { setTab('signup'); setSiErrors({}); }}
                                        className={`underline font-bold ${nightMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'} transition-colors cursor-pointer`}
                                    >
                                        Sign Up
                                    </button>
                                </p>
                            </motion.div>
                        )}

                        {/* Sign Up Form */}
                        {!successMsg && tab === 'signup' && (
                            <motion.div
                                key="signup"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                            >
                                <PixelInput
                                    icon={<User size={18} />}
                                    type="text"
                                    placeholder="Warrior name"
                                    value={suUsername}
                                    onChange={setSuUsername}
                                    nightMode={nightMode}
                                    error={suErrors.username}
                                />
                                <PixelInput
                                    icon={<Mail size={18} />}
                                    type="email"
                                    placeholder="Email address"
                                    value={suEmail}
                                    onChange={setSuEmail}
                                    nightMode={nightMode}
                                    error={suErrors.email}
                                />
                                <PixelInput
                                    icon={<Lock size={18} />}
                                    type="password"
                                    placeholder="Password"
                                    value={suPassword}
                                    onChange={setSuPassword}
                                    nightMode={nightMode}
                                    error={suErrors.password}
                                    showToggle
                                />
                                <PixelInput
                                    icon={<Lock size={18} />}
                                    type="password"
                                    placeholder="Confirm password"
                                    value={suConfirm}
                                    onChange={setSuConfirm}
                                    nightMode={nightMode}
                                    error={suErrors.confirm}
                                    showToggle
                                />

                                {/* Avatar Color Picker */}
                                <div>
                                    <p className={`font-display text-[8px] uppercase tracking-widest mb-2 ${nightMode ? 'text-slate-400' : 'text-slate-500'
                                        }`}>
                                        <Sparkles size={12} className="inline mr-1" />
                                        Choose Avatar Color
                                    </p>
                                    <div className="flex gap-2 flex-wrap">
                                        {AVATAR_COLORS.map((c) => (
                                            <motion.button
                                                key={c}
                                                onClick={() => setSelectedColor(c)}
                                                whileHover={{ scale: 1.2 }}
                                                whileTap={{ scale: 0.8 }}
                                                className={`w-8 h-8 border-3 cursor-pointer transition-all ${selectedColor === c
                                                    ? 'border-white shadow-[0_0_12px_rgba(255,255,255,0.5)] scale-110'
                                                    : nightMode
                                                        ? 'border-slate-600 hover:border-slate-400'
                                                        : 'border-slate-300 hover:border-slate-500'
                                                    }`}
                                                style={{ backgroundColor: c }}
                                            >
                                                {selectedColor === c && (
                                                    <motion.div
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        className="w-full h-full flex items-center justify-center"
                                                    >
                                                        <div className="w-2 h-2 bg-white" />
                                                    </motion.div>
                                                )}
                                            </motion.button>
                                        ))}
                                    </div>
                                </div>

                                <PixelButton
                                    variant="primary"
                                    size="lg"
                                    className="w-full text-sm"
                                    onClick={handleSignUp}
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <motion.span
                                            animate={{ opacity: [1, 0.5, 1] }}
                                            transition={{ duration: 0.8, repeat: Infinity }}
                                        >
                                            Creating Warrior...
                                        </motion.span>
                                    ) : (
                                        <>
                                            <Swords size={16} className="inline mr-2" />
                                            Create Account
                                        </>
                                    )}
                                </PixelButton>

                                <p className={`text-center font-body text-base ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Already have an account?{' '}
                                    <button
                                        onClick={() => { setTab('signin'); setSuErrors({}); }}
                                        className={`underline font-bold ${nightMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-500'} transition-colors cursor-pointer`}
                                    >
                                        Sign In
                                    </button>
                                </p>
                            </motion.div>
                        )}

                        {/* ── Guest divider + button ── */}
                        {!successMsg && (
                            <>
                                <div className="relative py-1">
                                    <div className={`absolute inset-0 flex items-center ${nightMode ? 'opacity-30' : 'opacity-20'}`}>
                                        <div className="w-full border-t-2 border-dashed border-slate-400" />
                                    </div>
                                    <div className={`relative flex justify-center ${nightMode ? 'bg-slate-800' : 'bg-white'}`}>
                                        <span className={`px-4 font-display text-[8px] uppercase tracking-widest ${nightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                            or skip for now
                                        </span>
                                    </div>
                                </div>

                                <PixelButton
                                    variant="accent"
                                    size="md"
                                    className="w-full text-xs"
                                    onClick={handleGuest}
                                    disabled={isLoading}
                                >
                                    <Ghost size={16} className="inline mr-2" />
                                    Play as Guest
                                </PixelButton>
                            </>
                        )}
                    </div>

                    {/* ═══ FOOTER ═══ */}
                    <div className={`px-6 py-3 text-center font-body text-sm border-t-2 ${nightMode
                        ? 'border-slate-700 text-slate-600 bg-slate-800/50'
                        : 'border-slate-100 text-slate-400 bg-slate-50'
                        }`}>
                        🔒 Your data is stored locally on this device
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

/* ═══════════════════════════════════════════════════════
   Player Profile Badge (shown in top-right of main menu)
   ═══════════════════════════════════════════════════════ */

export const PlayerProfileBadge: React.FC<{
    user: UserProfile;
    nightMode: boolean;
    onLogout: () => void;
}> = ({ user, nightMode, onLogout }) => {
    const [showMenu, setShowMenu] = useState(false);

    // XP progress calc
    const xpForNextLevel = user.level * 100;
    const xpProgress = (user.xp / xpForNextLevel) * 100;

    return (
        <div className="fixed top-4 right-4 z-50">
            <motion.div
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
            >
                <motion.button
                    onClick={() => setShowMenu(!showMenu)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={`flex items-center gap-3 px-4 py-2 border-4 cursor-pointer transition-colors duration-500 ${nightMode
                        ? 'bg-slate-800/90 border-indigo-600 hover:border-indigo-400'
                        : 'bg-white/90 border-slate-700 hover:border-indigo-500'
                        }`}
                >
                    {/* Mini avatar */}
                    <div
                        className="w-8 h-8 border-2 border-black/30 flex items-center justify-center"
                        style={{ backgroundColor: user.avatarColor }}
                    >
                        <div className="w-2 h-2 bg-white" />
                    </div>

                    <div className="text-left">
                        <p className={`font-display text-[9px] uppercase tracking-wide ${nightMode ? 'text-indigo-300' : 'text-slate-800'
                            }`}>
                            {user.username}
                        </p>
                        <p className={`font-body text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            {user.isGuest ? '👻 Guest' : `⚔️ Lv.${user.level}`}
                        </p>
                    </div>

                    <ChevronRight
                        size={14}
                        className={`transition-transform duration-200 ${showMenu ? 'rotate-90' : ''} ${nightMode ? 'text-slate-500' : 'text-slate-400'
                            }`}
                    />
                </motion.button>

                {/* Dropdown menu */}
                <AnimatePresence>
                    {showMenu && (
                        <motion.div
                            initial={{ opacity: 0, y: -8, scaleY: 0.8 }}
                            animate={{ opacity: 1, y: 4, scaleY: 1 }}
                            exit={{ opacity: 0, y: -8, scaleY: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className={`absolute right-0 top-full mt-1 w-64 border-4 shadow-[6px_6px_0_0_rgba(0,0,0,0.2)] ${nightMode
                                ? 'bg-slate-800 border-slate-600'
                                : 'bg-white border-slate-700'
                                }`}
                            style={{ transformOrigin: 'top right' }}
                        >
                            {/* Profile header */}
                            <div className={`p-4 border-b-2 ${nightMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-12 h-12 border-3 border-black/30 flex items-center justify-center"
                                        style={{ backgroundColor: user.avatarColor }}
                                    >
                                        <MiniStickman color={user.avatarColor} size={30} />
                                    </div>
                                    <div>
                                        <p className={`font-display text-xs uppercase ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>
                                            {user.username}
                                        </p>
                                        <p className={`font-body text-sm ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {user.isGuest ? 'Guest Account' : (user.email || 'Registered')}
                                        </p>
                                    </div>
                                </div>

                                {/* XP bar */}
                                {!user.isGuest && (
                                    <div className="mt-3">
                                        <div className="flex justify-between mb-1">
                                            <span className={`font-display text-[7px] uppercase ${nightMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                                Level {user.level}
                                            </span>
                                            <span className={`font-body text-xs ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {user.xp}/{xpForNextLevel} XP
                                            </span>
                                        </div>
                                        <div className={`w-full h-2 ${nightMode ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${xpProgress}%` }}
                                                transition={{ duration: 0.8, delay: 0.3 }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Stats row */}
                            <div className={`grid grid-cols-2 gap-0 border-b-2 ${nightMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                <div className={`p-3 text-center border-r-2 ${nightMode ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <p className={`font-display text-lg ${nightMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                        {user.wins}
                                    </p>
                                    <p className={`font-display text-[7px] uppercase ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Wins
                                    </p>
                                </div>
                                <div className="p-3 text-center">
                                    <p className={`font-display text-lg ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                                        {user.matches}
                                    </p>
                                    <p className={`font-display text-[7px] uppercase ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                        Matches
                                    </p>
                                </div>
                            </div>

                            {/* Logout button */}
                            <div className="p-3">
                                <PixelButton variant="danger" size="sm" className="w-full text-[10px]" onClick={() => {
                                    setShowMenu(false);
                                    onLogout();
                                }}>
                                    Log Out
                                </PixelButton>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════
   Utility: Get stored session if any
   ═══════════════════════════════════════════════════════ */

export function getStoredSession(): UserProfile | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}
