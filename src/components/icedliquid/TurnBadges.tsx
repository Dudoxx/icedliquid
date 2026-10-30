'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Observation badges of icedLiquid: per answer (time to answer, context tokens, brain tokens and tokens/s, rounds, voice tokens/s) and per session (turns, total tokens, mean tokens/s, last context size).
 * @status    feature-local
 *
 * Every number is a VoiceTurnMetrics value measured by the agent from the WebGPU worker's `done`
 * messages and wall clocks; a missing value hides its badge. Chips are rounded-full with tabular
 * numbers on a muted tonal fill. SaveRun downloads the session as a JSON file in the browser (no
 * server write) and shows the file name.
 */
import { AudioLines, Brain, FileText, Gauge, Layers, Save, Timer, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { Icon } from '@/components/ui/Icon';
import { Button, Mono } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { VoiceTurnMetrics } from '@/lib/voice-agent/types';

import { exportRun, type IcedLiquidTurn } from './use-icedliquid-session';

type SaveStatus = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; path: string } | { kind: 'failed'; error: string };

/** Icon button that saves the session; the result line is a status (path) or an alert (error). */
function SaveRun({ turns, enabled }: { turns: readonly IcedLiquidTurn[]; enabled: boolean }): React.JSX.Element {
  const t = useTranslations('voice');
  const locale = useLocale();
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const save = (): void => {
    setStatus({ kind: 'saving' });
    exportRun(turns, locale).then(
      (r) => setStatus('path' in r ? { kind: 'saved', path: r.path } : { kind: 'failed', error: r.error }),
      (error: unknown) => setStatus({ kind: 'failed', error: error instanceof Error ? error.message : String(error) }),
    );
  };
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-xs" data-testid="icedliquid-save-run">
      <Button
        instantiation={{
          content: null,
          icon: Save,
          ariaLabel: t('stage.save.label'),
          disabled: !enabled,
          pending: status.kind === 'saving',
          onClick: save,
        }}
        overrides={{ variant: 'ghost', size: 'icon' }}
      />
      <span role="status" className="min-w-0 text-xs text-muted-foreground">
        {status.kind === 'saving' ? t('stage.save.saving') : null}
        {status.kind === 'saved' ? (
          <>
            {t('stage.save.saved')} <Mono className="text-xs break-all" data-testid="icedliquid-save-path">{status.path}</Mono>
          </>
        ) : null}
      </span>
      {status.kind === 'failed' ? (
        <span role="alert" className="min-w-0 text-xs text-destructive">
          {t('stage.save.failed')}: <Mono className="text-xs break-all">{status.error}</Mono>
        </span>
      ) : null}
    </span>
  );
}

function Chip({ icon, text, title, strong }: { icon: LucideIcon; text: string; title: string; strong?: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-xs rounded-full px-sm py-xs text-xs tabular-nums',
        strong ? 'bg-secondary text-secondary-foreground' : 'bg-surface-muted text-muted-foreground',
      )}
    >
      <Icon icon={icon} size="sm" label={title} />
      {text}
    </span>
  );
}

export function TurnBadges({ m }: { m: Partial<VoiceTurnMetrics> | undefined }): React.JSX.Element | null {
  const t = useTranslations('voice');
  const locale = useLocale();
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  if (!m) return null;
  const chips: Array<[LucideIcon, string, string, boolean?]> = [];
  if (m.reply_ms !== undefined) chips.push([Timer, t('stage.badge.reply', { s: (m.reply_ms / 1000).toFixed(1) }), t('stage.badge.replyTitle'), true]);
  if (m.context_tokens) chips.push([FileText, t('stage.badge.context', { n: n.format(m.context_tokens) }), t('stage.badge.contextTitle')]);
  if (m.brain_tokens) chips.push([Brain, t('stage.badge.brain', { n: n.format(m.brain_tokens), rate: n.format(m.brain_tok_s ?? 0) }), t('stage.badge.brainTitle')]);
  if (m.rounds && m.rounds > 1) chips.push([Layers, t('stage.badge.rounds', { n: m.rounds }), t('stage.badge.roundsTitle')]);
  if (m.voice_tokens) chips.push([AudioLines, t('stage.badge.voice', { n: n.format(m.voice_tokens), rate: n.format(m.voice_tok_s ?? 0) }), t('stage.badge.voiceTitle')]);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-xs" data-testid="turn-badges">
      {chips.map(([icon, text, title, strong]) => (
        <Chip key={title} icon={icon} text={text} title={title} strong={strong === true} />
      ))}
    </div>
  );
}

export function SessionStats({ turns }: { turns: readonly IcedLiquidTurn[] }): React.JSX.Element | null {
  const t = useTranslations('voice');
  const n = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 0 });
  const answered = turns.filter((x) => x.metrics.brain_tokens !== undefined);
  if (answered.length === 0) return <SaveRun turns={turns} enabled={false} />;
  const sum = (k: keyof VoiceTurnMetrics): number => answered.reduce((a, x) => a + (Number(x.metrics[k]) || 0), 0);
  const tokens = sum('brain_tokens') + sum('voice_tokens');
  const meanRate = sum('brain_tok_s') / answered.length;
  const context = answered.at(-1)?.metrics.context_tokens ?? 0;
  return (
    <div className="flex flex-wrap gap-xs" data-testid="session-stats">
      <Chip icon={Layers} text={t('stage.session.turns', { n: answered.length })} title={t('stage.session.turnsTitle')} strong />
      <Chip icon={Gauge} text={t('stage.session.tokens', { n: n.format(tokens) })} title={t('stage.session.tokensTitle')} />
      <Chip icon={Brain} text={t('stage.session.rate', { rate: n.format(meanRate) })} title={t('stage.session.rateTitle')} />
      <Chip icon={FileText} text={t('stage.session.context', { n: n.format(context) })} title={t('stage.session.contextTitle')} />
      <SaveRun turns={turns} enabled />
    </div>
  );
}
