import type { Metadata } from "next";
import MarketingPage from "../marketing-page";

export const metadata: Metadata = {
  title: "Kütüphane Otomasyonu | Ödünç, İade ve Raf Kontrolü",
  description: "Okul kütüphaneleri için ödünç-iade, barkod ve QR arama, kitap sayımı, raf kontrolü ve raporlama otomasyonu.",
  alternates: { canonical: "/kutuphane-otomasyonu" },
};

export default function Page() {
  return <MarketingPage eyebrow="KÜTÜPHANE OTOMASYONU" title="Günlük kütüphane işlemlerini hızlandıran çevrim içi sistem." intro="Kitap hareketlerini kaydedin, envanteri denetleyin ve ihtiyaç duyduğunuz raporlara aynı panelden ulaşın." features={[
    { title: "Hızlı ödünç ve iade", text: "Üye ve kitap bilgilerini yan yana arayın. İşlem tamamlanır tamamlanmaz güncel ödünç listesinde sonucu görün." },
    { title: "Kitap sayımı ve raf kontrolü", text: "Kategori, raf ve yazar filtreleriyle sayım yapın. Kontrol edilen kitapları işaretleyin; eksik veya yeniden bulunan kitapları yönetin." },
    { title: "Anlaşılır raporlar", text: "En çok okuyan öğrencileri ve en çok okunan kitapları seçilen tarih aralığına göre karşılaştırın." },
  ]}>
    <section className="marketing-copy"><h2>Kütüphane otomasyonu kimler için uygundur?</h2><p>İlkokul, ortaokul ve lise kütüphanelerinin yanı sıra aynı sistemde birden fazla okulun yönetilmesi gereken yapılar için uygundur. İnternet bağlantısı bulunan bilgisayar, tablet ve telefonlardan kullanılabilir.</p><p>Sistem sadece kitap listesini saklamaz; envanter, üyelik, ödünç geçmişi, geciken kitaplar, kayıp kayıtları ve okuma istatistiklerini birbirine bağlı biçimde yönetir.</p></section>
  </MarketingPage>;
}
