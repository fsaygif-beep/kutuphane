# Özel veritabanı yedekleri

Bu depo herkese açıktır. Kişisel kayıtlar, hesap listesi ve veritabanı yalnızca AES-256-GCM ile şifreli dosya olarak saklanır. Düz metin yedek veya şifre çözme anahtarı burada bulunmaz.

Anahtar sahibinin bilgisayarında ayrı `Kutuphane-Ozel-Yedek-Anahtari-2026-11-02.key` dosyasındadır. Anahtarı kaybetmeyin; bu depoya veya web sitesine yüklemeyin. Uygulamanın kullanıcı parolaları düz metin olarak alınamaz; veritabanındaki tuzlanmış özetler şifreli yedek kapsamındadır.

Çözmek için Python ve `cryptography` gerekir:

```
python decrypt-backup.py kutuphane-2026-11-02.enc --key-file ANAHTAR_DOSYASININ_YOLU --output ozel-yedek.zip
```

Bu komut yalnızca yerel ZIP üretir; canlı veritabanına bağlanmaz. Önce ayrı bir deneme veritabanında SQL/SQLite bütünlüğünü kontrol edin. R2 görsel dosyalarının ikili içerikleri bu veritabanı yedeğinde yoktur. Mevcut R2 dosyaları güncellemede değiştirilmemiştir.
