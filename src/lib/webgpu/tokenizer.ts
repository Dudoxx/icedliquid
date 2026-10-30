/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     webgpu
 * @purpose   Chat tokenizer for the WebGPU lane: renders chat_template.jinja (with tools) and encodes/decodes with tokenizer.json, eos ids from generation_config.json, media ids from config.json.
 * @status    feature-local
 */
import { Template } from '@huggingface/jinja';
import { Tokenizer } from '@huggingface/tokenizers';

import { WebgpuEngineError, type WebgpuChatMessage, type WebgpuToolSpec } from './protocol';

export interface ChatTokenizerSources {
  tokenizerJson: string;
  tokenizerConfigJson: string;
  chatTemplate: string;
  generationConfigJson: string;
  /** config.json; needed for `specialIds` (media placeholders, generation markers). */
  modelConfigJson?: string;
}

/** A chat_template.jinja content part (parse_content): media parts render their placeholder span. */
export type ChatTemplatePart =
  | { type: 'text'; text: string }
  | { type: 'image' }
  | { type: 'video' }
  | { type: 'audio' };

export interface ChatTemplateMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | readonly ChatTemplatePart[];
}

export interface EncodeChatOptions {
  /** Prepended as a system turn unless the messages already start with one. */
  system?: string;
  /** OpenAI-style function tools, rendered by the template as the `<tools>` system block. */
  tools?: readonly WebgpuToolSpec[];
}

/** Token ids the multimodal prompt needs; config.json ids plus the vision span from tokenizer_config.json. */
export interface SpecialTokenIds {
  image: number;
  video: number;
  audio: number;
  audioOut: number;
  audioStart: number;
  mixedStart: number;
  textEnd: number;
  visionStart: number;
  visionEnd: number;
}

export interface ChatTokenizer {
  encodeChat(messages: readonly WebgpuChatMessage[], options?: EncodeChatOptions): number[];
  /** The rendered prompt string (BOS included, generation prompt appended). */
  renderChat(messages: readonly ChatTemplateMessage[], options?: EncodeChatOptions): string;
  /** Encode an already rendered prompt with add_special_tokens false. */
  encodeText(text: string): number[];
  /** Vocabulary id of one token text (special tokens included); LOAD_FAILED when unknown. */
  tokenId(text: string): number;
  decode(ids: readonly number[]): string;
  readonly eosIds: ReadonlySet<number>;
  /** null when the tokenizer was built without config.json (text lane). */
  readonly specialIds: SpecialTokenIds | null;
  /** The vision span tokens from tokenizer_config.json. */
  readonly visionSpan: { start: string; end: string };
}

interface TokenizerConfigShape {
  bos_token?: string | { content?: string } | null;
  eos_token?: string | { content?: string } | null;
  vision_start_token?: string;
  vision_end_token?: string;
}

/** config.json key per SpecialTokenIds field (the model card's token ids, never literals here). */
const CONFIG_ID_KEYS = {
  image: 'image_token_id',
  video: 'video_token_id',
  audio: 'audio_token_id',
  audioOut: 'audio_out_token_id',
  audioStart: 'audio_start_token_id',
  mixedStart: 'mixed_start_token_id',
  textEnd: 'text_end_token_id',
} as const satisfies Record<Exclude<keyof SpecialTokenIds, 'visionStart' | 'visionEnd'>, string>;

interface GenerationConfigShape {
  eos_token_id?: number | number[] | null;
}

function parseObject(json: string, file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(json);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WebgpuEngineError('LOAD_FAILED', `${file} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function tokenText(token: TokenizerConfigShape['bos_token']): string {
  if (typeof token === 'string') return token;
  return token?.content ?? '';
}

function eosIdsFrom(generation: GenerationConfigShape): Set<number> {
  const raw = generation.eos_token_id;
  const ids = Array.isArray(raw) ? raw : typeof raw === 'number' ? [raw] : [];
  if (ids.length === 0) throw new WebgpuEngineError('LOAD_FAILED', 'generation_config.json has no eos_token_id');
  return new Set(ids);
}

function lookupId(tokenizer: Tokenizer, text: string): number {
  const id = tokenizer.token_to_id(text);
  if (id === undefined) throw new WebgpuEngineError('LOAD_FAILED', `tokenizer.json has no token ${text}`);
  return id;
}

function specialIdsFrom(
  modelConfigJson: string,
  visionIds: { visionStart: number; visionEnd: number },
): SpecialTokenIds {
  const config = parseObject(modelConfigJson, 'config.json');
  const read = (key: string): number => {
    const value = config[key];
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new WebgpuEngineError('LOAD_FAILED', `config.json lacks ${key}`);
    }
    return value;
  };
  const ids = Object.fromEntries(Object.entries(CONFIG_ID_KEYS).map(([field, key]) => [field, read(key)])) as Record<
    keyof typeof CONFIG_ID_KEYS,
    number
  >;
  return { ...ids, ...visionIds };
}

/** Template message list: the system turn first (once), content passed through unchanged. */
function templateMessages(
  messages: readonly ChatTemplateMessage[],
  system: string | undefined,
): { role: string; content: string | ChatTemplatePart[] }[] {
  const out = messages.map((m) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : [...m.content] }));
  if (system !== undefined && out[0]?.role !== 'system') out.unshift({ role: 'system', content: system });
  return out;
}

export function createChatTokenizer(sources: ChatTokenizerSources): ChatTokenizer {
  const tokenizerConfig = parseObject(sources.tokenizerConfigJson, 'tokenizer_config.json');
  const tokenizer = new Tokenizer(parseObject(sources.tokenizerJson, 'tokenizer.json'), tokenizerConfig);
  const template = new Template(sources.chatTemplate);
  const specials = tokenizerConfig as TokenizerConfigShape;
  const bosToken = tokenText(specials.bos_token);
  const eosToken = tokenText(specials.eos_token);
  const eosIds = eosIdsFrom(parseObject(sources.generationConfigJson, 'generation_config.json') as GenerationConfigShape);
  const visionSpan = { start: specials.vision_start_token ?? '', end: specials.vision_end_token ?? '' };
  const specialIds =
    sources.modelConfigJson === undefined
      ? null
      : specialIdsFrom(sources.modelConfigJson, {
          visionStart: lookupId(tokenizer, visionSpan.start),
          visionEnd: lookupId(tokenizer, visionSpan.end),
        });

  const renderChat = (messages: readonly ChatTemplateMessage[], options: EncodeChatOptions = {}): string => {
    const context: Record<string, unknown> = {
      messages: templateMessages(messages, options.system),
      bos_token: bosToken,
      eos_token: eosToken,
      add_generation_prompt: true,
    };
    // Only set when given: the text lane renders with no `tools` variable at all.
    if (options.tools && options.tools.length > 0) context.tools = options.tools.map((tool) => ({ ...tool }));
    return template.render(context);
  };
  const encodeText = (text: string): number[] => tokenizer.encode(text, { add_special_tokens: false }).ids;

  return {
    eosIds,
    specialIds,
    visionSpan,
    renderChat,
    encodeText,
    encodeChat(messages, options) {
      return encodeText(renderChat(messages, options));
    },
    tokenId(text) {
      return lookupId(tokenizer, text);
    },
    decode(ids) {
      return tokenizer.decode([...ids], { skip_special_tokens: false });
    },
  };
}
