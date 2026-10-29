// The approved 13:34 screenshot anchors these points to the original room art.
// Use the same cover projection as the room background and lamp positions.
export const homeArtwork = { width: 1038, height: 1516 };
export const defaultRabbitCenter = { x: 501, y: 528 };
export const defaultBoardCorner = { x: 104, y: 59 };
export type RoomRect = { left: number; top: number; width: number; height: number };
export function roomProjection(room: RoomRect) {
  const scale = Math.max(room.width / homeArtwork.width, room.height / homeArtwork.height);
  return { scale, left: room.left + (room.width - homeArtwork.width * scale) / 2,
    top: room.top + (room.height - homeArtwork.height * scale) / 2 };
}
export function roomPoint(room: RoomRect, point: { x: number; y: number }) {
  const projection = roomProjection(room);
  return { x: projection.left + point.x * projection.scale, y: projection.top + point.y * projection.scale };
}
export function artworkPoint(room: RoomRect, point: { x: number; y: number }) {
  const projection = roomProjection(room);
  return { x: (point.x - projection.left) / projection.scale, y: (point.y - projection.top) / projection.scale };
}
