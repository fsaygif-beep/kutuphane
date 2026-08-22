import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Çankırı Lisesi Kütüphanesi",
  description: "Öğrenci, kitap, ödünç, iade, gecikme ve okuma raporlarını tek panelde yönetin.",
  openGraph: {
    title: "Çankırı Lisesi Kütüphanesi",
    description: "Kitaplar, öğrenciler ve okuma kültürü tek merkezde.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Çankırı Lisesi Kütüphanesi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Çankırı Lisesi Kütüphanesi",
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
