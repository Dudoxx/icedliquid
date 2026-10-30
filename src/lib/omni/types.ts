/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       contract
 * @domain    integration
 * @topic     omni
 * @purpose   The streamed tool-call shape and the think-block filter shared by the worker and the voice agent.
 * @status    feature-local
 */

/** One streamed tool call (OpenAI chat-completions shape). */
export interface OmniToolCall {
  index: number;
  id?: string;
  type?: 'function';
  function: { name: string; arguments: string };
}

/** Drop the model's `<think>` block and stray markers. */
export function stripThink(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<\/?think>/g, '');
}
