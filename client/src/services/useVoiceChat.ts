import { useEffect, useRef, useState, useCallback } from "react";
import { Room } from "colyseus.js";
import { VoiceChat, VoicePeer } from "./voiceChat";

export interface UseVoiceChatResult {
  /** List of all voice participants (remote peers only) */
  peers: VoicePeer[];
  /** Whether this client is in the voice channel */
  isJoined: boolean;
  /** Whether the local mic is muted */
  isMuted: boolean;
  /** Whether the local user is currently speaking */
  isSpeaking: boolean;
  /** Record of sessionId → currently speaking */
  speakingMap: Record<string, boolean>;
  /** Join voice chat (requests mic permission) */
  join: () => Promise<void>;
  /** Leave voice chat */
  leave: () => void;
  /** Toggle mute */
  toggleMute: () => void;
}

export function useVoiceChat(
  room: Room | null,
  mySessionId?: string,
): UseVoiceChatResult {
  const chatRef = useRef<VoiceChat | null>(null);
  const [peers, setPeers] = useState<VoicePeer[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});

  // Build / destroy VoiceChat when room changes
  useEffect(() => {
    if (!room || !mySessionId) return;

    const vc = new VoiceChat(room, mySessionId);
    chatRef.current = vc;

    const offPeers = vc.on("peersChanged", (list) => {
      setPeers(list);
    });

    const offSpeaking = vc.on("speakingChanged", ({ sessionId, speaking }) => {
      setSpeakingMap((prev) => ({ ...prev, [sessionId]: speaking }));
    });

    return () => {
      offPeers();
      offSpeaking();
      vc.destroy();
      chatRef.current = null;
      setPeers([]);
      setIsJoined(false);
      setIsMuted(false);
      setSpeakingMap({});
    };
  }, [room, mySessionId]);

  const join = useCallback(async () => {
    if (!chatRef.current) return;
    await chatRef.current.join();
    setIsJoined(chatRef.current.isJoined);
    setIsMuted(chatRef.current.isMuted);
  }, []);

  const leave = useCallback(() => {
    chatRef.current?.leave();
    setIsJoined(false);
    setSpeakingMap({});
    setPeers([]);
  }, []);

  const toggleMute = useCallback(() => {
    const vc = chatRef.current;
    if (!vc) return;
    if (vc.isMuted) {
      vc.unmute();
      setIsMuted(false);
    } else {
      vc.mute();
      setIsMuted(true);
    }
  }, []);

  const isSpeaking = speakingMap[mySessionId ?? ""] ?? false;

  return {
    peers,
    isJoined,
    isMuted,
    isSpeaking,
    speakingMap,
    join,
    leave,
    toggleMute,
  };
}
