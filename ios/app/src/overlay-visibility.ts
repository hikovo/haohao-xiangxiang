/** Visibility only: never change the saved home rabbit's position, scale or animation choice. */
export function syncHomeRabbitVisibility(
  active: boolean,
  pet: Pick<HTMLElement, "hidden">,
  speech: Pick<HTMLElement, "hidden">,
  room: Pick<HTMLElement, "classList">,
) {
  pet.hidden = active;
  room.classList.toggle("overlay-companion-active", active);
  // A bubble from before the transition should not linger when the rabbit returns.
  if (active) speech.hidden = true;
}
