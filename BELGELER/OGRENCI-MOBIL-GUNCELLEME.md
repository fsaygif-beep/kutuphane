# Öğrenci ve mobil güncellemesi — 2 Kasım 2026

## Yeni özellikler
- Ödünç, iade ve sayım işlemleri sunucunun doğruladığı değişikliklerle yenilenir. Tam kataloğun yeniden indirilmesi kaldırılmıştır. Büyük listeler kademeli gösterilir; Excel ve QR çözümleyici yalnız gerektiğinde indirilir.
- Öğrenci fotoğrafı, sınıfı ve tarihli okuma geçmişi; birden fazla özel okuma listesi.
- Okunup iade edilmiş kitaplar için yorum. Yalnız yönetici onaylı yorumlar diğer öğrencilere görünür. İsim ilk harf ve soyadı biçimindedir. Aynı adlı ve aynı yazarlı nüshalar yorumları birlikte gösterir.
- Yaşa uygun değil, şiddet, smut/cinsel içerik, hasarlı/eksik sayfa ve diğer şikâyetleri. İlgili kitap ve sayfa aralığı isteğe bağlıdır. Şikâyetler diğer öğrencilere açılmaz.
- Üyelik başvurusunda cep telefonu; onaydan sonra telefon ve e-posta öğrenci kaydına aktarılır. Telefon ve parola ile giriş desteklenir.
- 81 il ve 973 ilçenin uygulama içinden seçilmesi; sınıf-şubenin 10A gibi boşluksuz yazılması.
- Hesabım, Ayarlar içine taşınmıştır. Öğretmen kaydında ad soyad, iletişim ve e-posta yeterlidir. Öğrenci no ve sınıf istenmez; teknik üye anahtarını sistem oluşturur.
- Yeni talepler Aktif, değerlendirilen talepler Pasif alanda görünür; yönetici her iki alandaki talepleri silebilir.
- Öğrenci ve kitap görselleri büyütülebilir. Geç Kalanlar sayfasında görsel yalnız isme tıklanınca açılır.
- Ödünç, iade ve sayımda telefon kamerasıyla QR okuma; kamera yerine QR fotoğrafı seçme seçeneği. Kod okunması yalnız kitabı bulur, işlemi otomatik tamamlamaz. Kamera kapatılınca veya sayfadan ayrılınca kamera akışı durdurulur. Görüntü sunucuya gönderilmez.

## Telefon kullanımı
Programın HTTPS adresini Safari veya Chrome ile açın. İlgili işlemde Kamerayla QR oku düğmesine basın ve kamera izni verin. Kitabın demirbaş numarasını içeren QR kodu gösterin. Kitap bulunduğunda işlemi ekrandan onaylayın. Kamera izni yoksa QR fotoğrafı seçilebilir veya kod elle yazılabilir.

## Başka okul kullanımı
Girişte Okulunuz için kullanım başvurusu yapın. Merkez yönetici başvuruyu onayladıktan sonra okul yöneticisi kendi hesabıyla giriş yapar. İlk girişte 30 günlük deneme başlar; süre ve abonelik mevcut kurallarla yönetilir. Kitaplar, öğrenciler, sayımlar, yorumlar ve şikâyetler school_id ile ayrılır. Mevcut okul kopyalanmaz. Öğrenci üyeliğinde kayıtlı okulun kurum kodu ve öğrenci bilgileri eşleşmelidir.

## Veri geçişi ve koruma
0019_student_community.sql yalnız 4 yeni tablo, arama dizinleri ve membership_requests.phone alanını ekler. Mevcut kitap, öğrenci, ödünç veya sayım satırlarını silen/değiştiren bir veri geçişi yoktur. Mevcut D1 DB ve R2 BUCKET bağları korunur. E-posta servis anahtarının kurulumu bu sürümün dışında bırakılmıştır.

## Doğrulama
17 otomatik test: yorum onayı, diğer öğrenciden ve diğer okuldan yalıtım, şikâyetler, özel listeler, telefonla giriş, öğretmen kaydı, ikinci okul başvuru/onay/giriş/katalog, ödünç/iade/sayım, talep değerlendirme/silme ve QR çözümleme.
5.000 kitaplık yerel testte tam yükleme 1.399.320 bayt, sayım yanıtı 374 bayt. Bu bir canlı gecikme ölçümü değildir.
QR fotoğrafı yerel tarayıcı testinde doğru kitap ve öğrenciyi bulmuştur. Gerçek telefon kamerası ve izin ekranı fiziksel cihazda ayrıca denenmelidir.

## Kaynak paketi
Ayarlar > Veri ve Dönem > Programın Son Sürümü mevcut /downloads/kutuphane-guncel.zip adresini kullanır. Bu kaynak paketi kişisel kayıt veya servis anahtarı içermez. Özel veritabanı yedeği ayrı şifrelenir; şifre çözme anahtarı depoya konulmaz.
