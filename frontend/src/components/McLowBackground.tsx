import { MC_UI } from '../utils/mcAssets';

/** Cheap repeating grass/dirt tiles when 3D terrain is off. */
export default function McLowBackground() {
  return (
    <div className="mc-low-bg" aria-hidden>
      <div
        className="mc-low-ground"
        style={{ backgroundImage: `url(${MC_UI.dirtSide})` }}
      />
      <div
        className="mc-low-grass"
        style={{ backgroundImage: `url(${MC_UI.grass})` }}
      />
    </div>
  );
}
