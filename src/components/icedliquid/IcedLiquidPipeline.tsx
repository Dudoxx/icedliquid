'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Pipeline strip of the icedLiquid showcase: ears, brain, voice and tools as four tiles with where each runs (this browser on WebGPU, or the server) and the last measured time; the active stage is highlighted.
 * @status    feature-local
 *
 * Times come from VoiceTurnMetrics of the newest turn; a stage with no measurement shows a dash.
 * The GPU and weight-cache line lives in ModelStatus.
 */
import { AudioLines, Brain, Ear, Wrench, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Icon } from '@/components/ui/Icon';
import { Mono, Text } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { VoiceAgentState, VoiceTurnMetrics } from '@/lib/voice-agent/types';

type StageId = 'ears' | 'brain' | 'voice' | 'tools';

const STAGES: ReadonlyArray<{ id: StageId; icon: LucideIcon; where: 'browser' | 'server'; active: VoiceAgentState }> = [
  { id: 'ears', icon: Ear, where: 'browser', active: 'hearing' },
  { id: 'brain', icon: Brain, where: 'browser', active: 'thinking' },
  { id: 'tools', icon: Wrench, where: 'server', active: 'tool' },
  { id: 'voice', icon: AudioLines, where: 'browser', active: 'speaking' },
];

function stageMs(id: StageId, m: Partial<VoiceTurnMetrics> | undefined): number | undefined {
  if (!m) return undefined;
  if (id === 'ears') return m.ears_ms;
  if (id === 'brain') return m.brain_ms;
  if (id === 'tools') return m.tool_ms || undefined;
  return m.voice_first_audio_ms;
}

export function IcedLiquidPipeline({
  state,
  metrics,
}: {
  state: VoiceAgentState;
  metrics: Partial<VoiceTurnMetrics> | undefined;
}): React.JSX.Element {
  const t = useTranslations('voice');
  return (
    <div className="flex min-w-0 flex-col gap-sm">
      <ol className="grid grid-cols-2 gap-sm sm:grid-cols-4" aria-label={t('stage.pipeline.label')}>
        {STAGES.map((s) => {
          const ms = stageMs(s.id, metrics);
          const on = state === s.active;
          return (
            <li
              key={s.id}
              data-stage={s.id}
              data-active={on ? 'true' : undefined}
              className={cn(
                'flex min-w-0 flex-col gap-xs rounded-card p-sm transition-colors motion-reduce:transition-none',
                on ? 'bg-primary text-primary-foreground' : 'bg-surface-muted',
              )}
            >
              <span className="flex items-center gap-xs">
                <Icon icon={s.icon} size="sm" />
                <Text as="span" variant="ui" weight="semibold" className={cn('truncate', on && 'text-primary-foreground')}>
                  {t(`stage.pipeline.${s.id}`)}
                </Text>
              </span>
              <Text as="span" variant="small" className={on ? 'text-primary-foreground' : undefined}>
                {t(`stage.whereShort.${s.where}`)}
              </Text>
              <Mono className={cn('text-sm', on && 'text-primary-foreground')}>
                {ms === undefined ? '—' : t('stage.ms', { ms: Math.round(ms) })}
              </Mono>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
