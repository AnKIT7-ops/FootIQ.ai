/** Shared motion tokens: one ease for UI transitions, one spring for layout/press. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const SPRING = { type: "spring", stiffness: 500, damping: 38 } as const;
