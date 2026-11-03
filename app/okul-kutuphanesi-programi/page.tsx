import type { Metadata } from "next";
import MarketingPage from "../marketing-page";

export const metadata: Metadata = {
  title: "Okul Kütüphanesi Programı | Kitap ve Üye Takibi",
  description: "Okullar için kitap, öğrenci, öğretmen, ödünç-iade, raf kontrolü ve raporlama özellikleri sunan çevrim içi kütüphane programı.",
  alternates: { canonical: "/okul-kutuphanesi-programi" },
};

export default function Page() {
  return <MarketingPage eyebrow="OKULLAR İÇİN KÜTÜPHANE PROGRAMI" title="Okul kütüphanesi işlemleri tek ve güvenli bir panelde." intro="Kitap kataloğundan üyelik kayıtlarına, ödünç vermeden raf sayımına kadar günlük kütüphane işlerini düzenli ve ölçülebilir hale getirin." features={[
    { title: "Kitap kataloğu ve Excel aktarımı", text: "Mevcut kitap listenizi Excel dosyasından topluca aktarın. Kitapları kategori, tür, raf, yazar, ISBN ve demirbaş numarasıyla düzenleyin." },
    { title: "Öğrenci ve üye yönetimi", text: "Öğrenci, öğretmen ve diğer çalışanları ayrı üye gruplarıyla yönetin. Üye geçmişini ve aldığı kitapları tek ekrandan görüntüleyin." },
    { title: "Ödünç, iade ve gecikme takibi", text: "Kitapları QR, öğrenci numarası, demirbaş numarası veya ISBN ile bulun. Ödünç ve iade hareketlerini anında kaydedin." },
  ]}>
    <section className="marketing-copy"><h2>Okul kütüphanesi programı ne sağlar?</h2><p>Kâğıt defterler ve birbirinden kopuk tablolar yerine bütün işlemler aynı okul hesabında tutulur. Yetkili kullanıcılar kitapların rafta mı, ödünçte mi veya kayıp mı olduğunu görebilir; öğrencilerin okuma hareketlerini inceleyebilir ve tarih aralığına göre rapor oluşturabilir.</p><p>Çok okullu yapı sayesinde her okulun üyeleri, kitapları ve raporları diğer okullardan ayrıdır. Yönetici, kütüphane görevlisi ve öğrenci hesapları kendilerine verilen yetkilere göre çalışır.</p></section>
  </MarketingPage>;
}
