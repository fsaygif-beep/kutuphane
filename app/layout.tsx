import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://okulkutuphanesi.com.tr"),
  title: "Okul Kütüphanesi Programı | Kütüphane Otomasyonu",
  description: "Okul kütüphanenizi tek panelden yönetin: kitap ve üye kayıtları, ödünç-iade, raf kontrolü, raporlar ve toplu Excel aktarımı.",
  applicationName: "Okul Kütüphane Otomasyonu",
  category: "education",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Okul Kütüphane Otomasyonu",
    title: "Okul Kütüphanesi Programı | Kütüphane Otomasyonu",
    description: "Kitap, üye, ödünç-iade, raf kontrolü ve raporları tek panelden yönetin.",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Okul Kütüphane Otomasyonu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Okul Kütüphanesi Programı | Kütüphane Otomasyonu",
    description: "Kitap, üye, ödünç-iade, raf kontrolü ve raporları tek panelden yönetin.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", "@id": "https://okulkutuphanesi.com.tr/#website", url: "https://okulkutuphanesi.com.tr/", name: "Okul Kütüphane Otomasyonu", inLanguage: "tr-TR" },
      { "@type": "SoftwareApplication", "@id": "https://okulkutuphanesi.com.tr/#software", name: "Okul Kütüphane Otomasyonu", url: "https://okulkutuphanesi.com.tr/", description: "Okullar için kitap, üye, ödünç-iade, raf kontrolü ve raporlama özellikleri sunan çevrim içi kütüphane yönetim programı.", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: "tr-TR" },
    ],
  };

  return (
    <html lang="tr">
      <body>
        {children}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      </body>
    </html>
  );
}
