import MinecraftBackground from './components/MinecraftBackground';
import McLowBackground from './components/McLowBackground';
import TntBlock3D from './components/TntBlock3D';
import TntBlock2D from './components/TntBlock2D';
import NightScene from './components/NightScene';
import MobLayer from './components/MobLayer';
import AnimalLayer from './components/AnimalLayer';
import GameCursor from './components/GameCursor';
import { useGraphicsQuality } from './utils/useGraphics';

/** Loaded only after a Minecraft-theme restart so Classic never pays for this. */
export default function MinecraftChrome() {
  const gfx = useGraphicsQuality();
  return (
    <>
      {gfx !== 'high' ? <McLowBackground /> : null}
      {gfx === 'high' ? <MinecraftBackground quality="high" /> : null}
      <NightScene quality={gfx} />
      {gfx === 'high' ? <TntBlock3D quality="high" /> : <TntBlock2D />}
      <MobLayer />
      {gfx === 'high' ? <AnimalLayer /> : null}
      <GameCursor />
    </>
  );
}
