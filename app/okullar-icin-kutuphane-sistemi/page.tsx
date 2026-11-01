import type { Metadata } from "next";
import MarketingPage from "../marketing-page";

export const metadata: Metadata = {
  title: "Okullar İçin Kütüphane Sistemi | 30 Gün Deneme",
  description: "Okulların kitap, öğrenci ve ödünç kayıtlarını ayrı ve güvenli alanlarda yöneten, 30 günlük deneme sunan kütüphane sistemi.",
  alternates: { canonical: "/okullar-icin-kutuphane-sistemi" },
};

export default function Page() {
  return <MarketingPage eyebrow="OKUL YÖNETİCİLERİ VE KÜTÜPHANE SORUMLULARI İÇİN" title="Kurulumu kolay, okul bazlı kütüphane yönetimi." intro="Okul başvurusu onaylandığında okulunuza ait güvenli yönetim alanı açılır ve 30 günlük deneme süresi başlar." features={[
    { title: "Okula özel çalışma alanı", text: "Her okul kendi kurum kodu, kullanıcıları, üyeleri ve kitap kataloğuyla çalışır. Başka okulların kayıtlarına erişemez." },
    { title: "Rol bazlı kullanım", text: "Yönetici ve görevliler için ayrı yetkiler tanımlanabilir; öğrenciler üyelik başvurusu yapabilir ve izin verilen alanlara erişebilir." },
    { title: "Her cihazdan erişim", text: "Ek program kurulumu gerektirmeden güncel internet tarayıcılarında bilgisayar, tablet ve telefon üzerinden çalışır." },
  ]}>
    <section className="marketing-copy"><h2>Başvuru ve kullanım süreci</h2><ol><li>Ana sayfadaki “Okulunuz için kullanım başvurusu yapın” seçeneğini açın.</li><li>Okul ve yönetici bilgilerini girerek başvuruyu gönderin.</li><li>Merkez onayından sonra okul hesabınız ve 30 günlük deneme erişiminiz etkinleşir.</li><li>Kitaplarınızı Excel’den aktarın, üyeleri ekleyin ve ödünç işlemlerine başlayın.</li></ol></section>
  </MarketingPage>;
}
