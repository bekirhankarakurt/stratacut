import { useEffect, useState } from 'react';
import { nameStyleForLevel } from '../utils/progression';
import { MC_MOBS } from '../utils/mcAssets';

export default function ProfileAvatar({
  src,
  level,
  size = 40,
  title,
}: {
  src?: string;
  level: number;
  size?: number;
  title?: string;
}) {
  const style = nameStyleForLevel(level);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [src]);
  const photo = src && !broken ? src : '';
  return (
    <span
      className={['mc-profile-frame relative z-20 inline-flex shrink-0 overflow-hidden', style.badgeClass].join(' ')}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      title={title}
    >
      <img
        src={MC_MOBS.steveFace}
        alt=""
        className="h-full w-full object-cover"
        style={{ imageRendering: 'pixelated' }}
      />
      {photo ? (
        <img
          src={photo}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : null}
    </span>
  );
}
