# Çankırı Lisesi Kütüphane Otomasyonu

Öğrenci, kitap, ödünç/iade, gecikme, raporlama ve kitap sayımı süreçlerini tek panelde yöneten web uygulaması.

## Mevcut modüller

- Genel bakış, okuma ilhamı ve aktif ödünçler
- Manuel öğrenci ve kitap kaydı
- Aynı öğrenci numarası ve demirbaş numarası için mükerrer kayıt koruması
- Ayarlanabilir ödünç süresi ve eğitim-öğretim yılı
- İade ve gecikme takibi
- Öğrenci ve kitap arama
- En çok okuyan öğrenci ve en çok okunan kitap raporları
- Kitap sayımı, raf durumu kontrolü ve CSV çıktısı
- Mobil uyumlu yönetim paneli

## Kurulum

```bash
npm ci
npm run db:generate
npm run dev
```

Uygulama kalıcı veriler için Cloudflare D1 kullanır. Çalıştırma ortamında `DB` bağlaması tanımlanmalıdır.

## Güvenlik

Gerçek şifreler, API anahtarları ve öğrenci verileri kaynak kod deposuna eklenmemelidir.

## Sonraki geliştirmeler

- Excel içe/dışa aktarma
- Öğrenci ve kitap görselleri için dosya depolama
- Yönetici/kullanıcı rol yönetimi
- PDF, Word, PNG ve JPG raporları
- Sınıf atlatma ve mezun sınıf yönetimi
- Dewey/tür/raf bazında gelişmiş raf listeleri
