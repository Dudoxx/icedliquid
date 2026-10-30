/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     voice-agent
 * @purpose   The session language of the voice agent: fills the voice_agent prompt templates (brain system turn, tool follow-up, ASR and TTS system turns, greeting) for one locale.
 * @status    active
 */
import type { VoiceAgentConfig } from './types';

/** Every instruction of one session, filled for its locale. */
export interface VoiceAgentLocale {
  code: string;
  language: string;
  system_prompt: string;
  /** Still holds `{results}`; `toolFollowup` fills it per round. */
  tool_followup: string;
  asr_system: string;
  tts_system: string;
  greeting: string;
  /** Retry instruction when an answer holds data numbers but no tool ran. */
  grounding_nudge: string;
  /** Spoken instead of an answer that stayed ungrounded after the retry. */
  ungrounded_answer: string;
}

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{(language|voice)\}/g, (_, key: string) => values[key] ?? '');

/** The filled instruction set of `code`; throws when config/icedliquid.json has no entry for it. */
export function resolveVoiceLocale(agent: VoiceAgentConfig, code: string): VoiceAgentLocale {
  const entry = agent.locales[code];
  if (!entry) throw new Error(`voice_agent.locales has no entry for "${code}"`);
  const values = { language: entry.language, voice: entry.tts_voice };
  return {
    code,
    language: entry.language,
    system_prompt: fill(agent.system_prompt, values),
    tool_followup: fill(agent.tool_followup, values),
    asr_system: fill(agent.asr_system, values),
    tts_system: fill(agent.tts_system, values),
    greeting: entry.greeting,
    grounding_nudge: fill(agent.grounding_nudge, values),
    ungrounded_answer: entry.ungrounded_answer,
  };
}

/** The user turn after a tool round: the results JSON in the locale's follow-up template. */
export function toolFollowup(locale: VoiceAgentLocale, results: unknown): string {
  return locale.tool_followup.replace('{results}', JSON.stringify(results));
}
