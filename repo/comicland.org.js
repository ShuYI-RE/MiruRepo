// ==MiruExtension==
// @name         ComicLand
// @version      v0.0.1
// @author       Shahed
// @lang         en
// @license      MIT
// @package      comicland.org
// @type         manga
// @webSite      https://api.comicland.org/api
// @nsfw         true
// ==/MiruExtension==

// ComicLand serves a JSON API (not HTML) — every request below hits
// api.comicland.org/api/... directly with the browser-identity headers
// the API expects (Origin/Referer = comicland.org, matching how the
// site's own front-end calls it).

const IMG_LIMIT = 20;

export default class extends Extension {
  async req(path, params) {
    const qs = params
      ? "?" + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
      : "";
    return this.request(path + qs, {
      headers: {
        "Origin": "https://comicland.org",
        "Referer": "https://comicland.org/",
        "Accept": "application/json",
      },
    });
  }

  // ComicLand's cdn subdomain blocks hotlinking from outside the site;
  // the img subdomain serves the same files without that check.
  fixImg(u) {
    if (!u) return u;
    return u.replace(/cdn\.comicland\.org/g, "img.comicland.org");
  }

  formatItem(c) {
    return {
      url: c.slug || "",
      title: c.title || "",
      cover: this.fixImg(c.cover_url || c.cover || c.image || c.thumbnail || ""),
    };
  }

  extractList(resp) {
    const d = resp && resp.data;
    if (!d) return [];
    if (d.list) return d.list;
    if (d.items) return d.items;
    if (d.data && d.data.list) return d.data.list;
    if (d.data && d.data.items) return d.data.items;
    return [];
  }

  async latest(page) {
    const offset = (page - 1) * IMG_LIMIT;
    const res = await this.req("/comics", { offset, limit: IMG_LIMIT, status: "ongoing" });
    return this.extractList(res).map((c) => this.formatItem(c));
  }

  async search(kw, page) {
    const offset = ((page || 1) - 1) * IMG_LIMIT;
    const res = await this.req("/comic/search", { q: kw, offset, limit: IMG_LIMIT });
    const items = (res && res.data && res.data.items) || [];
    return items.map((c) => this.formatItem(c));
  }

  async detail(url) {
    const res = await this.req("/comic/detail", { slug: url });
    if (!res || !res.data) throw new Error("Comic not found.");
    const comic = res.data;

    const chapters = (comic.chapters || []).map((c) => ({
      name: c.title || `Chapter ${c.chapter_index}`,
      // watch() needs both slug + chapter index — encode both into the url
      url: `${url}::${c.chapter_index}`,
    }));

    return {
      title: comic.title || "",
      cover: this.fixImg(comic.cover_url || comic.cover || ""),
      desc: comic.description || comic.desc || "",
      episodes: [
        {
          title: "Chapters",
          urls: chapters,
        },
      ],
    };
  }

  async watch(url) {
    const [slug, indexStr] = url.split("::");
    const index = parseInt(indexStr, 10);
    const res = await this.req("/chapter/pages_by_index", { slug, index });
    const pages = (res && res.data && res.data.pages) || [];
    return {
      urls: pages.map((p) => this.fixImg(p)),
    };
  }
}
