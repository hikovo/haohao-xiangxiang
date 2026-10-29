/** Package-local animations only; no media upload or network dependency. */
async function animationData(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) throw new Error('兔兔动画还没准备好，请重新打开 App');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
export async function rabbitPiPAnimations(): Promise<{atlas: string}> {
  // The exact homepage atlas, with alpha preserved. No video player surface.
  return {atlas: await animationData('/rabbit-overlay-atlas.png')};
}
