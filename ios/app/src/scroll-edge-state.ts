/** Every edge depends on its own remaining scroll distance. At initial top the
 * bottom is blurred when more content exists, and it clears only at bottom. */
export function scrollEdgeState(top: number, viewport: number, content: number, _armed = true) {
  const maximum = Math.max(0, content - viewport);
  const position = Math.min(maximum, Math.max(0, top));
  const depth = Math.min(40, Math.max(0, viewport / 10), maximum / 2);
  const ease = (distance: number) => {
    const x = depth >= 1 ? Math.max(0, Math.min(1, (distance - 1) / depth)) : 0;
    return x * x * (3 - 2 * x);
  };
  return {depth, top: ease(position), bottom: ease(maximum - position)};
}
