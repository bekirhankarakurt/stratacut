import { useSyncExternalStore } from 'react';
import { getGame, subscribe, type GameState } from './game';

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getGame, getGame);
}
