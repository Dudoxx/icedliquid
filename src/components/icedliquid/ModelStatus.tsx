'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Model status of the icedLiquid stage: the WebGPU adapter, whether the weights sit in the browser cache (OPFS), a load progress bar (MB, cache or download), and the resident size and load time once ready; warms the model from the cache on page open.
 * @status    feature-local
 *
 * Cache facts come from cacheSummary() (lib/webgpu/opfs-cache.ts, read-only); load progress and
 * resident bytes from the WebGPU worker state. The auto-warm runs ONLY when committed weight files
 * are already cached, so opening the page never starts a multi-GB download by itself.
 */
import { Cpu, Database, HardDriveDownload } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/primitives';
import { webgpu } from '@/config';
import { cacheSummary } from '@/lib/webgpu/opfs-cache';
import { useWebgpuEngine, webgpuEngine } from '@/lib/webgpu/use-webgpu-engine';

const MB = 1024 * 1024;

type Cache = Awaited<ReturnType<typeof cacheSummary>>;

/** Read the cache once; when weights are cached and the worker is idle, load them from disk now. */
function useCacheWarm(): Cache | undefined {
  const [cache, setCache] = useState<Cache | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void cacheSummary().then((summary) => {
      if (!alive) return;
      setCache(summary);
      if (!summary || summary.files === 0 || webgpuEngine.state().status !== 'idle') return;
      webgpuEngine.load(webgpu);
    });
    return () => {
      alive = false;
    };
  }, []);
  return cache;
}

export function ModelStatus(): React.JSX.Element {
  const t = useTranslations('voice');
  const n = new Intl.NumberFormat(useLocale(), { maximumFractionDigits: 0 });
  const gpu = useWebgpuEngine();
  const cache = useCacheWarm();
  const files = Object.values(gpu.progress);
  const loaded = files.reduce((a, f) => a + f.loaded, 0);
  const total = files.reduce((a, f) => a + f.total, 0);
  const cached = (cache?.files ?? 0) > 0;
  const gpuLabel = gpu.adapter
    ? t('stage.gpu', {
        vendor: gpu.adapter.vendor ? gpu.adapter.vendor.charAt(0).toUpperCase() + gpu.adapter.vendor.slice(1) : '—',
        family: gpu.adapter.architecture.replace(/^metal-(\d+)$/i, 'Metal $1') || '—',
      })
    : t('stage.model.noAdapter');
  return (
    <div className="flex min-w-0 flex-col gap-xs rounded-card bg-surface-muted px-md py-sm" data-testid="model-status" data-cache={cached ? 'hit' : 'miss'}>
      {/* Wraps instead of truncating: the adapter name is the measured fact, never cut. */}
      <Text variant="small" className="flex min-w-0 flex-wrap items-center gap-x-xs">
        <Icon icon={Cpu} size="sm" />
        <span className="min-w-0 break-words">{gpuLabel}</span>
        <span aria-hidden>·</span>
        <span>{t(`stage.gpuState.${gpu.status}`)}</span>
      </Text>
      {gpu.status === 'loading' && total > 0 ? (
        <>
          <progress
            value={loaded}
            max={total}
            aria-label={t('stage.model.loading')}
            className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-surface [&::-webkit-progress-value]:bg-primary"
          />
          <Text variant="small" className="tabular-nums">
            {t(cached ? 'stage.model.fromCache' : 'stage.model.downloading', { loaded: n.format(loaded / MB), total: n.format(total / MB) })}
          </Text>
        </>
      ) : (
        <Text variant="small" className="flex min-w-0 items-center gap-xs tabular-nums">
          <Icon icon={cached ? Database : HardDriveDownload} size="sm" />
          {gpu.status === 'ready' || gpu.status === 'generating'
            ? t('stage.model.ready', {
                mb: n.format(gpu.residentBytes / MB),
                s: ((gpu.modelLoadMs ?? 0) / 1000).toFixed(1),
                source: gpu.cacheHit ? t('stage.model.sourceCache') : t('stage.model.sourceNetwork'),
              })
            : cached
              ? t('stage.model.cached', { mb: n.format((cache?.bytes ?? 0) / MB) })
              : t('stage.model.notCached')}
        </Text>
      )}
    </div>
  );
}
