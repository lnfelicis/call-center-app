# Sirket Ici Cagri Kayit ve Yetkilendirme Sistemi Plani

## Proje Ozeti

Bu proje, sirket ici cagri merkezi icin personel paneli, yonetim paneli ve ilerleyen fazda tarayici uzantisi olan rol/izin tabanli bir cagri kayit sistemidir.

Mevcut teknik yapi:

- `client`: React + Vite + Tailwind + shadcn uyumlu UI yapisi
- `server`: Express + TypeScript API
- `database`: MySQL
- `workspace`: pnpm monorepo

Temel urun kurali: Personel varsayilan olarak sadece kendi actigi cagri kayitlarini gorur. Tum kayitlari gorme, kayit duzenleme, not ekleme, cozume alma, rapor alma ve log goruntuleme ayri izinlerdir.

## Faz 1: Temel Altyapi ve Kimlik Dogrulama

Amac: Sistemin guvenli giris, kullanici ve oturum temelini kurmak.

Yapilacaklar:

- MySQL icin migration veya surumlenebilir SQL dosya yapisi kurulacak.
- Kullanici, rol, izin, rol-izin, oturum ve log tablolari tasarlanacak.
- Kullanici girisi, cikisi ve aktif oturum kontrolu uygulanacak.
- Sifre hashleme, aktif/pasif kullanici, son giris tarihi ve hatali giris sayaci eklenecek.
- Backend tarafinda merkezi auth middleware kurulacak.
- Frontend tarafinda giris ekrani ve oturum durumuna gore yonlendirme yapilacak.

Beklenen ciktilar:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- Auth middleware
- Ilk admin kullanicisi olusturma akisi veya seed verisi

Kabul kriterleri:

- Giris yapmayan kullanici panel ekranlarina erisememeli.
- Pasif kullanici giris yapamamali.
- Gecersiz oturumlarda API standart yetkisiz yaniti donmeli.

## Faz 2: Panelden Yonetilebilir Rol ve Izin Sistemi

Amac: Roller sabit kodlu olmadan panelden eklenebilir ve izinleri secilebilir hale getirmek.

Karar verilmis yetki modeli:

- Her kullaniciya tek rol atanacak.
- Kullanici bazli ozel izin veya izin ezme olmayacak.
- Ek yetki kombinasyonu gerekiyorsa panelden yeni rol acilacak.
- Ornek roller: `Personel`, `Personel Manager`, `Takim Lideri`, `Yonetici`, `Super Admin`.
- Kullanici yetkileri sadece atanmis rolun izinlerinden gelecek.

Yapilacaklar:

- Roller listesi ekrani yapilacak.
- Yeni rol ekleme modali/formu yapilacak.
- Rol duzenleme ve pasife alma desteklenecek.
- Izinler kategori bazli checkbox gruplari halinde gosterilecek.
- Rol kaydedilirken secilen izinler role baglanacak.
- Kullanici yonetiminde kullaniciya rol atanabilecek.
- Kritik rol/izin degisiklikleri loglanacak.

Onerilen izin gruplari:

- Cagri Kayitlari
- Notlar
- Atama
- Cozum Islemleri
- Kullanici Yonetimi
- Roller ve Izinler
- Raporlar
- Loglar
- Ayarlar
- Hassas Veri Goruntuleme

Baslangic izinleri:

- `calls.view.own`
- `calls.view.all`
- `calls.create`
- `calls.edit`
- `calls.note.own`
- `calls.note.assigned`
- `calls.assign`
- `calls.resolve`
- `calls.reopen`
- `calls.archive`
- `reports.view`
- `reports.export`
- `logs.view`
- `settings.manage`
- `users.manage`
- `roles.manage`
- `sensitive.view_unmasked`

Beklenen ciktilar:

- `GET /roles`
- `POST /roles`
- `GET /roles/:id`
- `PATCH /roles/:id`
- `PATCH /roles/:id/permissions`
- `GET /permissions`
- Kullanici formunda rol secimi

Kabul kriterleri:

- Panelden yeni rol eklenebilmeli.
- Rolun izinleri checkbox ile secilip kaydedilebilmeli.
- Bir kullaniciya rol atandiginda kullanicinin yetkileri o rolden gelmeli.
- Kullanici bazli ozel izin alani bulunmamali.
- Rol veya izin degisikligi loglanmali.

## Faz 3: Cagri Kaydi MVP

Amac: Personelin cagri kaydi acabilmesi ve yetkisine gore kayitlari gorebilmesi.

Yapilacaklar:

- Personel ana sayfasi olusturulacak.
- Ana sayfaya `Yeni Cagri Kaydi` butonu eklenecek.
- Yeni cagri kaydi formu modal olarak acilacak.
- Cagri kaydi olusturuldugunda sistem otomatik alanlari dolduracak:
  - Kayit numarasi
  - Kaydi acan kullanici
  - Kayit tarihi ve saati
  - Varsayilan durum: `Acik`
  - IP ve tarayici bilgisi
  - Log kaydi
- Personel varsayilan olarak sadece kendi actigi kayitlari gorecek.
- `calls.view.all` izni olan rol tum kayitlari sadece goruntuleyebilecek.
- Tum kayitlari goruntuleme izni, duzenleme veya cozume alma yetkisi vermeyecek.
- Telefon ve TC format kontrolleri eklenecek.
- Ayni telefon veya TC icin acik/yakin tarihli kayit uyarisi verilecek.

Form alanlari:

- Telefon numarasi
- Ogrenci TC
- Ogrenci adi soyadi
- Gorusme tipi
- Sorun kategorisi
- Alt sorun kategorisi
- Yasanilan sorun
- Personel notu
- Oncelik
- Takip gerekiyor mu?
- Takip tarihi
- Dosya veya ekran goruntusu

Beklenen ciktilar:

- `POST /calls`
- `GET /calls`
- `GET /calls/:id`
- Personel ana sayfasi
- Kendi cagrilarim ekrani
- Cagri olusturma modali

Kabul kriterleri:

- Personel cagri kaydi acabilmeli.
- Yeni kayit otomatik `Acik` durumunda olusmali.
- Personel kendi kaydinin ana bilgilerini sonradan duzenleyememeli.
- Yetkisi olmayan kullanici tum kayitlari gorememeli.
- Yetkisi olsa bile sadece goruntuleme izni olan kullanici kayit duzenleyememeli.

## Faz 4: Cagri Detayi, Notlar, Atama ve Cozum Akisi

Amac: Kayit uzerindeki operasyonel is akisini tamamlamak.

Yapilacaklar:

- Cagri detay ekrani yapilacak.
- Ana kayit bilgileri yetkiye gore salt okunur veya duzenlenebilir olacak.
- Ilk personel notu ayri saklanacak ve sonradan degistirilemeyecek.
- Ek notlar ayri kayitlar olarak tutulacak.
- Not ekleme izinlere baglanacak.
- Atama sistemi eklenecek.
- Baska personel tarafindan acilmis kayit bir personele atanirsa `Atanan Personel Notu` alani gosterilecek.
- `Cozuldu` islemi ayri izne baglanacak.
- Cozum aciklamasi zorunlu olacak.
- Cozulen kayitlar kilitlenecek.
- Yetkili kullanici cozulen kaydi yeniden acabilecek.
- Islem gecmisi zaman cizelgesi olarak gosterilecek.

Not turleri:

- Personel Notu
- Takip Notu
- Atanan Personel Notu
- Ic Not
- Cozum Notu
- Yonetici Notu

Beklenen ciktilar:

- `POST /calls/:id/notes`
- `PATCH /calls/:id/assign`
- `PATCH /calls/:id/status`
- `POST /calls/:id/resolve`
- `POST /calls/:id/reopen`
- Cagri detay ekrani
- Islem gecmisi bolumu

Kabul kriterleri:

- Not ekleme izni kayit duzenleme yetkisi vermemeli.
- Cozuldu islemi sadece `calls.resolve` izniyle yapilabilmeli.
- Cozum aciklamasi olmadan kayit cozuldu yapilamamali.
- Atanan personel notu ilk personel notundan ayri saklanmali.
- Kritik islemlerin tamami loglanmali.

## Faz 5: Yonetim Paneli

Amac: Yetkili kullanicilarin tum sistemi yonetebilecegi ekranlari kurmak.

Yapilacaklar:

- Yonetici dashboard ekrani yapilacak.
- Tum cagri kayitlari ekrani yapilacak.
- Yonetici icin ek tablo kolonlari gosterilecek:
  - Kaydi acan kullanici
  - Atanan kullanici
  - Cozum yetkilisi
  - Cozum tarihi
  - SLA durumu
  - Departman
- Kullanici yonetimi ekrani yapilacak.
- Kullanici olusturma, duzenleme, pasife alma ve rol atama desteklenecek.
- Log kayitlari ekrani yapilacak.
- Silme yerine pasife alma veya arsivleme yaklasimi uygulanacak.

Beklenen ciktilar:

- `GET /admin/dashboard`
- `GET /users`
- `POST /users`
- `PATCH /users/:id`
- `GET /logs`
- Yonetici dashboard
- Kullanici yonetimi ekrani
- Log kayitlari ekrani

Kabul kriterleri:

- Kullanici yonetimi sadece yetkili rollerce gorulebilmeli.
- Log kayitlari sadece `logs.view` izni olan rollerce gorulebilmeli.
- Kullanici olusturma, rol atama ve izin degisikligi loglanmali.

## Faz 6: Ayarlar ve Dinamik Form Yonetimi

Amac: Cagri formundaki secenekleri ve davranislari kod degisikligi olmadan panelden yonetmek.

Yapilacaklar:

- Gorusme tipleri ayarlardan yonetilecek.
- Sorun kategorileri ve alt kategoriler ayarlardan yonetilecek.
- Durum secenekleri ayarlardan yonetilecek.
- Oncelik secenekleri ayarlardan yonetilecek.
- Cozum kategorileri ayarlardan yonetilecek.
- Form alanlari icin aktiflik, zorunluluk, gorunurluk, duzenlenebilirlik, maskeleme ve siralama ayarlari eklenecek.
- Ayar degisiklikleri loglanacak.

Beklenen ciktilar:

- `GET /settings`
- `PATCH /settings`
- `GET /settings/options/:type`
- `POST /settings/options/:type`
- `PATCH /settings/options/:type/:id`
- Dinamik cagri formu

Kabul kriterleri:

- Form secenekleri sabit kodlu olmamali.
- Pasif yapilan secenek yeni kayit formunda gorunmemeli.
- Zorunlu yapilan alan bos gecilememeli.
- TC ve telefon maskeleme ayari uygulanmali.

## Faz 7: Arama, Raporlama ve Disa Aktarma

Amac: Kayitlari yetkiye gore aramak, raporlamak ve disa aktarmak.

Yapilacaklar:

- Kayit arama ekrani yapilacak.
- Personel sadece yetki kapsamina giren kayitlarda arama yapabilecek.
- Yonetici ek filtrelerle arama yapabilecek.
- Rapor ekranlari yapilacak.
- Excel ve PDF disa aktarma izinlere baglanacak.
- Raporlarda TC ve telefon maskeleme ayarlari uygulanacak.

Arama filtreleri:

- Telefon numarasi
- Ogrenci TC
- Ogrenci adi soyadi
- Kayit no
- Sorun kategorisi
- Durum
- Tarih araligi
- Takip tarihi
- Oncelik
- Kaydi acan kullanici
- Atanan kullanici
- Departman
- Cozum yetkilisi
- SLA durumu

Beklenen ciktilar:

- `GET /calls/search`
- `GET /reports/summary`
- `GET /reports/staff`
- `GET /reports/categories`
- `GET /reports/export`
- Kayit arama ekrani
- Raporlar ekrani

Kabul kriterleri:

- Arama sonucunda yetkisiz kayitlar donmemeli.
- Rapor alma ve disa aktarma ayri izinlerle kontrol edilmeli.
- Hassas veriler yetkiye gore maskelenmeli.

## Faz 8: Bildirimler, Guvenlik ve KVKK

Amac: Operasyonel bildirimleri, guvenlik kurallarini ve kisisel veri kontrollerini tamamlamak.

Yapilacaklar:

- Panel ici bildirim altyapisi kurulacak.
- E-posta bildirimleri eklenecek.
- Takip tarihi gelen kayitlar icin bildirim gonderilecek.
- Acil kayitlarda yetkili kisilere bildirim gonderilecek.
- Belirli surede cozulmeyen kayitlar icin yonetici bildirimi eklenecek.
- Sifre politikalari, oturum suresi ve otomatik cikis ayarlari eklenecek.
- IP kisitlama ve hatali giris limiti desteklenecek.
- Veri saklama, arsivleme ve anonimlestirme ayarlari planlanacak.

Beklenen ciktilar:

- `GET /notifications`
- `PATCH /notifications/:id/read`
- Bildirim ayarlari
- Guvenlik ayarlari
- Veri gorunurluk ve saklama ayarlari

Kabul kriterleri:

- Bildirimler yetkili ve ilgili kullanicilara gitmeli.
- Hassas veri gorunurlugu izinlere ve ayarlara gore calismali.
- Guvenlik ayari degisiklikleri loglanmali.

## Faz 9: Tarayici Uzantisi

Amac: Sirket ici kullanicilarin tarayici uzerinden hizli cagri kaydi acabilmesini saglamak.

Yapilacaklar:

- Uzanti icin ayri paket yapisi kurulacak.
- Uzanti paneldeki oturum ve yetki kurallarini kullanacak.
- Hizli kayit formu yapilacak.
- Telefon numarasi otomatik algilama opsiyonel olarak eklenecek.
- Hangi domainlerde calisacagi ayarlardan yonetilecek.
- Uzantidan acilan kayit, giris yapan kullanici adina olusacak.
- Ilk surumde uzanti sadece kayit acmaya odaklanacak.

Beklenen ciktilar:

- Browser extension paketi
- Hizli kayit formu
- Panel API entegrasyonu
- Uzanti ayarlari

Kabul kriterleri:

- Uzantiyi sadece yetkili kullanicilar kullanabilmeli.
- Uzantidan acilan kayit dogru kullaniciya baglanmali.
- Paneldeki cagri olusturma validasyonlari uzanti icin de gecerli olmali.

## Genel Test Plani

- Personel sadece kendi kayitlarini gorebilmeli.
- `calls.view.all` izni olan rol tum kayitlari gorebilmeli ama duzenleyememeli.
- Rol izinleri panelden degistiginde kullanici yetkileri buna gore degismeli.
- Kullanici bazli ozel izin bulunmamali.
- Not ekleme izni kayit duzenleme yetkisi vermemeli.
- Cozuldu islemi sadece ilgili izinle yapilabilmeli.
- Cozum aciklamasi zorunlu olmali.
- TC ve telefon yetkiye gore maskelenmeli.
- Log ekranina sadece yetkili roller erisebilmeli.
- Ayarlardan kapatilan form alani formda gorunmemeli.
- Arama ve raporlama sonucunda yetkisiz veri donmemeli.
- Uzantidan acilan kayit dogru kullanici adina olusmali.

Kontrol komutlari:

- `pnpm --filter client build`
- `pnpm --filter server build`

## Varsayimlar

- Mevcut `client` ve `server` klasor yapisi korunacak.
- Veritabani MySQL olarak kalacak.
- Backend nihai yetki kontrol noktasi olacak.
- Frontend sadece kullanici deneyimi ve gorunurluk icin yetki bilgisi kullanacak.
- Silme islemi varsayilan olarak fiziksel silme degil, pasife alma veya arsivleme olacak.
- Roller panelden yonetilecek, ancak kullanici bazli ozel izin olmayacak.
- Ilk uygulanacak cekirdek sira: auth, rol/izin paneli, cagri olusturma, kayit listeleme, detay/not/atama/cozum, loglama.
