# Kütüphane güncellemesi — 2 Kasım 2026

25. sürüm yayımlandı: https://okulkutuphanesi.com.tr
Sites adresi: https://coklu-okul-kutuphane.leumruk66.chatgpt.site

## Yayım sonrası veri kontrolü
Kitaplar: 7.986 toplam kayıt (5.046 aktif). Üyeler: 544. Ödünç hareketleri: 331 (121 aktif). Sayım kayıtları: 4.847, sayım oturumu: 1.
Beş tablonun tüm eski satırları kimlik ve mevcut alan değerleriyle karşılaştırıldı. Eksilen veya değişen eski satır yok. Eklenen source alanının eski kayıtlar için değeri manual.
15 tablonun JSON, SQL ve SQLite yedeği alındı; geri yüklenebilirlik ve bütünlük kontrolü geçti. R2 görsel dosyaları bu yedekte yok; bu dosyalar ve depolama bağlaması değiştirilmedi.

## Güncellemeler
- Ayrı Ödünç Ver / İade Al ekranları.
- Üyenin üzerindeki tüm aktif kitaplar ve her satırda iade işlemi.
- Yüklü üye fotoğrafı ve kitap kapağı; eksik görseller için yer tutucu.
- Yeni ödünçte son açık sayıma eksik kayıt ekleme. Sayım sayfası açıldığında seçili açık sayımın mevcut aktif ödünçlerle otomatik eşleştirilmesi. Eski sayım kayıtları değiştirilmez. Otomatik eklenenler etiketlenir.
- Gerçek veri yedeğinin yerel kopyasında bu eşleştirme 13 kayıt ekledi (4.847 → 4.860); 121 aktif ödünç değişmedi. Bu sadece yerel testtir. Canlıda sayım sayfası açılana kadar ekleme yapılmaz.
- Toplu silmede oturum açmış yöneticinin kendi parolasının sunucuda doğrulanması. Yanlış parola veya personel hesabı reddedilir. Ödünçte veya herhangi bir sayımda kayıtlı kitap korunur. Diğer uygun kitaplar fiziksel silinmeden arşivlenir. Canlıda toplu silme testi yapılmadı.
- Sırt etiketinde 10 etiket satırı ve etiket içinde 10 bilgi satırı; Excel dosyasında 10×14 kapasite ve hücre değerleri doğrulandı.
- Kitap kartında kategori değeri.
- Geç kalanlarda üye ve kitap bilgileriyle arama, görünen sonuçlarda tümünü seç, seçili kayıtlar için üye başına gruplanmış e-posta.

## E-posta için kalan gereklilik
Canlı ortamda RESEND_API_KEY yok. Doğrulanmış gönderen adresi ve API anahtarı tanımlanmadan gerçek e-posta gönderimi mümkün değildir. Anahtarı sohbet mesajı yerine Sites'ın gizli ortam değişkeni alanına girmek gerekir. Başarı, servis reddi, ağ hatası, boş seçim ve eksik yapılandırma sahte servisle test edildi. Gerçek öğrenciye deneme e-postası gönderilmedi. Teslimat ve gelen kutusu kontrolü yapılmadı.

## Kontroller
Üretim derlemesi, 5 veri koruma testi, gerçek API'nin yerel D1 uyarlayıcısıyla kimlik/parola/ödünç/sayım/iade/e-posta kontrolleri ve tarayıcı ekran kontrolleri geçti. Mevcut kaynakta ortam türleri ve bazı eski API satırları için önceden bulunan tam TypeScript kontrol hataları sürüyor. Kaynak, migration ve dağıtım paketi aynı kaydedilmiş sürüme aittir.
