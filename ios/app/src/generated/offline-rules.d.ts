import type { ArchiveItem, ArchiveRange } from '../offline-blindbox';
export function splitCaption(value: string): string[];
export function correctCaption(value: string): string;
export function conversationalCaption(value: string): string;
export function reviewedCaption(item: ArchiveItem): string;
export function reviewedBubbles(item: ArchiveItem): string[];
export function draw(rows: ArchiveItem[], message: string, range: ArchiveRange, recent?: string[], random?: () => number): { reply: string; item: ArchiveItem | null; reason: 'greeting' | 'short-input' | 'invalid-date' | 'out-of-range' | 'archive-query-empty' | 'ordinary-no-match' | 'archive-match' };
export function rank(rows: ArchiveItem[], message: string, range: ArchiveRange, recent?: string[]): Array<{ item: ArchiveItem; score: number; recent: boolean }>;
export function exactDate(value: string): string | null;
