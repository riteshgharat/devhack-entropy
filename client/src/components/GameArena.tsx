import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Room } from 'colyseus.js';
import { motion, AnimatePresence } from 'motion/react';
import { PixelCard } from './PixelCard';
import { PixelButton } from './PixelButton';
import { Trophy, Timer, Users, Zap, Rocket, Bomb } from 'lucide-react';

interface GameArenaProps {
    room: Room;
    nightMode: boolean;
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

/* ══════════════════════════════════════════════════════════════
   DAHLIA GRASS TILE — rich layered green with subtle detail
   ══════════════════════════════════════════════════════════════ */
function makeDahliaTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    const S = size;
    c.width = S; c.height = S;
    const g = c.getContext('2d')!;
    const cx = S / 2, cy = S / 2;

    // Rich gradient base
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, S * 0.7);
    grad.addColorStop(0, '#4caf50');
    grad.addColorStop(0.5, '#388e3c');
    grad.addColorStop(1, '#2e7d32');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);

    function petalRing(
        count: number, outer: number, inner: number,
        halfW: number, offset: number, cols: string[], opacity = 1
    ) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + offset;
            const tipX = cx + Math.cos(angle) * outer;
            const tipY = cy + Math.sin(angle) * outer;
            const perp = angle + Math.PI / 2;
            const b1x = cx + Math.cos(angle) * inner + Math.cos(perp) * halfW;
            const b1y = cy + Math.sin(angle) * inner + Math.sin(perp) * halfW;
            const b2x = cx + Math.cos(angle) * inner - Math.cos(perp) * halfW;
            const b2y = cy + Math.sin(angle) * inner - Math.sin(perp) * halfW;

            g.globalAlpha = opacity;
            g.fillStyle = cols[i % cols.length];
            g.beginPath();
            g.moveTo(tipX, tipY);
            g.lineTo(b1x, b1y);
            g.lineTo(b2x, b2y);
            g.closePath();
            g.fill();

            g.globalAlpha = opacity * 0.3;
            g.strokeStyle = 'rgba(255,255,255,0.2)';
            g.lineWidth = 0.5;
            g.beginPath();
            g.moveTo(tipX, tipY);
            g.lineTo(b1x, b1y);
            g.stroke();
            g.globalAlpha = 1;
        }
    }

    petalRing(20, S * 0.72, S * 0.14, S * 0.12, 0,
        ['#2e7d32', '#33691e', '#388e3c', '#1b5e20', '#276221']);
    petalRing(18, S * 0.50, S * 0.12, S * 0.10, Math.PI / 18,
        ['#43a047', '#388e3c', '#4caf50', '#43a047', '#37873b']);
    petalRing(14, S * 0.35, S * 0.10, S * 0.08, Math.PI / 28,
        ['#66bb6a', '#4caf50', '#57a85b', '#43a047']);
    petalRing(10, S * 0.22, S * 0.08, S * 0.06, 0,
        ['#81c784', '#66bb6a', '#76c479']);

    g.globalAlpha = 1;
    g.fillStyle = '#1a3d1a';
    g.beginPath(); g.arc(cx, cy, S * 0.08, 0, Math.PI * 2); g.fill();

    return c;
}

/* ── Dirt tile for eaten grass ── */
function makeDirtTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d')!;
    const h = size / 2;

    // Slightly varied dirt with texture
    g.fillStyle = '#7a5c3a'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#8B6B4A'; g.fillRect(0, 0, h, h); g.fillRect(h, h, h, h);

    // Subtle pebble dots
    const pebbles = [[size * 0.2, size * 0.3], [size * 0.6, size * 0.15], [size * 0.75, size * 0.65], [size * 0.35, size * 0.7]];
    pebbles.forEach(([px, py]) => {
        g.fillStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.arc(px, py, 3, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.1)';
        g.beginPath(); g.arc(px - 1, py - 1, 2, 0, Math.PI * 2); g.fill();
    });

    return c;
}

/* ── Small Grass Tile (phase 2 — smaller, lighter, centered on dirt) ── */
function makeSmallGrassTile(size: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d')!;
    const cx = size / 2, cy = size / 2;

    // Dirt base
    const h = size / 2;
    g.fillStyle = '#7a5c3a'; g.fillRect(0, 0, size, size);
    g.fillStyle = '#8B6B4A'; g.fillRect(0, 0, h, h); g.fillRect(h, h, h, h);

    // Small grass clump in center (40% of tile)
    const r = size * 0.2;
    const grassGrad = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.5);
    grassGrad.addColorStop(0, '#66bb6a');
    grassGrad.addColorStop(0.6, '#43a047');
    grassGrad.addColorStop(1, '#2e7d32');
    g.fillStyle = grassGrad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();

    // Little leaf details
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i;
        const lx = cx + Math.cos(a) * r * 0.7;
        const ly = cy + Math.sin(a) * r * 0.7;
        g.fillStyle = i % 2 === 0 ? '#81c784' : '#4caf50';
        g.beginPath(); g.arc(lx, ly, 4, 0, Math.PI * 2); g.fill();
    }

    return c;
}

/* ── Power-up icon drawing (on canvas) ── */
function drawPowerUpIcon(ctx: CanvasRenderingContext2D, x: number, y: number, type: string, time: number) {
    const bounce = Math.sin(time * 4) * 4;
    const glow = 0.5 + 0.3 * Math.sin(time * 6);

    ctx.save();
    ctx.translate(x, y + bounce);

    // Glow circle behind icon
    let glowColor = 'rgba(251,191,36,';
    if (type === 'bomb') glowColor = 'rgba(239,68,68,';
    else if (type === 'rocket') glowColor = 'rgba(249,115,22,';
    else if (type === 'speed') glowColor = 'rgba(251,191,36,';

    ctx.fillStyle = glowColor + glow + ')';
    ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI * 2); ctx.fill();

    // Icon
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (type === 'bomb') ctx.fillText('💣', 0, 0);
    else if (type === 'rocket') ctx.fillText('🚀', 0, 0);
    else if (type === 'speed') ctx.fillText('⚡', 0, 0);

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
   PROFESSIONAL ARENA BACKGROUND
   Rich isometric-style field with decorative border and depth
   ══════════════════════════════════════════════════════════════ */
function drawArenaBackground(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    offsetX: number, offsetY: number,
    nightMode: boolean,
    time: number
) {
    // ── Outer background with gradient sky / terrain ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (nightMode) {
        bgGrad.addColorStop(0, '#0a1628');
        bgGrad.addColorStop(0.4, '#0d2b1a');
        bgGrad.addColorStop(1, '#071a0f');
    } else {
        bgGrad.addColorStop(0, '#87ceeb');
        bgGrad.addColorStop(0.3, '#a8dba8');
        bgGrad.addColorStop(0.6, '#3d8c40');
        bgGrad.addColorStop(1, '#2d6e30');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Animated background detail: subtle hex grid ──
    if (!nightMode) {
        ctx.strokeStyle = 'rgba(0,80,0,0.12)';
        ctx.lineWidth = 1;
        const hexSize = 40;
        for (let hy = -hexSize; hy < H + hexSize; hy += hexSize * 1.5) {
            for (let hx = -hexSize; hx < W + hexSize; hx += hexSize * Math.sqrt(3)) {
                const offset_row = Math.floor(hy / (hexSize * 1.5)) % 2 === 0 ? 0 : hexSize * Math.sqrt(3) / 2;
                drawHex(ctx, hx + offset_row, hy, hexSize * 0.5);
            }
        }
    } else {
        // Night: subtle star field
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        const starPositions = [[50, 30], [150, 80], [300, 20], [450, 60], [600, 40], [750, 90],
        [900, 25], [1050, 70], [180, 150], [400, 130], [700, 160], [950, 120],
        [80, 200], [350, 210], [600, 190], [850, 230]];
        starPositions.forEach(([sx, sy]) => {
            const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 2 + sx));
            ctx.globalAlpha = twinkle;
            ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ── Decorative corners / outer field markings ──
    ctx.save();
    ctx.translate(offsetX, offsetY);

    // Corner flag posts
    const flags = [[0, 0], [ARENA_W, 0], [0, ARENA_H], [ARENA_W, ARENA_H]] as [number, number][];
    flags.forEach(([fx, fy]) => {
        // Post
        ctx.fillStyle = nightMode ? '#94a3b8' : '#e2e8f0';
        ctx.fillRect(fx - 2, fy - 18, 4, 18);
        // Flag
        ctx.fillStyle = nightMode ? '#f59e0b' : '#ef4444';
        ctx.beginPath();
        ctx.moveTo(fx + 2, fy - 18);
        ctx.lineTo(fx + 14, fy - 13);
        ctx.lineTo(fx + 2, fy - 8);
        ctx.closePath(); ctx.fill();
    });

    // Arena boundary – double-line pixel border
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
    // Center cross
    ctx.beginPath();
    ctx.moveTo(ARENA_W / 2 - 15, ARENA_H / 2); ctx.lineTo(ARENA_W / 2 + 15, ARENA_H / 2);
    ctx.moveTo(ARENA_W / 2, ARENA_H / 2 - 15); ctx.lineTo(ARENA_W / 2, ARENA_H / 2 + 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtle lane lines for depth
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

export const GameArena: React.FC<GameArenaProps> = ({ room, nightMode, onLeave }) => {
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

    return (
        <div className={`relative w-full max-w-5xl mx-auto mt-4 flex flex-col items-center ${nightMode ? 'text-white' : ''}`}>
            {/* ── TOP BAR HUD ── */}
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

                {/* Scoreboard */}
                <div className={`border-4 font-display text-xs shadow-lg
                    ${nightMode ? 'bg-slate-900/95 border-indigo-500 text-slate-200' : 'bg-white/95 border-slate-700 text-slate-800'}`}
                    style={{ minWidth: '190px' }}>
                    <div className={`px-3 py-1 text-center font-bold text-[10px] tracking-widest
                        ${nightMode ? 'bg-indigo-900/50 text-indigo-300' : 'bg-slate-100 text-slate-600'}`}>
                        ▸ SCORES ◂
                    </div>
                    <div className="px-3 py-1">
                        {getScoreboard().map((entry, i) => (
                            <div key={entry.id} className="flex items-center gap-2 py-1">
                                <span className="text-[9px] opacity-60">{i + 1}.</span>
                                <div className="w-3 h-3 border border-black/30" style={{ backgroundColor: entry.color }} />
                                <span className="flex-1 truncate text-[9px]">{entry.name}</span>
                                <span className="text-green-400 font-bold text-[9px]">{entry.score}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── ARENA CANVAS ── */}
            <div className={`relative border-8 shadow-2xl overflow-hidden
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

                {/* Waiting screen */}
                {!gameState.matchStarted && gameState.countdown === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/65 backdrop-blur-md z-10">
                        <div className="text-center text-white space-y-4">
                            <motion.div
                                animate={{ y: [0, -12, 0], scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            >
                                <Users size={64} className="mx-auto text-indigo-400" />
                            </motion.div>
                            <h2 className="font-display text-2xl tracking-widest">WAITING FOR PLAYERS</h2>
                            <p className="font-body text-lg opacity-70">
                                Need {Math.max(0, 2 - (gameState.players?.size || 0))} more player(s)
                            </p>
                            <div className="flex justify-center gap-3 mt-2">
                                {Array.from({ length: gameState.players?.size || 0 }).map((_, i) => (
                                    <motion.div
                                        key={i}
                                        animate={{ scale: [1, 1.3, 1] }}
                                        transition={{ delay: i * 0.2, duration: 1, repeat: Infinity }}
                                        className="w-4 h-4 rounded-full bg-green-400"
                                    />
                                ))}
                                {Array.from({ length: Math.max(0, 2 - (gameState.players?.size || 0)) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="w-4 h-4 rounded-full border-2 border-white/40" />
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── CONTROLS HINT ── */}
            <div className={`mt-2 flex gap-6 font-display text-[9px] opacity-50
                ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <span>WASD / ARROWS — MOVE</span>
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

            <div className="mt-4">
                <PixelButton variant="secondary" size="sm" onClick={onLeave}>Exit Arena</PixelButton>
            </div>
        </div>
    );
};