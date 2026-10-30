'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Generated-image viewer of icedLiquid: a clickable thumbnail that opens a full-size lightbox (title, prompt, download, close) and a download link, both working inside the stage's native fullscreen.
 * @status    feature-local
 *
 * Not the portal Dialog on purpose: a body portal is invisible while the stage element is the
 * browser's fullscreen element. The lightbox is a fixed layer INSIDE the stage subtree
 * (z-popover above the z-overlay stage frame), role=dialog + aria-modal, focus on close, closes on
 * backdrop click or Esc (captured before the stage's own Esc handler). Download re-encodes the
 * image as PNG through a canvas (no network request) and saves it under an icedliquid-*.png name.
 */
import { Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/primitives';

/** Download name: always .png (the file is re-encoded as PNG). */
function fileName(): string {
  return `icedliquid-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
}

/** Hand a Blob to the browser as a named download; the object URL is released afterwards. */
function triggerDownload(blob: Blob, name: string): void {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Save the image as a real PNG file. The model returns WebP; the browser decodes it into a canvas
 * and re-encodes PNG (lossless, full size). A data: URL never taints the canvas and needs no
 * network call (fetch(data:) is refused by the page CSP connect-src). The Blob download also
 * fixes Chrome ignoring `download` names on large data: links.
 */
function saveAsPng(url: string): void {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    canvas.toBlob((blob) => (blob ? triggerDownload(blob, fileName()) : undefined), 'image/png');
  };
  img.src = url;
}

export function DownloadLink({ url }: { url: string }): React.JSX.Element {
  const t = useTranslations('voice');
  return (
    <a
      href={url}
      download={fileName()}
      onClick={(e) => {
        e.preventDefault();
        saveAsPng(url);
      }}
      className="inline-flex min-h-8 items-center gap-xs rounded-full bg-secondary px-sm text-sm text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon icon={Download} size="sm" />
      {t('stage.image.download')}
    </a>
  );
}

export function ImageViewer({ url, prompt }: { url: string; prompt: string }): React.JSX.Element {
  const t = useTranslations('voice');
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('stage.image.open')}
        className="block w-full cursor-zoom-in overflow-hidden rounded-card focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL from the tool result, no optimiser */}
        <img src={url} alt={prompt} className="w-full bg-surface-muted object-contain transition-transform motion-safe:hover:scale-[1.01] motion-reduce:transition-none" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('stage.image.title')}
          className="fixed inset-0 z-(--z-popover) flex flex-col gap-sm bg-background/95 p-lg"
        >
          <div className="flex min-w-0 items-center gap-sm">
            <Text as="span" variant="ui" weight="semibold" className="min-w-0 flex-1 truncate">
              {t('stage.image.title')}
            </Text>
            <DownloadLink url={url} />
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-10 items-center gap-xs rounded-full bg-secondary px-md text-sm font-medium text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Icon icon={X} size="sm" />
              {t('stage.image.close')}
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- in-memory data URL from the tool result, no optimiser */}
            <img src={url} alt={prompt} className="max-h-full max-w-full rounded-card object-contain shadow-modal" />
          </div>
          {prompt ? (
            <Text variant="small" className="mx-auto max-w-prose text-center">
              {prompt}
            </Text>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
