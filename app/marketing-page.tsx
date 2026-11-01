import Link from "next/link";

type Feature = { title: string; text: string };

export default function MarketingPage({ eyebrow, title, intro, features, children }: {
  eyebrow: string;
  title: string;
  intro: string;
  features: Feature[];
  children?: React.ReactNode;
}) {
  return <main className="marketing-page">
    <header className="marketing-header">
      <Link className="marketing-brand" href="/"><span className="mark">K</span><span><strong>Okul Kütüphane Otomasyonu</strong><small>Okullar için çevrim içi kütüphane yönetimi</small></span></Link>
      <nav aria-label="Tanıtım sayfaları">
        <Link href="/ozellikler">Özellikler</Link>
        <Link href="/okullar-icin-kutuphane-sistemi">Okullar için</Link>
        <Link href="/sikca-sorulan-sorular">Sıkça sorulanlar</Link>
        <Link className="marketing-login" href="/">Giriş yap</Link>
      </nav>
    </header>
    <section className="marketing-hero">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{intro}</p><div className="marketing-actions"><Link className="primary-link" href="/">Okul başvurusu yap</Link><Link href="/ozellikler">Özellikleri incele</Link></div></div>
      <img src="/reading-hero.png" alt="Okul kütüphanesinde kitap okuyan öğrenciler" />
    </section>
    <section className="marketing-features" aria-label="Öne çıkan özellikler">{features.map((feature, index) => <article key={feature.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{feature.title}</h2><p>{feature.text}</p></article>)}</section>
    {children}
    <section className="marketing-cta"><div><p className="eyebrow">KÜTÜPHANENİZİ DİJİTALLEŞTİRİN</p><h2>Kitapları ve üyeleri tek merkezden yönetin.</h2><p>Okulunuz için kullanım başvurusu oluşturun; kütüphane işlemlerini bilgisayar, tablet veya telefondan takip edin.</p></div><Link className="primary-link" href="/">Programa giriş ve başvuru</Link></section>
    <footer><strong>Okul Kütüphane Otomasyonu</strong><nav><Link href="/okul-kutuphanesi-programi">Okul kütüphanesi programı</Link><Link href="/kutuphane-otomasyonu">Kütüphane otomasyonu</Link><Link href="/sikca-sorulan-sorular">Sıkça sorulan sorular</Link></nav></footer>
  </main>;
}
