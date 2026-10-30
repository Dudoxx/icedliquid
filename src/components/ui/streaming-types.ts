/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       type
 * @domain    ui
 * @topic     realtime
 * @purpose   Instantiation / override contracts of StreamingText, the streamdown control-label keys and its link policy.
 * @status    foundation
 *
 * Strings are i18n keys of namespace `realtime`.
 */
import { defaultUrlTransform, type PluginConfig, type StreamdownTranslations, type UrlTransform } from 'streamdown';

export const STREAMING_TEXT_MODES = ['static', 'streaming'] as const;
export type StreamingTextMode = (typeof STREAMING_TEXT_MODES)[number];

export interface StreamingTextInstantiation {
  /** Markdown source (model text — data, not UI copy). */
  readonly text: string;
  /** Accessible name of the output region (already translated). */
  readonly label?: string;
}

export interface StreamingTextOverrides {
  mode: StreamingTextMode;
  /** True while chunks still arrive: caret + incomplete-markdown repair. */
  animating: boolean;
  /** Code / math / mermaid renderers; none ship by default. */
  plugins: PluginConfig;
}

/** Every streamdown control label, translated under `realtime.streamdown.*`. */
export const STREAMDOWN_LABEL_KEYS = [
  'close',
  'copied',
  'copyCode',
  'copyLink',
  'copyTable',
  'copyTableAsCsv',
  'copyTableAsMarkdown',
  'copyTableAsTsv',
  'downloadDiagram',
  'downloadDiagramAsMmd',
  'downloadDiagramAsPng',
  'downloadDiagramAsSvg',
  'downloadFile',
  'downloadImage',
  'downloadTable',
  'downloadTableAsCsv',
  'downloadTableAsMarkdown',
  'errorMermaid',
  'exitFullscreen',
  'externalLinkWarning',
  'imageNotAvailable',
  'mermaidAriaLabel',
  'mermaidFormatMmd',
  'mermaidFormatPng',
  'mermaidFormatSvg',
  'openExternalLink',
  'openLink',
  'resetView',
  'tableFormatCsv',
  'tableFormatMarkdown',
  'tableFormatTsv',
  'viewFullscreen',
  'zoomIn',
  'zoomOut',
] as const satisfies ReadonlyArray<keyof StreamdownTranslations>;

/**
 * Link policy of model text (it can quote web results): a link keeps its target only when it is
 * `https://`; any other href is dropped. Other URLs (images) keep streamdown's default policy.
 */
export const httpsOnlyLinks: UrlTransform = (url, key, node) => {
  if (key !== 'href') return defaultUrlTransform(url, key, node);
  return URL.parse(url)?.protocol === 'https:' ? url : null;
};
