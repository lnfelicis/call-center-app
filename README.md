# Call Center App

Çağrı kayıtları, rol/yetki yönetimi, ayarlar, log kayıtları ve yönetim paneli içeren full-stack uygulama.

## Gereksinimler

- Node.js
- pnpm `11.9.0`
- MySQL

Pnpm yoksa:

```bash
npm install -g pnpm
```

## Kurulum

Proje ana dizininde bağımlılıkları yükleyin:

```bash
pnpm install
```

## Ortam Değişkenleri

### Server

`server/.env.example` dosyasını `server/.env` olarak kopyalayın:

```bash
cp server/.env.example server/.env
```

Windows PowerShell için:

```powershell
Copy-Item server/.env.example server/.env
```

`server/.env` içeriğini kendi MySQL bilgilerinize göre düzenleyin:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=call_center_app
AUTH_TOKEN_SECRET=change-this-secret
SUPER_ADMIN_USERNAME=superadmin
SUPER_ADMIN_FULL_NAME=Süper Admin
SUPER_ADMIN_EMAIL=superadmin@example.com
SUPER_ADMIN_PASSWORD=Admin12345!
```

### Client

`client/.env` dosyası oluşturun:

```env
VITE_API_URL=http://localhost:3000
```

Aynı ağdaki başka cihazlardan erişilecekse `localhost` yerine sunucuyu çalıştıran bilgisayarın yerel IP adresini yazın:

```env
VITE_API_URL=http://192.168.1.195:3000
```

## Veritabanı Kurulumu

MySQL çalışır durumdayken server setup komutunu çalıştırın:

```bash
pnpm --filter server run setup
```

Bu komut:

- Veritabanını oluşturur.
- Tabloları ve başlangıç verilerini hazırlar.
- Süper Admin rolünü ve kullanıcıyı seed eder.

Varsayılan giriş bilgileri `.env` dosyasındaki `SUPER_ADMIN_*` değerlerinden gelir.

Test veritabanını manuel olarak hazırlamak için yalnızca `server/.env.test`
dosyasını okuyan güvenli setup komutunu kullanın:

```bash
pnpm --filter server setup:test
```

Bu komut `DB_NAME` değerinin `_test` ile bitmesini ve yalnızca harf, rakam ile
alt çizgi içermesini zorunlu tutar. Kontrol, herhangi bir MySQL bağlantısı
kurulmadan önce yapılır; normal `server/.env` dosyası fallback olarak okunmaz.

## Geliştirme Ortamını Başlatma

Server:

```bash
pnpm dev:server
```

Client:

```bash
pnpm dev:client
```

Paralel:

```bash
pnpm dev
```

Varsayılan adresler:

- Client: `http://localhost:5173`
- Server API: `http://localhost:3000`

## Build ve Kontroller

Client build:

```bash
pnpm --filter client build
```

Server build:

```bash
pnpm --filter server build
```

Client lint:

```bash
pnpm --filter client lint
```

## Backend Testleri

Unit ve HTTP contract testleri veritabanı gerektirmez:

```bash
pnpm --filter server test:unit
```

Unit testler; policy, mapper, service/controller orkestrasyonu, coercion, yetki,
transaction ve yan etki sırasını fake bağımlılıklarla hızlı biçimde doğrular.

Entegrasyon testleri gerçek MySQL davranışını doğrulamak için yalnızca ayrı bir test
şemasında çalışır. Önce `server/.env.test.example` dosyasını `server/.env.test`
olarak kopyalayıp test bağlantı bilgilerini düzenleyin. `DB_NAME` güvenlik nedeniyle
mutlaka `_test` ile bitmelidir; aksi durumda destructive reset engellenir. Normal
`server/.env` testler tarafından yüklenmez.

```bash
pnpm --filter server test:integration
```

Entegrasyon testleri; gerçek HTTP middleware zinciri, MySQL SQL/FK/transaction
davranışı, setup idempotency, auth lockout, settings transaction regresyonu,
notification yan etkileri ve audit kayıtlarını kapsar. `.env.test` yoksa bu suite
güvenli biçimde skip edilir.

Coverage ve tam backend doğrulaması:

```bash
pnpm --filter server test:coverage
pnpm --filter server test:typecheck
pnpm --filter server build
```

Backend kaynakları feature-first olarak `server/src/modules/<feature>/` altında
routes/controller, service, repository ve gerektiğinde policy/mapper katmanlarına
ayrılmıştır. `server/src/app.ts` listener açmadan Express uygulamasını üretir;
`server/src/composition/app-routers.ts` ortak bağımlılıkları type-safe feature
factory'lerine bağlar. Production MySQL pool'u `server/src/bootstrap.ts` tarafından
oluşturulur ve graceful shutdown sırasında aynı pool kapatılır. `server/src/index.ts`
yalnız production ortamını yükleyip bootstrap katmanını başlatır.

## Production Çalıştırma

Önce server build alın:

```bash
pnpm --filter server build
```

Sonra server uygulamasını başlatın:

```bash
pnpm --filter server start
```

Client için production build:

```bash
pnpm --filter client build
```

Build çıktısı `client/dist` dizinine yazılır.

### Render üzerinde gerçek istemci IP adresi

Backend Render Web Service olarak çalıştığında Render'ın otomatik sağladığı
`RENDER=true` ortam değişkeni algılanır. Express, Render proxy zincirine güvenerek
loglar ile çağrı kayıtlarında gerçek istemci IP adresini kullanır. Ek bir ortam
değişkeni tanımlamanız gerekmez; yerel geliştirmede proxy güveni kapalı kalır.

IP izin listesi etkinse yalnızca giriş sırasında değil, her korumalı API isteğinde
yeniden kontrol edilir. Açık bir oturum izin verilmeyen bir IP'ye geçerse istemci ilk
API isteğinde veya en geç 60 saniyelik oturum kontrolünde otomatik olarak çıkış yapar.
Oturum token'ı giriş yapılan IP adresine bağlıdır; bu adres izin listesinden
çıkarıldığında token başka bir istek IP'si raporlansa bile geçersiz sayılır.
