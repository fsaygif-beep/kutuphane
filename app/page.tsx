import LibraryApp from "./library-app";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) {
    return (
      <main className="login-page">
        <section className="login-panel">
          <div className="login-brand"><span className="mark">K</span><div><strong>Okul Kütüphane Otomasyonu</strong><small>Güvenli ve rol tabanlı erişim</small></div></div>
          <div className="login-copy"><p className="eyebrow">KÜTÜPHANENİZE HOŞ GELDİNİZ</p><h1>Kitaplara ve okulunuzdaki görevlerinize tek hesaptan ulaşın.</h1><p>Girişten sonra hesabınıza yönetici tarafından tanımlanan panel otomatik açılır.</p></div>
          <div className="role-cards">
            <article><span>⚙</span><strong>Yönetici</strong><p>Kurum ayarları, kullanıcılar, raporlar ve tüm kayıtlar.</p></article>
            <article><span>▤</span><strong>Kütüphane sorumlusu</strong><p>Kitap, öğrenci, ödünç, iade, sayım ve rapor işlemleri.</p></article>
            <article><span>◉</span><strong>Öğrenci</strong><p>Kitap kataloğu, kendi ödünçleri, talepler ve güvenli öneriler.</p></article>
          </div>
          <a className="login-button" href={chatGPTSignInPath("/")}>Güvenli giriş yap <span>→</span></a>
          <p className="login-note">Öğrenci hesapları okul kaydıyla eşleştirilir ve yönetici onayından sonra açılır.</p>
        </section>
        <aside className="login-visual"><img src="/reading-hero.png" alt="Kütüphanede kitap okuyan öğrenciler" /><div><strong>Her okul için, her yerden erişim</strong><p>İnternet bağlantısı olan bilgisayar, tablet ve telefondan kullanılabilir.</p></div></aside>
      </main>
    );
  }
  return <LibraryApp />;
}
