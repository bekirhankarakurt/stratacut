import { useEffect, useState, useSyncExternalStore } from 'react';
import { ACHIEVEMENTS, nameStyleForLevel } from '../utils/progression';
import {
  fetchLanBoard,
  formatPlayMs,
  lanAvatarUrl,
  mergeLanBoard,
  startLanSync,
  statusLabel,
  themePlaceLabel,
  type LanBoard,
  type LanPlayer,
} from '../utils/lanBoard';
import { getPlayerProfile, subscribePlayerProfile } from '../utils/playerProfile';
import PlayerName from './PlayerName';
import ProfileAvatar from './ProfileAvatar';
import TrophyGrid from './TrophyGrid';
import Button from './ui/Button';

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="mc-block mc-stat-tile px-2.5 py-2">
      <div className="flex items-center gap-1">
        <span className="text-[13px] leading-none">{icon}</span>
        <span className="mc-label text-[8px] tracking-wide text-amber-200/85">{label}</span>
      </div>
      <div className="mc-stat-val mt-1.5 truncate font-mono leading-none">{value}</div>
    </div>
  );
}

function Row({ p, photo, onOpen }: { p: LanPlayer; photo?: string; onOpen: () => void }) {
  const style = nameStyleForLevel(p.level);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        'mc-block grid w-full grid-cols-[2rem_2.5rem_1fr_auto] items-center gap-2 px-2 py-1.5 text-left',
        p.self ? 'bg-accent-600/25 ring-2 ring-accent-500/50' : 'bg-[#191d13]',
      ].join(' ')}
    >
      <span className={['mc-label text-center text-[10px]', p.place <= 3 ? style.titleClass : 'text-slate-500'].join(' ')}>
        #{p.place}
      </span>
      <ProfileAvatar key={photo || p.id} src={photo} level={p.level} size={40} title={`Sv.${p.level} çerçevesi`} />
      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <PlayerName name={p.name} level={p.level} />
          <span className={['mc-label shrink-0 text-[9px] font-black', style.titleClass].join(' ')}>
            Sv.{p.level}
          </span>
          {p.online ? (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Çevrimiçi" />
          ) : (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" title="Çevrimdışı" />
          )}
          {p.self ? <span className="mc-label text-[7px] text-accent-500">SEN</span> : null}
        </div>
        <div className={['mc-label mt-0.5 truncate text-[8px]', style.titleClass].join(' ')}>{p.rank}</div>
        {p.bio ? (
          <div className="mt-0.5 line-clamp-2 text-[12px] font-black leading-snug text-amber-200" style={{ textShadow: '1px 1px 0 #000' }}>
            “{p.bio}”
          </div>
        ) : (
          <div className="mt-0.5 truncate font-mono text-[9px] text-amber-200/90">{statusLabel(p)}</div>
        )}
      </div>
      <div className="text-right font-mono text-[9px] text-slate-400">
        <div className="font-black text-amber-200">Sv.{p.level}</div>
        <div>🏆 {p.achievements}/{ACHIEVEMENTS.length}</div>
        <div>◆ {p.coins}</div>
        <div>Gün {p.aliveDays}</div>
      </div>
    </button>
  );
}

function Profile({ p, photo, onBack }: { p: LanPlayer; photo?: string; onBack: () => void }) {
  const place = themePlaceLabel(p.theme);
  const style = nameStyleForLevel(p.level);
  const kills = p.mobKills ?? 0;
  const deaths = p.deaths ?? 0;
  const kd = deaths > 0 ? (kills / deaths).toFixed(1) : String(kills);
  const online = p.online
    ? `${place || 'Çevrimiçi'}${p.activity === 'pdf' ? ' · PDF düzenliyor' : ''}${p.theme === 'minecraft' && p.deadly ? ' · ölümcül' : ''}`
    : 'Çevrimdışı';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#0b0e08]">
      <div className="mc-profile-hero relative z-20 shrink-0 border-b-4 border-black px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={onBack}>
            ← Sıralama
          </Button>
          <span className={['mc-label text-[11px] font-black', style.titleClass].join(' ')}>#{p.place}</span>
        </div>
        <div className="flex min-h-[6.5rem] items-start gap-4">
          <ProfileAvatar key={photo || p.id} src={photo} level={p.level} size={96} title={`Sv.${p.level} · ${p.rank}`} />
          <div className="min-w-0 flex-1">
            <PlayerName name={p.name} level={p.level} className="text-[18px]" />
            <div className={['mc-title mt-1 text-[11px]', style.titleClass].join(' ')}>
              Sv.{p.level} · {p.rank}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-black/40 px-2 py-1 font-mono text-[11px] font-bold">
              <span className={`h-2.5 w-2.5 rounded-full ${p.online ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <span className={p.online ? 'text-emerald-300' : 'text-slate-400'}>{online}</span>
            </div>
            <div className="mt-1 truncate font-mono text-[10px] text-slate-400">{p.host}</div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-3 mt-3">
        <div className="mc-profile-quote px-5 py-3.5 pl-8">
          <div className="mc-label text-[10px] font-black tracking-[0.28em] text-amber-300">PROFİL NOTU</div>
          {p.bio ? (
            <p className="mt-1.5">{p.bio}</p>
          ) : (
            <p className="mt-1.5" style={{ fontSize: 15, fontWeight: 700, color: 'rgba(254, 243, 199, 0.45)', textShadow: 'none' }}>
              Henüz not yazmamış.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 p-3 pt-4">
        <div>
          <div className="mc-label mb-1.5 text-[9px] text-amber-300">Kupalar</div>
          <TrophyGrid ids={p.unlocked ?? []} empty="Bu oyuncu henüz kupa paylaşmıyor veya kupa yok." />
        </div>

        <div>
          <div className="mc-label mb-1.5 text-[9px] text-amber-300">Savaş</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat icon="⚔" label="Yaratık" value={kills} />
            <Stat icon="☠" label="Boss" value={p.bossKills ?? 0} />
            <Stat icon="💀" label="Ölüm" value={deaths} />
            <Stat icon="⚖" label="K/D" value={kd} />
          </div>
        </div>

        <div>
          <div className="mc-label mb-1.5 text-[9px] text-amber-300">Tema süreleri</div>
          <div className="grid grid-cols-2 gap-2">
            <Stat icon="⛏" label="Madende" value={formatPlayMs(p.minecraftMs ?? 0)} />
            <Stat icon="📄" label="Classic" value={formatPlayMs(p.classicMs ?? 0)} />
          </div>
        </div>

        <div>
          <div className="mc-label mb-1.5 text-[9px] text-amber-300">İlerleme</div>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon="⭐" label="Seviye" value={p.level} />
            <Stat icon="✦" label="XP" value={p.xp} />
            <Stat icon="🏆" label="Başarım" value={`${p.achievements}/${ACHIEVEMENTS.length}`} />
            <Stat icon="✂" label="Kesim" value={p.splits ?? 0} />
            <Stat icon="📚" label="PDF" value={p.pdfsOpened ?? 0} />
            <Stat icon="📄" label="Sayfa" value={p.pagesSaved ?? 0} />
            <Stat icon="◆" label="Coin" value={p.coins} />
            <Stat icon="☀" label="Hayatta" value={`Gün ${p.aliveDays}`} />
            <Stat icon="👑" label="Rütbe" value={p.rank} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LanRanksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [board, setBoard] = useState<LanBoard | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const localProf = useSyncExternalStore(subscribePlayerProfile, getPlayerProfile, getPlayerProfile);

  const photoOf = (p: LanPlayer) => (p.self && localProf.avatar ? localProf.avatar : lanAvatarUrl(p));

  useEffect(() => {
    if (!open) return;
    startLanSync();
    setSelectedId(null);
    let cancelled = false;
    const load = async () => {
      setBusy(true);
      const next = await fetchLanBoard();
      if (!cancelled && next) setBoard((prev) => mergeLanBoard(prev, next));
      setBusy(false);
    };
    void load();
    const tid = window.setInterval(() => {
      void fetchLanBoard().then((next) => {
        if (!cancelled && next) setBoard((prev) => mergeLanBoard(prev, next));
      });
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(tid);
    };
  }, [open]);

  if (!open) return null;

  const mine = board?.players.find((p) => p.self);
  const others = board?.players.filter((p) => !p.self) ?? [];
  const selected = board?.players.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="presentation">
      <div
        className="mc-block flex min-h-0 w-full max-w-3xl animate-modal-in flex-col overflow-hidden bg-[#10140c] shadow-xl"
        style={{ height: 'min(90vh, 52rem)', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b-4 border-black bg-[#20250f] px-4 py-3">
          <div>
            <h2 className="mc-title text-[12px] text-accent-500">{selected ? 'Oyuncu profili' : 'LAN Sıralama'}</h2>
            <p className="mt-1 font-mono text-[11px] text-slate-500">
              {selected ? 'Tıklanan oyuncunun anlık durumu ve istatistikleri' : 'Aynı şirket ağındaki PDFCraft oyuncuları · satıra tıkla'}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Kapat
          </Button>
        </div>

        {selected ? (
          <Profile p={selected} photo={photoOf(selected)} onBack={() => setSelectedId(null)} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {mine ? (
              <div className="shrink-0 border-b-4 border-black bg-[#181c10] px-4 py-3">
                <div className="mc-label mb-2 text-[8px] text-slate-500">Senin profilin · tıkla detay</div>
                <Row p={mine} photo={photoOf(mine)} onOpen={() => setSelectedId(mine.id)} />
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat icon="⭐" label="Seviye" value={mine.level} />
                  <Stat icon="✦" label="XP" value={mine.xp} />
                  <Stat icon="✂" label="Kesim" value={mine.splits} />
                  <Stat icon="💀" label="Ölüm" value={mine.deaths} />
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
              <div className="mc-label mb-1 text-[8px] text-slate-500">
                Sıralama · {board?.players.length ?? 0} oyuncu {busy ? ' · taranıyor…' : ''}
              </div>
              {(board?.players ?? []).map((p) => (
                <Row key={p.id} p={p} photo={photoOf(p)} onOpen={() => setSelectedId(p.id)} />
              ))}
              {!board?.players.length ? (
                <div className="mc-block bg-[#191d13] px-3 py-4 text-center text-[11px] text-slate-500">
                  Henüz kimse görünmüyor. Diğer PC’lerde v2 açık olsun; Windows güvenlik duvarı izin isteyebilir.
                </div>
              ) : null}
              {board && others.length === 0 && mine ? (
                <div className="px-1 pt-1 font-mono text-[10px] text-slate-500">
                  Şu an ağda yalnızsın. Mesai arkadaşların v2’yi açınca burada görünür.
                </div>
              ) : null}
              <div className="px-1 pt-2 font-mono text-[9px] leading-relaxed text-slate-500">
                İsme tıklayınca profil açılır. Fotoğraf, açıklama ve kupalar Ayarlar’dan eklenir.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
