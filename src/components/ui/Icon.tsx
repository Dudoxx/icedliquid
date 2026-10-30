/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       component
 * @domain    ui
 * @topic     icons
 * @purpose   Lucide-only icon with token size and stroke steps, by typed name or by component.
 * @status    reusable
 *
 * Two inputs, one look:
 * - `icon` — a statically imported lucide component (tree-shaken, renders on the server).
 *   Prefer it in shells and lists.
 * - `name` — a kebab-case `IconName` key of `ICONS` below (registries, card families, demo
 *   data). The map is explicit on purpose: `lucide-react/dynamic` made Turbopack resolve
 *   ~1,600 lazy icon modules on the first compile of any page that rendered `Icon`. A new
 *   name-based icon adds one line here; TypeScript rejects a name that is not in the map.
 * Decorative by default (`aria-hidden`). Pass a translated `label` for a meaningful icon.
 */
import {
  AudioLinesIcon,
  BoxesIcon,
  CircleIcon,
  ClapperboardIcon,
  CpuIcon,
  FilmIcon,
  FolderKanbanIcon,
  HeartPulseIcon,
  ImageIcon,
  InfoIcon,
  LayersIcon,
  LayoutTemplateIcon,
  MessageCircleQuestionIcon,
  MessageSquareIcon,
  MicIcon,
  MonitorIcon,
  ServerIcon,
  Volume2Icon,
  WrenchIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { iconVariants, type IconSize, type IconStroke } from './variants';

/** Every icon reachable by name. Keys use lucide's kebab-case names. */
const ICONS = {
  'audio-lines': AudioLinesIcon,
  boxes: BoxesIcon,
  circle: CircleIcon,
  clapperboard: ClapperboardIcon,
  cpu: CpuIcon,
  film: FilmIcon,
  'folder-kanban': FolderKanbanIcon,
  'heart-pulse': HeartPulseIcon,
  image: ImageIcon,
  info: InfoIcon,
  layers: LayersIcon,
  'layout-template': LayoutTemplateIcon,
  'message-circle-question': MessageCircleQuestionIcon,
  'message-square': MessageSquareIcon,
  mic: MicIcon,
  monitor: MonitorIcon,
  server: ServerIcon,
  'volume-2': Volume2Icon,
  wrench: WrenchIcon,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface IconBaseProps {
  readonly size?: IconSize;
  /** Stroke step: `thin` for dense chrome, `regular` = lucide default. */
  readonly variant?: IconStroke;
  /** Translated accessible name; omit for a decorative icon. */
  readonly label?: string;
  readonly className?: string;
}

export type IconProps = IconBaseProps &
  (
    | { readonly name: IconName; readonly icon?: never }
    | { readonly icon: LucideIcon; readonly name?: never }
  );

export function Icon(props: IconProps): React.JSX.Element {
  const { size = 'sm', variant = 'regular', label, className } = props;
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const);
  const Glyph = props.icon ?? (props.name === undefined ? undefined : ICONS[props.name]);
  return (
    <span className={cn(iconVariants({ size, variant }), className)} {...a11y}>
      {Glyph ? <Glyph aria-hidden /> : null}
    </span>
  );
}
