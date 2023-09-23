import { MC_UI } from '../utils/mcAssets';

export default function McFire() {
  return (
    <span className="mc-fire" aria-hidden>
      <span className="mc-pdf-scorch" />
      <img className="mc-fire-glow" src={MC_UI.explosion} alt="" />
      <span className="mc-fire-sheet" style={{ backgroundImage: `url(${MC_UI.fireSheet})` }} />
      <img className="mc-fire-ember mc-fire-ember-a" src={MC_UI.fireCharge} alt="" />
      <img className="mc-fire-ember mc-fire-ember-b" src={MC_UI.fireCharge} alt="" />
      <img className="mc-fire-ember mc-fire-ember-c" src={MC_UI.fireCharge} alt="" />
    </span>
  );
}
