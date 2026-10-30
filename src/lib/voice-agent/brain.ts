/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       service
 * @domain    integration
 * @topic     voice-agent
 * @purpose   The voice agent's brain and mouth on the in-tab WebGPU worker: tool-calling turns (ASR text in, answer text out) and streamed speech playback.
 * @status    active
 */
import type { TranscribeFn } from '@/lib/asr-live/types';
import { SpeechPlayer } from '@/lib/omni/speech-player';
import { stripThink } from '@/lib/omni/types';
import type { WebgpuChatMessage, WebgpuDiagnostics } from '@/lib/webgpu/protocol';
import { webgpuEngine } from '@/lib/webgpu/use-webgpu-engine';

import { toolFollowup, type VoiceAgentLocale } from './locale';
import { hasDataNumber } from './turn-filter';
import { callVoiceAgentTool, parseToolArgs, voiceAgentTools, type VoiceAgentToolAnswer } from './tools';
import type { VoiceAgentConfig, VoiceAgentToolEvent } from './types';

/** Tracks the one WebGPU run in flight so an interrupt can abort it. */
export interface RunSlot {
  current: string | null;
  aborted: boolean;
}

const TOOL_MARKUP = /<tool_call>[\s\S]*?<\/tool_call>/g;

/** Spoken text: no think block, no tool-call markup, no stray tags. */
export function spokenText(raw: string): string {
  return stripThink(raw)
    .replace(TOOL_MARKUP, '')
    .replace(/<\/?[a-z_]+[^>]*>/g, '')
    .trim();
}

/** One browser ASR pass as a diagnostics caller reads it: the raw answer before spokenText. */
export interface WebgpuTranscriptResult {
  raw_text: string;
  text: string;
  token_count: number;
  diagnostics: WebgpuDiagnostics | null;
}

/** Opt-in extras of webgpuTranscriber; absent = the voice agent's default behaviour. */
export interface WebgpuTranscriberOptions {
  /** Ask the worker for audio level, mel floor share and first-token EOS probability. */
  diagnostics?: boolean;
  /** Called once per utterance, after the run, with the raw text and the token count. */
  onResult?: (result: WebgpuTranscriptResult) => void;
  /** ASR system turn of the session language (`Perform ASR in German.`); absent = reference English. */
  system?: string;
}

/** Browser ASR for the live-ASR engine: one WebGPU `audio_to_text` pass on the utterance. */
export function webgpuTranscriber(maxTokens: number, slot: RunSlot, options: WebgpuTranscriberOptions = {}): TranscribeFn {
  return async ({ pcm }) => {
    const started = performance.now();
    const id = crypto.randomUUID();
    slot.current = id;
    let text = '';
    // Copy: the worker takes the buffer (transfer) and the engine still reads pcm.length.
    const run = webgpuEngine.generate({
      id,
      mode: 'audio_to_text',
      messages: [{ role: 'user', content: '' }],
      max_tokens: maxTokens,
      media: { audio: pcm.slice() },
      ...(options.system ? { system: options.system } : {}),
      ...(options.diagnostics ? { diagnostics: true } : {}),
    });
    let step = await run.next();
    while (!step.done) {
      if (step.value.type === 'token') text += step.value.text;
      step = await run.next();
    }
    // The worker's final message carries the whole answer; token events may be absent for ASR.
    if (step.value.text.length > text.length) text = step.value.text;
    slot.current = null;
    const spoken = spokenText(text);
    options.onResult?.({
      raw_text: text,
      text: spoken,
      token_count: step.value.completion_tokens,
      diagnostics: step.value.diagnostics ?? null,
    });
    return {
      text: spoken,
      engine: 'webgpu_ort',
      request_ms: performance.now() - started,
    };
  };
}

/** Worker usage of one generate run (from its `done` message) plus its wall ms. */
export interface RunUsage {
  prompt_tokens: number;
  completion_tokens: number;
  ttft_ms: number | null;
  wall_ms: number;
}

interface Round {
  text: string;
  calls: Array<{ name: string; arguments: string }>;
  usage: RunUsage;
}

async function generateRound(
  messages: WebgpuChatMessage[],
  agent: VoiceAgentConfig,
  language: string,
  withTools: boolean,
  slot: RunSlot,
): Promise<Round> {
  const id = crypto.randomUUID();
  slot.current = id;
  const run = webgpuEngine.generate({
    id,
    mode: withTools ? 'tools' : 'text_to_text',
    messages,
    max_tokens: agent.answer_max_tokens,
    ...(withTools ? { tools: voiceAgentTools(language) } : {}),
  });
  const started = performance.now();
  const round: Omit<Round, 'usage'> = { text: '', calls: [] };
  // Manual iteration: the generator's return value is the worker's `done` message (token usage).
  let step = await run.next();
  while (!step.done) {
    const event = step.value;
    if (event.type === 'token') round.text += event.text;
    else if (event.type === 'tool_calls') round.calls.push(...event.calls.map((c) => c.function));
    step = await run.next();
  }
  slot.current = null;
  const d = step.value;
  return {
    ...round,
    usage: { prompt_tokens: d.prompt_tokens, completion_tokens: d.completion_tokens, ttft_ms: d.ttft_ms, wall_ms: performance.now() - started },
  };
}

/** What the model reads of a tool result: media payloads (`image_data_url`, ~1 MB) stay in the UI. */
function modelView(result: VoiceAgentToolAnswer['result']): Record<string, unknown> {
  const { image_data_url: image, ...rest } = result;
  return image === undefined ? rest : { ...rest, image: 'shown to the user on screen' };
}

/**
 * Text for the voice: the answer without Markdown marks (headings, emphasis, code ticks, list
 * bullets, link targets), so TTS never reads symbols aloud; the screen keeps the Markdown.
 */
export function speechText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/gm, '')
    .replace(/[*_`~>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * One user turn → the answer text, in the session language (`locale`: system turn and the
 * follow-up after a tool round). Tool calls run between rounds and are reported through `onTool`.
 *
 * Grounding guard: an answer that states a data number (`hasDataNumber`: degrees, percent, a clock
 * time …) when no tool ran this turn is never returned. It gets one retry with
 * `locale.grounding_nudge`; still ungrounded → `locale.ungrounded_answer` (say "I
 * could not check", never an invented reading).
 */
export async function think(
  history: WebgpuChatMessage[],
  userText: string,
  agent: VoiceAgentConfig,
  locale: VoiceAgentLocale,
  slot: RunSlot,
  onTool: (event: VoiceAgentToolEvent) => void,
  runTool: (name: string, args: Record<string, unknown>) => Promise<VoiceAgentToolAnswer> = (name, args) =>
    callVoiceAgentTool(name, args, locale.code),
  onUsage?: (usage: RunUsage) => void,
): Promise<string> {
  const scratch: WebgpuChatMessage[] = [];
  let toolRan = false;
  let nudged = false;
  for (let round = 0; round <= agent.max_tool_rounds; round++) {
    const withTools = round < agent.max_tool_rounds;
    const messages: WebgpuChatMessage[] = [
      { role: 'system', content: locale.system_prompt },
      ...history,
      { role: 'user', content: userText },
      ...scratch,
    ];
    const r = await generateRound(messages, agent, locale.language, withTools, slot);
    onUsage?.(r.usage);
    if (slot.aborted) return '';
    if (r.calls.length === 0 || !withTools) {
      const answer = spokenText(r.text);
      if (toolRan || !hasDataNumber(answer, agent.grounding_markers)) return answer;
      if (nudged || !withTools) return locale.ungrounded_answer;
      nudged = true;
      scratch.push({ role: 'assistant', content: answer }, { role: 'user', content: locale.grounding_nudge });
      continue;
    }
    toolRan = true;
    const results: Array<{ tool: string; result: unknown }> = [];
    for (const call of r.calls) {
      const event: VoiceAgentToolEvent = {
        id: crypto.randomUUID(),
        name: call.name,
        args: parseToolArgs(call.arguments),
      };
      onTool(event);
      const answer = await runTool(call.name, event.args);
      onTool({ ...event, result: answer.result, ms: answer.ms });
      results.push({ tool: call.name, result: modelView(answer.result) });
    }
    scratch.push(
      { role: 'assistant', content: r.text.trim() || JSON.stringify(r.calls) },
      { role: 'user', content: toolFollowup(locale, results) },
    );
  }
  return '';
}

function rms(pcm: Float32Array): number {
  let sum = 0;
  for (const s of pcm) sum += s * s;
  return Math.sqrt(sum / Math.max(1, pcm.length));
}

/** Speak `text` with WebGPU TTS in the session voice; chunks play as they arrive. Resolves when playback has ended. */
export async function speak(
  text: string,
  agent: VoiceAgentConfig,
  locale: VoiceAgentLocale,
  slot: RunSlot,
  onLevel: (level: number) => void,
  onPlayer: (p: SpeechPlayer | null) => void,
  onUsage?: (usage: RunUsage) => void,
): Promise<void> {
  const player = new SpeechPlayer();
  const started = performance.now();
  onPlayer(player);
  const id = crypto.randomUUID();
  slot.current = id;
  try {
    const run = webgpuEngine.generate({
      id,
      mode: 'text_to_speech',
      generation_mode: 'audio',
      messages: [{ role: 'user', content: text }],
      system: locale.tts_system,
      max_tokens: agent.speech_max_tokens,
    });
    let step = await run.next();
    while (!step.done) {
      const event = step.value;
      if (event.type === 'audio') {
        onLevel(Math.min(1, rms(event.pcm) * 4));
        void player.pushPcm(event.pcm, event.sample_rate);
      }
      step = await run.next();
    }
    slot.current = null;
    const d = step.value;
    onUsage?.({ prompt_tokens: d.prompt_tokens, completion_tokens: d.completion_tokens, ttft_ms: d.ttfa_ms, wall_ms: performance.now() - started });
    if (!slot.aborted) await player.drained();
  } finally {
    onLevel(0);
    player.stop();
    onPlayer(null);
  }
}
