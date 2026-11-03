import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/signout-with-chatgpt"] },
    sitemap: "https://okulkutuphanesi.com.tr/sitemap.xml",
    host: "https://okulkutuphanesi.com.tr",
  };
}
