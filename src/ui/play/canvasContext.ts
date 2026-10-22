import { createContext, useContext } from 'react';

/** Pan offset (screen px) and zoom factor of the canvas. */
export interface View {
  x: number;
  y: number;
  k: number;
}

/** A rectangle in world (unscaled canvas) coordinates. */
export interface WorldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CanvasApi {
  /** Where an element inside the world sits, in world coordinates. */
  worldRectOf(el: Element): WorldRect;
  /** Pans so the world rectangle is visible, leaving room for a popover on its right. */
  reveal(rect: WorldRect): void;
}

export const CanvasContext = createContext<CanvasApi | null>(null);

/** The surrounding <Canvas>'s coordinate helpers. */
export function useCanvas(): CanvasApi {
  const api = useContext(CanvasContext);
  if (!api) throw new Error('useCanvas outside <Canvas>');
  return api;
}
