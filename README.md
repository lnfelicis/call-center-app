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

## Geliştirme Ortamını Başlatma

Server:

```bash
pnpm dev:server
```

Client:

```bash
pnpm dev:client
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
