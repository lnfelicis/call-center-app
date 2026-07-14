# Davranış Korumalı Node.js/Express/TypeScript Refactor Planı

## Özet ve değişmez sözleşme

Mevcut backend TypeScript `strict` kontrolünden geçiyor; ancak test altyapısı bulunmuyor, uygulama oluşturma ile sunucuyu başlatma iç içe ve 44 API endpoint’i ile `/health` ağırlıklı olarak büyük route dosyalarında SQL, HTTP ve iş mantığını birlikte barındırıyor.

Hedef; skill yönlendirmesine uygun feature-first katmanlaşma, explicit dependency injection, merkezi hata yönetimi, test edilebilir uygulama fabrikası ve güvenli lifecycle yönetimi oluşturmaktır.

Refactor boyunca aşağıdakiler birebir korunacak:

- Tüm method/path’ler, route mount ve middleware sırası.
- Status kodları, JSON alanları ve Türkçe mesajlar.
- Varsayılan Express 404’ü ve beklenmeyen hatalardaki mevcut `500 {"message":"Beklenmeyen bir hata oluştu."}` cevabı.
- Input coercion, validation sırası ve `Boolean`, `String`, `Number` gibi mevcut dönüşüm ayrıntıları.
- Token algoritması, IP kontrolü, her istekte güncellenen RBAC izinleri ve permission kombinasyonları.
- SQL filtreleri, parametre sırası, sıralama, limit, maskeleme ve rapor scope’u.
- Audit, event ve notification içerikleri; çağrılma sıraları ve hata yayılımı.
- Mevcut transaction sınırları ve kısmi başarı davranışları.

Dış HTTP API’sinde, veritabanı şemasında ve client sözleşmelerinde değişiklik yapılmayacak.

## Kademeli uygulama

1. **Golden-master test bariyeri**

   - `Vitest`, `Supertest`, `@vitest/coverage-v8` ve gerekli tip paketleri eklenecek; `test`, `test:unit`, `test:integration` ve `test:coverage` script’leri tanımlanacak.
   - Seçilen yaklaşıma göre `call_center_app_test` benzeri ayrı MySQL şeması kullanılacak. Test başlangıcı, `DB_NAME` değeri `_test` ile bitmiyorsa destructive setup/reset işlemini kesin olarak durduracak.
   - İlk contract suite, production koduna dokunmadan mevcut `index.ts` sürecini boş bir portta child process olarak başlatacak ve Supertest’i URL üzerinden çalıştıracak.
   - Şema her suite başında yeniden oluşturulacak; testler paralel çalıştırılmayacak, her test öncesinde FK-safe truncate ve sabit ID’li fixture seed uygulanacak.
   - Normal `server/.env` testler tarafından kullanılmayacak; örnek test ayarları ayrı `.env.test.example` içinde belgelenecek.

2. **Test edilebilir bootstrap ve altyapı sınırı**

   - `createApp(dependencies): Express` yalnız Express uygulamasını oluşturacak; listener açmayacak.
   - `composition/app-routers.ts` explicit dependency wiring noktası olacak; `bootstrap.ts` aynı port fallback’i ve `0.0.0.0` host’u ile sunucuyu başlatacak, `index.ts` yalnız production env yükleyip bootstrap’ı çağıracak.
   - Config tek modülde toplanacak ancak bütün mevcut env coercion/default davranışları korunacak.
   - Global DB singleton yerine aynı pool ayarlarını kullanan `createPool(config)` fabrikası ve dar `Database`/`TransactionConnection` arayüzleri kullanılacak.
   - `SIGINT`/`SIGTERM` sırasında HTTP server kapatılacak, ardından pool sonlandırılacak; varsayılan kapanış timeout’u 10 saniye olacak.
   - Pino tabanlı, body/query/token kaydetmeyen yapılandırılmış runtime loglama eklenecek. Veritabanındaki audit kayıtları bununla birleştirilmeyecek veya değiştirilmeyecek.
   - CORS, JSON parser limiti, Render `trust proxy`, health route’u, route sırası ve default 404 aynen kalacak.

3. **Onaylanan ayrı transaction düzeltmesi**

   - `PATCH /settings` için önce tüm field kayıtları, ardından option kayıtları mevcut hata önceliğiyle doğrulanacak; ancak doğrulama tamamlanmadan connection/transaction açılmayacak.
   - Geçersiz payload yine aynı `400` ve aynı gövdeyi döndürecek.
   - Regression testi; hiçbir değişikliğin commit edilmediğini ve havuza açık transaction dönmediğini doğrulayacak.
   - Bu düzeltme domain refactor’ından ayrı commit edilecek; başka mevcut davranış düzeltmesi bu kapsamda yapılmayacak.

4. **Feature-first katmanlaşma**

   Her modül `routes/controller → service/use-case → repository` yapısına ayrılacak:

   - Controller: mevcut input coercion, exact status ve response gövdesi.
   - Service: iş kararları ve mevcut audit/event/notification çağrı sırası.
   - Repository: mevcut MySQL SQL’i, parametre sırası, sort/limit ve transaction sınırı.
   - Mapper/policy: snake_case–camelCase dönüşümleri, maskeleme, scope, validation ve normalizasyon gibi saf fonksiyonlar.

   Ağır bir DI container kullanılmayacak. Router fabrikaları; service, audit, notification, logger, clock, UUID üreticisi, token servisi ve report exporter bağımlılıklarını açıkça alacak.

   Dönüşüm sırası:

   1. Auth, audit, users, roles, admin ve logs.
   2. Settings, legacy call-option endpoint’leri ve notifications.
   3. Calls: listeleme, oluşturma, eşleştirme, detay, güncelleme, not, atama, status, resolve ve reopen.
   4. Reports: filtreler, search, özetler, Excel/PDF export.
   5. Setup orchestration ve son TypeScript sıkılaştırması.

   Yalnız gerçekten aynı davranıştaki mapper/helper’lar ortaklaştırılacak. Özellikle:

   - Call ekranı ile report maskeleme politikaları ayrı kalacak.
   - `/call-options` ve `/settings/options` arasındaki type ve boolean farklılıkları korunacak.
   - Report summary/staff/categories global; search/export kullanıcı scope’lu kalacak.
   - Auth/permission verileri cache’lenmeyecek.
   - Notification üretimi `GET /notifications` içinde ve await edilen yan etki olarak kalacak.
   - Yeni transaction eklenmeyecek; audit/notification mevcut transaction’lara alınmayacak.

5. **Setup ve TypeScript düzenlemesi**

   - Setup kodu import edildiğinde çalışmayan `runSetup(dependencies, config)` fonksiyonuna ve mevcut CLI davranışını koruyan ince bir wrapper’a ayrılacak.
   - Şema/seed SQL’i, çalışma sırası, sabit kayıtlar ve CLI çıktıları korunacak.
   - Sürümlemeli migration, ORM veya şema değişikliği bu refactor’a eklenmeyecek.
   - Son aşamada `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` ve `noEmitOnError` tek tek açılacak; her bayraktan sonra tam contract suite çalıştırılacak.

## İç arayüz değişiklikleri

Dış API değişmeyecek. Yeni iç arayüzler şunlar olacak:

- `AppConfig`: mevcut env değerlerinin typed karşılığı.
- `AppDependencies`: config, database, logger, clock ve modül router’ları.
- `Database` ve `TransactionConnection`: kullanılan `query`, `getConnection`, `commit`, `rollback`, `release`, `end` yetenekleri.
- `Clock`, `IdGenerator`, `TokenService`, `ReportExporter`, `AuditWriter` ve `NotificationPublisher`.
- `HttpError(status, body)`: yalnız mevcut bilinen HTTP hatalarını taşır; body `{message}` veya IP reddinde mevcut `{code,message}` şeklinde kalır.
- Express request type augmentation ile `req.user`; dış `AuthUser` şekli değişmez.

Express 5’in native async error propagation özelliği kullanılacak; ek async-wrapper veya `express-async-errors` eklenmeyecek.

## Test planı ve kabul kapıları

| Alan | Zorunlu senaryolar |
|---|---|
| Uygulama sözleşmesi | 44 API endpoint’i ve `/health` için method/path manifesti; CORS, JSON parser, Render proxy, default 404, malformed JSON/oversized body’nin mevcut generic 500 cevabı, response key seti ve key sırası |
| Auth/RBAC | Username/e-posta login, trim davranışı, yanlış parola sayacı ve 423 kilit, pasif kullanıcı/rol, IP allowlist, token süre/imza/tamper/expiry, malformed payload’ın mevcut sonucu, exact 401/403 gövdeleri, bütün OR-permission kombinasyonları |
| Users/Roles/Admin/Logs | Liste sıraları ve DTO’lar; password mesaj sırası; duplicate/FK hatalarının generic 500 kalması; `Boolean("false")` davranışı; role transaction rollback; audit hatası sonrasında ana mutation’ın kalıcı olması; dashboard global metric ve limitleri |
| Calls/Options/Settings | Own/all/assigned/create-only görünürlük matrisi; dinamik required/editable/masked alanlar; TC/telefon kontrolleri; warning’ler; match önceliği; option endpoint farkları; locked kayıtlar; note permission matrisi; assign/status/resolve/reopen yan etkileri ve mevcut tekrarlı işlem davranışları |
| Reports/Exports | Tüm query filtreleri, geçersiz tarih ve `all` davranışı, SLA dalları, global ve scoped rapor farkı, field ayarından bağımsız report masking, 200/1000 limitleri, Excel içeriğinin parse edilmesi, PDF `%PDF` doğrulaması, MIME/filename/base64 ve audit metadata |
| Notifications/Audit | Panel/e-posta channel matrisi, recipient dedupe, follow-up/stale üretimi, tekrar GET, unread-first sıralama ve limit 100; actor/IP/user-agent/metadata; audit/notification failure propagation |
| DB ve orchestration | Gerçek MySQL ile enum/FK/JSON/`INSERT IGNORE`/`affectedRows`; unit testlerde fake bağımlılıklarla exact çağrı sırası; mevcut partial-write davranışları; commit/rollback/release sırası; setup’ın iki kez çalışması |

Ek test ilkeleri:

- Unit testler saf mapper, normalizer, authorization policy, query builder ve service orkestrasyonuna odaklanacak.
- API/integration testleri gerçek ayrı MySQL şemasında çalışacak; SQLite veya yalnız DB mock’u kullanılmayacak.
- Exact response kontrolleri `toStrictEqual` ve `Object.keys` ile yapılacak; UUID, token ve tarih gibi dinamik değerler pattern ve DB ilişkisiyle doğrulanacak.
- Export binary’leri kırılgan byte snapshot yerine semantik olarak parse edilecek.
- Genel final coverage kapısı lines/statements/functions için `%85`, branches için `%80`; security, IP, authorization ve transaction helper’larında branch coverage `%100` olacak.
- Her kademeli değişiklikte tüm contract suite yeniden çalışacak; beklenen fixture çıktısındaki değişiklik refactor içinde kabul edilmeyecek.

Son doğrulama komutları:

- `pnpm --filter server test:unit`
- `pnpm --filter server test:integration`
- `pnpm --filter server test:coverage`
- `pnpm --filter server build`
- `pnpm --filter client build`
- `pnpm --filter client lint`

## Varsayımlar ve kapsam dışı değişiklikler

- Entegrasyon testleri için seçilen ayrı MySQL test şeması kullanılacak.
- Refactor seçildiği gibi küçük, geri alınabilir domain dilimleriyle teslim edilecek.
- Zod/Joi ile yeni runtime validation, standart response envelope, yeni HTTP error mapping, JWT kütüphanesine geçiş, token revocation, auth cache, rate limit, Helmet, compression, CORS daraltma, export streaming, background job ve versioned migration kapsam dışıdır.
- Mevcut secret fallback’i, setup davranışı, duplicate/FK hatalarının 500 olması, notification read yan etkisi, resolve/reopen ayrıntıları ve audit sonrası kısmi başarılar ayrıca onaylanmış bir davranış değişikliği olmadan düzeltilmeyecek.
