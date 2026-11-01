import type { Metadata } from "next";
import MarketingPage from "../marketing-page";

export const metadata: Metadata = {
  title: "Özellikler | Okul Kütüphane Otomasyonu",
  description: "Kitap ve üye yönetimi, Excel aktarımı, toplu görsel yükleme, ödünç-iade, sayım, raporlar ve yetkilendirme özellikleri.",
  alternates: { canonical: "/ozellikler" },
};

export default function Page() {
  return <MarketingPage eyebrow="PROGRAM ÖZELLİKLERİ" title="Kütüphane yönetiminde ihtiyaç duyulan araçlar bir arada." intro="Katalog oluşturma, üye yönetimi, dolaşım işlemleri, envanter kontrolü ve raporlama için bütünleşik bir çalışma alanı." features={[
    { title: "Katalog ve toplu işlemler", text: "Excel’den kitap aktarın, kitap türleri tanımlayın, kategori ve raflara göre filtreleyin; kitap ve üye görsellerini topluca yükleyin." },
    { title: "Üyeler ve yetkiler", text: "Öğrenci, öğretmen ve çalışan kayıtlarını yönetin. Kullanıcıların görebileceği ve değiştirebileceği bölümleri yetkilerle sınırlandırın." },
    { title: "Ödünç kuralları", text: "Ödünç süresini ve bir öğrencinin alabileceği kitap sayısını belirleyin. Kitap verilmemesi gereken üyeler için işlem engeli oluşturun." },
    { title: "Sayım ve kayıp kitaplar", text: "Kontrol edilen satırları anında ayırt edin, eksik kitapları kayıp listesine alın ve yeniden bulunanları dolaşıma açın." },
    { title: "Rapor ve geçmiş", text: "Üye veya kitap üzerine tıklayarak hareket geçmişini inceleyin. Aynı eser ve yazara ait nüshaların kullanımını birlikte değerlendirin." },
    { title: "Okul bazlı güvenli alan", text: "Her okulun kitap, üye ve işlem kayıtları birbirinden ayrılır. Deneme ve abonelik erişimleri merkezi olarak yönetilir." },
  ]} />;
}
