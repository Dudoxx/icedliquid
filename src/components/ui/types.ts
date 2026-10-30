/**
 * © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
 *
 * @ddx       type
 * @domain    ui
 * @topic     design-system
 * @purpose   The one props shape of the ui components: `{ instantiation, overrides }`.
 * @status    foundation
 *
 * `instantiation` = what this instance IS (translated content, handlers, data).
 * `overrides`     = how it looks (variant, size, mode); every field optional.
 */
export type ComponentProps<TInst, TOver> = {
  instantiation: TInst;
  overrides?: Partial<TOver>;
};
