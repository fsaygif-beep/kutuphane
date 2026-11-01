# Rapor ayrıntıları ve güncel paket

2 Kasım 2026. Rapor sıralamalarında seçilen öğrenci için okuduğu kitaplar, seçilen eser için okuyan üyeler aynı tarih aralığı ve istatistik kurallarıyla listelenir. Asistanın ekranı, menüsü, API kodu ve özel stilleri kaldırılmıştır. Yeni veritabanı migrasyonu yoktur.

Üretim derlemesi, 6 birim/veri koruma testi, gerçek API'nin yapay yerel verilerle testi ve raporlardaki iki tıklama akışının tarayıcı kontrolü geçti. Önceki kaynakta bulunan ortam türü/TypeScript hataları bu kapsam dışındaki satırlarda sürmektedir.

Yeni canlı snapshot: 7986 toplam kitap kaydı, 544 üye, 331 ödünç hareketi, 4860 sayım satırı. Tüm 15 kullanıcı tablosu yerel SQLite'a geri yüklenip bütünlük kontrolünden geçti. Önceki 4847 sayım kaydına, önceki sürümdeki otomatik sayım özelliğiyle 13 kayıt eklenmiştir.

Önceki ve güncel özel yedekler backups altında yalnızca şifreli biçimde bulunur. Anahtar depoda yoktur. Gerçek parolalar düz metin olarak alınamaz. Altyapı ve erişim bilgileri kaynak ZIP'indeki BELGELER/YERLESIM-VE-ERISIM.md dosyasındadır; özel hesap listesi şifreli yedek içindedir.

E-posta gönderimi için Resend anahtarı ve doğrulanmış gönderen hâlâ gerekir; bu rapor güncellemesi e-posta yapılandırmasını değiştirmez.
