// Dynamic sitemap.xml - includes EN + ES routes with hreflang alternates,
// plus FAQ categories with lastmod from the most recent FAQ update.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const BASE_URL = "https://spaholis.com";

const STATIC_ROUTES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/treatments-therapies", changefreq: "weekly", priority: "0.9" },
  { path: "/signature-treatments", changefreq: "monthly", priority: "0.8" },
  { path: "/book", changefreq: "weekly", priority: "0.9" },
  { path: "/classes", changefreq: "weekly", priority: "0.8" },
  { path: "/classes/schedule", changefreq: "daily", priority: "0.7" },
  { path: "/private-sessions", changefreq: "weekly", priority: "0.8" },
  { path: "/education", changefreq: "monthly", priority: "0.7" },
  { path: "/gift-cards", changefreq: "monthly", priority: "0.6" },
  { path: "/retreats", changefreq: "weekly", priority: "0.9" },
  { path: "/faqs", changefreq: "weekly", priority: "0.7" },
];

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const enUrl = (path: string) => `${BASE_URL}${path}`;
const esUrl = (path: string) => `${BASE_URL}${path === "/" ? "/es" : `/es${path}`}`;

function urlEntry(loc: string, alt: { en: string; es: string }, opts: { lastmod?: string; changefreq: string; priority: string }) {
  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>\n` +
    (opts.lastmod ? `    <lastmod>${opts.lastmod}</lastmod>\n` : "") +
    `    <changefreq>${opts.changefreq}</changefreq>\n` +
    `    <priority>${opts.priority}</priority>\n` +
    `    <xhtml:link rel="alternate" hreflang="en" href="${alt.en}" />\n` +
    `    <xhtml:link rel="alternate" hreflang="es" href="${alt.es}" />\n` +
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${alt.en}" />\n` +
    `  </url>`
  );
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: latestFaq } = await supabase
      .from("faqs")
      .select("updated_at")
      .eq("is_visible", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: categories } = await supabase
      .from("faq_categories")
      .select("slug, updated_at")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true });

    const faqsLastmod = latestFaq?.updated_at ?? new Date().toISOString();

    const urls: string[] = [];
    for (const r of STATIC_ROUTES) {
      const lastmod = r.path === "/faqs" ? faqsLastmod : undefined;
      const alt = { en: enUrl(r.path), es: esUrl(r.path) };
      urls.push(urlEntry(enUrl(r.path), alt, { lastmod, changefreq: r.changefreq, priority: r.priority }));
      urls.push(urlEntry(esUrl(r.path), alt, { lastmod, changefreq: r.changefreq, priority: r.priority }));
    }

    for (const c of categories ?? []) {
      const enLoc = `${BASE_URL}/faqs#faq-cat-${escapeXml(c.slug)}`;
      const esLoc = `${BASE_URL}/es/faqs#faq-cat-${escapeXml(c.slug)}`;
      const alt = { en: enLoc, es: esLoc };
      urls.push(urlEntry(enLoc, alt, { lastmod: c.updated_at, changefreq: "monthly", priority: "0.5" }));
      urls.push(urlEntry(esLoc, alt, { lastmod: c.updated_at, changefreq: "monthly", priority: "0.5" }));
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
      urls.join("\n") +
      `\n</urlset>\n`;

    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("sitemap error", err);
    return new Response("Internal error", { status: 500 });
  }
});
