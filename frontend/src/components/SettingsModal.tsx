import { useEffect, useState, lazy, Suspense } from 'react';
import {
  applyGraphicsQuality,
  applyPanelOpacity,
  folderLabel,
  loadAppSettings,
  rememberRecentFolder,
  saveAppSettings,
  type AppSettings,
  type GraphicsQuality,
} from '../utils/appSettings';
import { getTheme, reloadWithTheme, type UiTheme } from '../utils/theme';
import { useTheme } from '../utils/useTheme';
import { resetProgress } from '../utils/progression';
import { deleteDiskSave } from '../utils/diskSave';
import Button from './ui/Button';

const ProfileEditor = lazy(() => import('./ProfileEditor'));

function FolderBlock({
  title,
  hint,
  icon,
  accent,
  value,
  recentFolders,
  onChange,
  onPickFolder,
}: {
  title: string;
  hint: string;
  icon: string;
  accent: 'emerald' | 'violet' | 'rose';
  value: string;
  recentFolders: string[];
  onChange: (path: string) => void;
  onPickFolder: () => Promise<string | null>;
}) {
  const mc = useTheme() === 'minecraft';
  const look =
    accent === 'emerald'
      ? {
          ring: 'focus:ring-accent-600/25 border-accent-200/80',
          chip: 'border-accent-200/70 bg-accent-50/80 text-accent-900 hover:border-accent-400 hover:bg-accent-100',
          iconMc: 'bg-gradient-to-br from-accent-100 to-accent-200/80',
          icon: 'bg-accent-100',
          btn: 'accent' as const,
          selected: 'ring-2 ring-accent-500/40',
        }
      : accent === 'rose'
        ? {
            ring: 'focus:ring-rose-500/25 border-rose-200/80',
            chip: 'border-rose-200/70 bg-rose-50/80 text-rose-900 hover:border-rose-400 hover:bg-rose-100',
            iconMc: 'bg-gradient-to-br from-rose-100 to-rose-200/80',
            icon: 'bg-rose-100',
            btn: 'primary' as const,
            selected: 'ring-2 ring-rose-500/40',
          }
        : {
            ring: 'focus:ring-violet-500/25 border-violet-200/80',
            chip: 'border-violet-200/70 bg-violet-50/80 text-violet-900 hover:border-violet-400 hover:bg-violet-100',
            iconMc: 'bg-gradient-to-br from-violet-100 to-violet-200/80',
            icon: 'bg-violet-100',
            btn: 'primary' as const,
            selected: 'ring-2 ring-violet-500/40',
          };
  const ring = look.ring;
  const chip = look.chip;

  return (
    <section
      className={
        mc
          ? 'settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm'
          : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
      }
    >
      <div className="mb-3 flex items-start gap-3">
        <div
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center text-lg',
            mc
              ? `rounded-xl shadow-inner ${look.iconMc}`
              : `rounded-lg ${look.icon}`,
          ].join(' ')}
        >
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{hint}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          placeholder="Klasör seçin…"
          onChange={(e) => onChange(e.target.value)}
          className={[
            'min-w-0 flex-1 border bg-white px-2.5 py-1.5 text-sm text-slate-900 outline-none',
            mc
              ? `rounded-xl bg-white/90 px-3 py-2.5 transition-shadow focus:border-slate-300 focus:ring-2 ${ring}`
              : 'rounded-lg border-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-accent-600/20',
          ].join(' ')}
        />
        <Button
          size="sm"
          variant={mc ? look.btn : 'secondary'}
          className="shrink-0 px-3"
          onClick={async () => {
            const picked = await onPickFolder();
            if (picked) onChange(picked);
          }}
        >
          Seç…
        </Button>
      </div>

      {recentFolders.length > 0 ? (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Son konumlar</div>
          <div className="flex flex-wrap gap-1.5">
            {recentFolders.map((path) => (
              <button
                key={path}
                type="button"
                title={path}
                onClick={() => onChange(path)}
                className={[
                  'animate-chip-in max-w-full truncate rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150',
                  'hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98]',
                  value === path ? look.selected : '',
                  chip,
                ].join(' ')}
              >
                {folderLabel(path)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function SettingsModal({
  open,
  onClose,
  onSaved,
  onPickFolder,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (settings: AppSettings) => void;
  onPickFolder: () => Promise<string | null>;
}) {
  const [targetOutputDir, setTargetOutputDir] = useState('');
  const [notFoundOutputDir, setNotFoundOutputDir] = useState('');
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);
  const [theme, setTheme] = useState<UiTheme>(() => getTheme());
  const [resetWarn, setResetWarn] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [panelOpacity, setPanelOpacity] = useState(0.82);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>('high');
  const [nightMobs, setNightMobs] = useState(true);
  const [deadlyMode, setDeadlyMode] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [namePlaceholder, setNamePlaceholder] = useState('Oyuncu');
  const mc = useTheme() === 'minecraft';

  useEffect(() => {
    if (!open) return;
    const s = loadAppSettings();
    setTargetOutputDir(s.targetOutputDir);
    setNotFoundOutputDir(s.notFoundOutputDir);
    setRecentFolders(s.recentFolders);
    setTheme(getTheme());
    setPanelOpacity(s.panelOpacity);
    setGraphicsQuality(s.graphicsQuality);
    setNightMobs(s.nightMobs);
    setDeadlyMode(s.deadlyMode === true);
    setPlayerName(s.playerName);
    setSavedFlash(false);
    void fetch('/api/system/identity')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { username?: string } | null) => {
        if (body?.username) setNamePlaceholder(String(body.username).slice(0, 24));
      })
      .catch(() => undefined);
    setResetWarn(false);
    setResetDone(false);
  }, [open]);

  if (!open) return null;

  const discardPreview = () => {
    const saved = loadAppSettings();
    applyPanelOpacity(saved.panelOpacity);
    applyGraphicsQuality(saved.graphicsQuality);
    onClose();
  };

  const handleSave = () => {
    let recent = recentFolders;
    if (targetOutputDir.trim()) recent = rememberRecentFolder(targetOutputDir.trim()).recentFolders;
    if (notFoundOutputDir.trim()) recent = rememberRecentFolder(notFoundOutputDir.trim()).recentFolders;
    const next = saveAppSettings({
      targetOutputDir: targetOutputDir.trim(),
      notFoundOutputDir: notFoundOutputDir.trim(),
      recentFolders: recent,
      panelOpacity,
      graphicsQuality,
      nightMobs,
      deadlyMode,
      playerName,
    });
    setRecentFolders(next.recentFolders);
    onSaved(next);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div
      className={
        mc
          ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-sm'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'
      }
      onClick={discardPreview}
      role="presentation"
    >
      <div
        className={
          mc
            ? 'animate-modal-in w-full max-w-xl overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-b from-white to-slate-50/95 shadow-2xl shadow-slate-900/20'
            : 'w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl'
        }
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className={mc ? 'relative overflow-hidden border-b border-slate-200/80 px-5 py-4' : 'border-b border-slate-100 px-4 py-3'}>
          {mc ? <div className="settings-shimmer pointer-events-none absolute inset-0 opacity-40" aria-hidden /> : null}
          <div className="relative flex items-center justify-between gap-3">
            <div>
              <h2 id="settings-title" className={mc ? 'text-lg font-bold tracking-tight text-slate-900' : 'text-base font-bold text-slate-900'}>
                Ayarlar
              </h2>
              <p className="mt-0.5 text-xs text-slate-600">Klasörler kaydedilir; uygulama her açıldığında hatırlanır.</p>
            </div>
            <button
              type="button"
              onClick={discardPreview}
              className={mc ? 'rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800' : 'rounded p-1.5 text-slate-500 hover:bg-slate-100'}
              aria-label="Kapat"
            >
              ✕
            </button>
          </div>
        </div>

        <div className={mc ? 'max-h-[min(70vh,32rem)] space-y-3 overflow-auto p-4' : 'max-h-[min(70vh,32rem)] space-y-3 overflow-auto px-4 py-3'}>
          <section
            className={
              mc
                ? 'settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm'
                : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
            }
          >
            <h3 className="text-sm font-bold text-slate-900">Tema</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              İlk açılış Classic’tir. Minecraft ağırdır; seçince uygulama yeniden başlar.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'minecraft' as const, title: 'Minecraft', hint: 'PDFCraft · canavarlar, XP, voxel. Yeniden başlatır.' },
                  { id: 'classic' as const, title: 'Classic', hint: 'Hafif PDF Splitter Pro. Eski PC için.' },
                ]
              ).map((opt) => {
                const on = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (opt.id === getTheme()) return;
                      const goingMc = opt.id === 'minecraft';
                      const ok = window.confirm(
                        goingMc
                          ? 'Minecraft teması eski bilgisayarlarda ağırdır. Uygulama yeniden başlayacak. Devam edilsin mi?'
                          : 'Classic temaya geçmek için uygulama yeniden başlayacak. Devam edilsin mi?',
                      );
                      if (!ok) return;
                      setTheme(opt.id);
                      reloadWithTheme(opt.id);
                    }}
                    className={[
                      mc ? 'rounded-2xl border px-3 py-3 text-left' : 'rounded-lg border px-3 py-2.5 text-left',
                      on
                        ? 'border-accent-600 bg-accent-50 ring-2 ring-accent-500/40'
                        : mc
                          ? 'border-slate-200 bg-white/80 hover:border-slate-300'
                          : 'border-slate-200 bg-white hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="text-sm font-bold text-slate-900">{opt.title}</div>
                    <div className="mt-1 text-[11px] leading-snug text-slate-600">{opt.hint}</div>
                    {on ? <div className="mt-2 text-[10px] font-semibold text-accent-700">Seçili</div> : null}
                  </button>
                );
              })}
            </div>
          </section>
          <section
            className={
              mc
                ? 'settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm'
                : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
            }
          >
            <h3 className="text-sm font-bold text-slate-900">Profil</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              {mc
                ? 'LAN sıralamasında görünen isim, fotoğraf ve açıklama. Boş isimde Windows kullanıcı adın kullanılır.'
                : 'LAN sıralamasında görünen isim. Boş bırakırsan Windows kullanıcı adın kullanılır. Fotoğraf ve not yalnızca Minecraft temasındadır.'}
            </p>
            <input
              type="text"
              maxLength={24}
              value={playerName}
              placeholder={namePlaceholder}
              onChange={(e) => setPlayerName(e.target.value.slice(0, 24))}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-accent-500/40 focus:ring-2"
            />
            {mc ? (
              <div className="mt-3">
                <Suspense fallback={null}>
                  <ProfileEditor />
                </Suspense>
              </div>
            ) : null}
          </section>
          {mc ? (
          <section className="settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
            <h3 className="text-sm font-bold text-slate-900">Grafik</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Minecraft dünyası. Eski (2011) PC: Orta veya Düşük. Canavarlar her ayarda çalışır.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'high' as const, title: 'Yüksek', hint: '3D voxel dünya + 3D TNT' },
                  { id: 'medium' as const, title: 'Orta', hint: 'Durağan 2D zemin, WebGL yok' },
                  { id: 'low' as const, title: 'Düşük', hint: 'Aynı zemin, daha küçük sprite' },
                ]
              ).map((opt) => {
                const on = graphicsQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setGraphicsQuality(opt.id);
                      applyGraphicsQuality(opt.id);
                    }}
                    className={[
                      mc ? 'rounded-2xl border px-2.5 py-2.5 text-left transition-all' : 'rounded-lg border px-2.5 py-2 text-left transition-all',
                      on
                        ? 'border-accent-600 bg-accent-50 ring-2 ring-accent-500/40'
                        : mc
                          ? 'border-slate-200 bg-white/80 hover:border-slate-300'
                          : 'border-slate-200 bg-white hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <div className="text-sm font-bold text-slate-900">{opt.title}</div>
                    <div className="mt-1 text-[10px] leading-snug text-slate-600">{opt.hint}</div>
                    {on ? <div className="mt-1.5 text-[10px] font-semibold text-accent-700">Seçili</div> : null}
                  </button>
                );
              })}
            </div>
          </section>
          ) : null}
          {mc ? (
            <section className="settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-bold text-slate-900">Gece canavarları</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Kapatınca geceleri yaratık gelmez. Ölümcül mod açıksa gündüz de gelir.
              </p>
              <button
                type="button"
                onClick={() => {
                  const next = !nightMobs;
                  setNightMobs(next);
                  saveAppSettings({ nightMobs: next });
                }}
                className={[
                  'mt-3 w-full rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition-all',
                  nightMobs
                    ? 'border-accent-600 bg-accent-50 text-slate-900 ring-2 ring-accent-500/40'
                    : 'border-slate-300 bg-white/80 text-slate-700',
                ].join(' ')}
              >
                {nightMobs ? 'Canavarlar açık' : 'Canavarlar kapalı'}
                <div className="mt-1 text-[11px] font-semibold text-slate-600">
                  {nightMobs ? 'Gece ilk dalga ~10 sn, sonra 2–2.5 dk arayla.' : 'Gece yaratık spawn olmaz.'}
                </div>
              </button>
            </section>
          ) : null}
          {mc ? (
            <section className="settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-bold text-slate-900">Ölümcül mod</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Açınca gündüz-gece her 30 sn birden fazla yaratık gelir. Canları 3 katına çıkar; yine de kaçılabilir.
              </p>
              <button
                type="button"
                onClick={() => {
                  const next = !deadlyMode;
                  setDeadlyMode(next);
                  saveAppSettings({ deadlyMode: next });
                }}
                className={[
                  'mt-3 w-full rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition-all',
                  deadlyMode
                    ? 'border-red-600 bg-red-50 text-slate-900 ring-2 ring-red-500/40'
                    : 'border-slate-300 bg-white/80 text-slate-700',
                ].join(' ')}
              >
                {deadlyMode ? 'Ölümcül mod açık' : 'Ölümcül mod kapalı'}
                <div className="mt-1 text-[11px] font-semibold text-slate-600">
                  {deadlyMode
                    ? '30 sn’de 2–4 yaratık · can ×3 · en fazla 5 ekranda'
                    : 'Kapalı: normal gece spawn.'}
                </div>
              </button>
            </section>
          ) : null}
          {mc ? (
            <section className="settings-card animate-settings-card-in rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-sm">
              <h3 className="text-sm font-bold text-slate-900">Panel şeffaflığı</h3>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                Yeşil panellerin arkası. Düşük değer, Minecraft dünyasını daha iyi gösterir.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={35}
                  max={100}
                  step={1}
                  value={Math.round(panelOpacity * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setPanelOpacity(v);
                    applyPanelOpacity(v);
                  }}
                  className="min-w-0 flex-1 accent-emerald-600"
                />
                <span className="w-10 shrink-0 text-right font-mono text-xs font-bold text-slate-800">
                  {Math.round(panelOpacity * 100)}%
                </span>
              </div>
            </section>
          ) : null}
          <FolderBlock
            title="Hedef Klasör"
            hint="Kesip kaydettiğiniz PDF'lerin varsayılan çıktı konumu."
            icon="📁"
            accent="emerald"
            value={targetOutputDir}
            recentFolders={recentFolders}
            onChange={setTargetOutputDir}
            onPickFolder={onPickFolder}
          />
          <FolderBlock
            title="Bulunamadı Klasörü"
            hint="Bulunamadı olarak işaretlediğiniz sayfalar buraya kaydedilir."
            icon="🔍"
            accent="rose"
            value={notFoundOutputDir}
            recentFolders={recentFolders}
            onChange={setNotFoundOutputDir}
            onPickFolder={onPickFolder}
          />
          <section
            className={
              mc
                ? 'settings-card animate-settings-card-in rounded-2xl border border-rose-200/70 bg-rose-50/50 p-4 shadow-sm backdrop-blur-sm'
                : 'rounded-xl border border-rose-200 bg-rose-50 p-4'
            }
          >
            <h3 className="text-sm font-bold text-slate-900">İlerlemeyi sıfırla</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              XP, seviye, başarımlar, coin ve envanter silinir. EXE yanındaki kayıt dosyası da silinir. 1. seviyeden başlarsın.
            </p>
            {resetWarn ? (
              <div className="mt-3 rounded-xl border border-rose-300 bg-white/90 p-3">
                <p className="text-xs font-semibold text-rose-800">Bu işlem geri alınamaz.</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  Tüm oyun ilerlemen silinecek. Emin misin?
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setResetWarn(false)}>
                    Vazgeç
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      resetProgress();
                      if (getTheme() === 'minecraft') {
                        void import('../utils/game').then(({ resetGame }) => resetGame());
                      }
                      void deleteDiskSave();
                      setResetWarn(false);
                      setResetDone(true);
                      window.setTimeout(() => setResetDone(false), 2000);
                    }}
                  >
                    Evet, sıfırla
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                size="sm"
                variant="danger"
                className="mt-3"
                onClick={() => setResetWarn(true)}
              >
                {resetDone ? '1. seviyeye alındı' : 'İlerlemeyi sıfırla'}
              </Button>
            )}
          </section>
        </div>

        <div
          className={
            mc
              ? 'flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 bg-white/60 px-4 py-3 backdrop-blur-sm'
              : 'flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3'
          }
        >
          <p className="text-[11px] text-slate-500">Son konumlar her iki alanda da öneri olarak görünür.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={discardPreview}>
              İptal
            </Button>
            <Button
              size="sm"
              variant="accent"
              className={savedFlash ? 'animate-settings-save-flash' : ''}
              onClick={() => {
                handleSave();
              }}
            >
              {savedFlash ? '✓ Kaydedildi' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
