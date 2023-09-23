import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe, type Progress } from './progression';

export function useProgression(): Progress {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
