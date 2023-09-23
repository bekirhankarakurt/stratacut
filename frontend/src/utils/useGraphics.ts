import { useSyncExternalStore } from 'react';
import { getGraphicsQuality, subscribeGraphics, type GraphicsQuality } from './appSettings';

export function useGraphicsQuality(): GraphicsQuality {
  return useSyncExternalStore(subscribeGraphics, getGraphicsQuality, getGraphicsQuality);
}
