import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.okulkutuphanesi.com"),
  title: "Okul Kütüphane Otomasyonu",
  description: "Öğrenci, kitap, ödünç, iade, gecikme ve okuma raporlarını tek panelde yönetin.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Okul Kütüphane Otomasyonu",
    description: "Kitaplar, öğrenciler ve okuma kültürü tek merkezde.",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Okul Kütüphane Otomasyonu" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Okul Kütüphane Otomasyonu",
    description: "Kitaplar, öğrenciler ve okuma kültürü tek merkezde.",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
