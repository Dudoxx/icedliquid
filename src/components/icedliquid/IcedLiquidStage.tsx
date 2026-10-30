'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Showcase stage of the icedLiquid voice agent on one 16:9 screen: orb, state and controls, the measured wait per answer, the ears/brain/voice/tools pipeline with where each runs, and the conversation column.
 * @status    feature-local
 *
 * Built for screenshots and screen recordings (blog, LinkedIn, manuals): from lg up a two-column
 * stage that fills the viewport between the fixed site header and footer (never shorter than 37 rem); the
 * conversation column takes the larger share and scrolls inside its own panel. Below lg the columns
 * stack and the conversation card is one viewport tall, so its transcript scrolls inside it and the
 * composer stays reachable. The orb grows into the free height of its column. Every value comes from the agent session (useIcedLiquidSession); nothing is staged or invented.
 */
import { Hand, Maximize2, Mic, MicOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Button, Heading, Mono, Surface, Text } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { VoiceAgentState } from '@/lib/voice-agent/types';
import { useWebgpuEngine, type WebgpuEngineStatus } from '@/lib/webgpu/use-webgpu-engine';

import { IcedLiquidMark } from './IcedLiquidMark';
import { IcedOrb } from './IcedOrb';
import { IcedLiquidChat } from './IcedLiquidChat';
import { IcedLiquidInput, type IcedLiquidInputMode } from './IcedLiquidInput';
import { IcedLiquidPipeline } from './IcedLiquidPipeline';
import { ModelStatus } from './ModelStatus';
import { StageFrame } from './StageFrame';
import { SessionStats } from './TurnBadges';
import { useIcedLiquidSession, type IcedLiquidSession } from './use-icedliquid-session';

/** State pill colours: info = hearing you, warning = working (think/tool), primary = speaking. */
const STATE_TONE: Record<VoiceAgentState, string> = {
  idle: 'bg-secondary text-secondary-foreground',
  loading: 'bg-secondary text-secondary-foreground',
  listening: 'bg-secondary text-secondary-foreground',
  hearing: 'bg-info text-info-foreground',
  thinking: 'bg-warning text-warning-foreground',
  tool: 'bg-warning text-warning-foreground',
  speaking: 'bg-primary text-primary-foreground',
};

const LIQUID_AI_URL = 'https://www.liquid.ai';

const CAN_INTERRUPT: ReadonlySet<VoiceAgentState> = new Set(['thinking', 'tool', 'speaking']);

const ORB_MIN = 144;

/** Orb edge in px: the free square of its region, in 8 px steps, between ORB_MIN and `max`. */
function useOrbFit(max: number): { ref: React.RefObject<HTMLDivElement | null>; size: number } {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(152);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = (): void => {
      const free = Math.min(el.clientWidth, el.clientHeight);
      setSize(Math.max(ORB_MIN, Math.min(max, Math.floor(free / 8) * 8)));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    fit();
    return () => observer.disconnect();
  }, [max]);
  return { ref, size };
}

/** Send opens only while the agent listens AND the one worker is free (an ASR pass may still run). */
function inputMode(s: IcedLiquidSession, gpu: WebgpuEngineStatus): IcedLiquidInputMode {
  if (!s.running) return 'off';
  return s.state === 'listening' && gpu === 'ready' ? 'ready' : 'busy';
}

function IcedLiquidControls({ s, full, enter }: { s: IcedLiquidSession; full: boolean; enter: () => void }): React.JSX.Element {
  const t = useTranslations('voice');
  const last = s.turns.at(-1)?.metrics;
  const replied = s.turns.findLast((turn) => turn.metrics.reply_ms !== undefined)?.metrics.reply_ms;
  const { ref: orbRef, size: orbSize } = useOrbFit(full ? 320 : 280);
  return (
    <Surface
      as="section"
      tone="elevated"
      aria-label={t('stage.controls')}
      className="flex min-h-0 min-w-0 flex-col gap-sm lg:col-span-5 2xl:col-span-4"
    >
      <div className="flex min-w-0 flex-col gap-xs">
        {full ? null : (
          <div className="flex min-w-0 items-center justify-between gap-sm">
            <IcedLiquidMark wordmark={t('stage.name')} />
            <Button
              instantiation={{ content: t('stage.fullscreen.enter'), icon: Maximize2, onClick: enter }}
              overrides={{ variant: 'outline', size: 'sm' }}
            />
          </div>
        )}
        <Text variant="small">{t('stage.tagline')}</Text>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-sm">
        <div ref={orbRef} className="flex min-h-36 w-full flex-1 items-center justify-center">
          <IcedOrb state={s.state} level={s.level} sampler={s.sampleLevel} size={orbSize} label={t('stage.orb', { state: t(`stage.state.${s.state}`) })} />
        </div>
        <Text
          as="span"
          variant="ui"
          weight="medium"
          aria-live="polite"
          data-testid="icedliquid-state"
          className={cn('rounded-full px-md py-xs transition-colors motion-reduce:transition-none', STATE_TONE[s.state])}
        >
          {t(`stage.state.${s.state}`)}
        </Text>
        <div className="flex flex-wrap justify-center gap-sm">
          <Button
            instantiation={{
              content: s.running ? t('action.stop') : t('action.start'),
              icon: s.running ? MicOff : Mic,
              onClick: s.running ? s.stop : s.start,
            }}
            // Stop ends the session, it destroys nothing: a neutral secondary, not the danger fill.
            overrides={{ variant: s.running ? 'secondary' : 'primary', size: 'lg' }}
          />
          {CAN_INTERRUPT.has(s.state) ? (
            <Button
              instantiation={{ content: t('action.interrupt'), icon: Hand, onClick: s.interrupt }}
              overrides={{ variant: 'outline', size: 'lg' }}
            />
          ) : null}
        </div>
      </div>
      {s.fault ? (
        <Text tone="destructive" role="alert">
          <Mono className="text-sm break-words">{s.fault}</Mono>
        </Text>
      ) : null}
      <div className="flex min-w-0 items-baseline justify-between gap-sm rounded-card bg-surface-muted px-md py-sm">
        <Text as="span" variant="ui">
          {t('stage.wait')}
        </Text>
        <Mono className="text-base font-semibold text-primary" data-testid="icedliquid-reply-ms">
          {replied === undefined ? '—' : t('stage.seconds', { s: (replied / 1000).toFixed(1) })}
        </Mono>
      </div>
      <IcedLiquidPipeline state={s.state} metrics={last} />
      <ModelStatus />
    </Surface>
  );
}

export function IcedLiquidStage(): React.JSX.Element {
  const t = useTranslations('voice');
  const s = useIcedLiquidSession();
  const gpu = useWebgpuEngine().status;
  return (
    <StageFrame>
      {({ full, enter }) => (
    <div
      className={cn('grid min-w-0 gap-md lg:grid-cols-12', full ? 'min-h-0 flex-1 max-lg:overflow-y-auto' : 'lg:h-[max(37rem,calc(100dvh-var(--header-height)-var(--footer-height)-2*var(--token-spacing-md)))]')}
      data-testid="icedliquid-stage"
      data-state={s.state}
    >
      <IcedLiquidControls s={s} full={full} enter={enter} />
      <Surface as="section" aria-label={t('stage.chat.label')} className="flex h-[max(24rem,calc(100dvh-var(--header-height)-var(--footer-height)-2*var(--token-spacing-md)))] min-w-0 flex-col gap-sm lg:col-span-7 lg:h-auto lg:min-h-0 2xl:col-span-8">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-sm">
          <Heading level={2} size="sm">
            {t('stage.chat.title')}
          </Heading>
          <SessionStats turns={s.turns} />
        </div>
        <IcedLiquidChat
          lines={s.lines}
          turns={s.turns}
          working={s.state === 'thinking' || s.state === 'tool'}
          speakingId={s.speakingId}
          sampleLevel={s.sampleLevel}
        />
        <IcedLiquidInput mode={inputMode(s, gpu)} onAsk={s.ask} />
        <Text variant="small" className="border-t border-border pt-sm">
          {t.rich('stage.credit', {
            link: (chunks) => (
              <a href={LIQUID_AI_URL} target="_blank" rel="noopener noreferrer" className="text-link underline-offset-4 hover:underline">
                {chunks}
              </a>
            ),
          })}
        </Text>
      </Surface>
    </div>
      )}
    </StageFrame>
  );
}
