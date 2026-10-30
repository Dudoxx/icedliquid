'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Full-screen frame of the icedLiquid stage for demos and recordings: covers the site header with a slim bar (Dudoxx logo, icedLiquid mark, Esc hint, exit button), uses the browser Fullscreen API when allowed and leaves on Esc.
 * @status    feature-local
 *
 * The frame is a fixed overlay (z-overlay) so it works even when the browser refuses native
 * fullscreen; native fullscreen hides the browser chrome too. Esc leaves either way: the browser
 * exits native fullscreen itself (fullscreenchange syncs the state), a keydown handler covers the
 * overlay-only case. The Dudoxx logo is the static BrandLogo (one brand, name from `brand.name`).
 */
import { Minimize2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button, Text } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

import { IcedLiquidMark } from './IcedLiquidMark';

function useStageFullscreen(): { ref: React.RefObject<HTMLDivElement | null>; full: boolean; enter: () => void; exit: () => void } {
  const ref = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  const exit = useCallback((): void => {
    setFull(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, []);

  const enter = useCallback((): void => {
    setFull(true);
    // Native fullscreen is best effort (needs a user gesture; may be blocked by policy).
    void ref.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') exit();
    };
    const onChange = (): void => {
      if (!document.fullscreenElement) setFull(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, [full, exit]);

  return { ref, full, enter, exit };
}

export interface StageFrameControl {
  full: boolean;
  enter: () => void;
}

export function StageFrame({ children }: { children: (ctl: StageFrameControl) => React.ReactNode }): React.JSX.Element {
  const t = useTranslations('voice');
  const tBrand = useTranslations('brand');
  const { ref: frameRef, full, enter, exit } = useStageFullscreen();
  return (
    <div
      ref={frameRef}
      data-fullscreen={full ? 'true' : undefined}
      className={cn(
        'flex min-w-0 flex-col gap-md',
        full && 'fixed inset-0 z-(--z-overlay) overflow-hidden bg-background p-lg',
      )}
    >
      {full ? (
        <div className="flex min-w-0 items-center gap-md">
          <BrandLogo instantiation={{ name: tBrand('name') }} overrides={{ size: 'md', withName: true }} />
          <span aria-hidden className="h-6 w-px bg-border" />
          <IcedLiquidMark wordmark={t('stage.name')} />
          <Text as="span" variant="small" className="ml-auto hidden md:inline">
            {t('stage.fullscreen.hint')}
          </Text>
          <Button instantiation={{ content: t('stage.fullscreen.exit'), icon: Minimize2, onClick: exit }} overrides={{ variant: 'outline' }} />
        </div>
      ) : null}
      {children({ full, enter })}
    </div>
  );
}
