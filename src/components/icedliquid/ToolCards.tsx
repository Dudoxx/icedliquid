'use client';
/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     voice
 * @purpose   Tool cards of the icedLiquid conversation: a weather card (now, feels-like, wind, humidity, day rows), a web-results card (site, title link, summary) and a compact chip for every other tool call, each with where it ran and its time.
 * @status    feature-local
 *
 * Layout: tonal fill, no borders, tabular numbers, https-only links opened in a new
 * tab with noopener. A missing value shows a dash; nothing is invented.
 */
import { CircleCheck, CircleX, Droplets, ExternalLink, Globe, ImageIcon, Languages, Loader2, Moon, Power, Sun, Wind, Wrench, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Icon } from '@/components/ui/Icon';
import { Mono, Surface, Text } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import type { VoiceAgentToolEvent } from '@/lib/voice-agent/types';
import { CLIENT_TOOLS } from '@/lib/voice-agent/tools';

import { DownloadLink, ImageViewer } from './ImageViewer';
import { asImage, asWeather, asWebHits, weatherGlyph, type ImageResult, type WeatherResult, type WebHit } from './tool-results';

/** `now` keeps the tool's one decimal (the answer quotes it); day rows round to whole degrees. */
function useFormat(): { now: (c: number | null) => string; temp: (c: number | null) => string; kph: (v: number | null) => string; pct: (v: number | null) => string; day: (d: string | null, i: number) => string } {
  const locale = useLocale();
  const t = useTranslations('voice');
  const unit = (u: string, digits = 0) => new Intl.NumberFormat(locale, { style: 'unit', unit: u, maximumFractionDigits: digits });
  return {
    now: (c) => (c === null ? '–' : unit('celsius', 1).format(c)),
    temp: (c) => (c === null ? '–' : unit('celsius').format(Math.round(c))),
    kph: (v) => (v === null ? '–' : unit('kilometer-per-hour').format(Math.round(v))),
    pct: (v) => (v === null ? '–' : new Intl.NumberFormat(locale, { style: 'percent' }).format(v / 100)),
    day: (d, i) =>
      i === 0 || !d ? t('stage.card.today') : new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`)),
  };
}

const TOOL_NAMES = ['get_weather', 'get_time', 'web_search', 'generate_image', 'set_theme', 'set_locale', 'end_session'] as const;
type KnownTool = (typeof TOOL_NAMES)[number];
const isKnownTool = (name: string): name is KnownTool => (TOOL_NAMES as readonly string[]).includes(name);

/** Localized tool name; an unknown tool keeps its id (never hidden). */
function useToolLabel(): (name: string) => string {
  const t = useTranslations('voice');
  return (name) => (isKnownTool(name) ? t(`stage.tools.${name}`) : name);
}

function CardHeader({ icon, title, meta }: { icon: LucideIcon; title: string; meta: string }): React.JSX.Element {
  return (
    <div className="flex min-w-0 items-center gap-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-card bg-surface-muted text-muted-foreground">
        <Icon icon={icon} size="sm" />
      </span>
      <Text as="span" variant="ui" weight="semibold" className="min-w-0 flex-1 truncate">
        {title}
      </Text>
      <Text as="span" variant="small">
        {meta}
      </Text>
    </div>
  );
}

function WeatherCard({ w, ms }: { w: WeatherResult; ms: number }): React.JSX.Element {
  const t = useTranslations('voice');
  const label = useToolLabel();
  const f = useFormat();
  const Now = weatherGlyph(w.now.code, w.now.is_day);
  const stats: Array<[string, string, LucideIcon]> = [
    [t('stage.card.wind'), f.kph(w.now.wind_kph), Wind],
    [t('stage.card.humidity'), f.pct(w.now.humidity), Droplets],
    [t('stage.card.rain'), f.pct(w.days[0]?.chance_of_rain ?? null), Droplets],
  ];
  return (
    <Surface as="section" density="compact" className="@container flex w-full max-w-160 flex-col gap-sm" data-card="weather">
      <CardHeader icon={Now} title={w.place} meta={t('stage.card.meta', { tool: label('get_weather'), ms: Math.round(ms) })} />
      <div className="flex flex-wrap items-center gap-md">
        <Icon icon={Now} size="lg" className="size-12 text-primary" />
        <div className="flex min-w-0 flex-col">
          <span className="font-display text-4xl leading-none tabular-nums">{f.now(w.now.temp_c)}</span>
          <Text as="span" variant="ui">
            {w.now.condition ?? '–'} · {t('stage.card.feels', { temp: f.now(w.now.feels_like_c) })}
          </Text>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-sm @[26rem]:grid-cols-3">
        {stats.map(([label, value, icon]) => (
          <div key={label} className="flex flex-col gap-xs rounded-card bg-surface-muted px-sm py-xs">
            <dt className="flex items-center gap-xs text-xs text-muted-foreground">
              <Icon icon={icon} size="sm" />
              {label}
            </dt>
            <dd className="text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <ol className="flex flex-col gap-xs">
        {w.days.map((d, i) => (
          <li key={d.date ?? i} className="flex items-center gap-sm rounded-card bg-surface-muted px-sm py-xs text-sm">
            <span className="w-12 font-medium">{f.day(d.date, i)}</span>
            <Icon icon={weatherGlyph(d.code)} size="sm" className="text-primary" />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{d.condition ?? '–'}</span>
            <span className="tabular-nums">
              {f.temp(d.max_c)} <span className="text-muted-foreground">/ {f.temp(d.min_c)}</span>
            </span>
          </li>
        ))}
      </ol>
    </Surface>
  );
}

function WebCard({ hits, query, ms }: { hits: WebHit[]; query: string; ms: number }): React.JSX.Element {
  const t = useTranslations('voice');
  const label = useToolLabel();
  return (
    <Surface as="section" density="compact" className="@container flex w-full flex-col gap-sm" data-card="web">
      <CardHeader icon={Globe} title={query} meta={t('stage.card.sources', { tool: label('web_search'), n: hits.length, ms: Math.round(ms) })} />
      <ul className="grid grid-cols-1 gap-sm @2xl:grid-cols-2">
        {hits.map((h) => (
          <li key={h.url} className="flex min-w-0 flex-col gap-xs rounded-card bg-surface-muted p-sm">
            <Text as="span" variant="small" className="truncate">
              {h.site}
              {h.published ? ` · ${h.published.slice(0, 10)}` : ''}
            </Text>
            <a href={h.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-medium hover:text-link hover:underline">
              {h.title} <Icon icon={ExternalLink} size="sm" className="inline" label={t('stage.card.open')} />
            </a>
            {h.summary ? <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{h.summary}</p> : null}
          </li>
        ))}
      </ul>
    </Surface>
  );
}

function ImageCard({ img, ms }: { img: ImageResult; ms: number }): React.JSX.Element {
  const t = useTranslations('voice');
  const label = useToolLabel();
  const meta = [label('generate_image'), img.model?.split('/').at(-1), img.cost_usd === null ? null : `$${img.cost_usd.toFixed(3)}`, t('stage.ms', { ms: Math.round(ms) })]
    .filter(Boolean)
    .join(' · ');
  return (
    <Surface as="section" density="compact" className="flex w-full max-w-160 flex-col gap-sm" data-card="image">
      <CardHeader icon={ImageIcon} title={t('stage.card.image')} meta={meta} />
      <ImageViewer url={img.url} prompt={img.caption ?? img.prompt} />
      <div className="flex min-w-0 items-start gap-sm">
        {(img.caption ?? img.prompt) ? <p className="line-clamp-3 min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground" title={img.prompt}>{img.caption ?? img.prompt}</p> : <span className="flex-1" />}
        <DownloadLink url={img.url} />
      </div>
    </Surface>
  );
}

const CLIENT_ICON: Record<string, LucideIcon> = { end_session: Power, set_theme: Moon, set_locale: Languages };

function ToolChip({ event }: { event: VoiceAgentToolEvent }): React.JSX.Element {
  const t = useTranslations('voice');
  const label = useToolLabel();
  const done = event.result !== undefined;
  const ok = event.result?.ok === true;
  const client = CLIENT_TOOLS.has(event.name);
  const icon = event.name === 'set_theme' && event.args['mode'] === 'light' ? Sun : (CLIENT_ICON[event.name] ?? Wrench);
  const args = Object.values(event.args).map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' · ');
  return (
    <div className="flex min-w-0 items-center gap-sm self-start rounded-full bg-secondary px-md py-xs text-secondary-foreground" data-line="tool">
      <Icon icon={icon} size="sm" />
      <span className="text-sm font-medium">{label(event.name)}</span>
      {args ? <span className="min-w-0 truncate text-sm opacity-80">{args}</span> : null}
      <Icon
        icon={!done ? Loader2 : ok ? CircleCheck : CircleX}
        size="sm"
        className={cn(!done && 'animate-spin motion-reduce:animate-none', done && (ok ? 'text-success' : 'text-destructive'))}
        label={!done ? t('stage.tool.running') : ok ? t('stage.tool.ok') : t('stage.tool.failed')}
      />
      {done ? <Mono className="text-sm">{t('stage.ms', { ms: Math.round(event.ms ?? 0) })}</Mono> : null}
      <span className="text-xs opacity-80">{client ? t('stage.where.page') : t('stage.where.server')}</span>
    </div>
  );
}

/** The card for a finished weather/search call, else the chip. */
export function ToolCard({ event }: { event: VoiceAgentToolEvent }): React.JSX.Element {
  const image = event.name === 'generate_image' ? asImage(event.result) : null;
  if (image) return <ImageCard img={image} ms={event.ms ?? 0} />;
  const weather = event.name === 'get_weather' ? asWeather(event.result) : null;
  if (weather) return <WeatherCard w={weather} ms={event.ms ?? 0} />;
  const hits = event.name === 'web_search' ? asWebHits(event.result) : null;
  const query = typeof event.args['query'] === 'string' ? event.args['query'] : '';
  if (hits && hits.length > 0) return <WebCard hits={hits} query={query} ms={event.ms ?? 0} />;
  return <ToolChip event={event} />;
}
