# Programın yerleşimi ve erişim rehberi

Güncelleme: 2 Kasım 2026 — rapor ayrıntıları ve asistanın kaldırılması.

| Bileşen | Yer / yönetim |
| --- | --- |
| Ana adres | https://okulkutuphanesi.com.tr |
| Sites adresi | https://coklu-okul-kutuphane.leumruk66.chatgpt.site |
| Sites projesi | appgprj_6a8a6bfceee081919b5baf62687c7dc2 |
| Sunucu çalıştırma | OpenAI Sites tarafından yönetilen Cloudflare Workers |
| Kalıcı veriler | Aynı projenin Cloudflare D1 `DB` bağlaması |
| Fotoğraf, kapak, logo | Aynı projenin Cloudflare R2 `BUCKET` bağlaması |
| Kaynakların yayımlanması | OpenAI Sites projesinin kaynak deposu ve kayıtlı sürümleri |
| GitHub kod aynası | https://github.com/fsaygif-beep/kutuphane |
| Sitenin kaynak ZIP'i | `/downloads/kutuphane-guncel.zip` |

Fiziksel veri merkezi/ülke bilgisi doğrulanmış değildir. Cloudflare'ın burada ayrı bir kişisel hesap kullanıcı adı veya parolası kullanılmaz; kaynakları Sites yönetir.

## Hangi hesap gerekir?

- Sites yönetimi/yayımlama: Projenin sahibi veya editörü olan ChatGPT hesabı. Uygulama yöneticisi hesabı bundan ayrıdır.
- GitHub: `fsaygif-beep` hesabı veya `fsaygif-beep/kutuphane` üzerinde yazma yetkisi verilen hesap.
- Program: Okulunuzdaki yönetici tarafından tanımlanmış e-posta/telefon ve mevcut parola.
- Özel hesap listesi ve şifreli veritabanı: Yalnızca sahibine verilen ayrı özel yedek paketinde bulunur.

Gerçek parolalar kaynak paketine veya herkese açık GitHub deposuna konulmaz. Program parolaları PBKDF2/SHA-256 ile tuzlanmış özetler olarak saklanır; düz metin olarak geri çıkarılamaz. Kayıtlı parolaları görmek için bir komut yoktur. Gerekiyorsa hesap sahibinin yetkili parola kurtarma/değiştirme işlemi gerekir.

## Ortam ve servisler

- `.openai/hosting.json`: Mevcut `project_id`, `d1: DB`, `r2: BUCKET` değerlerini koruyun.
- `INITIAL_ADMIN_SETUP_CODE`: İlk kurulum için gizli Sites ortam değişkeni; mevcut sistemde yeni kurulum/sıfırlama amacıyla çalıştırmayın.
- `RESEND_API_KEY`: E-posta için gizli Sites ortam değişkeni. 2 Kasım kontrolünde tanımlı değildi.
- Programın E-posta ayarındaki gönderen adresi Resend üzerinde doğrulanmış olmalıdır. Servis anahtarı veya doğrulanmış gönderen olmadan gerçek teslimat çalışmaz.
- Yerelde Node.js ve paket bağımlılıkları gerekir. Üretim Cloudflare Worker ortamıdır; `cloudflare:workers` modülü sıradan Node sunucusunda doğrudan çalışmaz.

## Veriyi koruyarak güncelleme

1. Mevcut Sites projesini açın. Yeni boş proje/veritabanı oluşturmayın.
2. D1 veritabanını yedekleyin ve geri yükleme kontrolü yapın. R2 görsel dosyalarını ayrıca yedekleyin.
3. Kaynak kodu test edip aynı projenin yeni sürümü olarak yayımlayın. Eski SQL migrasyonlarını değiştirmeyin veya yeniden sıfırlamayın.
4. Kitap/üye/ödünç/sayım kayıtlarını kimlik ve içerik bazında önce/sonra karşılaştırın.

Bu ZIP canlı veritabanını ve R2 görsellerini içermez. GitHub'daki özel yedek şifreli dosyadır; açma anahtarı sitede veya GitHub'da bulunmaz. Geri yüklemeyi önce ayrı bir deneme veritabanında yapın; canlı sisteme kontrolsüz içe aktarma uygulamayın.

## Bu çalışma kapsamında yapılanlar

- Ayrı ödünç ve iade ekranları, fotoğraflar, kişinin üzerindeki kitaplar ve satırdan iade.
- Ödünç kaynaklı otomatik sayım; mevcut sayım kayıtlarını koruma.
- Toplu arşivlemede yönetici parolası, ödünçte ve sayımda kayıtlı kitapları koruma.
- Sırt etiketinde 10 satır, kitap kartında kategori, gecikme araması ve tümünü seç.
- Rapor sıralamasına tıklayınca aynı tarih aralığındaki tamamlanmış işlemleri listeleme. Aynı isimli üyeler kimlikleriyle, aynı eser nüshaları ad+yazarla eşleştirilir.
- Asistanın menüsü, bileşeni, API uç noktası ve özel stilleri kaldırıldı. Eski veritabanı kayıtları silinmedi; geçmişteki atıl yetki metinleri veri kaybını önlemek için topluca değiştirilmedi.

Kaynak ZIP'i `python scripts/package-source.py` ile yeniden üretilebilir; üretilen ZIP kendisini, özel verileri ve yerel çalışma dosyalarını içermez.
