import { useSyncExternalStore } from 'react';
import { getTheme, subscribeTheme, type UiTheme } from './theme';

export function useTheme(): UiTheme {
  return useSyncExternalStore(subscribeTheme, getTheme, getTheme);
}
