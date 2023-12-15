# PDF Splitter Pro — UI/UX Yenileme Görev Listesi

> Bu dosya, uygulayıcı AI modeline (Composer / Grok vb.) verilecek iş listesidir.
> Görevleri sırayla yap, her görevin sonundaki **Kabul Kriterleri**ni sağlamadan sonrakine geçme.
> **İş mantığını (backend split/PDF işleme) BOZMA** — sadece belirtilen yeni endpoint'leri ekle.

---

## 0. Proje Bağlamı (önce oku)

### Mimari
- **Backend:** FastAPI + PyMuPDF — `backend/app/` (port 8001). PDF açma, thumbnail/önizleme render, sayfa aralığı veya "sepet" (seçili sayfa kümesi) ile parçalama.
- **Frontend:** React 18 + Vite + Tailwind 3 + TypeScript — `frontend/src/` (port 5173, `/api` proxy'si 8001'e gider).
- **Tek kullanıcılı yerel masaüstü aracı.** UI dili **Türkçe**. Dark mode YOK, eklenmeyecek.

### Çalıştırma
```powershell
# proje kökünde
.\start.ps1          # backend + frontend + tarayıcı
# veya manuel:
.\.venv\Scripts\python.exe -m uvicorn backend.app.main:app --port 8001 --reload
cd frontend; npm run dev
```

### Mevcut tasarım sistemi (KORU ve üzerine inşa et)
- Font: **Geist** (yerel `frontend/public/fonts/*.woff2`, `@font-face` ile `tailwind.css`'te tanımlı)
- Accent renk: **emerald** (`accent-*` scale `tailwind.config.js`'te tanımlı), base: slate
- Primitives: `frontend/src/components/ui/{Button,Input,Card,Spinner}.tsx` — yeni UI bunları kullanmalı
- `prefers-reduced-motion` desteği `tailwind.css`'te var — tüm yeni animasyonlar buna uymalı

### Dosya haritası
| Dosya | Rol |
|---|---|
| `frontend/src/pages/Dashboard.tsx` | Ana sayfa/orkestrasyon (state, API çağrıları, layout) |
| `frontend/src/components/SplitForm.tsx` | Parçalama formu (aralık/sepet modu, validasyon) |
| `frontend/src/components/ThumbGrid.tsx` | Sanallaştırılmış (virtualized) thumbnail grid — **sanallaştırmayı bozma** |
| `frontend/src/components/PagePreview.tsx` | Büyük sayfa önizleme (zoom/döndür/pan) |
| `frontend/src/components/Toasts.tsx` | Bildirimler |
| `frontend/src/api/client.ts` | fetch sarmalayıcıları |
| `backend/app/api/routes_system.py` | pick-folder, pick-pdf, scan-output |
| `backend/app/api/routes_pdf.py` | open, thumb, image, split |
| `backend/app/services/pdf_service.py` | PDF iş mantığı — **DOKUNMA** |

### Genel kurallar
- TypeScript strict; `npm run build` hatasız geçmeli.
- Yeni bağımlılık eklemeden önce CSS/Tailwind ile çözülebiliyor mu diye düşün. Animasyon için `framer-motion` eklenebilir (tek izinli yeni bağımlılık).
- Animasyonlar sadece `transform` + `opacity` kullanmalı (zayıf PC'lerde 60fps). Süreler 150–300ms.
- Her görevden sonra `npm run build` çalıştır, hata varsa düzelt.

---

## GÖREV 1 — Tek ekran yerleşimi (scroll derdini bitir) — ÖNCELİK: KRİTİK

**Sorun:** PDF seçildikten sonra parçalama formu preview'in ALTINDA kalıyor; kullanıcı sürekli mouse tekerleğiyle aşağı kaydırmak zorunda. Her şey tek ekrana sığmalı.

**Yapılacak — `Dashboard.tsx` yerleşimini yeniden kur:**
1. Uygulama `h-screen` (100vh) olacak, **sayfa scroll'u tamamen kalkacak** (`body` scroll yok; sadece iç paneller kendi içinde scroll eder).
2. Yeni yerleşim (desktop, `lg:` ve üstü) — 3 sütun:
   - **Sol (≈%30):** ThumbGrid — kendi içinde scroll (zaten öyle).
   - **Orta (≈%40):** PagePreview — kalan yüksekliği doldurur, kendi içinde scroll/pan.
   - **Sağ (≈%30):** SplitForm + İşlem Geçmişi — bu sütun kendi içinde scroll eder (`overflow-y-auto`).
3. Üst bar (header) incelecek: tek satır — logo/başlık solda, dosya adı + sayfa sayısı ortada, "PDF Seç" butonu sağda. Maks yükseklik ~56px.
4. `lg` altındaki ekranlarda mevcut stack (alt alta) düzeni kalsın; orada sayfa scroll'una izin ver.
5. SplitForm'u kompaktlaştır: bölüm başlıklarını küçült, alan aralıklarını sıkılaştır (`gap-2`), "İşlem Geçmişi"ni varsayılan **katlanmış (collapsible)** yap — başlığa tıklayınca açılır.

**Kabul Kriterleri:**
- [ ] 1920×1080 ve 1366×768'de PDF açıkken **hiçbir sayfa scroll'u yok**; form, preview ve thumb'lar aynı anda görünür.
- [ ] Form alanlarının tamamına (sağ sütun içi scroll ile) erişilebiliyor.
- [ ] Thumbnail sanallaştırması hâlâ çalışıyor (1000+ sayfalı PDF'te akıcı).

---

## GÖREV 2 — Sürükle-bırak PDF açma + boş durum ekranı — ÖNCELİK: YÜKSEK

**Sorun:** PDF seçmek ayrı bir pencere (dosya diyaloğu) açıyor. Her şey tek sayfada olmalı.

**Yapılacak:**
1. PDF seçilmemişken tüm içerik alanı büyük bir **drop zone** olsun: "PDF'i buraya sürükleyip bırakın **veya** tıklayıp seçin".
   - `dragover` durumunda kenarlık accent renge döner + hafif scale animasyonu.
   - Tıklanınca mevcut gizli `<input type="file">` tetiklenir (dosya diyaloğu tamamen kaldırılamaz — tarayıcı kısıtı; ama artık tek tık yerine sürükle-bırak da çalışır).
2. PDF açıkken de pencereye dosya sürüklenirse yakala: yarı saydam overlay göster ("Bırak → yeni PDF açılır"), bırakınca yeni PDF açılır.
3. Sadece `.pdf` kabul et; başka tür bırakılırsa hata toast'u göster.
4. Yükleme sırasında drop zone içinde spinner + "Açılıyor…" göster; büyük dosyada kullanıcı bekletildiğini anlamalı.

**Kabul Kriterleri:**
- [ ] Boş durumda sürükle-bırak ile PDF açılıyor.
- [ ] PDF açıkken sürükle-bırak ile yeni PDF'e geçiliyor.
- [ ] PDF olmayan dosyada Türkçe hata toast'u: "Sadece PDF dosyaları desteklenir."

---

## GÖREV 3 — Görsel kimlik: arka plan efekti + profesyonel animasyonlar — ÖNCELİK: YÜKSEK

**Sorun:** Ekranda hiç arka plan efekti yok, eğlenceli değil, profesyonel durmuyor.

**Yapılacak:**
1. **Arka plan:** Düz `bg-slate-50` yerine çok hafif bir degrade/mesh:
   - Üst köşelerden yayılan iki yumuşak radyal leke (emerald %4–6 opaklık + slate-200), `body`/kök div'de sabit (`fixed`, `pointer-events-none`). CSS ile; canvas/JS animasyonu YOK (performans).
   - İnce bir grid/dot deseni ekleyebilirsin (opaklık ≤ %3).
2. **Giriş animasyonları:** PDF açıldığında paneller (thumb/preview/form) 200ms stagger ile fade+slide-up. `framer-motion` kullanabilirsin ya da CSS `animation-delay`.
3. **Mikro-etkileşimler:**
   - Butonlarda `hover` hafif parlaklık + `active:scale-[0.98]`.
   - Thumbnail seçiminde seçili çerçeve yumuşak geçiş (150ms).
   - Sepete sayfa ekle/çıkar: chip 150ms scale+fade ile girer/çıkar.
   - "Kes ve Kaydet" başarılı olunca butonda kısa ✓ animasyonu (500ms) sonra normale döner.
   - Toast'lar sağdan kayarak girer, yukarı kayıp solarak çıkar (çıkış animasyonu şu an yok — ekle).
4. **Sayısal geri bildirim:** Split sırasında form üstünde ilerleme hissi ver (belirsiz progress bar — üstte ince accent şerit).
5. Tümü `prefers-reduced-motion: reduce`'da kapanmalı (mevcut CSS kuralı bunu genel olarak hallediyor; test et).

**Kabul Kriterleri:**
- [ ] Arka plan degrade görünür ama okumayı bozmaz (metin kontrastı WCAG AA kalır).
- [ ] PDF açılış stagger animasyonu ve toast çıkış animasyonu çalışıyor.
- [ ] Eski bir PC senaryosu: animasyonlar yalnızca transform/opacity kullanıyor (DevTools > Rendering > Paint flashing ile büyük repaint olmadığını doğrula).

---

## GÖREV 4 — Sepet "Geri Al" (undo) — ÖNCELİK: YÜKSEK

**Sorun:** Sepete yanlış sayfa ekleyince tek tek bulup çıkarmak gerekiyor; geri al butonu yok.

**Yapılacak — `Dashboard.tsx` + `SplitForm.tsx`:**
1. Sepet değişiklikleri için **undo yığını** tut (son 20 işlem): her ekleme/çıkarma/boşaltma bir kayıt (`önceki dizi` sakla — sayfa dizileri küçük, kopya ucuz).
2. Sepet panelinde **"Geri Al"** butonu (`↩ Geri Al` — `Ctrl+Z` kısayolu da çalışsın, yalnızca sepet modundayken ve odak bir input'ta değilken).
3. "Sepeti Boşalt" da geri alınabilir olmalı (boşaltmadan önceki dizi yığına girer).
4. Buton, yığın boşken disabled.
5. Toast gerekmiyor; buton yeterli. Ama boşaltma sonrası ilk 5 sn "Geri Al" butonunu vurgula (pulse animasyonu 1 kez).

**Kabul Kriterleri:**
- [ ] Ekle → Geri Al → sayfa sepetten çıkıyor. Çıkar → Geri Al → geri geliyor. Boşalt → Geri Al → tüm liste geri geliyor.
- [ ] `Ctrl+Z` input odaklı değilken çalışıyor, input'ta yazarken çalışmıyor (metin undo'sunu bozmamalı).
- [ ] Yeni PDF açılınca undo yığını sıfırlanıyor.

---

## GÖREV 5 — Son işlemi geri al: çıktı dosyasını diskten sil — ÖNCELİK: KRİTİK

**Sorun:** Yanlış kesip kaydedince dosyayı elle bulup silmek gerekiyor. Geçmişten "sil" yapılabilmeli.

### 5a. Backend — yeni endpoint (`routes_system.py`)
`POST /api/system/delete-output` — body: `{ "outputDir": string, "filename": string }`

**Güvenlik kuralları (hepsi zorunlu):**
1. `outputDir` mevcut `normalize_output_dir()` ile doğrulanır.
2. `filename` yol ayracı içeremez (`/`, `\`, `..`) — sadece dosya adı.
3. Dosya adı `bolum_\d{3}_sayfa_.+\.pdf` desenine uymak ZORUNDA (uygulamanın kendi ürettiği dosyalar dışında hiçbir şey silinemez).
4. Hedef `outputDir` içinde olmalı (`resolve()` sonrası `parent` kontrolü).
5. Dosya yoksa 404 (`{"detail": "Dosya bulunamadı: <ad>"}`); silme başarılıysa `{"ok": true}`.
6. Hata mesajları Türkçe, mevcut 422/404/500 desenini izle.

### 5b. Frontend — İşlem Geçmişi satırına "Sil" butonu
1. Her geçmiş kaydına kırmızı **"Sil"** butonu (danger variant).
2. Tıklanınca inline onay: buton "Emin misin?" olur, 3 sn içinde tekrar tıklanırsa siler, süre geçerse eski haline döner (ayrı modal AÇMA — tek sayfa felsefesi).
3. Silme başarılı → kayıt geçmişten düşer, success toast: "Silindi: <dosya>", ve **çıktı klasörü hemen yeniden taranır** (`scan-output`) → "Yapıldı" rozetleri anında güncellenir.
4. Silme hatası → error toast (backend'in detail mesajı).

**Kabul Kriterleri:**
- [ ] Geçmişten silinen dosya diskten gerçekten siliniyor; thumb'lardaki "Yapıldı" rozeti aynı anda kalkıyor.
- [ ] `filename` alanına `..\..\x.pdf` gibi değerle istek atılırsa 422 dönüyor (curl/Invoke-RestMethod ile test et).
- [ ] Desene uymayan dosya adı (ör. `rapor.pdf`) 422 dönüyor.

---

## GÖREV 6 — Canlı güncelleme: çıktı klasörünü otomatik izle — ÖNCELİK: YÜKSEK

**Sorun:** Kullanıcı çıktı klasöründen elle dosya silince UI güncellenmiyor; "Yapıldı" rozetleri bayat kalıyor.

**Yapılacak — polling yaklaşımı (dosya sistemi izleyici EKLEME, basit tut):**
1. `Dashboard.tsx` içinde: `outputDir` doluyken **5 saniyede bir** `scan-output` çağır (`setInterval`; `outputDir` değişince/boşalınca temizle).
2. Sekme görünür değilken durdur (`document.visibilityState !== 'visible'` → atla); pencere odağa gelince (`focus`/`visibilitychange`) hemen bir kez tara.
3. Sonuç mevcut `donePages` ile aynıysa state'i GÜNCELLEME (gereksiz re-render önle — Set karşılaştırması yap).
4. Tarama sonucu değiştiyse sessizce güncelle (toast gösterme; sadece hata durumunda mevcut hata toast'u kalsın ama **aynı hata üst üste spam olmasın** — son hata mesajını hatırla, aynıysa tekrar gösterme).
5. Otomatik `sectionNo`/`startPage` önerme mantığını polling SIRASINDA tetikleme (yalnızca mevcut koşullarda, kullanıcı formla oynamıyorken; mevcut guard'lar korunmalı).

**Kabul Kriterleri:**
- [ ] Çıktı klasöründen Explorer ile dosya silinince ≤5 sn içinde "Yapıldı" rozetleri güncelleniyor.
- [ ] Sekme arka plandayken istek atılmıyor (Network sekmesinden doğrula).
- [ ] Kullanıcı formu doldururken polling formdaki değerleri EZMİYOR.

---

## GÖREV 7 — Genel kullanılabilirlik cilası — ÖNCELİK: ORTA

1. **Klavye gezinme:** Thumb grid'de `↑↓←→` ile sayfa seçimi, `Enter`/`Space` sepete ekle/çıkar (sepet modunda). Seçili thumb görünür alana `scrollIntoView({block:'nearest'})` ile gelsin.
2. **Sayfa atlama kutusu:** Preview başlığına "Sayfa: [input] / N" — numara yazıp Enter'a basınca o sayfaya git.
3. **Zoom:** `Ctrl + mouse tekerleği` ile preview zoom (mevcut +/- butonları kalsın).
4. **Tooltip'ler:** Disabled butonlara neden disabled olduğunu söyleyen `title` (örn. "Önce bitiş sayfası girin").
5. **Boş çıktı klasörü uyarısı:** Form gönderilirken klasör seçilmemişse hedef klasör alanına odaklan + alanı kısa süre vurgula (shake YOK; ring pulse yeterli).
6. **Buton metinleri:** "Kes ve Kaydet" işlemi sürerken "Kaydediliyor…" yazsın.

**Kabul Kriterleri:**
- [ ] Klavyeyle sayfa gezme + sepete ekleme fare olmadan yapılabiliyor.
- [ ] Sayfa atlama kutusu sınır dışı değerde (0, N+1) kırmızı ring gösterip değeri kabul etmiyor.

---

## Yapma / Dokunma listesi
- `backend/app/services/pdf_service.py` — iş mantığına dokunma (GÖREV 5a yalnızca `routes_system.py`'ye eklenir; gerekirse `storage_service.py`'ye küçük yardımcı eklenebilir).
- Dosya adı üretim düzeni (`bolum_XXX_sayfa_...`) değişmeyecek — `scan-output` ve EXE dağıtımı buna bağlı.
- ThumbGrid sanallaştırma mimarisi (translateY pencereleme) korunacak.
- Dark mode, routing, i18n, yeni sayfa EKLEME.
- Mevcut API sözleşmelerini değiştirme; sadece yeni endpoint ekle.

## Her görev sonunda
1. `cd frontend && npm run build` → hatasız.
2. Backend değiştiyse: `.venv\Scripts\python.exe -m uvicorn backend.app.main:app --port 8001` ayağa kalkıyor mu kontrol et.
3. Elle duman testi: PDF aç → aralık kes → sepet kes → geçmişten sil → klasörden elle sil → rozetler güncellensin.
4. Kısa değişiklik özeti yaz (ne değişti, hangi dosyalar).

## Önerilen sıra
GÖREV 1 → 2 → 5 → 6 → 4 → 3 → 7
(Önce yerleşim ve fonksiyonel eksikler, görsel cila en sona değil ortaya alındı çünkü 3, 1–2'nin yeni yerleşimi üzerine kurulur; 7 en son.)
