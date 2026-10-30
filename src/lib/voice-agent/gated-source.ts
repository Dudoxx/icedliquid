/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       util
 * @domain    integration
 * @topic     voice-agent
 * @purpose   Half-duplex gate around a live-ASR source: frames pass only while the gate is open, so the agent never transcribes its own voice.
 * @status    active
 */
import type { LiveAsrSource } from '@/lib/asr-live/sources';

export interface GatedSource extends LiveAsrSource {
  setOpen(open: boolean): void;
  isOpen(): boolean;
}

export function gatedSource(inner: LiveAsrSource): GatedSource {
  let open = true;
  return {
    open: (onFrame, onEnd) => inner.open((frame) => (open ? onFrame(frame) : undefined), onEnd),
    close: () => inner.close(),
    setOpen: (next) => {
      open = next;
    },
    isOpen: () => open,
  };
}
