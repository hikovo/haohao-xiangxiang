// Settle after a 320 ms gap; preserve a continuous ten-tap Easter egg.
export function appendRabbitTap(times: number[], now: number): number[] {
  return [...(times.length && now - times[times.length - 1] <= 320 ? times : []), now];
}
export function rabbitTapAction(count: number): 'hop' | 'wink' | 'dizzy' | 'captain' | undefined {
  return count >= 10 ? 'captain' : count >= 4 ? 'dizzy' : count >= 2 ? 'wink' : count === 1 ? 'hop' : undefined;
}
