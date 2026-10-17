/** Tactical Board geometry shared by pointer drag and keyboard moves (all in % of the pitch). */

export interface PitchPos {
  x: number;
  y: number;
}

/** Keep a chip/ball fully on the pitch. */
export function clampToPitch(x: number, y: number): PitchPos {
  return { x: Math.min(98, Math.max(2, x)), y: Math.min(96, Math.max(4, y)) };
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Arrow key → new clamped position (2% a press, 10% with Shift); null for any other key. */
export function nudge(pos: PitchPos, key: string, big: boolean): PitchPos | null {
  const dir = ARROWS[key];
  if (!dir) return null;
  const step = big ? 10 : 2;
  return clampToPitch(pos.x + dir[0] * step, pos.y + dir[1] * step);
}
