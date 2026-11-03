# Üyelik, mesajlar ve tavsiye listeleri güncellemesi

- Öğrenci başvurusu il, ilçe, okul, ad soyad, sınıf, numara, cep telefonu ve parola gerektirir. E-posta sorulmaz. Öğrenci girişinde telefon ve parola kullanılır; yetkili hesaplarının mevcut girişleri korunur.
- İsim/okul eşleşmeleri büyük-küçük harf ve Türkçe harf yazımlarını tolere eder. Merkez ve ilin adıyla birlikte yazılmış Merkez eşdeğerdir. Sınıf örneğin 9/a girilirse 9A olarak kaydedilir. Parolalar büyük-küçük harfe duyarlıdır.
- Yönetici onayı telefon bilgisini mevcut üye kaydına aktarır. Eski e-posta bilgileri silinmez; öğrenci bilgilerinde, e-posta ayar modülünde ve gecikme iletişim ekranında gösterilmez.
- Geç Kalanlar > Gecikenlerin Cep Telefonları alanından arama sonucunu veya seçili kayıtları XLSX ve CSV olarak indirin. Dosyada ad soyad, sınıf, numara, kitap ve telefon bulunur.
- Öğretmen ve diğer çalışan kaydında yalnız ad soyad zorunludur; branş isteğe bağlıdır.
- Kamera QR ve çizgili barkod okur (EAN/ISBN, Code128 ve yaygın diğer çizgili barkodlar). QR fotoğrafı seçme alanı kaldırılmıştır. Kamera için HTTPS ve cihaz izni gerekir. Görüntü sunucuya yüklenmez.
- Sayım ekranında yeni raf yazılıp kitap seçildiğinde başlığın yanındaki Kaydet yalnızca o kitabın rafını günceller; yeni sayım/ödünç/iade kaydı oluşturmaz.
- Öğrenci Yorumlarım alanında kendi yorumlarını ve onay durumlarını görür.
- Yönetici Tavsiye Listesi alanında birden fazla adlandırılmış liste oluşturabilir. Öğrencinin Okudum/Okuyacağım işareti kendisine özeldir; Okudum kitap bilgilerini yeşile çevirir. Bu işaret ödünç geçmişini değiştirmez.
- Teslim tarihi geçmiş aktif kitabı olan öğrencinin tüm sayfalarında UYARI görüntülenir.
- Yönetici Mesajlar alanında ad/numara, sınıf ve gecikenler ile filtreleyip alıcıları seçer. Mesajlar öğrenci paneline gider; başlık açıldığında okunma zamanı kaydedilir. Yönetici Okunan Mesajlar alanında izler.
- Kullanıcı Değiştir mevcut okulun diğer hesabına o hesabın parolasıyla giriş yapar. Yanlış giriş açık oturumu kapatmaz.
- Ayarlar > Kullanıcılar > Düzenle ile hesap güncellenir. Üyeliği sıfırla giriş hesabını pasifleştirip oturumları sonlandırır; üye, kitap, ödünç, iade ve sayım kayıtlarını silmez. Öğrenci tekrar başvurup yönetici onayı alabilir.

## Verilerin korunması

0020 geçişi yalnızca beş yeni tablo ve students.branch alanını ekler. Önceki alanlara UPDATE, DELETE veya DROP uygulanmaz. Mevcut DB ve BUCKET bağlantıları korunur. Kaynak ZIP kişisel kayıtları, parolaları veya gizli anahtarları içermez; özel veritabanı yedeği ayrı şifrelenir.
