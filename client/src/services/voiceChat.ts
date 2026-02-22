/**
 * VoiceChat — WebRTC mesh voice-chat using Colyseus as the signaling channel.
 *
 * Architecture (full-mesh, each pair = one RTCPeerConnection):
 *   - On join: server gives list of existing participants → this client
 *     sends an Offer to each of them.
 *   - Later joiners receive voice_joined → they send Offers to the newcomer.
 *   - ICE candidates and SDP are relayed through the Colyseus room.
 *
 * Signal messages (via Colyseus room.send / room.onMessage):
 *   OUTBOUND  → server (relayed to peer)
 *     voice_join               {}
 *     voice_leave              {}
 *     voice_offer              { to, sdp }
 *     voice_answer             { to, sdp }
 *     voice_ice                { to, candidate }
 *     voice_speaking           { speaking: boolean }
 *   INBOUND  ← server
 *     voice_peers              { peers: [{sessionId, displayName}][] }
 *     voice_joined             { sessionId, displayName }
 *     voice_left               { sessionId }
 *     voice_offer              { from, sdp }
 *     voice_answer             { from, sdp }
 *     voice_ice                { from, candidate }
 *     voice_speaking           { sessionId, speaking }
 */

import { Room } from 'colyseus.js';

// ICE servers: Google STUN + Open Relay TURN (free, handles cross-NAT / cross-network)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export interface VoicePeer {
  sessionId: string;
  displayName: string;
  speaking: boolean;
}

type VoiceEventMap = {
  peersChanged: VoicePeer[];
  speakingChanged: { sessionId: string; speaking: boolean };
  error: string;
};

type Listener<T> = (payload: T) => void;

export class VoiceChat {
  private room: Room;
  private mySessionId: string;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, VoicePeer>();
  private pcs = new Map<string, RTCPeerConnection>();
  /** Queue ICE candidates that arrive before setRemoteDescription completes */
  private iceCandidateQueue = new Map<string, RTCIceCandidateInit[]>();
  /** Track which PCs have a remote description set (safe to add candidates) */
  private remoteDescSet = new Set<string>();
  /** Audio elements keyed by peerId — kept alive to avoid GC stopping playback */
  private audioEls = new Map<string, HTMLAudioElement>();
  private offHandlers: Array<() => void> = [];
  private listeners: { [K in keyof VoiceEventMap]?: Listener<VoiceEventMap[K]>[] } = {};

  /** AudioContext analyser for local speaking detection */
  private analyserCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingTimer: ReturnType<typeof setInterval> | null = null;

  private _isMuted = false;
  private _isJoined = false;

  constructor(room: Room, mySessionId: string) {
    this.room = room;
    this.mySessionId = mySessionId;
    this._registerSignalingHandlers();
  }

  get isJoined() { return this._isJoined; }
  get isMuted() { return this._isMuted; }

  // ─── Public API ────────────────────────────────────────────────────────────

  async join(): Promise<void> {
    if (this._isJoined) return;

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      console.log('[VoiceChat] Mic acquired, tracks:', this.localStream.getAudioTracks().length);
    } catch (err) {
      console.error('[VoiceChat] Mic error:', err);
      this._emit('error', 'Microphone permission denied or unavailable');
      return;
    }

    this._startSpeakingDetection();
    this._isJoined = true;
    this._safeSend('voice_join', {});
    console.log('[VoiceChat] Joined voice channel');
  }

  leave(): void {
    if (!this._isJoined) return;
    this._isJoined = false;
    this._safeSend('voice_leave', {});
    this._cleanup();
    console.log('[VoiceChat] Left voice channel');
  }

  mute(): void {
    this._isMuted = true;
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = false; });
  }

  unmute(): void {
    this._isMuted = false;
    this.localStream?.getAudioTracks().forEach(t => { t.enabled = true; });
  }

  on<K extends keyof VoiceEventMap>(event: K, cb: Listener<VoiceEventMap[K]>): () => void {
    if (!this.listeners[event]) this.listeners[event] = [] as any;
    (this.listeners[event] as Listener<VoiceEventMap[K]>[]).push(cb);
    return () => {
      this.listeners[event] = (this.listeners[event] as Listener<VoiceEventMap[K]>[]).filter(l => l !== cb) as any;
    };
  }

  destroy(): void {
    this.leave();
    this.offHandlers.forEach(off => off());
    this.offHandlers = [];
  }

  // ─── Signaling message handlers ────────────────────────────────────────────

  private _registerSignalingHandlers() {
    const reg = (type: string, handler: (msg: any) => void) => {
      const off = this.room.onMessage(type, handler);
      if (typeof off === 'function') this.offHandlers.push(off);
    };

    // Server gives me the list of peers already in voice — I am the newcomer, I send offers
    reg('voice_peers', ({ peers }: { peers: { sessionId: string; displayName: string }[] }) => {
      console.log('[VoiceChat] voice_peers — existing peers:', peers.map(p => p.displayName));
      peers.forEach(p => {
        this.peers.set(p.sessionId, { ...p, speaking: false });
        this._createOffer(p.sessionId);
      });
      this._emit('peersChanged', this._peerList());
    });

    // A new participant joined after me — they will send me an offer
    reg('voice_joined', ({ sessionId, displayName }: { sessionId: string; displayName: string }) => {
      console.log('[VoiceChat] voice_joined:', displayName, sessionId);
      this.peers.set(sessionId, { sessionId, displayName, speaking: false });
      this._emit('peersChanged', this._peerList());
      // Pre-create the PC so it's ready with tracks before their offer arrives
      this._getOrCreatePC(sessionId);
    });

    // A participant left
    reg('voice_left', ({ sessionId }: { sessionId: string }) => {
      console.log('[VoiceChat] voice_left:', sessionId);
      this._closePeer(sessionId);
      this.peers.delete(sessionId);
      this._emit('peersChanged', this._peerList());
    });

    // Incoming SDP offer from a peer — create answer
    reg('voice_offer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      console.log('[VoiceChat] voice_offer from:', from);
      try {
        const pc = this._getOrCreatePC(from);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        this._markRemoteSet(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this._safeSend('voice_answer', { to: from, sdp: pc.localDescription });
        console.log('[VoiceChat] voice_answer sent to:', from);
      } catch (err) {
        console.error('[VoiceChat] Error handling offer from', from, err);
      }
    });

    // Incoming SDP answer — finalize connection
    reg('voice_answer', async ({ from, sdp }: { from: string; sdp: RTCSessionDescriptionInit }) => {
      console.log('[VoiceChat] voice_answer from:', from);
      try {
        const pc = this.pcs.get(from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          this._markRemoteSet(from);
        }
      } catch (err) {
        console.error('[VoiceChat] Error handling answer from', from, err);
      }
    });

    // Incoming ICE candidate — queue if remote description not yet set
    reg('voice_ice', async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      if (!candidate) return;
      const pc = this.pcs.get(from);
      if (!pc) return;

      if (this.remoteDescSet.has(from)) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale */ }
      } else {
        // Queue until remote description is ready
        if (!this.iceCandidateQueue.has(from)) this.iceCandidateQueue.set(from, []);
        this.iceCandidateQueue.get(from)!.push(candidate);
      }
    });

    // Peer speaking status
    reg('voice_speaking', ({ sessionId, speaking }: { sessionId: string; speaking: boolean }) => {
      const peer = this.peers.get(sessionId);
      if (peer) {
        peer.speaking = speaking;
        this._emit('speakingChanged', { sessionId, speaking });
      }
    });
  }

  // ─── WebRTC helpers ────────────────────────────────────────────────────────

  private _getOrCreatePC(peerId: string): RTCPeerConnection {
    if (this.pcs.has(peerId)) return this.pcs.get(peerId)!;

    console.log('[VoiceChat] Creating RTCPeerConnection for:', peerId);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    // Add local audio tracks so both sides send audio
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => {
        pc.addTrack(t, this.localStream!);
        console.log('[VoiceChat] Added local track to PC for:', peerId, t.kind);
      });
    }

    // Play incoming remote audio — keep element reference alive so GC doesn't kill it
    pc.ontrack = (evt) => {
      console.log('[VoiceChat] ontrack from peer:', peerId, 'streams:', evt.streams.length);
      const stream = evt.streams[0];
      if (!stream) return;

      let audio = this.audioEls.get(peerId);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        this.audioEls.set(peerId, audio);
      }
      audio.srcObject = stream;
      audio.play().catch(e => console.warn('[VoiceChat] Audio play blocked:', e));
    };

    // Relay ICE candidates to peer via signaling
    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this._safeSend('voice_ice', { to: peerId, candidate: evt.candidate.toJSON() });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[VoiceChat] ICE gathering state for', peerId, ':', pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[VoiceChat] ICE connection state for', peerId, ':', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        console.warn('[VoiceChat] ICE failed for', peerId, '— restarting ICE');
        pc.restartIce();
      }
      if (pc.iceConnectionState === 'closed') {
        this._closePeer(peerId);
        this.peers.delete(peerId);
        this._emit('peersChanged', this._peerList());
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[VoiceChat] Connection state for', peerId, ':', pc.connectionState);
    };

    this.pcs.set(peerId, pc);
    return pc;
  }

  private async _createOffer(peerId: string): Promise<void> {
    try {
      const pc = this._getOrCreatePC(peerId);
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      this._safeSend('voice_offer', { to: peerId, sdp: pc.localDescription });
      console.log('[VoiceChat] voice_offer sent to:', peerId);
    } catch (err) {
      console.error('[VoiceChat] Error creating offer for', peerId, err);
    }
  }

  /** Mark remote description as set and flush queued ICE candidates */
  private async _markRemoteSet(peerId: string): Promise<void> {
    this.remoteDescSet.add(peerId);
    const queued = this.iceCandidateQueue.get(peerId);
    if (queued && queued.length > 0) {
      console.log('[VoiceChat] Flushing', queued.length, 'queued ICE candidates for', peerId);
      const pc = this.pcs.get(peerId);
      if (pc) {
        for (const c of queued) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* stale */ }
        }
      }
      this.iceCandidateQueue.delete(peerId);
    }
  }

  private _closePeer(peerId: string): void {
    this.pcs.get(peerId)?.close();
    this.pcs.delete(peerId);
    this.remoteDescSet.delete(peerId);
    this.iceCandidateQueue.delete(peerId);
    const audio = this.audioEls.get(peerId);
    if (audio) {
      audio.srcObject = null;
      this.audioEls.delete(peerId);
    }
  }

  // ─── Speaking detection (AudioContext analyser, 80 ms polling) ────────────

  private _startSpeakingDetection() {
    if (!this.localStream) return;
    try {
      this.analyserCtx = new AudioContext();
      const source = this.analyserCtx.createMediaStreamSource(this.localStream);
      this.analyser = this.analyserCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const data = new Uint8Array(this.analyser.fftSize);
      let lastSent = false;

      this.speakingTimer = setInterval(() => {
        if (!this.analyser) return;
        this.analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const speaking = rms > 0.02;

        if (speaking !== lastSent) {
          lastSent = speaking;
          this._safeSend('voice_speaking', { speaking });
          this._emit('speakingChanged', { sessionId: this.mySessionId, speaking });
        }
      }, 80);
    } catch {
      // AudioContext may not be available
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  private _cleanup(): void {
    if (this.speakingTimer) { clearInterval(this.speakingTimer); this.speakingTimer = null; }
    this.analyserCtx?.close().catch(() => {});
    this.analyserCtx = null;
    this.analyser = null;

    this.pcs.forEach((_, peerId) => this._closePeer(peerId));
    this.pcs.clear();
    this.remoteDescSet.clear();
    this.iceCandidateQueue.clear();
    this.audioEls.clear();
    this.peers.clear();

    this.localStream?.getTracks().forEach(t => t.stop());
    this.localStream = null;

    this._emit('peersChanged', []);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Safely send a message, swallowing errors if the WebSocket is already closed. */
  private _safeSend(type: string, message: unknown): void {
    try {
      this.room.send(type, message);
    } catch {
      // WebSocket already closed (e.g. room transition) — ignore
    }
  }

  private _emit<K extends keyof VoiceEventMap>(event: K, payload: VoiceEventMap[K]): void {
    (this.listeners[event] as Listener<VoiceEventMap[K]>[] | undefined)?.forEach(cb => cb(payload));
  }

  private _peerList(): VoicePeer[] {
    return Array.from(this.peers.values());
  }
}
