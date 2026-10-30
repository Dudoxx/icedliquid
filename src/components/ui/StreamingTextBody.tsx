'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     realtime
 * @purpose   The streamdown body of StreamingText; lazy-loaded so streamdown compiles and loads only where markdown renders.
 * @status    reusable
 *
 * Internal to StreamingText. The region, its label and the aria
 * state stay in StreamingText; this file owns only the streamdown render and its translated
 * control labels.
 */
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { Streamdown, type PluginConfig, type StreamdownTranslations } from 'streamdown';

import { httpsOnlyLinks, STREAMDOWN_LABEL_KEYS, type StreamingTextMode } from './streaming-types';

export interface StreamingTextBodyProps {
  readonly text: string;
  readonly mode: StreamingTextMode;
  readonly animating: boolean;
  readonly plugins?: PluginConfig | undefined;
}

export function StreamingTextBody({
  text,
  mode,
  animating,
  plugins,
}: StreamingTextBodyProps): React.JSX.Element {
  const t = useTranslations('realtime');
  const translations = useMemo((): Partial<StreamdownTranslations> => {
    const labels: Partial<Record<(typeof STREAMDOWN_LABEL_KEYS)[number], string>> = {};
    for (const key of STREAMDOWN_LABEL_KEYS) labels[key] = t(`streamdown.${key}`);
    return labels;
  }, [t]);

  return (
    <Streamdown
      mode={mode}
      isAnimating={animating}
      parseIncompleteMarkdown={mode === 'streaming'}
      {...(animating ? { caret: 'block' as const } : {})}
      translations={translations}
      urlTransform={httpsOnlyLinks}
      {...(plugins === undefined ? {} : { plugins })}
      className="flex flex-col gap-sm break-words"
    >
      {text}
    </Streamdown>
  );
}
