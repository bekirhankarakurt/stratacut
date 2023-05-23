import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tailwind.css';
import { applyTheme, loadTheme } from './utils/theme';
import { hydrateFromDisk, flushDiskSave, markSaveBootstrapped } from './utils/diskSave';
import { reloadProgressFromStorage } from './utils/progression';
import { reloadPlayerProfileFromStorage } from './utils/playerProfile';

async function startMinecraftExtras() {
  await import('@fontsource/press-start-2p');
  const { applyGraphicsQuality, applyPanelOpacity, loadAppSettings } = await import('./utils/appSettings');
  const { getGame, reloadGameFromStorage, startGameClock } = await import('./utils/game');
  const { startLanSync } = await import('./utils/lanBoard');
  const { getPlayerProfile, publishLanAvatar } = await import('./utils/playerProfile');
  const { syncLegacyStats, flushThemeStats } = await import('./utils/progression');
  reloadGameFromStorage();
  const bootGame = getGame();
  const prof = getPlayerProfile();
  syncLegacyStats({
    deaths: bootGame.deaths,
    coins: bootGame.coins,
    nights: bootGame.aliveDays + bootGame.potionBonusDays,
    owned: bootGame.owned,
    hasPhoto: !!prof.avatar,
    hasBio: !!prof.bio.trim(),
  });
  startGameClock();
  const boot = loadAppSettings();
  applyPanelOpacity(boot.panelOpacity);
  applyGraphicsQuality(boot.graphicsQuality);
  if (prof.avatar) void publishLanAvatar(prof.avatar);
  startLanSync();
  window.addEventListener('beforeunload', () => {
    flushThemeStats();
  });
}

async function start() {
  const theme = loadTheme();
  applyTheme(theme);
  await hydrateFromDisk();
  reloadProgressFromStorage();
  reloadPlayerProfileFromStorage();
  markSaveBootstrapped();
  void flushDiskSave();
  if (theme === 'minecraft') {
    await startMinecraftExtras();
  }

  window.addEventListener('beforeunload', () => {
    void flushDiskSave();
  });

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void start();
