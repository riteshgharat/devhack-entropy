import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Room } from 'colyseus.js';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from './PixelCard';
import { PixelButton } from './PixelButton';
import { Trophy, Timer, Users, Zap, Rocket, Bomb, Sun, Moon, CheckCircle2, Circle, Crown } from 'lucide-react';

interface GameArenaProps {
    room: Room;
    nightMode: boolean;
    setNightMode: (val: boolean) => void;
    onLeave: () => void;
}

/* ── Visual effect types ── */
interface VFX {
    id: number;
    type: 'bomb' | 'rocket' | 'speed' | 'collect' | 'stun_stars' | 'speed_trail';
    x: number;
    y: number;
    timer: number;
    maxTimer: number;
    data?: any;
}

interface RocketProjectile {
    id: number;
    x: number;
    y: number;
    dx: number;
    dy: number;
    timer: number;
    trail: { x: number; y: number; alpha: number }[];
}

interface FloatingText {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    timer: number;
}

interface SpeedParticle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    timer: number;
    maxTimer: number;
    color: string;
}

/* ── Player colors ── */
const PLAYER_COLORS = [
    '#ef4444', '#3b82f6', '#22c55e', '#eab308',
    '#a855f7', '#f97316', '#ec4899', '#06b6d4',
];

const TILE_SIZE = 64;
const GRID_COLS = 12;
const GRID_ROWS = 8;
const ARENA_W = GRID_COLS * TILE_SIZE; // 768
const ARENA_H = GRID_ROWS * TILE_SIZE; // 512
const TOTAL_GRASS = GRID_COLS * GRID_ROWS;
const MAX_PLAYERS = 8;

/* ══════════════════════════════════════════════════════════════
   SPIKY GRASS BUSH — pointed leaves radiating from center
   Matches reference: bright green star-burst on dark ground
   ══════════════════════════════════════════════════════════════ */
function makeDahliaTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d')!;
    const cx = size / 2, cy = size / 2;

    // ── Dark ground base ──
    g.fillStyle = '#4a3f5a';
    g.fillRect(0, 0, size, size);
    // Subtle ground texture
    g.fillStyle = '#544868';
    g.fillRect(0, 0, size / 2, size / 2);
    g.fillRect(size / 2, size / 2, size / 2, size / 2);
    // Tiny specks
    for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(0,0,0,0.15)';
        g.beginPath();
        g.arc(
            size * 0.15 + Math.cos(i * 1.7) * size * 0.3,
            size * 0.15 + Math.sin(i * 2.3) * size * 0.3,
            1.5, 0, Math.PI * 2
        );
        g.fill();
    }

    // ── Center body (small dark green circle) ──
    const bodyR = size * 0.12;
    g.fillStyle = '#2d6b2d';
    g.beginPath();
    g.arc(cx, cy, bodyR, 0, Math.PI * 2);
    g.fill();

    // ── Spiky leaf blades — two rings ──
    // Outer ring: longer, thinner leaves
    const outerLeaves = 12;
    for (let i = 0; i < outerLeaves; i++) {
        const angle = (Math.PI * 2 / outerLeaves) * i + 0.15;
        const len = size * 0.38 + (i % 3) * size * 0.04;
        const tipX = cx + Math.cos(angle) * len;
        const tipY = cy + Math.sin(angle) * len;
        const halfW = size * 0.04;

        // Leaf shape: narrow at base, tapers to sharp point
        const baseX = cx + Math.cos(angle) * bodyR * 0.5;
        const baseY = cy + Math.sin(angle) * bodyR * 0.5;
        const perp = angle + Math.PI / 2;
        const midR = len * 0.4;
        const midX = cx + Math.cos(angle) * midR;
        const midY = cy + Math.sin(angle) * midR;

        // Alternate bright greens
        const colors = ['#5fcc37', '#4bb82a', '#6ed845', '#3da821', '#7ae650', '#51c02d'];
        g.fillStyle = colors[i % colors.length];

        g.beginPath();
        g.moveTo(tipX, tipY); // sharp tip
        g.quadraticCurveTo(
            midX + Math.cos(perp) * halfW * 1.8,
            midY + Math.sin(perp) * halfW * 1.8,
            baseX + Math.cos(perp) * halfW * 0.6,
            baseY + Math.sin(perp) * halfW * 0.6
        );
        g.lineTo(
            baseX - Math.cos(perp) * halfW * 0.6,
            baseY - Math.sin(perp) * halfW * 0.6
        );
        g.quadraticCurveTo(
            midX - Math.cos(perp) * halfW * 1.8,
            midY - Math.sin(perp) * halfW * 1.8,
            tipX, tipY
        );
        g.fill();

        // Light edge highlight
        g.strokeStyle = 'rgba(180,255,120,0.3)';
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(baseX, baseY);
        g.lineTo(tipX, tipY);
        g.stroke();
    }

    // Inner ring: shorter leaves, offset angle
    const innerLeaves = 10;
    for (let i = 0; i < innerLeaves; i++) {
        const angle = (Math.PI * 2 / innerLeaves) * i + 0.45;
        const len = size * 0.24 + (i % 2) * size * 0.03;
        const tipX = cx + Math.cos(angle) * len;
        const tipY = cy + Math.sin(angle) * len;
        const halfW = size * 0.035;

        const baseX = cx + Math.cos(angle) * bodyR * 0.3;
        const baseY = cy + Math.sin(angle) * bodyR * 0.3;
        const perp = angle + Math.PI / 2;
        const midR = len * 0.45;
        const midX = cx + Math.cos(angle) * midR;
        const midY = cy + Math.sin(angle) * midR;

        const cols = ['#7ae650', '#8bf065', '#6ed845', '#5fcc37'];
        g.fillStyle = cols[i % cols.length];

        g.beginPath();
        g.moveTo(tipX, tipY);
        g.quadraticCurveTo(
            midX + Math.cos(perp) * halfW * 1.6,
            midY + Math.sin(perp) * halfW * 1.6,
            baseX, baseY
        );
        g.quadraticCurveTo(
            midX - Math.cos(perp) * halfW * 1.6,
            midY - Math.sin(perp) * halfW * 1.6,
            tipX, tipY
        );
        g.fill();
    }

    // ── Bright center highlight dot ──
    g.fillStyle = '#a4f57a';
    g.beginPath();
    g.arc(cx, cy, size * 0.04, 0, Math.PI * 2);
    g.fill();

    return c;
}

/* ── Dirt tile for eaten grass (dark ground matching theme) ── */
function makeDirtTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d')!;
    const h = size / 2;

    // Dark purple ground
    g.fillStyle = '#4a3f5a';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#544868';
    g.fillRect(0, 0, h, h);
    g.fillRect(h, h, h, h);

    // Subtle pebble dots
    const pebbles = [[size * 0.2, size * 0.3], [size * 0.6, size * 0.15], [size * 0.75, size * 0.65], [size * 0.35, size * 0.7]];
    pebbles.forEach(([px, py]) => {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.arc(px, py, 2.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.beginPath(); g.arc(px - 1, py - 1, 1.5, 0, Math.PI * 2); g.fill();
    });

    return c;
}

/* ── Small Grass Tile (phase 2 — miniature spiky bush on dark ground) ── */
function makeSmallGrassTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d')!;
    const cx = size / 2, cy = size / 2;

    // Dark ground base
    const h = size / 2;
    g.fillStyle = '#4a3f5a';
    g.fillRect(0, 0, size, size);
    g.fillStyle = '#544868';
    g.fillRect(0, 0, h, h);
    g.fillRect(h, h, h, h);

    // Pebble dots
    for (let i = 0; i < 4; i++) {
        g.fillStyle = 'rgba(0,0,0,0.15)';
        g.beginPath();
        g.arc(size * 0.15 + Math.cos(i * 2.1) * size * 0.28,
              size * 0.2 + Math.sin(i * 2.7) * size * 0.25, 1.5, 0, Math.PI * 2);
        g.fill();
    }

    // Small center body
    const bodyR = size * 0.06;
    g.fillStyle = '#2d6b2d';
    g.beginPath();
    g.arc(cx, cy, bodyR, 0, Math.PI * 2);
    g.fill();

    // Spiky leaves — 8 short pointy blades
    const leafCount = 8;
    for (let i = 0; i < leafCount; i++) {
        const angle = (Math.PI * 2 / leafCount) * i + 0.2;
        const len = size * 0.18 + (i % 3) * size * 0.02;
        const tipX = cx + Math.cos(angle) * len;
        const tipY = cy + Math.sin(angle) * len;
        const halfW = size * 0.02;

        const baseX = cx + Math.cos(angle) * bodyR * 0.4;
        const baseY = cy + Math.sin(angle) * bodyR * 0.4;
        const perp = angle + Math.PI / 2;
        const midR = len * 0.4;
        const midX = cx + Math.cos(angle) * midR;
        const midY = cy + Math.sin(angle) * midR;

        const colors = ['#7ae650', '#6ed845', '#5fcc37', '#8bf065'];
        g.fillStyle = colors[i % colors.length];

        g.beginPath();
        g.moveTo(tipX, tipY);
        g.quadraticCurveTo(
            midX + Math.cos(perp) * halfW * 1.5,
            midY + Math.sin(perp) * halfW * 1.5,
            baseX, baseY
        );
        g.quadraticCurveTo(
            midX - Math.cos(perp) * halfW * 1.5,
            midY - Math.sin(perp) * halfW * 1.5,
            tipX, tipY
        );
        g.fill();
    }

    // Bright center dot
    g.fillStyle = '#a4f57a';
    g.beginPath(); g.arc(cx, cy, size * 0.025, 0, Math.PI * 2); g.fill();

    return c;
}

/* ── Power-up icon drawing (canvas-drawn shapes) ── */
function drawPowerUpIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, time: number) {
    const bounce = Math.sin(time * 4) * 3;
    const glow = 0.5 + 0.3 * Math.sin(time * 6);

    ctx.save();
    ctx.translate(x, y + bounce);

    if (type === 'bomb') {
        // Bomb: dark circle with fuse and spark
        // Glow
        ctx.fillStyle = `rgba(239,68,68,${glow * 0.4})`;
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();

        // Body (dark sphere)
        ctx.fillStyle = '#2a2020';
        ctx.beginPath(); ctx.arc(0, 2, 11, 0, Math.PI * 2); ctx.fill();

        // Highlight crescent
        ctx.fillStyle = '#4a3838';
        ctx.beginPath(); ctx.arc(-3, -1, 8, 0, Math.PI * 2); ctx.fill();

        // Top fuse cap
        ctx.fillStyle = '#888';
        ctx.fillRect(-3, -11, 6, 5);

        // Fuse string
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.quadraticCurveTo(5, -16, 3, -19);
        ctx.stroke();

        // Spark at fuse tip
        const sparkFlicker = 0.6 + 0.4 * Math.sin(time * 12);
        ctx.fillStyle = `rgba(255,200,50,${sparkFlicker})`;
        ctx.beginPath(); ctx.arc(3, -19, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,100,30,${sparkFlicker * 0.7})`;
        ctx.beginPath(); ctx.arc(3, -19, 5, 0, Math.PI * 2); ctx.fill();

    } else if (type === 'rocket') {
        // Rocket: red/orange body, yellow nose, fins
        // Background glow box
        ctx.fillStyle = `rgba(249,165,22,${glow * 0.3})`;
        ctx.fillRect(-14, -14, 28, 28);

        // Body
        ctx.fillStyle = '#ff5533';
        ctx.fillRect(-4, -8, 8, 16);

        // Nose cone
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(-4, -8);
        ctx.lineTo(0, -15);
        ctx.lineTo(4, -8);
        ctx.closePath();
        ctx.fill();

        // Fins
        ctx.fillStyle = '#cc3300';
        ctx.beginPath();
        ctx.moveTo(-4, 5); ctx.lineTo(-8, 10); ctx.lineTo(-4, 8); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4, 5); ctx.lineTo(8, 10); ctx.lineTo(4, 8); ctx.fill();

        // Exhaust flame
        const flameH = 4 + Math.random() * 3;
        ctx.fillStyle = '#ffa500';
        ctx.beginPath();
        ctx.moveTo(-3, 8); ctx.lineTo(0, 8 + flameH); ctx.lineTo(3, 8);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.moveTo(-1.5, 8); ctx.lineTo(0, 8 + flameH * 0.6); ctx.lineTo(1.5, 8);
        ctx.closePath(); ctx.fill();

        // Window
        ctx.fillStyle = '#87ceeb';
        ctx.beginPath(); ctx.arc(0, -2, 2.5, 0, Math.PI * 2); ctx.fill();

    } else if (type === 'speed') {
        // Speed boot: blue sneaker shape
        // Background glow
        ctx.fillStyle = `rgba(56,189,248,${glow * 0.3})`;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();

        // Boot sole
        ctx.fillStyle = '#1e3a5f';
        ctx.beginPath();
        ctx.moveTo(-10, 6); ctx.lineTo(10, 6);
        ctx.lineTo(12, 9); ctx.lineTo(-10, 9);
        ctx.closePath(); ctx.fill();

        // Boot body
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(-6, 6); ctx.lineTo(-8, -4);
        ctx.lineTo(-4, -8); ctx.lineTo(0, -6);
        ctx.lineTo(6, 0); ctx.lineTo(10, 6);
        ctx.closePath(); ctx.fill();

        // Tongue
        ctx.fillStyle = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(-4, -8); ctx.lineTo(-2, -11); ctx.lineTo(1, -7);
        ctx.closePath(); ctx.fill();

        // Speed lines
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 3; i++) {
            const ly = -4 + i * 5;
            ctx.beginPath();
            ctx.moveTo(-14 - i * 2, ly);
            ctx.lineTo(-10, ly);
            ctx.stroke();
        }
    }

    ctx.restore();
}

/* ══════════════════════════════════════════════════════════════
   TOP-DOWN WALKING CHARACTER
   Renders a character from above with animated legs
   ══════════════════════════════════════════════════════════════ */
function drawTopDownCharacter(
    ctx: CanvasRenderingContext2D,
    player: any,
    color: string,
    isLocal: boolean,
    time: number
) {
    const px = player.x;
    const py = player.y;
    const isMoving = Math.abs(player.velocityX) > 5 || Math.abs(player.velocityY) > 5;
    const isStunned = player.stunTimer > 0;
    const isSpeed = player.speedMultiplier > 1;

    ctx.save();
    ctx.translate(px, py);

    // ── Speed boost aura ──
    if (isSpeed) {
        const auraAlpha = 0.3 + 0.2 * Math.sin(time * 8);
        const auraGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 40);
        auraGrad.addColorStop(0, `rgba(251,191,36,${auraAlpha})`);
        auraGrad.addColorStop(1, 'rgba(251,191,36,0)');
        ctx.fillStyle = auraGrad;
        ctx.beginPath(); ctx.arc(0, 0, 40, 0, Math.PI * 2); ctx.fill();
    }

    // ── Stun effect: spinning stars ──
    if (isStunned) {
        const starCount = 3;
        for (let i = 0; i < starCount; i++) {
            const angle = (Math.PI * 2 / starCount) * i + time * 4;
            const starX = Math.cos(angle) * 30;
            const starY = Math.sin(angle) * 14 - 34;
            ctx.save();
            ctx.translate(starX, starY);
            ctx.rotate(time * 6 + i);
            drawStar5(ctx, 0, 0, 6, 3, '#fbbf24');
            ctx.restore();
        }

        // Dazed overlay on character
        ctx.globalAlpha = 0.3 + 0.2 * Math.sin(time * 10);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
    }

    // ── Movement direction ──
    let facing = 0; // radians
    if (isMoving) {
        facing = Math.atan2(player.velocityY, player.velocityX);
    }

    // ── Walking leg animation ──
    const walkCycle = isMoving ? Math.sin(time * 10) * 0.5 : 0;
    const bodyR = 20; // bigger body radius

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 5, bodyR + 3, bodyR - 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── LEGS (drawn behind body) ──
    const legOffset = bodyR * 0.8;
    const legSpread = 9;
    const legW = 9, legH = 13;

    ctx.save();
    ctx.rotate(facing + Math.PI / 2); // Rotate so legs trail behind movement

    // Leg 1 (left side)
    ctx.save();
    ctx.translate(-legSpread, legOffset + walkCycle * 5);
    ctx.rotate(walkCycle * 0.3);
    drawLeg(ctx, color, legW, legH, isStunned);
    ctx.restore();

    // Leg 2 (right side)
    ctx.save();
    ctx.translate(legSpread, legOffset - walkCycle * 5);
    ctx.rotate(-walkCycle * 0.3);
    drawLeg(ctx, color, legW, legH, isStunned);
    ctx.restore();

    ctx.restore(); // facing rotation

    // ── BODY (top-down oval) ──
    ctx.save();
    ctx.rotate(isStunned ? Math.sin(time * 15) * 0.2 : 0); // wobble when stunned

    // Body gradient
    const bodyGrad = ctx.createRadialGradient(-4, -4, 2, 0, 0, bodyR);
    bodyGrad.addColorStop(0, lightenColor(color, 40));
    bodyGrad.addColorStop(0.6, color);
    bodyGrad.addColorStop(1, darkenColor(color, 30));
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, bodyR, bodyR - 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Belt stripe across middle
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-bodyR, -2, bodyR * 2, 4);
    // Belt buckle
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-3, -2, 6, 4);
    ctx.restore();

    ctx.restore(); // wobble rotation

    const headR = 13;
    const headX = Math.cos(facing) * 7;
    const headY = Math.sin(facing) * 7;

    // Head shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(headX + 2, headY + 2, headR, 0, Math.PI * 2); ctx.fill();

    // Head
    const headGrad = ctx.createRadialGradient(headX - 2, headY - 2, 1, headX, headY, headR);
    headGrad.addColorStop(0, lightenColor(color, 50));
    headGrad.addColorStop(1, color);
    ctx.fillStyle = headGrad;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(headX, headY, headR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Eyes — 2 small dots oriented toward movement direction
    const eyeAngle1 = facing - 0.4;
    const eyeAngle2 = facing + 0.4;
    const eyeDist = headR * 0.5;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(headX + Math.cos(eyeAngle1) * eyeDist, headY + Math.sin(eyeAngle1) * eyeDist, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headX + Math.cos(eyeAngle2) * eyeDist, headY + Math.sin(eyeAngle2) * eyeDist, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(headX + Math.cos(eyeAngle1) * eyeDist + 0.5, headY + Math.sin(eyeAngle1) * eyeDist + 0.5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(headX + Math.cos(eyeAngle2) * eyeDist + 0.5, headY + Math.sin(eyeAngle2) * eyeDist + 0.5, 2, 0, Math.PI * 2); ctx.fill();

    // ── Arms ── small stumps on sides
    ctx.save();
    ctx.rotate(facing + Math.PI / 2);
    const armSpread = bodyR + 2;
    // Left arm
    ctx.fillStyle = color;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.save();
    ctx.translate(-armSpread, -4);
    ctx.rotate(isMoving ? -walkCycle * 0.5 : 0);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    // Right arm
    ctx.save();
    ctx.translate(armSpread, -4);
    ctx.rotate(isMoving ? walkCycle * 0.5 : 0);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // ── Local player indicator ──
    if (isLocal) {
        const pulse = (Math.sin(time * 4) + 1) / 2;
        ctx.strokeStyle = '#fbbf24';
        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 2;
        const pad = 26 + pulse * 4;
        ctx.beginPath(); ctx.arc(0, 0, pad, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
    }

    // ── Speed boost lightning bolts ──
    if (isSpeed) {
        for (let i = 0; i < 3; i++) {
            const boltAngle = (Math.PI * 2 / 3) * i + time * 5;
            const bx = Math.cos(boltAngle) * 22;
            const by = Math.sin(boltAngle) * 22;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(boltAngle);
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚡', 0, 0);
            ctx.restore();
        }
    }

    ctx.restore(); // main translate

    // ── Name label ──
    ctx.save();
    ctx.translate(px, py);
    ctx.font = 'bold 8px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(player.displayName, 0, -30);
    ctx.fillStyle = isLocal ? '#fbbf24' : '#fff';
    ctx.fillText(player.displayName, 0, -30);

    // Score below
    ctx.font = 'bold 7px "Press Start 2P", monospace';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(`${player.score}`, 0, 36);
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`${player.score}`, 0, 36);
    ctx.restore();
}

function drawLeg(ctx: CanvasRenderingContext2D, color: string, w: number, h: number, stunned: boolean) {
    // Boot (bottom dark part)
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, h / 4, w * 0.65, h * 0.35, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // Leg skin
    ctx.fillStyle = stunned ? '#fbbf24' : color;
    ctx.beginPath(); ctx.ellipse(0, -h / 4, w * 0.5, h * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
}

function drawStar5(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, color: string) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
}

function lightenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
}

function darkenColor(hex: string, amount: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

/* ══════════════════════════════════════════════════════════════
   PIXEL-ART FOREST BACKGROUND
   Layered forest scene with animated trees, walking characters,
   ground details, and atmospheric particles
   ══════════════════════════════════════════════════════════════ */

/* ── Helper: draw a pixel-art pine tree ── */
function drawPineTree(
    ctx: CanvasRenderingContext2D,
    x: number, baseY: number,
    h: number, w: number,
    trunkW: number, trunkH: number,
    colors: string[], trunkColor: string,
    sway: number
) {
    ctx.save();
    ctx.translate(x, baseY);
    // Trunk
    ctx.fillStyle = trunkColor;
    ctx.fillRect(-trunkW / 2, -trunkH, trunkW, trunkH);
    // Trunk highlight
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(-trunkW / 2, -trunkH, trunkW / 3, trunkH);

    // Layered triangular canopy with sway
    const layers = 4;
    for (let i = 0; i < layers; i++) {
        const layerH = h / layers;
        const layerW = w * (1 - i * 0.2);
        const yOff = -trunkH - i * layerH * 0.75;
        const xSway = sway * (i + 1) * 0.3;

        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(xSway, yOff - layerH);
        ctx.lineTo(-layerW / 2 + xSway * 0.5, yOff);
        ctx.lineTo(layerW / 2 + xSway * 0.5, yOff);
        ctx.closePath();
        ctx.fill();

        // Edge highlight
        ctx.fillStyle = colors[(i + 1) % colors.length];
        ctx.beginPath();
        ctx.moveTo(xSway, yOff - layerH);
        ctx.lineTo(-layerW / 4 + xSway * 0.6, yOff - layerH * 0.2);
        ctx.lineTo(-layerW / 2.5 + xSway * 0.5, yOff);
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

/* ── Helper: draw a tall deciduous tree ── */
function drawTallTree(
    ctx: CanvasRenderingContext2D,
    x: number, baseY: number,
    trunkH: number, canopyR: number,
    colors: string[], trunkColor: string,
    sway: number
) {
    ctx.save();
    ctx.translate(x, baseY);
    const tw = 8 + canopyR * 0.15;

    // Trunk
    ctx.fillStyle = trunkColor;
    ctx.fillRect(-tw / 2, -trunkH, tw, trunkH);
    // Bark texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < trunkH; i += 12) {
        ctx.beginPath();
        ctx.moveTo(-tw / 2 + 2, -i);
        ctx.lineTo(-tw / 2 + tw - 2, -i - 4);
        ctx.stroke();
    }
    // Trunk highlight
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-tw / 2, -trunkH, tw / 3, trunkH);

    // Canopy — overlapping round clusters
    const cx = sway * 2;
    const cy = -trunkH;
    const clusters = [
        { dx: 0, dy: -canopyR * 0.4, r: canopyR },
        { dx: -canopyR * 0.6, dy: -canopyR * 0.1, r: canopyR * 0.75 },
        { dx: canopyR * 0.55, dy: -canopyR * 0.15, r: canopyR * 0.7 },
        { dx: -canopyR * 0.3, dy: -canopyR * 0.8, r: canopyR * 0.6 },
        { dx: canopyR * 0.25, dy: -canopyR * 0.75, r: canopyR * 0.55 },
    ];
    clusters.forEach((cl, i) => {
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(cx + cl.dx, cy + cl.dy, cl.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Highlight spots
    ctx.fillStyle = 'rgba(180,255,100,0.12)';
    ctx.beginPath();
    ctx.arc(cx - canopyR * 0.3, cy - canopyR * 0.6, canopyR * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

/* ── Helper: draw grass tufts ── */
function drawGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, sway: number) {
    const blades = 5 + Math.floor(w / 4);
    for (let i = 0; i < blades; i++) {
        const bx = x - w / 2 + (w / blades) * i + Math.sin(i * 1.3) * 2;
        const bh = h * (0.6 + Math.sin(i * 2.1) * 0.4);
        const tipSway = sway * (0.5 + i * 0.1);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(bx - 1.5, y);
        ctx.quadraticCurveTo(bx + tipSway, y - bh, bx + tipSway + 1, y - bh + 2);
        ctx.quadraticCurveTo(bx + tipSway + 2, y - bh / 2, bx + 1.5, y);
        ctx.closePath();
        ctx.fill();
    }
}

/* ── Helper: draw a small walking pixel character ── */
function drawWalkingChar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, time: number, speed: number) {
    const walk = Math.sin(time * speed) * 2;
    const legSwing = Math.sin(time * speed * 2) * 3;
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(-size * 0.6, size * 0.1, size * 1.2, size * 0.2);

    // Legs
    ctx.fillStyle = darkenColor(color, 40);
    ctx.fillRect(-size * 0.25 + legSwing * 0.3, -size * 0.1, size * 0.2, size * 0.35);
    ctx.fillRect(size * 0.1 - legSwing * 0.3, -size * 0.1, size * 0.2, size * 0.35);

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-size * 0.3, -size * 0.7 + walk * 0.3, size * 0.6, size * 0.65);

    // Head
    ctx.fillStyle = lightenColor(color, 20);
    ctx.fillRect(-size * 0.25, -size + walk * 0.3, size * 0.5, size * 0.35);

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(size * 0.0, -size * 0.85 + walk * 0.3, size * 0.12, size * 0.1);
    ctx.fillRect(size * 0.15, -size * 0.85 + walk * 0.3, size * 0.12, size * 0.1);

    ctx.restore();
}

/* ── Helper: draw pixel rock ── */
function drawRock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, nightMode: boolean) {
    const baseColor = nightMode ? '#4a4e69' : '#8d99ae';
    const highlightColor = nightMode ? '#6c7086' : '#b8c0cc';
    const shadowColor = nightMode ? '#2b2d42' : '#6b7280';

    ctx.fillStyle = shadowColor;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.lineTo(x - w * 0.3, y - h);
    ctx.lineTo(x + w * 0.4, y - h * 0.85);
    ctx.lineTo(x + w * 0.55, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.45, y);
    ctx.lineTo(x - w * 0.2, y - h * 0.95);
    ctx.lineTo(x + w * 0.35, y - h * 0.8);
    ctx.lineTo(x + w * 0.5, y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = highlightColor;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.15, y - h * 0.9);
    ctx.lineTo(x + w * 0.05, y - h * 0.6);
    ctx.lineTo(x - w * 0.3, y - h * 0.4);
    ctx.closePath();
    ctx.fill();
}

function drawArenaBackground(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    offsetX: number, offsetY: number,
    nightMode: boolean,
    time: number
) {
    // ═══ SKY GRADIENT ═══
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (nightMode) {
        skyGrad.addColorStop(0, '#0a0e1a');
        skyGrad.addColorStop(0.3, '#111833');
        skyGrad.addColorStop(0.6, '#1a2040');
        skyGrad.addColorStop(1, '#0d1117');
    } else {
        skyGrad.addColorStop(0, '#87ceeb');
        skyGrad.addColorStop(0.25, '#a8d8ea');
        skyGrad.addColorStop(0.5, '#c5ddd6');
        skyGrad.addColorStop(0.75, '#7ba68a');
        skyGrad.addColorStop(1, '#3a5a40');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ═══ SUN (day mode) ═══
    if (!nightMode) {
        const sunX = W * 0.18, sunY = H * 0.13;
        // Outer glow
        const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 80);
        sunGlow.addColorStop(0, 'rgba(255,250,200,0.5)');
        sunGlow.addColorStop(0.4, 'rgba(255,220,100,0.2)');
        sunGlow.addColorStop(1, 'rgba(255,200,50,0)');
        ctx.fillStyle = sunGlow;
        ctx.beginPath(); ctx.arc(sunX, sunY, 80, 0, Math.PI * 2); ctx.fill();

        // Sun body
        ctx.fillStyle = '#ffe066';
        ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff8d6';
        ctx.beginPath(); ctx.arc(sunX - 5, sunY - 5, 18, 0, Math.PI * 2); ctx.fill();

        // Animated sun rays
        const rayCount = 12;
        for (let r = 0; r < rayCount; r++) {
            const rayAngle = (Math.PI * 2 / rayCount) * r + time * 0.3;
            const rayLen = 18 + Math.sin(time * 2 + r * 1.5) * 8;
            const rayStart = 32;
            const rx1 = sunX + Math.cos(rayAngle) * rayStart;
            const ry1 = sunY + Math.sin(rayAngle) * rayStart;
            const rx2 = sunX + Math.cos(rayAngle) * (rayStart + rayLen);
            const ry2 = sunY + Math.sin(rayAngle) * (rayStart + rayLen);
            ctx.strokeStyle = `rgba(255,230,100,${0.4 + Math.sin(time * 3 + r) * 0.2})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.moveTo(rx1, ry1); ctx.lineTo(rx2, ry2); ctx.stroke();
        }
    }

    // ═══ STARS (night only) ═══
    if (nightMode) {
        const starSeed = [0.1, 0.23, 0.45, 0.67, 0.82, 0.91, 0.34, 0.56, 0.78, 0.12,
                          0.38, 0.61, 0.85, 0.07, 0.49, 0.72, 0.28, 0.53, 0.94, 0.16];
        for (let i = 0; i < starSeed.length; i++) {
            const sx = starSeed[i] * W;
            const sy = starSeed[(i + 7) % starSeed.length] * H * 0.45;
            const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 1.5 + i * 1.7));
            ctx.fillStyle = `rgba(255,255,240,${twinkle * 0.6})`;
            ctx.fillRect(sx, sy, 2, 2);
        }
        // Moon
        ctx.fillStyle = 'rgba(220,230,255,0.15)';
        ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 50, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(220,230,255,0.3)';
        ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(240,245,255,0.6)';
        ctx.beginPath(); ctx.arc(W * 0.82, H * 0.12, 18, 0, Math.PI * 2); ctx.fill();
    }

    // ═══ PIXEL CLOUDS ═══
    const cloudDefs = [
        { baseX: W * 0.1, y: H * 0.08, w: 90, h: 30, speed: 0.015 },
        { baseX: W * 0.35, y: H * 0.14, w: 120, h: 35, speed: 0.01 },
        { baseX: W * 0.62, y: H * 0.06, w: 80, h: 25, speed: 0.018 },
        { baseX: W * 0.85, y: H * 0.18, w: 100, h: 32, speed: 0.012 },
        { baseX: W * 0.5, y: H * 0.22, w: 70, h: 22, speed: 0.02 },
    ];
    cloudDefs.forEach(cl => {
        // Drift clouds across the screen (loop around)
        const cx = ((cl.baseX + time * cl.speed * W) % (W + cl.w * 2)) - cl.w;
        const cloudAlpha = nightMode ? 0.08 : 0.65;
        const cloudColor = nightMode ? `rgba(60,70,100,${cloudAlpha})` : `rgba(255,255,255,${cloudAlpha})`;
        const cloudShadow = nightMode ? `rgba(30,40,60,${cloudAlpha * 0.5})` : `rgba(200,210,220,${cloudAlpha * 0.6})`;

        ctx.fillStyle = cloudShadow;
        // Shadow blobs slightly offset
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.3, cl.y + cl.h * 0.6, cl.h * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.6, cl.y + cl.h * 0.55, cl.h * 0.5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = cloudColor;
        // Main cloud body — pixel-ish rounded blobs
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.2, cl.y, cl.h * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.45, cl.y - cl.h * 0.2, cl.h * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.7, cl.y, cl.h * 0.55, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.35, cl.y + cl.h * 0.1, cl.h * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.55, cl.y + cl.h * 0.05, cl.h * 0.5, 0, Math.PI * 2); ctx.fill();

        // Bright highlight on top
        const hlColor = nightMode ? `rgba(80,90,120,${cloudAlpha * 0.4})` : `rgba(255,255,255,${cloudAlpha * 0.5})`;
        ctx.fillStyle = hlColor;
        ctx.beginPath(); ctx.arc(cx + cl.w * 0.4, cl.y - cl.h * 0.3, cl.h * 0.3, 0, Math.PI * 2); ctx.fill();
    });

    // ═══ BIRDS (small V-shapes flying in sky) ═══
    const birdCount = nightMode ? 3 : 6;
    for (let b = 0; b < birdCount; b++) {
        const bSeed = ((b * 71 + 23) % 100) / 100;
        const bx = ((bSeed * W + time * (20 + b * 8)) % (W + 60)) - 30;
        const by = H * 0.05 + bSeed * H * 0.18 + Math.sin(time * 2 + b * 1.5) * 8;
        const flapAngle = Math.sin(time * 6 + b * 2) * 0.4;
        const birdColor = nightMode ? 'rgba(150,160,200,0.4)' : 'rgba(40,40,50,0.6)';

        ctx.strokeStyle = birdColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx - 6, by + flapAngle * 5);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx + 6, by + flapAngle * 5);
        ctx.stroke();
    }

    // ═══ SKY-AREA PIXEL CHARACTERS (doing activities) ═══

    // --- Runner on far mountain ridge ---
    {
        const ridgeY = H * 0.3 + Math.sin(0.005 * ((120 + time * 30) % W) + 2) * (-40) + Math.sin(0.012 * ((120 + time * 30) % W) + 1) * (-25) + 40;
        const runnerX = ((120 + time * 30) % (W + 40)) - 20;
        const rSize = 6;
        const rTime = time;
        const rSpeed = 7;
        const rWalk = Math.sin(rTime * rSpeed) * 1.5;
        const rLeg = Math.sin(rTime * rSpeed * 2) * 2;
        const runColor = nightMode ? '#6a7aaa' : '#d97706';
        ctx.save(); ctx.translate(runnerX, ridgeY - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-rSize * 0.5, rSize * 0.1, rSize, rSize * 0.15);
        ctx.fillStyle = darkenColor(runColor, 30);
        ctx.fillRect(-rSize * 0.2 + rLeg * 0.3, -rSize * 0.05, rSize * 0.15, rSize * 0.3);
        ctx.fillRect(rSize * 0.08 - rLeg * 0.3, -rSize * 0.05, rSize * 0.15, rSize * 0.3);
        ctx.fillStyle = runColor;
        ctx.fillRect(-rSize * 0.25, -rSize * 0.6 + rWalk * 0.2, rSize * 0.5, rSize * 0.55);
        ctx.fillStyle = lightenColor(runColor, 25);
        ctx.fillRect(-rSize * 0.2, -rSize * 0.85 + rWalk * 0.2, rSize * 0.4, rSize * 0.3);
        // Tiny flag the runner carries
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(rSize * 0.2, -rSize * 1.1 + rWalk * 0.2, 1, rSize * 0.45);
        ctx.fillRect(rSize * 0.2, -rSize * 1.1 + rWalk * 0.2, rSize * 0.25, rSize * 0.15);
        ctx.restore();
    }

    // --- Second mountain runner (opposite direction) ---
    {
        const ridgeY2 = H * 0.38 + Math.sin(0.005 * ((W - 80 - time * 20) % W) + 4) * (-40) + Math.sin(0.012 * ((W - 80 - time * 20) % W) + 2) * (-25) + 40;
        const runner2X = W - ((80 + time * 20) % (W + 40)) + 20;
        const rSize = 5;
        const rWalk = Math.sin(time * 6) * 1.2;
        const rLeg = Math.sin(time * 12) * 2;
        const runColor = nightMode ? '#7a8acc' : '#2563eb';
        ctx.save(); ctx.translate(runner2X, ridgeY2 - 2);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(-rSize * 0.5, rSize * 0.1, rSize, rSize * 0.12);
        ctx.fillStyle = darkenColor(runColor, 30);
        ctx.fillRect(-rSize * 0.2 + rLeg * 0.25, -rSize * 0.05, rSize * 0.15, rSize * 0.28);
        ctx.fillRect(rSize * 0.08 - rLeg * 0.25, -rSize * 0.05, rSize * 0.15, rSize * 0.28);
        ctx.fillStyle = runColor;
        ctx.fillRect(-rSize * 0.22, -rSize * 0.55 + rWalk * 0.2, rSize * 0.45, rSize * 0.5);
        ctx.fillStyle = lightenColor(runColor, 20);
        ctx.fillRect(-rSize * 0.18, -rSize * 0.8 + rWalk * 0.2, rSize * 0.36, rSize * 0.28);
        ctx.restore();
    }

    // --- Lumberjack chopping near a tree stump (left side) ---
    {
        const lx = W * 0.04, ly = H * 0.55;
        const chop = Math.abs(Math.sin(time * 3));
        const axeAngle = -0.8 + chop * 1.2;
        const lSize = 9;
        const lColor = nightMode ? '#6b8065' : '#92400e';

        // Tree stump
        ctx.fillStyle = nightMode ? '#2a1f15' : '#6b4226';
        ctx.fillRect(lx + 14, ly - 10, 8, 10);
        ctx.fillStyle = nightMode ? '#3a2f22' : '#8b6240';
        ctx.fillRect(lx + 13, ly - 12, 10, 4);
        // Stump rings
        ctx.strokeStyle = nightMode ? '#1a1510' : '#5a3a1a';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.arc(lx + 18, ly - 10, 3, 0, Math.PI * 2); ctx.stroke();

        // Lumberjack body
        ctx.save(); ctx.translate(lx, ly);
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(-lSize * 0.5, lSize * 0.05, lSize, lSize * 0.15);
        ctx.fillStyle = darkenColor(lColor, 30);
        ctx.fillRect(-lSize * 0.2, -lSize * 0.05, lSize * 0.18, lSize * 0.3);
        ctx.fillRect(lSize * 0.05, -lSize * 0.05, lSize * 0.18, lSize * 0.3);
        ctx.fillStyle = lColor;
        ctx.fillRect(-lSize * 0.28, -lSize * 0.6, lSize * 0.56, lSize * 0.58);
        ctx.fillStyle = lightenColor(lColor, 20);
        ctx.fillRect(-lSize * 0.22, -lSize * 0.88, lSize * 0.44, lSize * 0.32);
        // Axe
        ctx.save();
        ctx.translate(lSize * 0.25, -lSize * 0.45);
        ctx.rotate(axeAngle);
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, 2, lSize * 0.7);
        ctx.fillStyle = '#999';
        ctx.fillRect(-2, lSize * 0.55, 6, 4);
        ctx.restore();
        // Woodchips flying when chopping down
        if (chop > 0.8) {
            const chipColor = nightMode ? '#5a4530' : '#c4a35a';
            for (let c = 0; c < 3; c++) {
                const cx2 = 12 + Math.sin(time * 8 + c * 2) * 6;
                const cy2 = -8 - Math.abs(Math.sin(time * 10 + c * 3)) * 10;
                ctx.fillStyle = chipColor;
                ctx.fillRect(cx2, cy2, 2, 2);
            }
        }
        ctx.restore();
    }

    // --- Jumping/celebrating character (mid-sky, on a hill) ---
    {
        const jx = W * 0.92, jy = H * 0.42;
        const jumpH = Math.abs(Math.sin(time * 2.5)) * 15;
        const jSize = 7;
        const jColor = nightMode ? '#8888cc' : '#ec4899';
        const armWave = Math.sin(time * 5) * 0.6;

        ctx.save(); ctx.translate(jx, jy - jumpH);
        // Shadow on ground at base (stays put)
        ctx.fillStyle = `rgba(0,0,0,${0.1 + 0.05 * (1 - jumpH / 15)})`;
        ctx.fillRect(-jSize * 0.6, jumpH + jSize * 0.1, jSize * 1.2, jSize * 0.15);
        // Legs
        ctx.fillStyle = darkenColor(jColor, 35);
        ctx.fillRect(-jSize * 0.2, -jSize * 0.05, jSize * 0.15, jSize * 0.3);
        ctx.fillRect(jSize * 0.08, -jSize * 0.05, jSize * 0.15, jSize * 0.3);
        // Body
        ctx.fillStyle = jColor;
        ctx.fillRect(-jSize * 0.25, -jSize * 0.6, jSize * 0.5, jSize * 0.55);
        // Head
        ctx.fillStyle = lightenColor(jColor, 25);
        ctx.fillRect(-jSize * 0.2, -jSize * 0.88, jSize * 0.4, jSize * 0.3);
        // Eyes (happy squint)
        ctx.fillStyle = '#fff';
        ctx.fillRect(jSize * 0.0, -jSize * 0.78, jSize * 0.08, jSize * 0.06);
        ctx.fillRect(jSize * 0.12, -jSize * 0.78, jSize * 0.08, jSize * 0.06);
        // Arms raised & waving
        ctx.fillStyle = jColor;
        ctx.save(); ctx.translate(-jSize * 0.3, -jSize * 0.5); ctx.rotate(-1.2 + armWave);
        ctx.fillRect(0, 0, jSize * 0.12, jSize * 0.4);
        ctx.restore();
        ctx.save(); ctx.translate(jSize * 0.3, -jSize * 0.5); ctx.rotate(1.2 - armWave);
        ctx.fillRect(-jSize * 0.12, 0, jSize * 0.12, jSize * 0.4);
        ctx.restore();
        // Sparkle particles when at peak
        if (jumpH > 12) {
            const spkColor = nightMode ? '#aabbff' : '#fbbf24';
            for (let s = 0; s < 4; s++) {
                const sa = (Math.PI * 2 / 4) * s + time * 4;
                ctx.fillStyle = spkColor;
                ctx.fillRect(Math.cos(sa) * 10, -jSize * 0.5 + Math.sin(sa) * 8, 2, 2);
            }
        }
        ctx.restore();
    }

    // --- Character carrying a basket of grass (walking along mountain) ---
    {
        const cSpeed = 15;
        const carrierX = ((time * cSpeed + 300) % (W * 0.6)) + W * 0.2;
        // Follow the second mountain layer roughly
        const carrierY = H * 0.38 + Math.sin(carrierX * 0.005 + 4) * (-40) + Math.sin(carrierX * 0.012 + 2) * (-25) + 38;
        const cSize = 7;
        const cWalk = Math.sin(time * 5) * 1.5;
        const cLeg = Math.sin(time * 10) * 2;
        const cColor = nightMode ? '#7a9a70' : '#15803d';

        ctx.save(); ctx.translate(carrierX, carrierY);
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(-cSize * 0.5, cSize * 0.08, cSize, cSize * 0.12);
        ctx.fillStyle = darkenColor(cColor, 30);
        ctx.fillRect(-cSize * 0.18 + cLeg * 0.2, -cSize * 0.04, cSize * 0.14, cSize * 0.25);
        ctx.fillRect(cSize * 0.06 - cLeg * 0.2, -cSize * 0.04, cSize * 0.14, cSize * 0.25);
        ctx.fillStyle = cColor;
        ctx.fillRect(-cSize * 0.22, -cSize * 0.55 + cWalk * 0.15, cSize * 0.44, cSize * 0.5);
        ctx.fillStyle = lightenColor(cColor, 20);
        ctx.fillRect(-cSize * 0.18, -cSize * 0.78 + cWalk * 0.15, cSize * 0.36, cSize * 0.26);
        // Basket on back
        ctx.fillStyle = nightMode ? '#5a4a30' : '#a0855a';
        ctx.fillRect(-cSize * 0.4, -cSize * 0.7 + cWalk * 0.15, cSize * 0.22, cSize * 0.35);
        // Grass poking out of basket
        ctx.fillStyle = '#4ade80';
        ctx.fillRect(-cSize * 0.42, -cSize * 0.85 + cWalk * 0.15, cSize * 0.08, cSize * 0.18);
        ctx.fillRect(-cSize * 0.32, -cSize * 0.9 + cWalk * 0.15, cSize * 0.08, cSize * 0.22);
        ctx.fillRect(-cSize * 0.22, -cSize * 0.82 + cWalk * 0.15, cSize * 0.08, cSize * 0.15);
        ctx.restore();
    }

    // --- Fisherman sitting by a small pond (right side, mid area) ---
    {
        const fx = W * 0.88, fy = H * 0.52;
        const bobTime = Math.sin(time * 1.5) * 2;
        const fSize = 7;
        const fColor = nightMode ? '#6677aa' : '#1d4ed8';

        // Small pond
        ctx.fillStyle = nightMode ? 'rgba(30,40,80,0.6)' : 'rgba(80,150,220,0.5)';
        ctx.beginPath(); ctx.ellipse(fx + 18, fy + 2, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = nightMode ? 'rgba(50,60,100,0.3)' : 'rgba(150,200,255,0.3)';
        ctx.beginPath(); ctx.ellipse(fx + 16, fy, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Character sitting
        ctx.save(); ctx.translate(fx, fy);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(-fSize * 0.4, fSize * 0.05, fSize * 0.8, fSize * 0.1);
        // Sitting legs (horizontal)
        ctx.fillStyle = darkenColor(fColor, 30);
        ctx.fillRect(-fSize * 0.1, -fSize * 0.08, fSize * 0.45, fSize * 0.15);
        // Body (hunched)
        ctx.fillStyle = fColor;
        ctx.fillRect(-fSize * 0.22, -fSize * 0.5, fSize * 0.44, fSize * 0.45);
        // Head
        ctx.fillStyle = lightenColor(fColor, 20);
        ctx.fillRect(-fSize * 0.18, -fSize * 0.72, fSize * 0.36, fSize * 0.25);
        // Hat
        ctx.fillStyle = nightMode ? '#4a3a2a' : '#92400e';
        ctx.fillRect(-fSize * 0.25, -fSize * 0.8, fSize * 0.5, fSize * 0.1);
        ctx.fillRect(-fSize * 0.15, -fSize * 0.9, fSize * 0.3, fSize * 0.12);
        // Fishing rod
        ctx.strokeStyle = nightMode ? '#6a5a40' : '#8B4513';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(fSize * 0.2, -fSize * 0.35);
        ctx.lineTo(fSize * 2.5, -fSize * 1.2 + bobTime);
        ctx.stroke();
        // Fishing line
        ctx.strokeStyle = nightMode ? 'rgba(150,160,200,0.4)' : 'rgba(100,100,100,0.5)';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(fSize * 2.5, -fSize * 1.2 + bobTime);
        ctx.lineTo(fSize * 2.6, fSize * 0.1 + bobTime * 0.5);
        ctx.stroke();
        // Float bobbing
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(fSize * 2.4, fSize * 0.0 + bobTime * 0.5, 3, 3);
        ctx.restore();
    }

    // --- Tiny pixel character doing push-ups (near mid-ground) ---
    {
        const px2 = W * 0.15, py2 = H * 0.48;
        const pushUp = Math.abs(Math.sin(time * 3));
        const pSize = 6;
        const pColor = nightMode ? '#8a7acc' : '#dc2626';

        ctx.save(); ctx.translate(px2, py2);
        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fillRect(-pSize * 0.7, pSize * 0.05 + pushUp * 1.5, pSize * 1.4, pSize * 0.1);
        // Body horizontal (push-up position)
        const bodyY = -pSize * 0.15 + pushUp * 1.5;
        // Arms (holding up)
        ctx.fillStyle = darkenColor(pColor, 30);
        ctx.fillRect(-pSize * 0.45, bodyY, pSize * 0.12, pSize * 0.15 + pushUp * 1.5);
        ctx.fillRect(pSize * 0.35, bodyY, pSize * 0.12, pSize * 0.15 + pushUp * 1.5);
        // Horizontal body
        ctx.fillStyle = pColor;
        ctx.fillRect(-pSize * 0.5, bodyY - pSize * 0.12, pSize * 1.0, pSize * 0.2);
        // Head
        ctx.fillStyle = lightenColor(pColor, 20);
        ctx.fillRect(-pSize * 0.6, bodyY - pSize * 0.25, pSize * 0.2, pSize * 0.2);
        // Sweat drop
        if (pushUp > 0.7) {
            ctx.fillStyle = nightMode ? '#aabbee' : '#60a5fa';
            ctx.fillRect(-pSize * 0.7, bodyY - pSize * 0.35 - Math.sin(time * 8) * 2, 2, 3);
        }
        ctx.restore();
    }

    // ═══ MISTY MOUNTAIN SILHOUETTES ═══
    const groundY = H * 0.88;
    const mtColors = nightMode
        ? ['#151b2e', '#1a2338', '#202b44']
        : ['#5a7a6a', '#4a6b5a', '#6a8a7a'];
    for (let layer = 0; layer < 3; layer++) {
        const yBase = H * 0.3 + layer * H * 0.08;
        ctx.fillStyle = mtColors[layer];
        ctx.beginPath();
        ctx.moveTo(0, yBase + 40);
        for (let mx = 0; mx <= W; mx += 20) {
            const mh = Math.sin(mx * 0.005 + layer * 2) * 40 + Math.sin(mx * 0.012 + layer) * 25;
            ctx.lineTo(mx, yBase - mh);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H);
        ctx.closePath(); ctx.fill();
    }

    // ═══ FAR BACKGROUND TREES (silhouettes, misty) ═══
    const farTreePositions = [
        { x: W * 0.05, h: 110, type: 'pine' }, { x: W * 0.12, h: 140, type: 'tall' },
        { x: W * 0.22, h: 160, type: 'pine' }, { x: W * 0.30, h: 130, type: 'pine' },
        { x: W * 0.40, h: 150, type: 'tall' }, { x: W * 0.52, h: 170, type: 'pine' },
        { x: W * 0.60, h: 120, type: 'pine' }, { x: W * 0.70, h: 155, type: 'tall' },
        { x: W * 0.80, h: 135, type: 'pine' }, { x: W * 0.90, h: 145, type: 'pine' },
        { x: W * 0.97, h: 125, type: 'tall' },
    ];
    const farBaseY = H * 0.62;
    const farSway = Math.sin(time * 0.4) * 1.5;
    const farColors = nightMode
        ? ['#1a2540', '#1e2d4a', '#223355']
        : ['#2d5a3a', '#336644', '#2a4f35'];
    const farTrunk = nightMode ? '#151d30' : '#3a2a1a';

    farTreePositions.forEach(t => {
        if (t.type === 'pine') {
            drawPineTree(ctx, t.x, farBaseY, t.h, t.h * 0.45, 6, 25, farColors, farTrunk, farSway);
        } else {
            drawTallTree(ctx, t.x, farBaseY, t.h * 0.5, t.h * 0.25, farColors, farTrunk, farSway);
        }
    });

    // Mist overlay on far trees
    const mistGrad = ctx.createLinearGradient(0, farBaseY - 100, 0, farBaseY + 30);
    if (nightMode) {
        mistGrad.addColorStop(0, 'rgba(15,20,40,0)');
        mistGrad.addColorStop(1, 'rgba(15,20,40,0.5)');
    } else {
        mistGrad.addColorStop(0, 'rgba(180,200,190,0)');
        mistGrad.addColorStop(1, 'rgba(180,200,190,0.35)');
    }
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, farBaseY - 180, W, 220);

    // ═══ MID-GROUND TREES ═══
    const midBaseY = H * 0.75;
    const midSway = Math.sin(time * 0.6 + 1) * 2.5;
    const midPineColors = nightMode
        ? ['#1d3328', '#254035', '#1a3020', '#2a4a38']
        : ['#2d6b3a', '#3a7a4a', '#257a35', '#4a8a55'];
    const midTallColors = nightMode
        ? ['#1a3825', '#22442e', '#1d3a28']
        : ['#45a049', '#3d8b40', '#55b855'];
    const midTrunk = nightMode ? '#2a1f18' : '#5a3a20';

    const midTrees = [
        { x: W * 0.02, h: 130, type: 'pine' as const },
        { x: W * 0.08, h: 180, type: 'tall' as const },
        { x: W * 0.18, h: 150, type: 'pine' as const },
        { x: W * 0.25, h: 110, type: 'pine' as const },
        { x: W * 0.35, h: 190, type: 'tall' as const },
        { x: W * 0.45, h: 140, type: 'pine' as const },
        { x: W * 0.55, h: 170, type: 'pine' as const },
        { x: W * 0.65, h: 200, type: 'tall' as const },
        { x: W * 0.75, h: 145, type: 'pine' as const },
        { x: W * 0.85, h: 165, type: 'pine' as const },
        { x: W * 0.95, h: 185, type: 'tall' as const },
    ];
    midTrees.forEach(t => {
        // Skip trees that would overlap the arena too much
        const inArena = t.x > offsetX - 30 && t.x < offsetX + ARENA_W + 30
            && midBaseY > offsetY - 30 && midBaseY < offsetY + ARENA_H + 30;
        if (inArena) return;
        if (t.type === 'pine') {
            drawPineTree(ctx, t.x, midBaseY, t.h, t.h * 0.4, 8, 35, midPineColors, midTrunk, midSway);
        } else {
            drawTallTree(ctx, t.x, midBaseY, t.h * 0.55, t.h * 0.22, midTallColors, midTrunk, midSway);
        }
    });

    // ═══ GROUND PLANE ═══
    const groundGrad = ctx.createLinearGradient(0, groundY - 30, 0, H);
    if (nightMode) {
        groundGrad.addColorStop(0, '#1a2a18');
        groundGrad.addColorStop(0.3, '#162214');
        groundGrad.addColorStop(1, '#0e160d');
    } else {
        groundGrad.addColorStop(0, '#4a7a3a');
        groundGrad.addColorStop(0.3, '#3a6a2a');
        groundGrad.addColorStop(1, '#2a5a1a');
    }
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY - 20, W, H - groundY + 20);

    // Ground texture dots
    const dotColor = nightMode ? 'rgba(40,60,35,0.5)' : 'rgba(80,130,60,0.4)';
    ctx.fillStyle = dotColor;
    for (let i = 0; i < 60; i++) {
        const dx = ((i * 73 + 17) % 100) / 100 * W;
        const dy = groundY + ((i * 41 + 7) % 100) / 100 * (H - groundY);
        ctx.fillRect(dx, dy, 3, 2);
    }

    // ═══ WALKING PIXEL CHARACTERS ═══
    const charPositions = [
        { baseX: 120, y: groundY - 2, size: 10, color: '#ef4444', speed: 4, range: 80 },
        { baseX: W - 180, y: groundY - 2, size: 9, color: '#3b82f6', speed: 3.5, range: 60 },
        { baseX: W * 0.45, y: groundY + 15, size: 8, color: '#22c55e', speed: 5, range: 50 },
        { baseX: 60, y: groundY + 25, size: 7, color: '#eab308', speed: 3, range: 40 },
    ];
    charPositions.forEach(ch => {
        const charX = ch.baseX + Math.sin(time * 0.5 * ch.speed / 4) * ch.range;
        // Only draw if outside arena
        if (charX > offsetX - 10 && charX < offsetX + ARENA_W + 10 && ch.y > offsetY - 10 && ch.y < offsetY + ARENA_H + 10) return;
        drawWalkingChar(ctx, charX, ch.y, ch.size, ch.color, time, ch.speed);
    });

    // ═══ ROCKS & DETAILS ═══
    const rocks = [
        { x: W * 0.78, y: groundY, w: 28, h: 22 },
        { x: W * 0.15, y: groundY + 10, w: 22, h: 16 },
        { x: W * 0.55, y: groundY + 30, w: 18, h: 14 },
    ];
    rocks.forEach(r => {
        if (r.x > offsetX - 10 && r.x < offsetX + ARENA_W + 10 && r.y > offsetY - 10 && r.y < offsetY + ARENA_H + 10) return;
        drawRock(ctx, r.x, r.y, r.w, r.h, nightMode);
    });

    // ═══ MUSHROOMS ═══
    const mushrooms = [
        { x: W * 0.10, y: groundY - 2 },
        { x: W * 0.88, y: groundY + 8 },
        { x: W * 0.42, y: groundY + 20 },
    ];
    mushrooms.forEach(m => {
        if (m.x > offsetX - 10 && m.x < offsetX + ARENA_W + 10 && m.y > offsetY - 10 && m.y < offsetY + ARENA_H + 10) return;
        // Stem
        ctx.fillStyle = nightMode ? '#c4a882' : '#f5deb3';
        ctx.fillRect(m.x - 2, m.y - 8, 4, 8);
        // Cap
        ctx.fillStyle = nightMode ? '#8b2020' : '#e74c3c';
        ctx.beginPath(); ctx.arc(m.x, m.y - 9, 7, Math.PI, 0); ctx.fill();
        // Spots
        ctx.fillStyle = '#fff';
        ctx.fillRect(m.x - 3, m.y - 12, 2, 2);
        ctx.fillRect(m.x + 2, m.y - 11, 2, 2);
    });

    // ═══ GRASS TUFTS ═══
    const grassSway = Math.sin(time * 1.8) * 3;
    const grassColor1 = nightMode ? '#2a5a28' : '#5fcc37';
    const grassColor2 = nightMode ? '#1d4a1a' : '#4bb82a';
    const grassColor3 = nightMode ? '#3a6a35' : '#7ae650';
    const tufts = [
        { x: 40, y: groundY, w: 20, h: 14 }, { x: 100, y: groundY - 2, w: 25, h: 16 },
        { x: 200, y: groundY + 5, w: 18, h: 12 }, { x: 320, y: groundY - 1, w: 22, h: 15 },
        { x: W - 80, y: groundY, w: 20, h: 14 }, { x: W - 150, y: groundY + 3, w: 24, h: 13 },
        { x: W - 250, y: groundY - 2, w: 18, h: 16 }, { x: W * 0.5 - 200, y: groundY + 8, w: 20, h: 12 },
        { x: W * 0.5 + 200, y: groundY + 12, w: 22, h: 14 }, { x: W * 0.5, y: groundY - 3, w: 26, h: 18 },
    ];
    tufts.forEach((t, i) => {
        if (t.x > offsetX - 10 && t.x < offsetX + ARENA_W + 10 && t.y > offsetY - 10 && t.y < offsetY + ARENA_H + 10) return;
        const c = [grassColor1, grassColor2, grassColor3][i % 3];
        drawGrassTuft(ctx, t.x, t.y, t.w, t.h, c, grassSway * (0.5 + i * 0.1));
    });

    // ═══ FOREGROUND TREES (larger, in front) ═══
    const fgSway = Math.sin(time * 0.5 + 2) * 3;
    const fgPineColors = nightMode
        ? ['#152a18', '#1d3820', '#1a3018', '#254530']
        : ['#1a6b2a', '#2d8a3a', '#3da848', '#238830'];
    const fgTallColors = nightMode
        ? ['#183020', '#204028', '#1a3520']
        : ['#2d8b30', '#45a049', '#3d9a40'];
    const fgTrunk = nightMode ? '#2a1a10' : '#6b4226';

    const fgTrees = [
        { x: -15, h: 250, type: 'tall' as const },
        { x: W * 0.06, h: 180, type: 'pine' as const },
        { x: W - 30, h: 240, type: 'tall' as const },
        { x: W * 0.94, h: 170, type: 'pine' as const },
    ];
    fgTrees.forEach(t => {
        if (t.type === 'pine') {
            drawPineTree(ctx, t.x, groundY, t.h, t.h * 0.35, 10, 45, fgPineColors, fgTrunk, fgSway);
        } else {
            drawTallTree(ctx, t.x, groundY, t.h * 0.6, t.h * 0.2, fgTallColors, fgTrunk, fgSway);
        }
    });

    // ═══ FIREFLY / PARTICLE EFFECTS ═══
    const particleCount = nightMode ? 25 : 12;
    for (let i = 0; i < particleCount; i++) {
        const seed1 = ((i * 127 + 53) % 100) / 100;
        const seed2 = ((i * 89 + 31) % 100) / 100;
        const px = seed1 * W;
        const py = H * 0.3 + seed2 * H * 0.6;
        // Skip if inside arena
        if (px > offsetX - 5 && px < offsetX + ARENA_W + 5 && py > offsetY - 5 && py < offsetY + ARENA_H + 5) continue;
        const drift = Math.sin(time * 1.2 + i * 0.8) * 8;
        const driftY = Math.cos(time * 0.9 + i * 1.1) * 5;
        const flicker = 0.3 + 0.7 * Math.abs(Math.sin(time * 2.5 + i * 1.3));

        if (nightMode) {
            // Glowing fireflies
            ctx.fillStyle = `rgba(200,255,100,${flicker * 0.5})`;
            ctx.beginPath(); ctx.arc(px + drift, py + driftY, 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(255,255,180,${flicker * 0.8})`;
            ctx.beginPath(); ctx.arc(px + drift, py + driftY, 2, 0, Math.PI * 2); ctx.fill();
        } else {
            // Floating pollen / dust motes
            ctx.fillStyle = `rgba(255,255,220,${flicker * 0.3})`;
            ctx.beginPath(); ctx.arc(px + drift, py + driftY, 2, 0, Math.PI * 2); ctx.fill();
        }
    }

    // ═══ LIGHT RAYS (day mode) ═══
    if (!nightMode) {
        ctx.save();
        for (let r = 0; r < 5; r++) {
            const rayX = W * 0.2 + r * W * 0.15;
            const rayAlpha = 0.03 + 0.02 * Math.sin(time * 0.5 + r);
            const grad = ctx.createLinearGradient(rayX, 0, rayX + 60, H);
            grad.addColorStop(0, `rgba(255,255,200,${rayAlpha})`);
            grad.addColorStop(0.5, `rgba(255,255,200,${rayAlpha * 0.5})`);
            grad.addColorStop(1, 'rgba(255,255,200,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(rayX, 0);
            ctx.lineTo(rayX + 40, 0);
            ctx.lineTo(rayX + 100, H);
            ctx.lineTo(rayX + 20, H);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    // ═══ ATMOSPHERIC FOG LAYER ═══
    const fogGrad = ctx.createLinearGradient(0, H * 0.6, 0, H);
    if (nightMode) {
        fogGrad.addColorStop(0, 'rgba(10,15,25,0)');
        fogGrad.addColorStop(1, 'rgba(10,15,25,0.4)');
    } else {
        fogGrad.addColorStop(0, 'rgba(60,100,70,0)');
        fogGrad.addColorStop(1, 'rgba(40,80,50,0.25)');
    }
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    // ═══ ARENA DECORATIVE BORDER ═══
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Corner flag posts
    const flags = [[0, 0], [ARENA_W, 0], [0, ARENA_H], [ARENA_W, ARENA_H]] as [number, number][];
    flags.forEach(([fx, fy]) => {
        ctx.fillStyle = nightMode ? '#94a3b8' : '#e2e8f0';
        ctx.fillRect(fx - 2, fy - 18, 4, 18);
        ctx.fillStyle = nightMode ? '#f59e0b' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(fx + 2, fy - 18);
        ctx.lineTo(fx + 14, fy - 13);
        ctx.lineTo(fx + 2, fy - 8);
        ctx.closePath(); ctx.fill();
    });

    // Arena boundary
    const borderColors = nightMode
        ? ['#6366f1', '#818cf8']
        : ['#f59e0b', '#fbbf24'];
    ctx.strokeStyle = borderColors[0];
    ctx.lineWidth = 6;
    ctx.strokeRect(-3, -3, ARENA_W + 6, ARENA_H + 6);
    ctx.strokeStyle = borderColors[1];
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, ARENA_W + 16, ARENA_H + 16);

    // Center circle
    ctx.strokeStyle = nightMode ? 'rgba(129,140,248,0.3)' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.arc(ARENA_W / 2, ARENA_H / 2, 60, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ARENA_W / 2 - 15, ARENA_H / 2); ctx.lineTo(ARENA_W / 2 + 15, ARENA_H / 2);
    ctx.moveTo(ARENA_W / 2, ARENA_H / 2 - 15); ctx.lineTo(ARENA_W / 2, ARENA_H / 2 + 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtle grid lines
    ctx.strokeStyle = nightMode ? 'rgba(129,140,248,0.08)' : 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let col = 1; col < GRID_COLS; col++) {
        ctx.beginPath();
        ctx.moveTo(col * TILE_SIZE, 0);
        ctx.lineTo(col * TILE_SIZE, ARENA_H);
        ctx.stroke();
    }
    for (let row = 1; row < GRID_ROWS; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * TILE_SIZE);
        ctx.lineTo(ARENA_W, row * TILE_SIZE);
        ctx.stroke();
    }

    ctx.restore();
}

function drawHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const x = cx + r * Math.cos(a);
        const y = cy + r * Math.sin(a);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
}

const TILE_SIZE_CONST = TILE_SIZE;
const ARENA_W_CONST = ARENA_W;
const ARENA_H_CONST = ARENA_H;

export const GameArena: React.FC<GameArenaProps> = ({ room, nightMode, setNightMode, onLeave }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<any>(room.state);
    const [showEndScreen, setShowEndScreen] = useState(false);
    const [lastEvent, setLastEvent] = useState("");
    const [eventIcon, setEventIcon] = useState<'bomb' | 'rocket' | 'speed' | ''>('');


    // Cached tiles
    const grassTileRef = useRef<HTMLCanvasElement | null>(null);
    const smallGrassTileRef = useRef<HTMLCanvasElement | null>(null);
    const dirtTileRef = useRef<HTMLCanvasElement | null>(null);

    // Visual effects state
    const vfxRef = useRef<VFX[]>([]);
    const rocketsRef = useRef<RocketProjectile[]>([]);
    const floatingTextsRef = useRef<FloatingText[]>([]);
    const speedParticlesRef = useRef<SpeedParticle[]>([]);
    const playerColorsRef = useRef<Map<string, string>>(new Map());
    const colorIndexRef = useRef(0);
    const vfxIdRef = useRef(0);
    const prevScoresRef = useRef<Map<string, number>>(new Map());
    const collectedTilesRef = useRef<Set<string>>(new Set());
    const prevGrassKeysRef = useRef<Set<string>>(new Set());
    const timeRef = useRef(0);

    const getPlayerColor = useCallback((sessionId: string, playerAvatarColor?: string): string => {
        if (playerAvatarColor) return playerAvatarColor;
        if (!playerColorsRef.current.has(sessionId)) {
            playerColorsRef.current.set(sessionId, PLAYER_COLORS[colorIndexRef.current % PLAYER_COLORS.length]);
            colorIndexRef.current++;
        }
        return playerColorsRef.current.get(sessionId)!;
    }, []);

    // Init tiles
    useEffect(() => {
        grassTileRef.current = makeDahliaTile(TILE_SIZE);
        smallGrassTileRef.current = makeSmallGrassTile(TILE_SIZE);
        dirtTileRef.current = makeDirtTile(TILE_SIZE);
    }, []);

    // Input handling
    useEffect(() => {
        const keys: { [key: string]: boolean } = {};

        const handleKeyDown = (e: KeyboardEvent) => {
            keys[e.key] = true;
            updateMovement();
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            keys[e.key] = false;
            updateMovement();
        };

        const updateMovement = () => {
            let dx = 0, dy = 0;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
            if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
            if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;
            room.send("move", { dx, dy });
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [room]);

    // Room state sync + VFX triggers
    useEffect(() => {
        room.onStateChange((state) => {
            setGameState({ ...state });
            if (state.matchEnded) {
                setShowEndScreen(true);
            } else {
                setShowEndScreen(false);
            }

            if (state.lastEvent && state.lastEvent !== lastEvent) {
                setLastEvent(state.lastEvent);
                const evt = state.lastEvent as string;

                if (evt.includes('Bomb')) {
                    setEventIcon('bomb');
                    state.players?.forEach((player: any) => {
                        if (evt.includes(player.displayName)) {
                            spawnBombVFX(player.x, player.y);
                        }
                    });
                } else if (evt.includes('Rocket')) {
                    setEventIcon('rocket');
                    state.players?.forEach((player: any, sid: string) => {
                        if (evt.includes(player.displayName)) {
                            spawnRocketVFX(player.x, player.y, getPlayerColor(sid, player.color));
                        }
                    });
                } else if (evt.includes('Speed')) {
                    setEventIcon('speed');
                    state.players?.forEach((player: any, sid: string) => {
                        if (evt.includes(player.displayName)) {
                            spawnSpeedVFX(player.x, player.y, getPlayerColor(sid, player.color));
                        }
                    });
                } else {
                    setEventIcon('');
                }

                setTimeout(() => setEventIcon(''), 3000);
            }

            state.players?.forEach((player: any, sid: string) => {
                const prevScore = prevScoresRef.current.get(sid) || 0;
                if (player.score > prevScore) {
                    floatingTextsRef.current.push({
                        id: vfxIdRef.current++,
                        x: player.x,
                        y: player.y - 40,
                        text: `+${player.score - prevScore}`,
                        color: '#4ade80',
                        timer: 1.2,
                    });
                }
                prevScoresRef.current.set(sid, player.score);

                // Speed particle trail
                if (player.speedMultiplier > 1) {
                    const color = getPlayerColor(sid, player.color);
                    for (let i = 0; i < 2; i++) {
                        speedParticlesRef.current.push({
                            id: vfxIdRef.current++,
                            x: player.x + (Math.random() - 0.5) * 20,
                            y: player.y + (Math.random() - 0.5) * 20,
                            vx: (Math.random() - 0.5) * 60,
                            vy: (Math.random() - 0.5) * 60 - 20,
                            timer: 0.5 + Math.random() * 0.3,
                            maxTimer: 0.8,
                            color,
                        });
                    }
                }
            });
        });

        return () => { room.removeAllListeners(); };
    }, [room, lastEvent, getPlayerColor]);

    const spawnBombVFX = (x: number, y: number) => {
        // Shockwave rings
        vfxRef.current.push({ id: vfxIdRef.current++, type: 'bomb', x, y, timer: 1.8, maxTimer: 1.8 });
        // Debris particles
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 / 12) * i;
            speedParticlesRef.current.push({
                id: vfxIdRef.current++,
                x, y,
                vx: Math.cos(angle) * (80 + Math.random() * 80),
                vy: Math.sin(angle) * (80 + Math.random() * 80),
                timer: 1.0 + Math.random() * 0.5,
                maxTimer: 1.5,
                color: i % 2 === 0 ? '#ef4444' : '#f97316',
            });
        }
    };

    const spawnRocketVFX = (x: number, y: number, color: string) => {
        // 8 rockets in all directions
        const directions = [
            { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
            { dx: -0.707, dy: -0.707 }, { dx: 0.707, dy: -0.707 },
            { dx: -0.707, dy: 0.707 }, { dx: 0.707, dy: 0.707 }
        ];
        directions.forEach(d => {
            rocketsRef.current.push({
                id: vfxIdRef.current++,
                x, y,
                dx: d.dx * 320,
                dy: d.dy * 320,
                timer: 2.2,
                trail: [],
            });
        });
        // Central explosion flash
        vfxRef.current.push({ id: vfxIdRef.current++, type: 'rocket', x, y, timer: 0.8, maxTimer: 0.8 });
    };

    const spawnSpeedVFX = (x: number, y: number, color: string) => {
        vfxRef.current.push({ id: vfxIdRef.current++, type: 'speed', x, y, timer: 2.0, maxTimer: 2.0 });
        // Burst of lightning-yellow particles upward
        for (let i = 0; i < 16; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
            speedParticlesRef.current.push({
                id: vfxIdRef.current++,
                x: x + (Math.random() - 0.5) * 20,
                y,
                vx: Math.cos(angle) * (60 + Math.random() * 80),
                vy: Math.sin(angle) * (100 + Math.random() * 60),
                timer: 0.8 + Math.random() * 0.4,
                maxTimer: 1.2,
                color: '#fbbf24',
            });
        }
    };

    // Canvas Rendering
    useEffect(() => {
        if (!canvasRef.current || !gameState) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d')!;
        if (!ctx) return;

        let animationFrameId: number;
        let lastTime = performance.now();

        const render = (now: number) => {
            const dt = Math.min((now - lastTime) / 1000, 0.05);
            lastTime = now;
            timeRef.current += dt;
            const time = timeRef.current;

            const W = 1200;
            const H = 900;
            canvas.width = W;
            canvas.height = H;

            const offsetX = (W - ARENA_W) / 2;
            const offsetY = (H - ARENA_H) / 2;

            ctx.clearRect(0, 0, W, H);

            // ── DRAW BACKGROUND ──
            drawArenaBackground(ctx, W, H, offsetX, offsetY, nightMode, time);

            ctx.save();
            ctx.translate(offsetX, offsetY);

            // ── ARENA GROUND: TWO-PHASE GRASS TILES ──
            if (grassTileRef.current && dirtTileRef.current && smallGrassTileRef.current) {
                // Build a map of tile positions → grass data from server
                const tileMap = new Map<string, { phase: number; powerUp: string }>();
                if (gameState.grasses) {
                    gameState.grasses.forEach((g: any) => {
                        const tx = Math.floor(g.x / TILE_SIZE);
                        const ty = Math.floor(g.y / TILE_SIZE);
                        tileMap.set(`${tx},${ty}`, { phase: g.phase || 1, powerUp: g.powerUp || '' });
                    });
                }

                // Draw all 12x8 tiles
                for (let ty = 0; ty < GRID_ROWS; ty++) {
                    for (let tx = 0; tx < GRID_COLS; tx++) {
                        const x = tx * TILE_SIZE;
                        const y = ty * TILE_SIZE;
                        const key = `${tx},${ty}`;
                        const tileData = tileMap.get(key);

                        if (!tileData) {
                            // Fully collected — show dirt
                            ctx.drawImage(dirtTileRef.current, x, y, TILE_SIZE, TILE_SIZE);
                        } else if (tileData.phase === 1) {
                            // Phase 1 — big grass
                            ctx.drawImage(grassTileRef.current, x, y, TILE_SIZE, TILE_SIZE);
                        } else if (tileData.phase === 2) {
                            // Phase 2 — small grass on dirt
                            ctx.drawImage(smallGrassTileRef.current, x, y, TILE_SIZE, TILE_SIZE);

                            // Draw hidden power-up icon if this tile has one
                            if (tileData.powerUp) {
                                drawPowerUpIcon(ctx, x + TILE_SIZE / 2, y + TILE_SIZE / 2, tileData.powerUp, time);
                            }
                        }
                    }
                }
            }

            // ── UPDATE & DRAW SPEED PARTICLES ──
            speedParticlesRef.current = speedParticlesRef.current.filter(p => {
                p.timer -= dt;
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vy += 150 * dt; // gravity
                return p.timer > 0;
            });
            speedParticlesRef.current.forEach(p => {
                const alpha = p.timer / p.maxTimer;
                const size = 4 * alpha;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;

            // ── UPDATE & DRAW ROCKETS ──
            rocketsRef.current = rocketsRef.current.filter(r => {
                r.timer -= dt;
                // Store trail
                r.trail.push({ x: r.x, y: r.y, alpha: 1.0 });
                if (r.trail.length > 12) r.trail.shift();
                r.trail.forEach(t => { t.alpha -= dt * 3; });
                r.x += r.dx * dt;
                r.y += r.dy * dt;
                return r.timer > 0;
            });

            rocketsRef.current.forEach(rocket => {
                // Draw trail
                rocket.trail.forEach((t, i) => {
                    const a = Math.max(0, t.alpha) * (i / rocket.trail.length);
                    ctx.globalAlpha = a * 0.6;
                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.arc(t.x, t.y, 3 * (i / rocket.trail.length), 0, Math.PI * 2);
                    ctx.fill();
                });
                ctx.globalAlpha = 1;

                // Draw rocket body
                const angle = Math.atan2(rocket.dy, rocket.dx);
                ctx.save();
                ctx.translate(rocket.x, rocket.y);
                ctx.rotate(angle + Math.PI / 2);

                // Flame
                ctx.fillStyle = '#fbbf24';
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.moveTo(-3, 8);
                ctx.lineTo(0, 14 + Math.random() * 4);
                ctx.lineTo(3, 8);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Body
                ctx.fillStyle = '#ef4444';
                ctx.fillRect(-3, -9, 6, 14);
                // Nose cone
                ctx.fillStyle = '#fbbf24';
                ctx.beginPath();
                ctx.moveTo(-3, -9);
                ctx.lineTo(0, -16);
                ctx.lineTo(3, -9);
                ctx.fill();
                // Fins
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                ctx.moveTo(-3, 4); ctx.lineTo(-7, 8); ctx.lineTo(-3, 8); ctx.fill();
                ctx.beginPath();
                ctx.moveTo(3, 4); ctx.lineTo(7, 8); ctx.lineTo(3, 8); ctx.fill();

                ctx.restore();
            });

            // ── UPDATE & DRAW VFX ──
            vfxRef.current = vfxRef.current.filter(v => { v.timer -= dt; return v.timer > 0; });

            vfxRef.current.forEach(v => {
                const progress = 1 - v.timer / v.maxTimer;

                if (v.type === 'bomb') {
                    // Phase 1: bomb emoji bounce
                    if (progress < 0.25) {
                        const scale = 1 + Math.sin(progress * Math.PI / 0.25) * 1.5;
                        ctx.save();
                        ctx.font = `${24 * scale}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('💣', v.x, v.y - 20 * scale);
                        ctx.restore();
                    }
                    // Phase 2: expanding shockwave rings
                    else {
                        const exp = (progress - 0.25) / 0.75;
                        const maxR = 80;

                        // Multiple rings for impact
                        for (let ring = 0; ring < 3; ring++) {
                            const rProgress = Math.max(0, exp - ring * 0.15);
                            const r = rProgress * maxR;
                            const a = (1 - rProgress) * 0.8;
                            if (a > 0) {
                                ctx.globalAlpha = a;
                                ctx.strokeStyle = ring === 0 ? '#ef4444' : ring === 1 ? '#f97316' : '#fbbf24';
                                ctx.lineWidth = 4 - ring;
                                ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); ctx.stroke();
                            }
                        }

                        // Flash center
                        ctx.globalAlpha = Math.max(0, (1 - exp) * 0.5);
                        const flashGrad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, 30);
                        flashGrad.addColorStop(0, '#fff');
                        flashGrad.addColorStop(0.3, '#fbbf24');
                        flashGrad.addColorStop(1, 'transparent');
                        ctx.fillStyle = flashGrad;
                        ctx.beginPath(); ctx.arc(v.x, v.y, 30, 0, Math.PI * 2); ctx.fill();
                        ctx.globalAlpha = 1;

                        // 💥 text popup
                        if (exp < 0.4) {
                            const textAlpha = 1 - exp / 0.4;
                            ctx.globalAlpha = textAlpha;
                            ctx.font = `bold ${20 + exp * 20}px Arial`;
                            ctx.textAlign = 'center';
                            ctx.fillStyle = '#fbbf24';
                            ctx.fillText('💥', v.x, v.y - 30 - exp * 30);
                            ctx.globalAlpha = 1;
                        }
                    }
                    ctx.globalAlpha = 1;
                }

                else if (v.type === 'rocket') {
                    // Central launch explosion
                    const r = progress * 50;
                    const a = 1 - progress;
                    ctx.globalAlpha = a;
                    // Outer ring
                    ctx.strokeStyle = '#f97316';
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(v.x, v.y, r, 0, Math.PI * 2); ctx.stroke();
                    // Inner flash
                    const g = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, r * 0.5);
                    g.addColorStop(0, 'rgba(255,200,50,0.8)');
                    g.addColorStop(1, 'transparent');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(v.x, v.y, r * 0.5, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                }

                else if (v.type === 'speed') {
                    // Radiating speed lines + lightning bolts
                    const bolts = 6;
                    for (let i = 0; i < bolts; i++) {
                        const angle = (Math.PI * 2 / bolts) * i + progress * 2;
                        const r = progress * 50;
                        const alpha = (1 - progress) * 0.9;
                        ctx.globalAlpha = alpha;
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(v.x + Math.cos(angle) * 10, v.y + Math.sin(angle) * 10);
                        ctx.lineTo(v.x + Math.cos(angle) * r, v.y + Math.sin(angle) * r);
                        ctx.stroke();
                    }

                    // ⚡ emoji pulse
                    if (progress < 0.6) {
                        const scale = 1 + progress * 2;
                        const alpha = 1 - progress / 0.6;
                        ctx.globalAlpha = alpha;
                        ctx.font = `${30 * scale}px Arial`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText('⚡', v.x, v.y - 20 - progress * 40);
                    }
                    ctx.globalAlpha = 1;
                }
            });

            // ── DRAW PLAYERS ──
            if (gameState.players) {
                gameState.players.forEach((player: any, sessionId: string) => {
                    const isLocal = sessionId === room.sessionId;
                    const color = getPlayerColor(sessionId, player.color);
                    drawTopDownCharacter(ctx, player, color, isLocal, time);
                });
            }

            // ── FLOATING TEXTS ──
            floatingTextsRef.current = floatingTextsRef.current.filter(ft => { ft.timer -= dt; ft.y -= 50 * dt; return ft.timer > 0; });
            floatingTextsRef.current.forEach(ft => {
                const alpha = Math.min(1, ft.timer * 2);
                ctx.globalAlpha = alpha;
                ctx.font = 'bold 14px "Press Start 2P", monospace';
                ctx.textAlign = 'center';
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 3;
                ctx.strokeText(ft.text, ft.x, ft.y);
                ctx.fillStyle = ft.color;
                ctx.fillText(ft.text, ft.x, ft.y);
                ctx.globalAlpha = 1;
            });

            // ── GRASS REMAINING BAR ──
            const totalInScene = (gameState.grasses?.length || 0);
            const barW = ARENA_W - 40;
            const barH = 12;
            const barX = 20;
            const barY = ARENA_H - 28;
            const barFill = Math.min(1, totalInScene / TOTAL_GRASS);

            // Bar bg
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
            ctx.fill();

            // Gradient fill
            const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
            barGrad.addColorStop(0, '#22c55e');
            barGrad.addColorStop(0.5, '#4ade80');
            barGrad.addColorStop(1, '#86efac');
            ctx.fillStyle = barGrad;
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW * barFill, barH, 3);
            ctx.fill();

            // Bar border
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 4);
            ctx.stroke();

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationFrameId);
    }, [gameState, nightMode, room.sessionId, getPlayerColor]);

    const getScoreboard = () => {
        if (!gameState.players) return [];
        const entries: any[] = [];
        gameState.players.forEach((p: any, id: string) => {
            entries.push({ name: p.displayName, score: p.score, id, color: getPlayerColor(id, p.color) });
        });
        return entries.sort((a, b) => b.score - a.score);
    };

    const timerSeconds = Math.ceil(gameState.matchTimer || 0);
    const timerDanger = timerSeconds <= 10 && timerSeconds > 0;
    const grassRemaining = gameState.grasses?.length || 0;
    const grassCollected = TOTAL_GRASS - grassRemaining;
    const grassPercent = Math.round((grassCollected / TOTAL_GRASS) * 100);

    return (
        <div className={`relative w-full max-w-7xl mx-auto mt-4 flex flex-col items-center ${nightMode ? 'text-white' : ''}`}>
            
            {/* Day/Night Toggle — exactly same as home page, fixed top-left */}
            <motion.button
                onClick={() => setNightMode(!nightMode)}
                className={`fixed top-4 left-4 z-50 w-14 h-14 border-4 flex items-center justify-center transition-colors duration-500 cursor-pointer pixel-corners ${nightMode
                    ? 'bg-indigo-600 border-indigo-800 hover:bg-indigo-500'
                    : 'bg-amber-400 border-amber-600 hover:bg-amber-300'
                    }`}
                whileHover={{ scale: 1.1, rotate: 15 }}
                whileTap={{ scale: 0.9 }}
                title={nightMode ? 'Switch to Day' : 'Switch to Night'}
            >
                <AnimatePresence mode="wait">
                    {nightMode ? (
                        <motion.div
                            key="moon"
                            initial={{ rotate: -90, opacity: 0, scale: 0 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            exit={{ rotate: 90, opacity: 0, scale: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Moon size={24} className="text-yellow-200" fill="currentColor" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="sun"
                            initial={{ rotate: 90, opacity: 0, scale: 0 }}
                            animate={{ rotate: 0, opacity: 1, scale: 1 }}
                            exit={{ rotate: -90, opacity: 0, scale: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Sun size={24} className="text-amber-800" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.button>

            {/* Day/Night label indicator — fixed top-left */}
            <motion.div
                className={`fixed top-5 left-20 z-50 font-display text-[10px] uppercase tracking-widest px-3 py-1 border-2 transition-colors duration-500 ${nightMode
                    ? 'bg-indigo-900/80 border-indigo-600 text-indigo-300'
                    : 'bg-amber-100/80 border-amber-500 text-amber-800'
                    }`}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
            >
                {nightMode ? '🌙 Night' : '☀️ Day'}
            </motion.div>

            {/* ── TOP BAR — Timer + Event Notification ── */}
            <div className="w-full flex justify-between items-start mb-3 px-2 gap-4">
                {/* Timer */}
                <motion.div
                    animate={timerDanger ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 0.6 }}
                    className={`px-4 py-2 border-4 flex items-center gap-3 font-display shadow-lg
                        ${timerDanger
                            ? 'bg-red-900 border-red-400 text-red-200'
                            : nightMode
                                ? 'bg-slate-900 border-red-500 text-red-300'
                                : 'bg-white border-red-500 text-red-600'}`}
                >
                    <Timer size={20} className={`${timerDanger ? 'animate-spin' : 'animate-pulse'} text-red-400`} />
                    <span className="text-xl tabular-nums">{timerSeconds}s</span>
                </motion.div>

                {/* Event notification */}
                <AnimatePresence>
                    {lastEvent && (
                        <motion.div
                            key={lastEvent}
                            initial={{ opacity: 0, y: -20, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            className={`px-5 py-3 border-4 font-display text-xs uppercase flex items-center gap-2 shadow-xl
                                ${eventIcon === 'bomb' ? 'bg-red-900/90 border-red-400 text-red-200' :
                                    eventIcon === 'rocket' ? 'bg-orange-900/90 border-orange-400 text-orange-200' :
                                        eventIcon === 'speed' ? 'bg-yellow-900/90 border-yellow-400 text-yellow-200' :
                                            nightMode ? 'bg-slate-900 border-yellow-500 text-yellow-300' : 'bg-yellow-50 border-yellow-500 text-yellow-800'}`}
                        >
                            {eventIcon === 'bomb' && <span className="text-lg">💣</span>}
                            {eventIcon === 'rocket' && <span className="text-lg">🚀</span>}
                            {eventIcon === 'speed' && <span className="text-lg">⚡</span>}
                            {lastEvent}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── MAIN LAYOUT: Arena + Side Panel ── */}
            <div className="w-full flex gap-4 items-start px-2">
                {/* ARENA CANVAS */}
                <div className={`relative border-8 shadow-2xl overflow-hidden flex-1
                    ${nightMode ? 'border-indigo-600' : 'border-amber-500'}
                    ${nightMode ? 'shadow-indigo-900/50' : 'shadow-amber-900/30'}`}
                    style={{ imageRendering: 'pixelated' }}>

                    {/* Outer glow */}
                    <div className={`absolute inset-0 pointer-events-none z-10
                        ${nightMode ? 'ring-2 ring-indigo-400/30' : 'ring-2 ring-amber-400/30'}`} />

                    <canvas ref={canvasRef} width={1200} height={900} className="w-full h-auto block" />

                    {/* Countdown */}
                    <AnimatePresence>
                        {gameState.countdown > 0 && (
                            <motion.div
                                initial={{ scale: 2, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30"
                            >
                                <motion.div
                                    key={gameState.countdown}
                                    initial={{ scale: 2.5, rotate: -10 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    className="font-display text-9xl text-white drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]"
                                    style={{ WebkitTextStroke: '4px #000', textShadow: '0 0 40px rgba(251,191,36,0.8)' }}
                                >
                                    {gameState.countdown}
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                {/* ═══ PREMIUM LOBBY / WAITING ROOM ═══ */}
                {!gameState.matchStarted && gameState.countdown === 0 && (
                    <div className={`absolute inset-0 flex items-center justify-center backdrop-blur-xl z-20 p-8 overflow-y-auto ${nightMode ? 'bg-black/80' : 'bg-amber-50/90'}`}>
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8"
                        >
                            {/* LEFT SIDE: Player List & Lobby Info */}
                            <div className="space-y-6">
                                <div className="text-left">
                                    <div className="flex items-center gap-3 mb-1">
                                        <div className={`px-2 py-1 rounded-sm ${nightMode ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                                            <span className="font-display text-[10px] text-white uppercase tracking-tighter">Lobby Room</span>
                                        </div>
                                        <span className={`font-display text-sm tabular-nums ${nightMode ? 'text-slate-400' : 'text-amber-700'}`}>ID: {room.id}</span>
                                    </div>
                                    <h2 className={`font-display text-4xl tracking-widest uppercase ${nightMode ? 'text-white' : 'text-amber-900'}`} style={{ textShadow: nightMode ? '4px 4px 0 #4f46e5' : '4px 4px 0 #fbbf24' }}>
                                        Are you Ready?
                                    </h2>
                                    <p className={`font-body text-sm mt-3 ${nightMode ? 'text-slate-400' : 'text-amber-700/80'}`}>
                                        Waiting for all players to mark themselves as ready. 
                                        Game will start automatically once everyone is set.
                                    </p>
                                </div>

                                <div className={`border-4 p-4 space-y-3 ${nightMode ? 'bg-slate-900/50 border-indigo-500/30' : 'bg-amber-50/80 border-amber-400/50'}`}>
                                    <div className={`flex justify-between items-center mb-4 pb-2 border-b ${nightMode ? 'border-white/10' : 'border-amber-300/40'}`}>
                                        <span className={`font-display text-xs ${nightMode ? 'text-indigo-300' : 'text-amber-700'}`}>Players ({gameState.players?.size || 0}/{MAX_PLAYERS})</span>
                                        <span className={`font-display text-[10px] uppercase ${nightMode ? 'text-white/40' : 'text-amber-600/60'}`}>Status</span>
                                    </div>
                                    
                                    {Array.from(gameState.players || []).map(([id, p]: [string, any]) => {
                                        const isLocal = id === room.sessionId;
                                        const isOwner = id === gameState.ownerId;
                                        return (
                                            <motion.div 
                                                key={id}
                                                layout
                                                className={`flex items-center gap-3 p-3 border-2 transition-colors ${
                                                    p.isReady
                                                        ? 'border-green-500/50 bg-green-500/10'
                                                        : nightMode ? 'border-white/5 bg-white/5' : 'border-amber-300/30 bg-amber-100/30'
                                                }`}
                                            >
                                                <div 
                                                    className="w-8 h-8 border-2 border-black/40 flex-shrink-0"
                                                    style={{ backgroundColor: getPlayerColor(id, p.color) }}
                                                />
                                                <div className="flex-1 overflow-hidden">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`font-display text-sm truncate ${isLocal ? 'text-yellow-400' : nightMode ? 'text-white' : 'text-amber-900'}`}>
                                                            {p.displayName} {isLocal && "(You)"}
                                                        </span>
                                                        {isOwner && <Crown size={12} className="text-yellow-500" />}
                                                    </div>
                                                    <span className={`font-body text-[10px] block leading-tight ${nightMode ? 'text-white/40' : 'text-amber-700/60'}`}>
                                                        {isOwner ? "Room Master" : "Challenger"}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    {p.isReady ? (
                                                        <div className="flex items-center gap-1.5 text-green-400">
                                                            <span className="font-display text-[10px] uppercase">Ready</span>
                                                            <CheckCircle2 size={16} />
                                                        </div>
                                                    ) : (
                                                        <div className={`flex items-center gap-1.5 ${nightMode ? 'text-white/20' : 'text-amber-400/60'}`}>
                                                            <span className="font-display text-[10px] uppercase">Waiting</span>
                                                            <Circle size={16} />
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}

                                    {/* Empty slots */}
                                    {Array.from({ length: Math.max(0, 2 - (gameState.players?.size || 0)) }).map((_, i) => (
                                        <div key={`empty-${i}`} className={`flex items-center gap-3 p-3 border-2 border-dashed opacity-30 ${nightMode ? 'border-white/10' : 'border-amber-400/30'}`}>
                                            <div className={`w-8 h-8 border-2 border-dashed ${nightMode ? 'bg-white/5 border-white/20' : 'bg-amber-200/20 border-amber-400/30'}`} />
                                            <span className={`font-display text-[10px] uppercase tracking-widest ${nightMode ? 'text-white/40' : 'text-amber-700/50'}`}>Waiting for player...</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <PixelButton 
                                        variant={gameState.players?.get(room.sessionId)?.isReady ? "secondary" : "primary"}
                                        className="flex-1 py-4 text-sm"
                                        onClick={() => room.send("ready")}
                                    >
                                        {gameState.players?.get(room.sessionId)?.isReady ? "CANCEL READY" : "I AM READY!"}
                                    </PixelButton>
                                    <PixelButton variant="accent" className="px-6" onClick={onLeave}>EXIT</PixelButton>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Instructions & Game Rules */}
                            <div className={`border-4 p-6 flex flex-col justify-between ${nightMode ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-amber-50/80 border-amber-400/50'}`}>
                                <div className="space-y-6">
                                    <div className="text-left space-y-4">
                                        <h3 className={`font-display text-xl uppercase tracking-wider flex items-center gap-2 ${nightMode ? 'text-yellow-400' : 'text-amber-700'}`}>
                                            <div className={`w-2 h-6 ${nightMode ? 'bg-yellow-400' : 'bg-amber-500'}`} />
                                            How to Play
                                        </h3>
                                        
                                        <div className="space-y-4">
                                            <div className="flex gap-4 items-start">
                                                <div className={`p-2 border font-display text-xs ${nightMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-800'}`}>MK</div>
                                                <div className="flex-1">
                                                    <p className={`font-display text-[11px] uppercase mb-1 ${nightMode ? 'text-white' : 'text-amber-900'}`}>Movement</p>
                                                    <p className={`font-body text-xs ${nightMode ? 'text-slate-400' : 'text-amber-700'}`}>Use WASD or Arrow Keys to navigate the field and collect grass.</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-4 items-start">
                                                <div className={`p-2 border font-display text-xs ${nightMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-amber-100 border-amber-300 text-amber-800'}`}>GR</div>
                                                <div className="flex-1">
                                                    <p className={`font-display text-[11px] uppercase mb-1 ${nightMode ? 'text-white' : 'text-amber-900'}`}>Two-Phase Harvesting</p>
                                                    <p className={`font-body text-xs ${nightMode ? 'text-slate-400' : 'text-amber-700'}`}>Touch Big Grass (2pts) to convert it to Small Grass. Wait 0.5s to harvest it again (1pt).</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <h4 className={`font-display text-[11px] uppercase tracking-widest pb-2 border-b ${nightMode ? 'text-indigo-300 border-white/5' : 'text-amber-600 border-amber-300/40'}`}>Arena Objects</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className={`p-2 rounded flex items-center gap-2 border ${nightMode ? 'bg-black/20 border-white/5' : 'bg-amber-100/50 border-amber-300/40'}`}>
                                                <span className="text-xl">💣</span>
                                                <span className={`font-display text-[9px] uppercase ${nightMode ? 'text-red-300' : 'text-red-600'}`}>Bomb Trap</span>
                                            </div>
                                            <div className={`p-2 rounded flex items-center gap-2 border ${nightMode ? 'bg-black/20 border-white/5' : 'bg-amber-100/50 border-amber-300/40'}`}>
                                                <span className="text-xl">🚀</span>
                                                <span className={`font-display text-[9px] uppercase ${nightMode ? 'text-orange-300' : 'text-orange-600'}`}>Nuke Rocket</span>
                                            </div>
                                            <div className={`p-2 rounded flex items-center gap-2 border ${nightMode ? 'bg-black/20 border-white/5' : 'bg-amber-100/50 border-amber-300/40'}`}>
                                                <span className="text-xl">⚡</span>
                                                <span className={`font-display text-[9px] uppercase ${nightMode ? 'text-blue-300' : 'text-blue-600'}`}>Super Speed</span>
                                            </div>
                                            <div className={`p-2 rounded flex items-center gap-2 border ${nightMode ? 'bg-black/20 border-white/5' : 'bg-amber-100/50 border-amber-300/40'}`}>
                                                <span className="text-xl">🌿</span>
                                                <span className={`font-display text-[9px] uppercase ${nightMode ? 'text-green-300' : 'text-green-600'}`}>Double Grass</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`mt-8 p-4 rounded-sm border ${nightMode ? 'bg-yellow-400/10 border-yellow-400/20' : 'bg-amber-100/60 border-amber-400/40'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`animate-pulse w-2 h-2 rounded-full ${nightMode ? 'bg-yellow-400 shadow-[0_0_8px_#facc15]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`} />
                                        <p className={`font-body text-[11px] leading-relaxed italic ${nightMode ? 'text-yellow-100/80' : 'text-amber-800'}`}>
                                            "Pro Tip: Use the Rocket only when your opponents are about to clear a large patch!"
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
                </div>

                {/* ── RIGHT SIDE PANEL ── */}
                <div className="flex flex-col gap-3" style={{ width: '220px', flexShrink: 0 }}>
                    {/* Grass Counter Card */}
                    <div className={`border-4 font-display shadow-lg overflow-hidden
                        ${nightMode ? 'bg-slate-900/95 border-green-500' : 'bg-white/95 border-green-500'}`}>
                        <div className={`px-3 py-1 text-center font-bold text-[10px] tracking-widest
                            ${nightMode ? 'bg-green-900/50 text-green-300' : 'bg-green-50 text-green-700'}`}>
                            🌿 GRASS COLLECTED
                        </div>
                        <div className="px-3 py-3 text-center">
                            <div className={`text-3xl font-display tabular-nums ${nightMode ? 'text-green-300' : 'text-green-600'}`}>
                                {grassCollected}
                                <span className={`text-lg ${nightMode ? 'text-green-500/60' : 'text-green-400'}`}>/{TOTAL_GRASS}</span>
                            </div>
                            {/* Progress bar */}
                            <div className={`mt-2 h-3 border-2 overflow-hidden
                                ${nightMode ? 'bg-slate-800 border-green-700' : 'bg-green-100 border-green-400'}`}>
                                <motion.div
                                    className="h-full"
                                    style={{
                                        width: `${grassPercent}%`,
                                        background: 'linear-gradient(90deg, #22c55e, #4ade80, #86efac)',
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${grassPercent}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <p className={`mt-1 text-[9px] ${nightMode ? 'text-green-400/60' : 'text-green-500'}`}>
                                {grassPercent}% cleared
                            </p>
                        </div>
                    </div>

                    {/* Scoreboard */}
                    <div className={`border-4 font-display text-xs shadow-lg
                        ${nightMode ? 'bg-slate-900/95 border-indigo-500 text-slate-200' : 'bg-white/95 border-slate-700 text-slate-800'}`}>
                        <div className={`px-3 py-1 text-center font-bold text-[10px] tracking-widest
                            ${nightMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-slate-100 text-slate-600'}`}>
                            ▸ SCORES ◂
                        </div>
                        <div className="px-3 py-1">
                            {getScoreboard().map((entry, i) => (
                                <div key={entry.id} className={`flex items-center gap-2 py-1.5 ${i === 0 ? '' : `border-t ${nightMode ? 'border-slate-700/50' : 'border-slate-100'}`}`}>
                                    <span className={`text-[9px] w-4 font-bold ${i === 0 ? 'text-yellow-400' : 'opacity-60'}`}>
                                        {i === 0 ? '👑' : `${i + 1}.`}
                                    </span>
                                    <div className="w-4 h-4 border-2 border-black/30" style={{ backgroundColor: entry.color }} />
                                    <span className="flex-1 truncate text-[10px]">{entry.name}</span>
                                    <span className="text-green-400 font-bold text-sm">{entry.score}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Controls hint */}
                    <div className={`border-4 font-display text-[9px] shadow-lg px-3 py-2
                        ${nightMode ? 'bg-slate-900/95 border-slate-600 text-slate-400' : 'bg-white/95 border-slate-300 text-slate-500'}`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px]">🎮</span>
                            <span className="tracking-wider">CONTROLS</span>
                        </div>
                        <p className="opacity-70">WASD / ARROWS — MOVE</p>
                    </div>

                    {/* Exit button */}
                    <PixelButton variant="secondary" size="sm" onClick={onLeave}>Exit Arena</PixelButton>
                </div>
            </div>

            {/* ── END SCREEN ── */}
            <AnimatePresence>
                {showEndScreen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-lg">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0, y: 30 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="w-full max-w-md mx-4"
                        >
                            <PixelCard title="Game Over" nightMode={nightMode}>
                                <div className="text-center p-6 space-y-6">
                                    <motion.div
                                        animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1] }}
                                        transition={{ duration: 0.8, delay: 0.3 }}
                                    >
                                        <Trophy size={80} className="mx-auto text-yellow-500 drop-shadow-lg" />
                                    </motion.div>
                                    <motion.h2
                                        initial={{ y: 10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                        className="font-display text-3xl"
                                    >
                                        {gameState.winnerId
                                            ? (gameState.players?.get(gameState.winnerId)?.displayName || "Winner") + " WINS!"
                                            : "IT'S A DRAW!"}
                                    </motion.h2>
                                    <div className="space-y-2 text-sm">
                                        {getScoreboard().map((entry, i) => (
                                            <motion.div
                                                key={entry.id}
                                                initial={{ x: -20, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: 0.6 + i * 0.1 }}
                                                className="flex items-center gap-3 px-4 py-2 bg-black/20 rounded"
                                            >
                                                <span className="font-display text-xs opacity-60">#{i + 1}</span>
                                                <div className="w-4 h-4 border border-black/30 rounded-sm" style={{ backgroundColor: entry.color }} />
                                                <span className="flex-1 font-display text-xs">{entry.name}</span>
                                                <span className="font-display text-xs text-green-400">{entry.score} 🌿</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                    <PixelButton variant="primary" className="w-full" onClick={onLeave}>
                                        Main Menu
                                    </PixelButton>
                                </div>
                            </PixelCard>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};