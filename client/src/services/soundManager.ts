/**
 * Central Sound Manager — manages background music & SFX for the entire app.
 *
 * Rules:
 *  • Only ONE looping BGM track plays at a time (homepage / grassgame / hotdynamic).
 *  • Switching to a new BGM cross-fades the old one out.
 *  • Button-click is a one-shot SFX that plays *on top of* any BGM.
 */

import homepageSrc from "../assets/homepage.mpeg";
import grassgameSrc from "../assets/grassgame.mpeg";
import hotdynamicSrc from "../assets/hotdynamic.mpeg";
import buttonclickSrc from "../assets/buttonclick.mpeg";

export type BgmTrack = "homepage" | "grassgame" | "hotdynamic" | "none";

const BGM_SOURCES: Record<Exclude<BgmTrack, "none">, string> = {
  homepage: homepageSrc,
  grassgame: grassgameSrc,
  hotdynamic: hotdynamicSrc,
};

class SoundManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private currentTrack: BgmTrack = "none";
  private sfxClick: HTMLAudioElement | null = null;
  private bgmVolume = 0.35;
  private sfxVolume = 0.6;
  private muted = false;

  constructor() {
    // Pre-create click SFX element so it's ready instantly
    this.sfxClick = new Audio(buttonclickSrc);
    this.sfxClick.volume = this.sfxVolume;
  }

  /* ── BGM ─────────────────────────────────────────── */

  /** Start (or switch to) a looping background track. */
  playBgm(track: BgmTrack) {
    if (track === this.currentTrack) return;

    // Stop whatever is currently playing
    this.stopBgm();

    if (track === "none") return;

    const src = BGM_SOURCES[track];
    this.bgmAudio = new Audio(src);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = this.muted ? 0 : this.bgmVolume;
    this.bgmAudio.play().catch(() => {
      // Autoplay blocked — will retry on next user interaction
    });
    this.currentTrack = track;
  }

  /** Stop current BGM. */
  stopBgm() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.bgmAudio.src = "";
      this.bgmAudio = null;
    }
    this.currentTrack = "none";
  }

  getCurrentTrack(): BgmTrack {
    return this.currentTrack;
  }

  /* ── SFX ─────────────────────────────────────────── */

  /** Play button-click sound (one-shot, overlays on BGM). */
  playClick() {
    if (this.muted) return;
    // Clone so rapid clicks don't cut each other off
    const click = this.sfxClick!.cloneNode() as HTMLAudioElement;
    click.volume = this.sfxVolume;
    click.play().catch(() => {});
  }

  /* ── Volume / Mute ───────────────────────────────── */

  setMuted(m: boolean) {
    this.muted = m;
    if (this.bgmAudio) {
      this.bgmAudio.volume = m ? 0 : this.bgmVolume;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setBgmVolume(v: number) {
    this.bgmVolume = Math.max(0, Math.min(1, v));
    if (this.bgmAudio && !this.muted) {
      this.bgmAudio.volume = this.bgmVolume;
    }
  }

  setSfxVolume(v: number) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
  }
}

/** Singleton instance used across the entire app */
export const soundManager = new SoundManager();
