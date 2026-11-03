import type { Metadata } from "next";
import MarketingPage from "../marketing-page";

const faqs = [
  { q: "Program hangi okullar için uygundur?", a: "İlkokul, ortaokul ve lise kütüphaneleri ile birden fazla okulun ayrı hesaplarla yönetildiği yapılar için uygundur." },
  { q: "Kitaplar Excel dosyasından aktarılabilir mi?", a: "Evet. Kitaplar Excel dosyasından toplu olarak aktarılabilir; boş alanlar boş bırakılır ve aynı benzersiz kimliğin ikinci kez kaydedilmesi engellenir." },
  { q: "Öğretmenler ve çalışanlar üye olabilir mi?", a: "Evet. Öğrencilerin yanında öğretmenler ve diğer çalışanlar da ayrı üye grupları olarak kaydedilebilir." },
  { q: "Kitap sayımı yapılabilir mi?", a: "Evet. Kategori, raf ve yazar filtreleriyle envanter sayımı yapılabilir; eksik, kayıp ve yeniden bulunan kitaplar yönetilebilir." },
  { q: "Deneme süresi var mı?", a: "Yeni okul hesaplarına ilk kullanımdan itibaren 30 günlük ücretsiz deneme süresi tanımlanır." },
];

export const metadata: Metadata = {
  title: "Sıkça Sorulan Sorular | Okul Kütüphane Programı",
  description: "Okul kütüphane programının Excel aktarımı, üyeler, ödünç işlemleri, sayım, güvenlik ve deneme süresi hakkında sorular.",
  alternates: { canonical: "/sikca-sorulan-sorular" },
};

export default function Page() {
  const schema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) };
  return <MarketingPage eyebrow="SIKÇA SORULAN SORULAR" title="Okul kütüphane sistemi hakkında merak edilenler." intro="Kurulum, veri aktarımı, üyeler, kitap sayımı ve deneme süresiyle ilgili kısa yanıtlar." features={[]}>
    <section className="faq-list">{faqs.map((item) => <details key={item.q}><summary>{item.q}</summary><p>{item.a}</p></details>)}</section>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
  </MarketingPage>;
}
