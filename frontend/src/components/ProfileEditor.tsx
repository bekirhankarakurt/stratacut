import { useRef } from 'react';
import { useSyncExternalStore } from 'react';
import { useProgression } from '../utils/useProgression';
import { levelFromXp, recordProfileBio, recordProfilePhoto } from '../utils/progression';
import {
  PLAYER_BIO_MAX,
  getPlayerProfile,
  publishLanAvatar,
  resizeAvatarFile,
  savePlayerProfile,
  subscribePlayerProfile,
} from '../utils/playerProfile';
import ProfileAvatar from './ProfileAvatar';

export default function ProfileEditor() {
  const prof = useSyncExternalStore(subscribePlayerProfile, getPlayerProfile, getPlayerProfile);
  const p = useProgression();
  const lvl = levelFromXp(p.xp).level;
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onPick = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await resizeAvatarFile(file);
      const avatarAt = await publishLanAvatar(dataUrl);
      savePlayerProfile({ avatar: dataUrl, avatarAt });
      recordProfilePhoto();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <ProfileAvatar src={prof.avatar || undefined} level={lvl} size={72} title="Rütbe çerçevesi" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-snug text-slate-600">
            Fotoğraf isteğe bağlı. Çerçeve rengi seviye/rütbene göre değişir.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => fileRef.current?.click()}
            >
              Fotoğraf seç
            </button>
            {prof.avatar ? (
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                onClick={() => {
                  void publishLanAvatar('').then((avatarAt) => {
                    savePlayerProfile({ avatar: '', avatarAt });
                  });
                }}
              >
                Kaldır
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          void onPick(f);
        }}
      />
      <label className="block">
        <span className="text-[11px] font-semibold text-amber-800">Profil notu (sıralamada büyük görünür)</span>
        <textarea
          maxLength={PLAYER_BIO_MAX}
          rows={3}
          value={prof.bio}
          placeholder="Kısa bir profil yazısı…"
          onChange={(e) => {
            const bio = e.target.value;
            savePlayerProfile({ bio });
            if (bio.trim()) recordProfileBio();
          }}
          className="mt-1 w-full resize-none rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-amber-500/40 focus:ring-2"
        />
        <span className="mt-0.5 block text-right font-mono text-[10px] text-slate-400">
          {prof.bio.length}/{PLAYER_BIO_MAX}
        </span>
      </label>
    </div>
  );
}
