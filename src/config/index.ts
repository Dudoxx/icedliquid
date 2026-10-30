/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       config
 * @domain    config
 * @purpose   Parse config/icedliquid.json once at import and expose the webgpu, asr_live and voice_agent blocks.
 * @status    foundation
 *
 * A missing, mistyped or unknown key throws AppConfigError naming every bad key path; nothing is
 * defaulted. The export keeps the block names and shapes the voice code already consumes.
 */
import rawConfig from '../../config/icedliquid.json';

import {
  appConfigSchema,
  type AppAsrLiveConfig,
  type AppConfig,
  type AppSamplingConfig,
  type AppVoiceAgentConfig,
  type AppVoiceAgentToolsConfig,
  type AppWebgpuConfig,
} from './schema';

export const CONFIG_FILE = 'config/icedliquid.json';

/** The config file failed its schema; `issues` holds one `<key path>: <reason>` line per fault. */
export class AppConfigError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`${CONFIG_FILE} is invalid: ${issues.join('; ')}`);
    this.name = 'AppConfigError';
    this.issues = issues;
  }
}

function parseConfig(raw: object): AppConfig {
  const parsed = appConfigSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  throw new AppConfigError(
    parsed.error.issues.map((issue) => {
      const at = issue.path.map(String).join('.') || '(root)';
      return `${at}: ${issue.message}`;
    }),
  );
}

export const appConfig: AppConfig = parseConfig(rawConfig);

/** Model files and graphs of the in-browser engine (load request of the WebGPU worker). */
export const webgpu: AppWebgpuConfig = appConfig.webgpu;
export const sampling: AppSamplingConfig = appConfig.sampling;
/** Live ASR segmentation (VAD, interims, endpoint). */
export const asr_live: AppAsrLiveConfig = appConfig.asr_live;

const { tools: voiceAgentToolsBlock, ...voiceAgentBlock } = appConfig.voice_agent;
/** Voice agent block as the browser reads it. */
export const voice_agent: AppVoiceAgentConfig = voiceAgentBlock;
/** Tool knobs for the server-side agent-tools route. */
export const voiceAgentTools: AppVoiceAgentToolsConfig = voiceAgentToolsBlock;

export type {
  AppAsrLiveConfig,
  AppConfig,
  AppSamplingConfig,
  AppVoiceAgentConfig,
  AppVoiceAgentToolsConfig,
  AppWebgpuConfig,
};
