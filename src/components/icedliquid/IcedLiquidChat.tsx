'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Conversation column of the icedLiquid stage: avatar + name per message, user bubbles (live words stream in italic, then the final), tool cards (weather, web results, page actions) and assistant answers; scrolls inside its panel and follows the newest line.
 * @status    feature-local
 *
 * Assistant text renders as Markdown through the one renderer (StreamingText) in its screen form
 * (displayText: measured numbers and units the voice says as words show as the tool cards show them);
 * the voice gets the words without marks (brain.speechText). Following the newest line scrolls
 * the conversation panel only, never the page (scrollIntoView would move every scrolling ancestor). Bubbles are rounded, with the tail corner on the speaker side, a tonal fill and
 * no border, at a larger demo type size (body 16 px).
 */
import { Mic, UserRound } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/primitives';
import { StreamingText } from '@/components/ui/StreamingText';
import { cn } from '@/lib/utils';

import { IcedLiquidMark } from './IcedLiquidMark';
import { ToolCard } from './ToolCards';
import { TurnBadges } from './TurnBadges';
import { displayText } from './display-text';
import type { IcedLiquidLine, IcedLiquidTurn } from './use-icedliquid-session';

function Avatar({ user }: { user: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full',
        user ? 'bg-primary text-primary-foreground' : 'bg-surface-muted text-foreground',
      )}
    >
      {user ? <Icon icon={UserRound} size="sm" /> : <IcedLiquidMark className="[&_svg]:size-6" />}
    </span>
  );
}

/**
 * Five bars that follow the voice being heard (playback analyser), updated straight in the DOM
 * every frame — no React render. Static under prefers-reduced-motion.
 */
function SpeakingWave({ sampleLevel }: { sampleLevel: () => number }): React.JSX.Element {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const bars = Array.from(ref.current?.children ?? []) as HTMLElement[];
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let smooth = 0;
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      const lv = sampleLevel();
      smooth += (lv - smooth) * (lv > smooth ? 0.6 : 0.2);
      bars.forEach((bar, i) => {
        const wobble = 0.55 + 0.45 * Math.sin(now / 90 + i * 1.7);
        bar.style.transform = `scaleY(${(0.2 + 0.8 * smooth * wobble).toFixed(3)})`;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sampleLevel]);
  return (
    <span ref={ref} aria-hidden className="inline-flex h-4 items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="h-4 w-1 origin-center scale-y-50 rounded-full bg-primary" />
      ))}
    </span>
  );
}

function Message({
  line,
  metrics,
  speaking,
  sampleLevel,
}: {
  line: Extract<IcedLiquidLine, { kind: 'user' | 'assistant' }>;
  metrics: IcedLiquidTurn['metrics'] | undefined;
  speaking: boolean;
  sampleLevel: () => number;
}): React.JSX.Element {
  const t = useTranslations('voice');
  const locale = useLocale();
  const user = line.kind === 'user';
  const interim = user && !line.final;
  return (
    <div className={cn('flex min-w-0 items-end gap-sm', user && 'flex-row-reverse')} data-line={line.kind}>
      <Avatar user={user} />
      <div className={cn('flex min-w-0 flex-col gap-xs', user ? 'items-end' : 'items-start')}>
        <Text as="span" variant="small" className="flex items-center gap-xs">
          {user ? t('stage.chat.you') : t('stage.chat.assistant')}
          {interim ? (
            <>
              <Icon icon={Mic} size="sm" className="text-info motion-safe:animate-pulse" />
              {t('stage.chat.live')}
            </>
          ) : null}
          {speaking ? (
            <>
              <SpeakingWave sampleLevel={sampleLevel} />
              {t('stage.chat.speaking')}
            </>
          ) : null}
        </Text>
        <div
          className={cn(
            'max-w-prose min-w-0 rounded-2xl px-md py-sm text-base leading-relaxed',
            user ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-surface-muted text-foreground',
            interim && 'italic opacity-80',
            speaking && 'ring-2 ring-primary transition-shadow motion-reduce:transition-none',
          )}
        >
          {user ? (
            line.text
          ) : (
            <StreamingText instantiation={{ text: displayText(line.text, locale), label: t('stage.chat.assistant') }} overrides={{ mode: 'static' }} />
          )}
        </div>
        {user ? null : <TurnBadges m={metrics} />}
      </div>
    </div>
  );
}

/** Three pulsing dots while the agent thinks or runs a tool */
function Typing(): React.JSX.Element {
  const t = useTranslations('voice');
  return (
    <div className="flex items-end gap-sm" role="status" aria-label={t('stage.chat.typing')}>
      <Avatar user={false} />
      <span className="flex gap-xs rounded-2xl rounded-bl-sm bg-surface-muted px-md py-md">
        {['[animation-delay:0ms]', '[animation-delay:150ms]', '[animation-delay:300ms]'].map((d) => (
          <span key={d} className={cn('size-2 rounded-full bg-muted-foreground motion-safe:animate-pulse', d)} />
        ))}
      </span>
    </div>
  );
}

export function IcedLiquidChat({
  lines,
  turns,
  working,
  speakingId,
  sampleLevel,
}: {
  lines: readonly IcedLiquidLine[];
  turns: readonly IcedLiquidTurn[];
  working: boolean;
  speakingId: string | null;
  sampleLevel: () => number;
}): React.JSX.Element {
  const t = useTranslations('voice');
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.scrollTo({ top: panel.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, [lines, working]);
  if (lines.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-md p-lg">
        <IcedLiquidMark className="[&_svg]:size-16" />
        <Text variant="body" className="max-w-prose text-center text-muted-foreground">
          {t('stage.chat.empty')}
        </Text>
      </div>
    );
  }
  return (
    <div ref={panelRef} className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto overscroll-contain p-sm" aria-live="polite" aria-label={t('stage.chat.label')}>
      {lines.map((line) =>
        line.kind === 'tool' ? (
          <div key={`tool-${line.id}`} className="flex w-full min-w-0 sm:pl-11">
            <ToolCard event={line.event} />
          </div>
        ) : (
          <Message
            key={`${line.kind}-${line.id}`}
            line={line}
            metrics={line.kind === 'assistant' ? turns.find((x) => x.id === line.id)?.metrics : undefined}
            speaking={line.kind === 'assistant' && line.id === speakingId}
            sampleLevel={sampleLevel}
          />
        ),
      )}
      {working ? <Typing /> : null}
    </div>
  );
}
