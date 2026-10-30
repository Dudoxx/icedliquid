'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     realtime
 * @purpose   The ONE markdown renderer for streamed and static text (streamdown), one theme, translated controls.
 * @status    reusable
 *
 * One markdown engine for the app. `static` renders finished text;
 * `streaming` repairs half-written markdown and shows the caret while `animating`. Code,
 * math and mermaid renderers plug in through `overrides.plugins` (none ship — fenced
 * code renders as plain blocks). The region is `aria-live="polite"`
 * and `aria-busy` while text still arrives.
 */
import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';

import type { StreamingTextInstantiation, StreamingTextOverrides } from './streaming-types';
import type { ComponentProps } from './types';

export type StreamingTextProps = ComponentProps<StreamingTextInstantiation, StreamingTextOverrides>;

/**
 * streamdown (markdown + highlighter + plugins) is the heaviest chat dependency, so it sits
 * behind a lazy boundary: a page that only imports StreamingText does not compile it until a
 * text renders. Server rendering resolves the body in place; until the chunk arrives on a
 * client-side mount the fallback shows the same text, unformatted.
 */
const StreamingTextBody = lazy(() =>
  import('./StreamingTextBody').then((m) => ({ default: m.StreamingTextBody })),
);

export function StreamingText({ instantiation, overrides }: StreamingTextProps): React.JSX.Element {
  const t = useTranslations('realtime');
  const mode = overrides?.mode ?? 'static';
  const animating = mode === 'streaming' && overrides?.animating === true;

  return (
    <div
      role="region"
      aria-label={instantiation.label ?? t('streamingText.label')}
      aria-live={mode === 'streaming' ? 'polite' : 'off'}
      aria-busy={animating}
      className="min-w-0 text-base leading-(--density-line-height) text-foreground"
    >
      <Suspense fallback={<p className="break-words whitespace-pre-wrap">{instantiation.text}</p>}>
        <StreamingTextBody
          text={instantiation.text}
          mode={mode}
          animating={animating}
          plugins={overrides?.plugins}
        />
      </Suspense>
    </div>
  );
}
