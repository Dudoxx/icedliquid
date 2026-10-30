/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       config
 * @domain    integration
 * @topic     omni
 * @purpose   The voice-path request modes as data (input kind, output kind, required engine modalities) and the three engine ids.
 * @status    feature-local
 */

export type OmniInputKind = 'text' | 'audio' | 'image' | 'video' | 'video_audio';
export type OmniOutputKind = 'text' | 'speech' | 'interleaved';
export type OmniMediaKind = 'audio' | 'image' | 'video';

/** Modality names of an engine row. */
export type OmniModality =
  | 'text_in'
  | 'audio_in'
  | 'text_out'
  | 'speech_out';

export type OmniModeId =
  | 'text_to_text'
  | 'text_to_speech'
  | 'audio_to_text'
  | 'audio_to_speech'
  | 'audio_question'
  | 'interleaved'
  | 'tools';

export type OmniModeKey =
  | 'textToText'
  | 'textToSpeech'
  | 'audioToText'
  | 'audioToSpeech'
  | 'audioQuestion'
  | 'interleaved'
  | 'tools';

export interface OmniMode {
  readonly id: OmniModeId;
  /** camelCase message key under `playground.modes.*` and `playground.prompts.*`. */
  readonly key: OmniModeKey;
  readonly input: OmniInputKind;
  readonly output: OmniOutputKind;
  readonly needs: readonly OmniModality[];
  /** false = the mode starts with an empty prompt (the media carries the request). */
  readonly hasPrompt: boolean;
  readonly tools: boolean;
}

export const OMNI_MODES: readonly OmniMode[] = [
  {
    id: 'text_to_text',
    key: 'textToText',
    input: 'text',
    output: 'text',
    needs: ['text_in', 'text_out'],
    hasPrompt: true,
    tools: false,
  },
  {
    id: 'text_to_speech',
    key: 'textToSpeech',
    input: 'text',
    output: 'speech',
    needs: ['text_in', 'speech_out'],
    hasPrompt: true,
    tools: false,
  },
  {
    id: 'audio_to_text',
    key: 'audioToText',
    input: 'audio',
    output: 'text',
    needs: ['audio_in', 'text_out'],
    hasPrompt: true,
    tools: false,
  },
  {
    id: 'audio_to_speech',
    key: 'audioToSpeech',
    input: 'audio',
    output: 'speech',
    needs: ['audio_in', 'speech_out'],
    hasPrompt: false,
    tools: false,
  },
  {
    id: 'audio_question',
    key: 'audioQuestion',
    input: 'audio',
    output: 'text',
    needs: ['audio_in', 'text_out'],
    hasPrompt: false,
    tools: false,
  },
  {
    id: 'interleaved',
    key: 'interleaved',
    input: 'text',
    output: 'interleaved',
    needs: ['text_in', 'text_out', 'speech_out'],
    hasPrompt: true,
    tools: false,
  },
  {
    id: 'tools',
    key: 'tools',
    input: 'text',
    output: 'text',
    needs: ['text_in', 'text_out'],
    hasPrompt: true,
    tools: true,
  },
];

/** app.js GEN_MODE: the gateway `generation_mode` per output kind. */
export const GEN_MODE: Readonly<Record<OmniOutputKind, 'text' | 'audio' | 'interleaved'>> = {
  text: 'text',
  speech: 'audio',
  interleaved: 'interleaved',
};

/** `?mode=` aliases: the showcase grid links the tool mode as `tool_call`. */
const MODE_ALIASES: Readonly<Record<string, OmniModeId>> = { tool_call: 'tools' };

export function findMode(id: string | null | undefined): OmniMode {
  const wanted = id ? (MODE_ALIASES[id] ?? id) : 'text_to_text';
  return OMNI_MODES.find((mode) => mode.id === wanted) ?? OMNI_MODES[0]!;
}

/** The media kind a mode consumes; `null` for text-in modes. `video_audio` reads the video slot. */
export function mediaKindOf(mode: OmniMode): OmniMediaKind | null {
  if (mode.input === 'text') return null;
  return mode.input === 'video_audio' ? 'video' : mode.input;
}

/** app.js buildRequest: 256 tokens for a text answer, 512 when speech is generated. */
export function maxTokensOf(mode: OmniMode): number {
  return mode.output === 'text' ? 256 : 512;
}

export type OmniEngineId = 'mlx_vlm' | 'llama_cpp' | 'webgpu';

/** Modes the browser worker implements; every mode runs through mode-runner.ts. */
export const WEBGPU_WORKER_MODES: ReadonlySet<OmniModeId> = new Set<OmniModeId>(
  OMNI_MODES.map((mode) => mode.id),
);

/** The three engine options in picker order, with their `playground.engines.*` key. */
export const OMNI_ENGINES: readonly {
  readonly id: OmniEngineId;
  readonly key: 'mlxVlm' | 'llamaCpp' | 'webgpu';
}[] = [
  { id: 'mlx_vlm', key: 'mlxVlm' },
  { id: 'llama_cpp', key: 'llamaCpp' },
  { id: 'webgpu', key: 'webgpu' },
];

/** Shared look of a playground choice chip (mode, engine): tonal fill, primary fill when checked. */
export const OMNI_CHOICE_CHIP_CLASS =
  'rounded-md bg-surface-muted px-md py-sm text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-checked:bg-primary aria-checked:text-primary-foreground';
