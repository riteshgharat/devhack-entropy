import React, { useEffect, useRef, useState, useCallback } from "react";
import { Room } from "colyseus.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  MessageCircle,
  Zap,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Users,
} from "lucide-react";
import { AIOverlayData } from "./BigOverlayBanner";
import { speakCommentary, VoiceSettings } from "../services/voiceCommentary";
import { useVoiceChat } from "../services/useVoiceChat";

// ─── Types ────────────────────────────────────────────────

interface ChatMsg {
  id: string;
  playerId: string;
  displayName: string;
  text: string;
  createdAt: number;
}

interface EmojiEvent {
  id: string;
  displayName: string;
  emoji: string;
  createdAt: number;
}

interface ArenaEvent {
  type: string;
  payload?: Record<string, unknown>;
}

interface FloatingEmoji {
  id: string;
  emoji: string;
  x: number;
}

const EMOJIS = ["🔥", "😂", "😱", "💀", "⚡", "🏆", "👀", "💥"];

const ARENA_EVENT_LABELS: Record<string, string> = {
  shrink_boundary: "⚠️ Arena is shrinking!",
  spawn_random_hazard: "☠️ New hazard spawned!",
  speed_up: "⚡ Speed boost active!",
  slow_mo: "🐢 Slow motion incoming!",
  spotlight_player: "🎯 Spotlight on the leader!",
  none: "",
};

// ─── Props ────────────────────────────────────────────────

interface Props {
  room: Room;
  nightMode: boolean;
  mySessionId?: string;
  /** Called when an AI overlay fires so the parent can render it over the canvas */
  onOverlay?: (overlay: AIOverlayData) => void;
  /** Voice commentary settings from App-level state */
  voiceSettings?: VoiceSettings;
}

// ─── Voice participant row ─────────────────────────────────

interface VoiceParticipantRowProps {
  name: string;
  speaking: boolean;
  muted?: boolean;
  nightMode: boolean;
  isSelf?: boolean;
}

const VoiceParticipantRow: React.FC<VoiceParticipantRowProps> = ({
  name,
  speaking,
  muted,
  nightMode,
  isSelf,
}) => (
  <div
    className={`flex items-center gap-1.5 px-1 py-0.5 rounded text-[10px] transition-colors ${
      speaking
        ? nightMode
          ? "bg-emerald-900/50 text-emerald-300"
          : "bg-emerald-50 text-emerald-700"
        : nightMode
          ? "text-slate-400"
          : "text-slate-500"
    }`}
  >
    {/* Speaking ring */}
    <div
      className={`relative w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
        speaking
          ? "border-emerald-400"
          : nightMode
            ? "border-slate-600"
            : "border-slate-300"
      }`}
    >
      {speaking && (
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-400/30"
          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
      )}
      {muted ? (
        <MicOff size={7} className="text-red-400" />
      ) : (
        <Mic
          size={7}
          className={
            speaking
              ? "text-emerald-400"
              : nightMode
                ? "text-slate-500"
                : "text-slate-400"
          }
        />
      )}
    </div>
    <span className="truncate flex-1 font-display">{name}</span>
    {isSelf && <span className="text-[8px] opacity-50">(you)</span>}
  </div>
);

// ─── Component ────────────────────────────────────────────

export const CommunicationHub: React.FC<Props> = ({
  room,
  nightMode,
  mySessionId,
  onOverlay,
  voiceSettings,
}) => {
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [emojiCooldowns, setEmojiCooldowns] = useState<Record<string, number>>(
    {},
  );
  const [arenaMsg, setArenaMsg] = useState<string>("");
  const [arenaFlash, setArenaFlash] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const arenaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep voiceSettings in a ref so the stable onMessage handler always reads latest value
  const voiceSettingsRef = useRef(voiceSettings);
  useEffect(() => {
    voiceSettingsRef.current = voiceSettings;
  }, [voiceSettings]);

  // ─── Voice Chat ───────────────────────────────────────────
  const {
    peers: voicePeers,
    isJoined: voiceJoined,
    isMuted,
    isSpeaking,
    speakingMap,
    join: joinVoice,
    leave: leaveVoice,
    toggleMute,
  } = useVoiceChat(room, mySessionId);

  const EMOJI_COOLDOWN = 2500;

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ─── Register all Colyseus message handlers ─────────────
  useEffect(() => {
    const handlers = [
      room.onMessage("chat_message", (msg: ChatMsg) => {
        setChat((prev) => [...prev.slice(-49), msg]);
        // Speak AI Game-Master messages aloud using the current (ref) voice settings
        if (msg.playerId === "ai_game_master" && voiceSettingsRef.current) {
          speakCommentary(msg.text, voiceSettingsRef.current);
        }
      }),

      room.onMessage("emoji_reaction", (event: EmojiEvent) => {
        spawnFloatingEmoji(event.emoji);
      }),

      room.onMessage("ai_overlay", (overlay: AIOverlayData) => {
        onOverlay?.(overlay);
      }),

      room.onMessage(
        "ai_emoji_burst",
        (data: { emoji: string; target: string }) => {
          // Fire 5 simultaneous floating emojis
          for (let i = 0; i < 5; i++) {
            setTimeout(() => spawnFloatingEmoji(data.emoji), i * 80);
          }
        },
      ),

      room.onMessage("arena_event", (event: ArenaEvent) => {
        const label = ARENA_EVENT_LABELS[event.type] ?? "";
        if (label) {
          setArenaMsg(label);
          setArenaFlash(true);
          if (arenaTimerRef.current) clearTimeout(arenaTimerRef.current);
          arenaTimerRef.current = setTimeout(() => {
            setArenaFlash(false);
            setArenaMsg("");
          }, 4000);
        }
      }),
    ];

    return () => {
      // Colyseus onMessage returns a function to remove the handler
      handlers.forEach((off) => typeof off === "function" && off());
      if (arenaTimerRef.current) clearTimeout(arenaTimerRef.current);
    };
  }, [room, onOverlay]);

  const spawnFloatingEmoji = useCallback((emoji: string) => {
    const id = `fe_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const x = 5 + Math.random() * 90; // % from left within hub
    setFloatingEmojis((prev) => [...prev.slice(-14), { id, emoji, x }]);
    setTimeout(
      () => setFloatingEmojis((prev) => prev.filter((e) => e.id !== id)),
      1800,
    );
  }, []);

  const sendChat = useCallback(() => {
    const text = input.trim();
    if (!text || text.length > 200) return;
    room.send("chat_message", { text });
    setInput("");
  }, [input, room]);

  const sendEmoji = useCallback(
    (emoji: string) => {
      const now = Date.now();
      const last = emojiCooldowns[emoji] ?? 0;
      if (now - last < EMOJI_COOLDOWN) return;
      setEmojiCooldowns((prev) => ({ ...prev, [emoji]: now }));
      room.send("emoji_reaction", { emoji });
      spawnFloatingEmoji(emoji);
    },
    [emojiCooldowns, room, spawnFloatingEmoji],
  );

  const bg = nightMode
    ? "bg-slate-900/95 border-slate-700 text-slate-100"
    : "bg-white/95 border-slate-200 text-slate-900";

  const inputBg = nightMode
    ? "bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500"
    : "bg-slate-100 border-slate-300 text-slate-800 placeholder-slate-400";

  return (
    <div
      className={`relative flex flex-col gap-1 h-full rounded border-2 overflow-hidden ${bg}`}
      style={{ minWidth: 240, maxWidth: 260 }}
    >
      {/* ── Floating Emojis ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        <AnimatePresence>
          {floatingEmojis.map((fe) => (
            <motion.span
              key={fe.id}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -140, scale: 1.6 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, ease: "easeOut" }}
              className="absolute text-3xl select-none"
              style={{ left: `${fe.x}%`, bottom: 80 }}
            >
              {fe.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Arena Event Banner ────────────────────────────── */}
      <AnimatePresence>
        {arenaFlash && arenaMsg && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white font-display text-[10px] uppercase tracking-widest px-3 py-1 text-center z-10 shrink-0"
          >
            {arenaMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Voice Channel ─────────────────────────────────── */}
      <div
        className={`shrink-0 px-2 pt-2 pb-1 border-b ${nightMode ? "border-slate-700" : "border-slate-200"}`}
      >
        {/* Header row */}
        <div className="flex items-center gap-1 mb-1.5">
          <Users
            size={10}
            className={nightMode ? "text-emerald-400" : "text-emerald-600"}
          />
          <span
            className={`font-display text-[9px] uppercase tracking-widest ${nightMode ? "text-emerald-400" : "text-emerald-600"}`}
          >
            Voice {voiceJoined ? `(${voicePeers.length + 1})` : ""}
          </span>
          <div className="ml-auto flex gap-1">
            {/* Mute / unmute — only show when joined */}
            {voiceJoined && (
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={toggleMute}
                title={isMuted ? "Unmute" : "Mute"}
                className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                  isMuted
                    ? nightMode
                      ? "border-red-600 bg-red-900/60 text-red-400"
                      : "border-red-400 bg-red-50 text-red-600"
                    : nightMode
                      ? "border-emerald-600 bg-emerald-900/40 text-emerald-300"
                      : "border-emerald-500 bg-emerald-50 text-emerald-600"
                }`}
              >
                {isMuted ? <MicOff size={10} /> : <Mic size={10} />}
              </motion.button>
            )}
            {/* Join / leave */}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={voiceJoined ? leaveVoice : joinVoice}
              title={voiceJoined ? "Leave voice" : "Join voice chat"}
              className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                voiceJoined
                  ? nightMode
                    ? "border-red-600 bg-red-900/60 text-red-400 hover:bg-red-900"
                    : "border-red-400 bg-red-50 text-red-500 hover:bg-red-100"
                  : nightMode
                    ? "border-slate-600 bg-slate-700 text-slate-400 hover:border-emerald-500 hover:text-emerald-400"
                    : "border-slate-300 bg-white text-slate-500 hover:border-emerald-500 hover:text-emerald-600"
              }`}
            >
              {voiceJoined ? <PhoneOff size={10} /> : <PhoneCall size={10} />}
            </motion.button>
          </div>
        </div>

        {/* Participant avatars */}
        {voiceJoined ? (
          <div className="flex flex-col gap-0.5">
            {/* Self */}
            <VoiceParticipantRow
              name="You"
              speaking={isSpeaking}
              muted={isMuted}
              nightMode={nightMode}
              isSelf
            />
            {/* Peers */}
            {voicePeers.map((peer) => (
              <VoiceParticipantRow
                key={peer.sessionId}
                name={peer.displayName}
                speaking={speakingMap[peer.sessionId] ?? false}
                nightMode={nightMode}
              />
            ))}
            {voicePeers.length === 0 && (
              <p className="text-[9px] italic text-slate-500">
                Waiting for others to join...
              </p>
            )}
          </div>
        ) : (
          <p
            className={`text-[9px] ${nightMode ? "text-slate-500" : "text-slate-400"}`}
          >
            Click <PhoneCall size={8} className="inline" /> to join voice chat
          </p>
        )}
      </div>

      {/* ── Chat Panel ────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden px-2 pt-2">
        <div
          className={`flex items-center gap-1 mb-1 font-display text-[9px] uppercase tracking-widest ${nightMode ? "text-slate-400" : "text-slate-500"}`}
        >
          <MessageCircle size={10} />
          <span>Chat</span>
          {/* Live voice indicator */}
          {voiceSettings?.enabled && (
            <motion.div
              className="ml-auto flex items-center gap-0.5 text-[8px] text-emerald-400 font-display"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Mic size={8} />
              <span>LIVE</span>
            </motion.div>
          )}
        </div>
        <div
          className="flex-1 overflow-y-auto flex flex-col gap-0.5 pr-0.5"
          style={{ scrollbarWidth: "thin" }}
        >
          {chat.map((msg) => {
            const isAI = msg.playerId === "ai_game_master";
            const isMine = msg.playerId === mySessionId;
            return (
              <div
                key={msg.id}
                className={`text-[10px] leading-snug wrap-break-word ${
                  isAI
                    ? nightMode
                      ? "text-indigo-400 bg-indigo-950/40 px-2 py-1 rounded border-l-2 border-indigo-600"
                      : "text-indigo-700 bg-indigo-50 px-2 py-1 rounded border-l-2 border-indigo-400"
                    : isMine
                      ? nightMode
                        ? "text-emerald-300"
                        : "text-emerald-600"
                      : nightMode
                        ? "text-slate-200"
                        : "text-slate-700"
                }`}
              >
                <span className="font-bold mr-1">{msg.displayName}:</span>
                <span>{msg.text}</span>
              </div>
            );
          })}
          {chat.length === 0 && (
            <p className="text-[9px] text-slate-500 italic">
              No messages yet...
            </p>
          )}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── Chat input ────────────────────────────────────── */}
      <div className="flex gap-1 px-2 pb-1 shrink-0">
        <input
          className={`flex-1 text-[11px] px-2 py-1 border rounded font-mono outline-none focus:ring-1 focus:ring-indigo-500 ${inputBg}`}
          placeholder="Say something..."
          value={input}
          maxLength={200}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              sendChat();
            }
          }}
        />
        <button
          onClick={sendChat}
          className={`p-1.5 rounded border transition-colors ${nightMode ? "bg-indigo-700 border-indigo-600 hover:bg-indigo-600 text-white" : "bg-indigo-600 border-indigo-700 hover:bg-indigo-500 text-white"}`}
        >
          <Send size={12} />
        </button>
      </div>

      {/* ── Divider ───────────────────────────────────────── */}
      <div
        className={`mx-2 border-t ${nightMode ? "border-slate-700" : "border-slate-200"}`}
      />

      {/* ── Emoji Bar ─────────────────────────────────────── */}
      <div className="shrink-0 px-2 pb-2">
        <div
          className={`flex items-center gap-1 mb-1 font-display text-[9px] uppercase tracking-widest ${nightMode ? "text-slate-400" : "text-slate-500"}`}
        >
          <Zap size={10} />
          <span>React</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {EMOJIS.map((emoji) => {
            const last = emojiCooldowns[emoji] ?? 0;
            const remaining = Math.max(0, EMOJI_COOLDOWN - (Date.now() - last));
            const onCooldown = remaining > 0;

            return (
              <button
                key={emoji}
                onClick={() => sendEmoji(emoji)}
                disabled={onCooldown}
                title={onCooldown ? `Cooldown...` : `React with ${emoji}`}
                className={`
                  relative text-xl w-9 h-9 flex items-center justify-center rounded border-2 transition-all
                  ${
                    onCooldown
                      ? "opacity-30 cursor-not-allowed border-slate-600"
                      : nightMode
                        ? "border-slate-600 hover:border-indigo-400 hover:scale-110 active:scale-95 cursor-pointer"
                        : "border-slate-300 hover:border-indigo-400 hover:scale-110 active:scale-95 cursor-pointer"
                  }
                `}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
