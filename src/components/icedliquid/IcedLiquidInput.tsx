'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Typed entry of the icedLiquid stage: a textarea (Enter sends, Shift+Enter breaks the line) and a send button that run the same turn as a spoken request, answered on screen and aloud.
 * @status    feature-local
 *
 * Three modes: `off` (no session: the box asks for Start first), `busy` (the agent thinks, runs a
 * tool or speaks: the box stays editable and says that Send opens when it listens again; nothing is
 * queued) and `ready` (listening: Send runs the turn; one turn at a time on the one WebGPU worker).
 * The text stays in the box until a send is accepted, so nothing typed is lost. Send is a filled
 * primary button only when it can act; otherwise it is a quiet secondary.
 */
import { SendHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

import { Button, Text } from '@/components/ui/primitives';

export type IcedLiquidInputMode = 'off' | 'busy' | 'ready';

export function IcedLiquidInput({ mode, onAsk }: { mode: IcedLiquidInputMode; onAsk: (text: string) => boolean }): React.JSX.Element {
  const t = useTranslations('voice');
  const id = useId();
  const hintId = useId();
  const [text, setText] = useState('');
  const canSend = mode === 'ready' && text.trim() !== '';
  const send = (): void => {
    if (canSend && onAsk(text)) setText('');
  };
  const placeholder = { off: t('stage.input.startFirst'), busy: t('stage.input.busy'), ready: t('stage.input.placeholder') }[mode];
  return (
    <div className="flex min-w-0 flex-col gap-xs">
      <div className="flex min-w-0 items-end gap-sm rounded-2xl bg-surface-muted p-xs">
        <label htmlFor={id} className="sr-only">
          {t('stage.input.label')}
        </label>
        <textarea
          id={id}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          disabled={mode === 'off'}
          aria-describedby={hintId}
          className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-sm py-sm text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-60"
        />
        <Button
          instantiation={{ content: t('stage.input.send'), icon: SendHorizontal, onClick: send, disabled: !canSend }}
          overrides={{ variant: canSend ? 'primary' : 'secondary' }}
        />
      </div>
      <Text id={hintId} variant="small" aria-live="polite" className={mode === 'busy' ? 'text-foreground' : undefined}>
        {mode === 'busy' ? t('stage.input.busy') : t('stage.input.hint')}
      </Text>
    </div>
  );
}
