export type FloatingArea = { left: number; top: number; right: number; bottom: number };
export type FloatingPosition = { x: number; y: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
// Keyboard resizing is temporary. Keep the saved page anchor, and only adjust
// the displayed coordinates to the visible part of the layout viewport.
export function visibleFloatingPlacement<T extends {left:number;top:number;width:number;height:number}>(layout:T, viewport:FloatingArea) {
  return {...layout,
    left:clamp(layout.left + viewport.left, viewport.left + 10, Math.max(viewport.left + 10, viewport.right - layout.width - 10)),
    top:clamp(layout.top + viewport.top, viewport.top + 70, Math.max(viewport.top + 70, viewport.bottom - layout.height - 12))};
}
export function floatingPlacement(area: FloatingArea, scale: number, position: FloatingPosition) {
  const availableWidth = Math.max(1, area.right - area.left - 20);
  const availableHeight = Math.max(1, area.bottom - area.top);
  const width = Math.min(availableWidth, availableHeight * 192 / 208, Math.max(50, 125 * scale));
  const height = width * 208 / 192;
  const minX = area.left + Math.min(10, (area.right - area.left - width) / 2);
  const maxX = Math.max(minX, area.right - width - 10);
  const minY = area.top, maxY = Math.max(minY, area.bottom - height);
  return { width, height, minX, maxX, minY, maxY,
    left: minX + clamp(Number.isFinite(position.x) ? position.x : 0.84, 0, 1) * (maxX - minX),
    top: minY + clamp(Number.isFinite(position.y) ? position.y : 0.58, 0, 1) * (maxY - minY) };
}
export function floatingPosition(layout: ReturnType<typeof floatingPlacement>, left: number, top: number): FloatingPosition {
  return { x: layout.maxX === layout.minX ? 0 : clamp((left - layout.minX) / (layout.maxX - layout.minX), 0, 1),
    y: layout.maxY === layout.minY ? 0 : clamp((top - layout.minY) / (layout.maxY - layout.minY), 0, 1) };
}
// A single viewport center is shared by every page, even when its footer differs.
export function centeredFloatingPlacement(area: FloatingArea, scale: number, center: FloatingPosition) {
  const layout = floatingPlacement(area, scale, { x: 0, y: 0 });
  return { ...layout,
    left: clamp(area.left + center.x * (area.right - area.left) - layout.width / 2, layout.minX, layout.maxX),
    top: clamp(area.top + center.y * (area.bottom - area.top) - layout.height / 2, layout.minY, layout.maxY) };
}
export function floatingCenter(area: FloatingArea, layout: ReturnType<typeof floatingPlacement>, left: number, top: number): FloatingPosition {
  return { x: (clamp(left, layout.minX, layout.maxX) + layout.width / 2 - area.left) / (area.right - area.left),
    y: (clamp(top, layout.minY, layout.maxY) + layout.height / 2 - area.top) / (area.bottom - area.top) };
}
export function floatingMenu(layout: ReturnType<typeof floatingPlacement>, area: FloatingArea, width: number, height: number) {
  const minLeft = area.left + 8, maxLeft = Math.max(minLeft, area.right - width - 8);
  const above = layout.top - height - 8;
  const top = above >= area.top ? above : clamp(layout.top + layout.height + 8, area.top, Math.max(area.top, area.bottom - height));
  return { left: clamp(layout.left + layout.width / 2 - width / 2, minLeft, maxLeft) - layout.left, top: top - layout.top };
}
