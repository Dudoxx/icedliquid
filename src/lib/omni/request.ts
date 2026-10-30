/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    integration
 * @topic     omni
 * @purpose   The OpenAI function-tool shape the worker parses calls against, and the per-modality engine row.
 * @status    feature-local
 */
import type { OmniModality } from './modes';

/** One OpenAI function tool. */
export interface OmniTool {
  type: 'function';
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}

/** What one engine can serve, per modality, with the reason a modality is off. */
export interface OmniEngineRow {
  enabled: boolean;
  modalities: Record<OmniModality, boolean>;
  reasons: Partial<Record<OmniModality, string>>;
}
