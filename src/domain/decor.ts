// The decorating reward: every dose earns coins, coins buy things for your room.

export type DecorKind = 'wall' | 'floor' | 'wallpaper' | 'flooring';

export interface DecorItem {
  id: string;
  name: string;
  kind: DecorKind;
  price: number;
  /** Emoji for wall/floor items, a colour for wallpaper/flooring. */
  emoji?: string;
  color?: string;
}

export const DECOR: DecorItem[] = [
  // Things for the floor
  { id: 'cactus', name: 'Little cactus', kind: 'floor', price: 40, emoji: '🌵' },
  { id: 'candle', name: 'Candle', kind: 'floor', price: 30, emoji: '🕯️' },
  { id: 'plant', name: 'Potted plant', kind: 'floor', price: 50, emoji: '🪴' },
  { id: 'basket', name: 'Basket', kind: 'floor', price: 40, emoji: '🧺' },
  { id: 'books', name: 'Stack of books', kind: 'floor', price: 70, emoji: '📚' },
  { id: 'chair', name: 'Chair', kind: 'floor', price: 80, emoji: '🪑' },
  { id: 'teddy', name: 'Teddy bear', kind: 'floor', price: 90, emoji: '🧸' },
  { id: 'guitar', name: 'Guitar', kind: 'floor', price: 150, emoji: '🎸' },
  { id: 'console', name: 'Game console', kind: 'floor', price: 180, emoji: '🎮' },
  { id: 'sofa', name: 'Sofa', kind: 'floor', price: 200, emoji: '🛋️' },
  { id: 'aquarium', name: 'Fish friend', kind: 'floor', price: 220, emoji: '🐠' },
  { id: 'bed', name: 'Cosy bed', kind: 'floor', price: 250, emoji: '🛏️' },
  { id: 'cat', name: 'Cat', kind: 'floor', price: 300, emoji: '🐈' },
  { id: 'dog', name: 'Dog', kind: 'floor', price: 300, emoji: '🐕' },
  // Things for the wall
  { id: 'poster', name: 'Poster', kind: 'wall', price: 40, emoji: '📜' },
  { id: 'bunting', name: 'Bunting', kind: 'wall', price: 50, emoji: '🎏' },
  { id: 'painting', name: 'Painting', kind: 'wall', price: 60, emoji: '🖼️' },
  { id: 'clock', name: 'Wall clock', kind: 'wall', price: 80, emoji: '🕰️' },
  { id: 'mirror', name: 'Mirror', kind: 'wall', price: 90, emoji: '🪞' },
  { id: 'window', name: 'Window', kind: 'wall', price: 120, emoji: '🪟' },
  { id: 'lights', name: 'Fairy lights', kind: 'wall', price: 140, emoji: '✨' },
  // Wallpaper
  { id: 'wp_sky', name: 'Sky wallpaper', kind: 'wallpaper', price: 100, color: '#CDE7F7' },
  { id: 'wp_mint', name: 'Mint wallpaper', kind: 'wallpaper', price: 100, color: '#CFF0E0' },
  { id: 'wp_peach', name: 'Peach wallpaper', kind: 'wallpaper', price: 100, color: '#FBDCCB' },
  { id: 'wp_lavender', name: 'Lavender wallpaper', kind: 'wallpaper', price: 100, color: '#E3D9F5' },
  { id: 'wp_night', name: 'Night wallpaper', kind: 'wallpaper', price: 150, color: '#2E3A5C' },
  // Flooring
  { id: 'fl_oak', name: 'Oak floor', kind: 'flooring', price: 100, color: '#C89B6D' },
  { id: 'fl_tile', name: 'Tile floor', kind: 'flooring', price: 100, color: '#D7DCE0' },
  { id: 'fl_rug', name: 'Rose carpet', kind: 'flooring', price: 120, color: '#E7A9B4' },
];

export const DEFAULT_WALL = '#F3EEE6';
export const DEFAULT_FLOOR = '#BFA48A';

/** Spots in the room an item can go. Positions are percentages of the room box. */
export interface RoomSlot {
  id: string;
  kind: 'wall' | 'floor';
  x: number;
  y: number;
}

export const ROOM_SLOTS: RoomSlot[] = [
  { id: 'w1', kind: 'wall', x: 18, y: 22 },
  { id: 'w2', kind: 'wall', x: 50, y: 15 },
  { id: 'w3', kind: 'wall', x: 82, y: 22 },
  { id: 'w4', kind: 'wall', x: 34, y: 44 },
  { id: 'w5', kind: 'wall', x: 66, y: 44 },
  { id: 'f1', kind: 'floor', x: 14, y: 70 },
  { id: 'f2', kind: 'floor', x: 38, y: 68 },
  { id: 'f3', kind: 'floor', x: 62, y: 68 },
  { id: 'f4', kind: 'floor', x: 86, y: 70 },
  { id: 'f5', kind: 'floor', x: 26, y: 87 },
  { id: 'f6', kind: 'floor', x: 50, y: 88 },
  { id: 'f7', kind: 'floor', x: 74, y: 87 },
];

export function decorById(id: string): DecorItem | undefined {
  return DECOR.find((d) => d.id === id);
}
