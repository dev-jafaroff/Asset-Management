# Asset Management Sistemi — İş Planı

Oct 12, 2026 · @Babek Cafarov

## Məqsəd və əhatə dairəsi

Snipe-IT-i şirkətin ehtiyacına uyğun, sadə və kompakt daxili sistemlə əvəz etmək. Sistem Microsoft hesabı ilə giriş, Intune-dan avtomatik cihaz sinxronizasiyası və mövcud QR etiketlərin işləməyə davam etməsini təmin etməlidir.

**MVP-yə daxildir:**

- Microsoft Entra ID ilə SSO və Entra qruplarına əsasən rollar
- Asset-lər: yaratma, redaktə, siyahı, axtarış, filter
- Checkout / checkin və hər asset-in tam tarixçəsi
- Intune sinxronizasiyası (avtomatik və əl ilə işə salınan)
- Snipe-IT-dən miqrasiya və köhnə QR kodların dəstəyi
- Yeni QR generasiyası, etiket çapı və kamera ilə skan
- CSV export

**MVP-yə daxil deyil (sonraya):** lisenziyalar, aksesuarlar, consumables, komponentlər, audit planlaması, maintenance qeydləri, mobil tətbiq (React Native).

## Texnologiya stack-i

Bütün layihə TypeScript ilə bir Next.js tətbiqində yazılır: frontend və API eyni yerdə, hər şey Azure-da.

| Sahə | Seçim | Səbəb |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | React bilikləriniz birbaşa işə yarayır, API ayrıca server tələb etmir |
| UI | Tailwind CSS + shadcn/ui | Sürətli, səliqəli, tam idarə olunan komponentlər |
| Cədvəllər | TanStack Table | Sorting, filter, pagination hazır |
| Formlar | React Hook Form + Zod | Validasiya həm formda, həm API-də eyni sxemlə |
| Baza | PostgreSQL | Əlaqəli data üçün ideal, Azure-da managed xidmət var |
| ORM | Prisma | Tipli sorğular, migration-lar |
| Auth | Auth.js + Microsoft Entra ID provider | SSO və qrup əsaslı rollar |
| Intune | Microsoft Graph API (client credentials) | Fon sync, istifadəçi login olmadan |
| QR | `qrcode` (yaratma), `html5-qrcode` (skan) | Yüngül və brauzerdə işləyir |
| Repo və CI/CD | Azure DevOps Repos + Pipelines | Korporativ nəzarət, Azure-a birbaşa deploy |
| Hosting | Azure App Service + Azure Database for PostgreSQL | Entra ilə eyni ekosistem |
| Secret-lər | Azure Key Vault | Client secret-lər kodda saxlanılmır |
| Lokal mühit | Docker (PostgreSQL) | Komandada eyni mühit |

## Arxitektura və əsas qərarlar

Bütün məntiq bir Next.js tətbiqində işləyir; xaricdə yalnız Entra ID, Graph, PostgreSQL, Key Vault və miqrasiya üçün Snipe-IT var.

&#91;embedded content: Sistem arxitekturası · 1 tətbiq, 5 xarici xidmət\]

Sync job və miqrasiya skripti nəticəni birbaşa PostgreSQL-ə yazır.

- **SSO:** Auth.js + Entra ID provider. Rollar token-dəki `groups` claim-dən oxunur; istifadəçi ilk login-də avtomatik yaradılır.
- **Rollar:** ADMIN hər şeyi, o cümlədən lookup cədvəllərini və sync-i idarə edir; EDITOR asset yaradır, redaktə edir, checkout/checkin edir; VIEWER yalnız baxır.
- **Intune sync:** client credentials ilə Graph. Uyğunlaşdırma normallaşdırılmış serial ilə; Intune-dan silinən cihaz `missingInIntune` olur, silinmir.
- **Sahə bölgüsü:** cihaz adı, OS, son sync tarixi Intune-a məxsusdur və UI-da yalnız oxunur; şirkət, lokasiya, qiymət, qeydlər manual idarə olunur.
- **Köhnə QR:** `/hardware/[id]` route-u `legacySnipeId` ilə asset-i tapıb yeni səhifəyə yönləndirir; köhnə domen saxlanılır və ya yönləndirilir.
- **Yeni QR:** `/a/[assetTag]` — sistemdən asılı olmayan, dəyişməz format.

## Verilənlər bazası modeli

Baza 9 cədvəldən ibarətdir; mərkəzdə `Asset` və onun tarixçəsini saxlayan `AssetEvent` dayanır.

| Cədvəl | Məqsəd | Əsas sahələr |
| --- | --- | --- |
| `Asset` | Hər fiziki cihaz | assetTag (unikal), serial (unikal), name, notes, purchaseCost, purchaseDate, source (MANUAL / INTUNE / SNIPEIT), intuneId, legacySnipeId, lastIntuneSync, missingInIntune, statusId, modelId, companyId, locationId, assignedToId |
| `AssetModel` | Model (HP ProBook 450 G7 və s.) | name, manufacturer, categoryId |
| `Category` | Kateqoriya (Personal Computers və s.) | name |
| `Company` | Şirkət (DRL, eiLink, EIG) | name |
| `Location` | Ofis / otaq | name |
| `StatusLabel` | Status | name, type (DEPLOYABLE / PENDING / UNDEPLOYABLE / ARCHIVED), color |
| `User` | İşçilər | entraObjectId, email, displayName, department, role (ADMIN / EDITOR / VIEWER) |
| `AssetEvent` | Tarixçə (dəyişməz log) | assetId, type (CREATED / UPDATED / CHECKOUT / CHECKIN / SYNC / IMPORTED), actorId, targetUserId, changes (JSON), createdAt |
| `SyncRun` | Intune sync nəticələri | startedAt, finishedAt, created, updated, missing, errors (JSON) |

Əsas qaydalar:

- Asset heç vaxt fiziki silinmir; ARCHIVED statusuna keçir.
- Hər dəyişiklik `AssetEvent`-ə yazılır; tarixçə yalnız əlavə olunur, redaktə edilmir.
- İstifadəçilər ilk login zamanı və ya Graph-dan avtomatik yaradılır; əl ilə user idarəetməsi yoxdur.
- Asset tag formatı mövcud qayda ilə davam edir: `PC-00001`, növbəti nömrə avtomatik verilir.

## Mərhələlər

Layihə 7 mərhələyə bölünür; hər tapşırıq bir Claude Code sessiyası və bir commit-dir. Növbəti mərhələyə yalnız qəbul meyarı ödənəndə keçilir.

### Mərhələ 0 — Qurulum

- [ ] Bir QR etiketi skan et, içindəki formatı qeyd et
- [ ] Azure DevOps-da repo yarat, branch qaydalarını qur (`main` qorunur, PR ilə merge)
- [ ] Next.js + TypeScript + Tailwind + shadcn/ui layihəsi
- [ ] `docker-compose.yml` ilə lokal PostgreSQL
- [ ] Prisma quraşdırılması, ilk boş migration
- [ ] ESLint, Prettier, `.env.example`
- [ ] `CLAUDE.md` və `docs/PLAN.md` fayllarını repo-ya əlavə et

**Qəbul meyarı:** `npm run dev` işləyir, baza qoşulur.

### Mərhələ 1 — Baza və giriş

- [ ] Tam Prisma sxemi və migration
- [ ] Seed: statuslar, kateqoriyalar, şirkətlər
- [ ] Entra ID-də App Registration (redirect URI, client secret)
- [ ] Auth.js + Entra ID provider, login səhifəsi
- [ ] Entra qruplarından rolların təyini (ADMIN / EDITOR / VIEWER)
- [ ] Bütün səhifələr və API-lər üçün auth middleware
- [ ] Əsas layout: kompakt sidebar, header, axtarış

**Qəbul meyarı:** Microsoft hesabı ilə giriş işləyir, rol qrupa görə düzgün təyin olunur.

### Mərhələ 2 — Snipe-IT miqrasiyası

- [ ] Snipe-IT-də API token yarat
- [ ] Lookup cədvəllərinin köçürülməsi (model, kateqoriya, şirkət, status, lokasiya)
- [ ] Asset-lərin köçürülməsi, `legacySnipeId` saxlanmaqla
- [ ] Checkin/checkout tarixçəsinin `AssetEvent`-ə köçürülməsi
- [ ] Köhnə QR route-u: `/hardware/[id]` → yeni asset səhifəsi
- [ ] Skripti test bazasında işlət, sayı yoxla (316 asset)

**Qəbul meyarı:** bütün asset-lər köçüb, 5 təsadüfi etiket skan edildikdə düzgün səhifə açılır.

### Mərhələ 3 — Əsas funksiyalar

- [ ] Asset siyahısı: cədvəl, axtarış, filter (status, şirkət, kateqoriya), pagination
- [ ] Asset detal səhifəsi və tarixçə timeline-ı
- [ ] Yaratma və redaktə formu (Intune sahələri yalnız oxunur)
- [ ] Checkout / checkin dialoqları
- [ ] Dashboard: statuslar üzrə saylar
- [ ] Lookup cədvəllərinin idarə səhifəsi (admin)
- [ ] CSV export

**Qəbul meyarı:** Snipe-IT-də gündəlik edilən bütün işlər yeni sistemdə edilə bilir.

### Mərhələ 4 — Intune sinxronizasiyası

- [ ] App Registration-a `DeviceManagementManagedDevices.Read.All` (Application) icazəsi, admin consent
- [ ] Graph client (client credentials, pagination)
- [ ] Sync məntiqi: serial ilə uyğunlaşdırma, yaratma, yeniləmə, `missingInIntune` işarəsi
- [ ] Sahə bölgüsü: texniki sahələr Intune-dan, biznes sahələri manual
- [ ] Intune istifadəçisinin təyinat təklifi kimi göstərilməsi
- [ ] Saatlıq cron job və “İndi sinxronlaşdır” düyməsi
- [ ] Sync loqu səhifəsi (`SyncRun`)

**Qəbul meyarı:** sync iki dəfə ardıcıl işlədildikdə dublikat yaranmır, manual dəyişikliklər itmir.

### Mərhələ 5 — QR

- [ ] Yeni asset-lər üçün QR (`/a/[assetTag]` URL-i)
- [ ] Etiket çapı səhifəsi: seçilmiş asset-lər üçün PDF
- [ ] Kamera ilə skan səhifəsi (həm köhnə, həm yeni format)
- [ ] Skandan sonra sürətli checkin / checkout

**Qəbul meyarı:** telefonla köhnə və yeni etiket skan edilib checkout edilə bilir.

### Mərhələ 6 — Deploy

- [ ] Azure Database for PostgreSQL və App Service
- [ ] Key Vault və App Service-in Managed Identity ilə qoşulması
- [ ] Azure Pipelines: lint, build, migration, deploy
- [ ] Production redirect URI-nin Entra-ya əlavə edilməsi
- [ ] Son miqrasiya, köhnə domenin yeni sistemə yönləndirilməsi
- [ ] Snipe-IT-i bir müddət yalnız oxuma rejimində saxla, sonra söndür

**Qəbul meyarı:** komanda bir həftə yalnız yeni sistemdən istifadə edir və Snipe-IT-ə qayıtmaq ehtiyacı olmur.

## Claude ilə iş qaydası

Kontekst bir dəfə fayllarda yazılır, sessiyalar qısa və bir tapşırıqlıq olur — token qənaətinin əsası budur.

1. Kod yazılması üçün Claude Code istifadə et; çatda fayl copy-paste etmə.
2. Sessiyanı belə başlat: “PLAN.md-dəki Mərhələ N-in növbəti tapşırığını et.”
3. Böyük tapşırıqda əvvəlcə plan mode-da plan istə, təsdiqlə, sonra kod yazdır.
4. Tapşırıq bitəndə test et, commit et, PLAN.md-də checkbox-u işarələ.
5. `/clear` ilə konteksti təmizlə və növbəti tapşırığa keç.
6. Yeni arxitektura qərarı verildikdə onu dərhal CLAUDE.md-yə bir sətirlə əlavə et.
7. Xəta olanda bütün log-u yox, yalnız xəta mesajını və əlaqəli faylın adını ver.

Bu sənədi Markdown kimi export edib repo-ya `docs/PLAN.md` kimi qoymaq olar.

## CLAUDE.md şablonu

Aşağıdakı mətni repo-nun kökündə `CLAUDE.md` kimi saxla; Claude Code onu hər sessiyada avtomatik oxuyur.

```markdown
# Asset Management — Claude üçün kontekst

## Layihə
Daxili IT asset idarəetmə sistemi (Snipe-IT-in əvəzi).
Plan və mərhələlər: docs/PLAN.md

## Stack
Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, TanStack Table,
React Hook Form + Zod, PostgreSQL + Prisma, Auth.js (Entra ID), Microsoft Graph.

## Əmrlər
- npm run dev            — lokal server
- docker compose up -d   — lokal PostgreSQL
- npx prisma migrate dev — migration
- npm run lint

## Struktur
- app/            — səhifələr və route handler-lər
- app/api/        — API
- lib/            — prisma, auth, graph client
- lib/sync/       — Intune sync məntiqi
- scripts/        — Snipe-IT miqrasiyası
- components/     — UI komponentləri

## Qaydalar
- TypeScript strict; any istifadə etmə.
- Validasiya Zod ilə, sxemlər lib/schemas-da.
- Server Actions və ya route handler-lərdə həmişə rol yoxlaması.
- Asset-lər silinmir, ARCHIVED olur.
- Hər dəyişiklik AssetEvent-ə yazılır.
- Secret-lər yalnız .env / Key Vault-da.
- UI mətnləri Azərbaycan dilində.

## Əsas qərarlar
- Köhnə QR formatı: <skan edib bura yaz>
- Köhnə QR route: /hardware/[id] → legacySnipeId ilə axtarış
- Yeni QR: /a/[assetTag]
- Intune uyğunlaşdırma: serialNumber ilə
- Intune-un idarə etdiyi sahələr: name, osVersion, lastIntuneSync (UI-da read-only)
- Rollar: Entra qrupları → ADMIN / EDITOR / VIEWER
```

## Risklər və açıq suallar

Ən böyük risk köhnə QR etiketlərin işləməz qalmasıdır; bu, Mərhələ 0-da yoxlanılır.

| Risk | Təsir | Qarşısının alınması |
| --- | --- | --- |
| QR-da gözləniləndən fərqli format | Etiketlər yenidən çap edilməlidir | İlk iş etiketi skan etmək; route-u ona görə qurmaq |
| Köhnə domen itir | Bütün etiketlər 404 verir | Domeni saxlamaq və ya redirect qurmaq |
| Serial nömrələr Intune və Snipe-IT-də fərqli yazılıb | Dublikat asset-lər | Müqayisədən əvvəl normallaşdırma (böyük hərf, boşluqsuz) |
| Client secret-in müddəti bitir | Sync dayanır | Key Vault-da saxlamaq, bitmə tarixini təqvimə yazmaq; sonra certificate-ə keçmək |
| Layihə uzanır | Snipe-IT ilə paralel iş | Snipe-IT-i son mərhələyə qədər aktiv saxlamaq |

Başlamazdan əvvəl cavab lazım olan suallar:

- [ ] Köhnə QR-ın içində tam olaraq nə yazılıb?
- [ ] Yeni sistem hansı domendə olacaq?
- [ ] Hansı Entra qrupları ADMIN, EDITOR və VIEWER olacaq?
- [ ] Intune-da olmayan cihazlar (monitor, printer) da sistemə daxil ediləcəkmi?
- [ ] Etiket printeri və etiket ölçüsü hansıdır?
