import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/okul-kutuphanesi-programi", "/kutuphane-otomasyonu", "/ozellikler", "/okullar-icin-kutuphane-sistemi", "/sikca-sorulan-sorular"];
  return routes.map((route, index) => ({
    url: `https://okulkutuphanesi.com.tr${route || "/"}`,
    lastModified: new Date("2026-09-01"),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.8,
  }));
}
