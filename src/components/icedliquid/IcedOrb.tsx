'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Animated voice orb of icedLiquid: a canvas with a glowing core, 64 radial level bars, spinning arc segments per agent state and pulse rings while it speaks; colours from the live theme tokens.
 * @status    feature-local
 *
 * A rAF loop reads state/level/sampler through refs (no re-render per frame), smoothed energy, DPR capped at
 * 2, paused while the tab is hidden, ONE static frame under prefers-reduced-motion. Colours are
 * the CSS variables --color-primary / --color-info / --color-warning / --color-muted-foreground,
 * re-read when <html> class or data-brand changes — no hex in code.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';

import type { VoiceAgentState } from '@/lib/voice-agent/types';

const BARS = 64;
const MAX_DPR = 2;
/** Arc spin per state, rad/s. */
const SPIN: Record<VoiceAgentState, number> = { idle: 0.15, loading: 1.2, listening: 0.45, hearing: 0.9, thinking: 2.4, tool: 2.4, speaking: 0.6 };

interface Palette {
  core: string;
  info: string;
  warn: string;
  dim: string;
}

function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const v = (name: string): string => css.getPropertyValue(name).trim() || 'currentColor';
  return { core: v('--color-primary'), info: v('--color-info'), warn: v('--color-warning'), dim: v('--color-muted-foreground') };
}

function accentOf(state: VoiceAgentState, p: Palette): string {
  if (state === 'hearing') return p.info;
  if (state === 'thinking' || state === 'tool' || state === 'loading') return p.warn;
  return p.core;
}

/** Target drive 0..1 per state. */
function drive(state: VoiceAgentState, level: number, t: number): number {
  if (state === 'speaking') return 0.15 + 0.85 * level;
  if (state === 'hearing' || state === 'listening') return Math.max(0.08, level);
  if (state === 'thinking' || state === 'tool') return 0.3 + 0.12 * Math.sin(5 * t);
  if (state === 'loading') return 0.2 + 0.1 * Math.sin(3 * t);
  return 0.06 + 0.05 * Math.sin(1.3 * t);
}

function drawFrame(ctx: CanvasRenderingContext2D, size: number, state: VoiceAgentState, energy: number, t: number, p: Palette): void {
  const c = size / 2;
  const r = size * 0.24;
  const accent = accentOf(state, p);
  ctx.clearRect(0, 0, size, size);
  // core glow
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.35 * energy;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(c, c, r * (1.05 + 0.35 * energy), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(c, c, r * 0.72, 0, Math.PI * 2);
  ctx.fill();
  // radial bars
  ctx.strokeStyle = accent;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, size / 120);
  for (let i = 0; i < BARS; i++) {
    const a = (i / BARS) * Math.PI * 2;
    const wave = 0.5 + 0.5 * Math.sin(a * 3 + t * 4) * Math.sin(a * 5 - t * 2.3);
    const len = size * (0.02 + 0.13 * energy * (0.35 + 0.65 * wave));
    ctx.globalAlpha = 0.35 + 0.65 * energy;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r * 1.12, c + Math.sin(a) * r * 1.12);
    ctx.lineTo(c + Math.cos(a) * (r * 1.12 + len), c + Math.sin(a) * (r * 1.12 + len));
    ctx.stroke();
  }
  // spinning arc segments + dashed counter track
  const spin = t * SPIN[state];
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = Math.max(2, size / 70);
  for (let k = 0; k < 3; k++) {
    const s = spin + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.45, s, s + 0.7);
    ctx.stroke();
  }
  ctx.strokeStyle = p.dim;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.arc(c, c, size * 0.41, -spin * 0.6, -spin * 0.6 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // speaking pulse rings
  if (state === 'speaking') {
    ctx.strokeStyle = accent;
    for (let k = 0; k < 3; k++) {
      const ph = ((t / 1.4 + k / 3) % 1 + 1) % 1;
      ctx.globalAlpha = (1 - ph) * 0.45 * (0.4 + energy);
      ctx.beginPath();
      ctx.arc(c, c, r * (1 + ph * 0.9), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

export function IcedOrb({
  state,
  level,
  sampler,
  size = 192,
  label,
}: {
  state: VoiceAgentState;
  level: number;
  /** Live playback loudness (SpeechPlayer.level) read every frame while speaking: the TTS cue. */
  sampler: () => number;
  size?: number;
  label: string;
}): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ state, level, sampler });
  useLayoutEffect(() => {
    live.current = { state, level, sampler };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    let palette = readPalette(canvas);
    const observer = new MutationObserver(() => {
      palette = readPalette(canvas);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-brand', 'style'] });
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      drawFrame(ctx, size, live.current.state, 0.2, 0, palette);
      return () => observer.disconnect();
    }
    let raf = 0;
    let energy = 0;
    const start = performance.now();
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const t = (now - start) / 1000;
      const { state: st, level: lv, sampler: heard } = live.current;
      // While speaking the orb follows what is heard (playback analyser), syllable by syllable.
      const target = drive(st, st === 'speaking' ? heard() : lv, t);
      energy += (target - energy) * (target > energy ? (st === 'speaking' ? 0.55 : 0.35) : st === 'speaking' ? 0.18 : 0.08);
      drawFrame(ctx, size, live.current.state, energy, t, palette);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [size]);

  return <canvas ref={canvasRef} role="img" aria-label={label} style={{ width: size, height: size }} data-state={state} />;
}
