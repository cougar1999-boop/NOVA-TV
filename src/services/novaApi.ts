import { NovaSource, NovaItem, NovaCategory, StalkerEpisodeRaw } from "../types";
import { getDeviceId } from "./novaStorage";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

// -------------------------------------------------------------
// STALKER PORTAL API
// -------------------------------------------------------------
export async function stalkerApi(action: string, source: NovaSource, extra: Record<string, any> = {}) {
  const response = await fetch("/api/stalker.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      action,
      portal: source.portal,
      mac: source.mac,
      model: source.model || "MAG254",
      token: source.token || "",
      session_id: source.session_id || "",
      serial_number: source.serial_number || "",
      device_id: getDeviceId(),
      ...extra,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Stalker request failed (HTTP ${response.status})`);
  }

  // Update session credentials on source if returned
  if (data.token) source.token = data.token;
  if (data.session_id) source.session_id = data.session_id;

  return data;
}

export async function stalkerHandshake(source: NovaSource) {
  const res = await stalkerApi("handshake", source);
  source.token = res.token || source.token || "";
  source.session_id = res.session_id || res.token || source.session_id || "";
  return res;
}

export function getSafeImageUrl(rawUrl: string | undefined | null, portalBase?: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  // If already relative /api/image.php, return as-is
  if (trimmed.startsWith("/api/image.php")) return trimmed;

  let fullUrl = trimmed;
  if (trimmed.startsWith("/") && portalBase) {
    try {
      const pUrl = new URL(portalBase);
      fullUrl = `${pUrl.origin}${trimmed}`;
    } catch {
      fullUrl = trimmed;
    }
  }

  // Any http:// or external image, route through image proxy to prevent Mixed Content & CORS blocks
  if (fullUrl.startsWith("http://") || fullUrl.startsWith("https://")) {
    return `/api/image.php?url=${encodeURIComponent(fullUrl)}`;
  }

  return fullUrl;
}

export async function stalkerGetGenres(source: NovaSource): Promise<NovaCategory[]> {
  try {
    await stalkerHandshake(source);
    const genreData = await stalkerApi("genres", source);
    const raw = Array.isArray(genreData?.genres) ? genreData.genres : [];
    const categories: NovaCategory[] = [];
    raw.forEach((g: any) => {
      const id = String(g.id ?? "").trim();
      const title = String(g.title || g.name || g.category_name || "").trim();
      if (id && id !== "*" && title) {
        categories.push({ id, name: title });
      }
    });
    source.liveCategories = categories;
    return categories;
  } catch (err) {
    console.warn("Could not load Stalker genres:", err);
    return [];
  }
}

export async function stalkerLoadChannels(
  source: NovaSource
): Promise<{ channels: NovaItem[]; categories: NovaCategory[] }> {
  await stalkerHandshake(source);

  // Parallel fetch channels and genres
  const [data, genres] = await Promise.all([
    stalkerApi("channels", source).catch(() => ({ channels: [] })),
    stalkerGetGenres(source).catch(() => []),
  ]);

  const genreMap: Record<string, string> = {};
  genres.forEach((c) => {
    genreMap[c.id] = c.name;
  });

  const raw = Array.isArray(data.channels) ? data.channels : [];

  const channels: NovaItem[] = raw.map((ch: any) => {
    const catId = String(ch.tv_genre_id ?? ch.genre_id ?? ch.category_id ?? ch.tv_genre ?? "").trim();
    const groupName = genreMap[catId] || ch.group || ch.tv_genre_name || ch.genre_name || "Algemeen";
    const rawLogo = ch.logo || ch.logo_url || "";
    const logo = getSafeImageUrl(rawLogo, source.portal);

    return {
      id: String(ch.id ?? ch.channel_id ?? createId()),
      number: ch.number || ch.channel_number || "",
      name: ch.name || "Channel",
      categoryId: catId,
      group: groupName,
      logo,
      cmd: ch.cmd || "",
      mediaType: "live",
    };
  });

  return { channels, categories: genres };
}

export async function stalkerLoadMovies(
  source: NovaSource,
  categoryId: string = "all",
  page: number = 1
): Promise<{ items: NovaItem[]; categories: NovaCategory[]; totalPages: number; totalItems: number }> {
  await stalkerHandshake(source);
  const res = await stalkerApi("media", source, {
    media_type: "movie",
    category_id: categoryId === "all" ? "" : categoryId,
    page: String(page),
  });

  const categories: NovaCategory[] = (Array.isArray(res.categories) ? res.categories : [])
    .map((c: any) => ({
      id: String(c.id ?? c.category_id ?? "").trim(),
      name: String(c.title || c.category_name || c.name || "Films").trim(),
    }))
    .filter((c: any) => c.id !== "" && c.id !== "*");

  const catMap: Record<string, string> = {};
  categories.forEach((c) => (catMap[c.id] = c.name));

  const raw = Array.isArray(res.items) ? res.items : Array.isArray(res.data) ? res.data : [];
  const items: NovaItem[] = raw.map((m: any) => {
    const id = String(m.id ?? m.movie_id ?? m.video_id ?? createId());
    const cId = String(m.category_id ?? m.genre_id ?? "").trim();
    return {
      id,
      movieId: id,
      name: m.name || m.title || "Movie",
      categoryId: cId,
      group: catMap[cId] || m.category_name || "Films",
      logo: getSafeImageUrl(m.screenshot_uri || m.cover || m.poster || m.movie_image || m.logo || "", source.portal),
      cmd: m.cmd || m.url || `/media/${id}.mpg`,
      mediaType: "movie",
      year: m.year || "",
    };
  });

  return {
    items,
    categories,
    totalPages: Number(res.total_pages) || 1,
    totalItems: Number(res.total_items) || items.length,
  };
}

export async function stalkerLoadSeries(
  source: NovaSource,
  categoryId: string = "all",
  page: number = 1
): Promise<{ items: NovaItem[]; categories: NovaCategory[]; totalPages: number; totalItems: number }> {
  await stalkerHandshake(source);
  const res = await stalkerApi("media", source, {
    media_type: "series",
    category_id: categoryId === "all" ? "" : categoryId,
    page: String(page),
  });

  const categories: NovaCategory[] = (Array.isArray(res.categories) ? res.categories : [])
    .map((c: any) => ({
      id: String(c.id ?? c.category_id ?? "").trim(),
      name: String(c.title || c.category_name || c.name || "Series").trim(),
    }))
    .filter((c: any) => c.id !== "" && c.id !== "*");

  const catMap: Record<string, string> = {};
  categories.forEach((c) => (catMap[c.id] = c.name));

  const raw = Array.isArray(res.items) ? res.items : Array.isArray(res.data) ? res.data : [];
  const items: NovaItem[] = raw.map((s: any) => {
    const id = String(s.series_id ?? s.id ?? s.video_id ?? s.movie_id ?? createId());
    const cId = String(s.category_id ?? s.genre_id ?? "").trim();
    return {
      id,
      seriesId: id,
      parentSeriesId: String(s.video_id ?? s.movie_id ?? id),
      videoId: s.video_id != null ? String(s.video_id) : "",
      movieId: s.movie_id != null ? String(s.movie_id) : "",
      name: s.name || s.title || "Series",
      categoryId: cId,
      group: catMap[cId] || s.category_name || "Series",
      logo: getSafeImageUrl(s.cover || s.cover_big || s.poster || s.logo || s.screenshot_uri || "", source.portal),
      cmd: s.cmd || "",
      mediaType: "series",
    };
  });

  return {
    items,
    categories,
    totalPages: Number(res.total_pages) || 1,
    totalItems: Number(res.total_items) || items.length,
  };
}

/**
 * Robust extraction of Stalker series episodes.
 * Supports all Ministra / Stalker Middleware variations and response shapes.
 */
export async function stalkerLoadSeriesEpisodes(
  source: NovaSource,
  show: NovaItem,
  seasonId?: string
): Promise<{ episodes: NovaItem[]; seasons: Record<string, NovaItem[]> }> {
  await stalkerHandshake(source);

  const seriesId = show.seriesId || show.id;
  const res = await stalkerApi("media", source, {
    media_type: "series_info",
    series_id: seriesId,
    parent_series_id: show.parentSeriesId || seriesId,
    video_id: show.videoId || "",
    movie_id: show.movieId || "",
    season_id: seasonId || "",
    cmd: show.cmd || "",
  });

  // Extract raw data from all possible response keys
  const data = res.data !== undefined ? res.data : res;

  // 1. Check if backend or portal provided nested season map
  const seasonsMap: Record<string, StalkerEpisodeRaw[]> = {};
  const rawList: StalkerEpisodeRaw[] = [];

  const candidateSeasons = data?.seasons || data?.episodes;
  if (candidateSeasons && typeof candidateSeasons === "object" && !Array.isArray(candidateSeasons)) {
    Object.keys(candidateSeasons).forEach((sKey) => {
      const list = Array.isArray(candidateSeasons[sKey]) ? candidateSeasons[sKey] : [];
      seasonsMap[sKey] = list;
      list.forEach((ep) => rawList.push({ ...ep, seasonNumber: sKey }));
    });
  } else if (Array.isArray(data?.items)) {
    rawList.push(...data.items);
  } else if (Array.isArray(data?.episodes)) {
    rawList.push(...data.episodes);
  } else if (Array.isArray(data?.data)) {
    rawList.push(...data.data);
  } else if (Array.isArray(data)) {
    rawList.push(...data);
  } else if (Array.isArray(res?.items)) {
    rawList.push(...res.items);
  }

  // If seasonsMap wasn't built yet, organize rawList by season
  if (rawList.length && !Object.keys(seasonsMap).length) {
    rawList.forEach((ep) => {
      const sNum = String(
        ep.seasonNumber ?? ep.season_number ?? ep.season_num ?? ep.season ?? ep.season_id ?? "1"
      );
      if (!seasonsMap[sNum]) seasonsMap[sNum] = [];
      seasonsMap[sNum].push(ep);
    });
  }

  const finalEpisodes: NovaItem[] = [];
  const finalSeasons: Record<string, NovaItem[]> = {};

  const seasonKeys = Object.keys(seasonsMap).sort((a, b) => Number(a) - Number(b));

  seasonKeys.forEach((sKey) => {
    finalSeasons[sKey] = [];
    const list = seasonsMap[sKey] || [];

    list.forEach((ep, idx) => {
      const epId = String(ep.id ?? ep.episode_id ?? ep.stream_id ?? `${seriesId}-${sKey}-${idx + 1}`);
      const epNum = ep.series_number ?? ep.episode_num ?? (idx + 1);
      const title = ep.title || ep.name || `Episode ${epNum}`;
      const epCmd = ep.cmd || ep.url || `/media/${epId}.mpg`;

      const item: NovaItem = {
        id: epId,
        episodeId: epId,
        seriesId: String(ep.series_id ?? show.seriesId ?? seriesId),
        parentSeriesId: String(show.parentSeriesId ?? seriesId),
        seasonId: String(ep.season_id ?? sKey),
        seasonNumber: sKey,
        episodeNumber: epNum,
        name: title,
        group: `Season ${sKey}`,
        logo: getSafeImageUrl(ep.movie_image || ep.screenshot_uri || ep.cover || ep.cover_big || show.logo || "", source.portal),
        cmd: epCmd,
        mediaType: "episode",
      };

      finalEpisodes.push(item);
      finalSeasons[sKey].push(item);
    });
  });

  return { episodes: finalEpisodes, seasons: finalSeasons };
}

/**
 * Resolves playable Stalker stream URL via create_link action.
 * Always requests a fresh link from the portal to acquire a valid play_token.
 */
export async function stalkerResolvePlayUrl(source: NovaSource, item: NovaItem): Promise<string> {
  // Priority 1: If item.cmd is already a full streaming URL or base64 command
  if (item.cmd) {
    let clean = item.cmd.replace(/^ffmpeg\s+/i, "").replace(/^ffrt\s+/i, "").trim();
    if ((clean.startsWith("/") || clean.startsWith("./")) && source.portal) {
      clean = new URL(clean, source.portal).href;
    }
    if (/^https?:\/\//i.test(clean)) {
      if (item.id && /([?&]stream=)(&|$)/.test(clean)) {
        clean = clean.replace(/([?&]stream=)(&|$)/, `$1${item.id}$2`);
      }
      return clean;
    }
  }

  const cmd = item.cmd || (item.mediaType === "episode" || item.mediaType === "movie" ? `/media/${item.id}.mpg` : "");

  try {
    const res = await stalkerApi("create_link", source, {
      cmd: cmd,
      channel_id: item.id,
      series_id: item.seriesId || item.parentSeriesId || "",
      season_id: item.seasonId || "",
      season_number: item.seasonNumber || "1",
      episode_id: item.episodeId || item.id || "",
      episode_num: item.episodeNumber || "1",
      media_type: item.mediaType || "live",
    });

    let url = res.url || res.cmd || "";
    url = String(url).replace(/^ffmpeg\s+/i, "").trim();

    // If relative path, prepend portal URL
    if ((url.startsWith("/") || url.startsWith("./")) && source.portal) {
      url = new URL(url, source.portal).href;
    }

    // If stream parameter is missing or empty, preserve the channel/episode id
    if (item.id && /([?&]stream=)(&|$)/.test(url)) {
      url = url.replace(/([?&]stream=)(&|$)/, `$1${item.id}$2`);
    }

    if (url && /^https?:\/\//i.test(url)) {
      return url;
    }
  } catch (err) {
    console.warn("create_link failed, trying fallback from item.cmd/url:", err);
  }

  // Fallback: if item.cmd is a full streaming URL
  if (item.cmd) {
    let clean = item.cmd.replace(/^ffmpeg\s+/i, "").trim();
    if (clean.startsWith("/") && source.portal) {
      clean = new URL(clean, source.portal).href;
    }
    if (/^https?:\/\//i.test(clean)) {
      return clean;
    }
  }

  if (item.url && /^https?:\/\//i.test(item.url)) {
    return item.url;
  }

  throw new Error("Geen afspeelbare stream URL ontvangen van het portaal.");
}

// -------------------------------------------------------------
// XTREAM CODES API
// -------------------------------------------------------------
export async function xtreamQuery(source: NovaSource, params: Record<string, string> = {}) {
  const query = new URLSearchParams({
    server: source.server || "",
    username: source.username || "",
    password: source.password || "",
    device_id: getDeviceId(),
    ...params,
  });

  const response = await fetch(`/api/xtream.php?${query.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    throw new Error(data.error || `Xtream request failed (HTTP ${response.status})`);
  }

  return data.data !== undefined ? data.data : data;
}

export async function xtreamLoadChannels(source: NovaSource): Promise<NovaItem[]> {
  const [cats, streams] = await Promise.all([
    xtreamQuery(source, { action: "get_live_categories" }),
    xtreamQuery(source, { action: "get_live_streams" }),
  ]);

  const catMap: Record<string, string> = {};
  if (Array.isArray(cats)) {
    cats.forEach((c: any) => {
      if (c && c.category_id) catMap[String(c.category_id)] = c.category_name || "Live TV";
    });
  }

  const raw = Array.isArray(streams) ? streams : [];
  return raw
    .map((c: any) => {
      const streamId = c.stream_id;
      if (streamId == null) return null;
      const cId = String(c.category_id ?? "");
      return {
        id: String(streamId),
        number: c.num || "",
        name: c.name || "Channel",
        group: catMap[cId] || "Live TV",
        logo: c.stream_icon || c.logo || "",
        url: `${source.server}/live/${encodeURIComponent(source.username || "")}/${encodeURIComponent(source.password || "")}/${streamId}.m3u8`,
        mediaType: "live" as const,
      };
    })
    .filter(Boolean) as NovaItem[];
}

export async function xtreamLoadMovies(source: NovaSource): Promise<{ items: NovaItem[]; categories: NovaCategory[] }> {
  const [cats, streams] = await Promise.all([
    xtreamQuery(source, { action: "get_vod_categories" }),
    xtreamQuery(source, { action: "get_vod_streams" }),
  ]);

  const categories: NovaCategory[] = (Array.isArray(cats) ? cats : []).map((c: any) => ({
    id: String(c.category_id ?? ""),
    name: c.category_name || "Movies",
  }));

  const catMap: Record<string, string> = {};
  categories.forEach((c) => (catMap[c.id] = c.name));

  const raw = Array.isArray(streams) ? streams : [];
  const items: NovaItem[] = raw
    .map((m: any) => {
      const id = m.stream_id;
      if (id == null) return null;
      const ext = m.container_extension || "mp4";
      const cId = String(m.category_id ?? "");
      return {
        id: String(id),
        name: m.name || "Movie",
        group: catMap[cId] || "Movies",
        logo: m.stream_icon || m.logo || "",
        url: `${source.server}/movie/${encodeURIComponent(source.username || "")}/${encodeURIComponent(source.password || "")}/${id}.${ext}`,
        mediaType: "movie" as const,
        year: m.year,
      };
    })
    .filter(Boolean) as NovaItem[];

  return { items, categories };
}

export async function xtreamLoadSeries(source: NovaSource): Promise<{ items: NovaItem[]; categories: NovaCategory[] }> {
  const [cats, seriesList] = await Promise.all([
    xtreamQuery(source, { action: "get_series_categories" }),
    xtreamQuery(source, { action: "get_series" }),
  ]);

  const categories: NovaCategory[] = (Array.isArray(cats) ? cats : []).map((c: any) => ({
    id: String(c.category_id ?? ""),
    name: c.category_name || "Series",
  }));

  const catMap: Record<string, string> = {};
  categories.forEach((c) => (catMap[c.id] = c.name));

  const raw = Array.isArray(seriesList) ? seriesList : [];
  const items: NovaItem[] = raw
    .map((s: any) => {
      const id = String(s.series_id ?? s.id ?? "");
      if (!id) return null;
      const cId = String(s.category_id ?? "");
      return {
        id,
        seriesId: id,
        name: s.name || "Series",
        group: catMap[cId] || "Series",
        logo: s.cover || s.cover_big || s.stream_icon || "",
        mediaType: "series" as const,
      };
    })
    .filter(Boolean) as NovaItem[];

  return { items, categories };
}

export async function xtreamLoadSeriesEpisodes(
  source: NovaSource,
  show: NovaItem
): Promise<{ episodes: NovaItem[]; seasons: Record<string, NovaItem[]> }> {
  const data = await xtreamQuery(source, {
    action: "get_series_info",
    series_id: show.seriesId || show.id,
  });

  const seasonsData = data?.episodes || data?.seasons || {};
  const episodes: NovaItem[] = [];
  const seasons: Record<string, NovaItem[]> = {};

  Object.keys(seasonsData).forEach((seasonNum) => {
    seasons[seasonNum] = [];
    const list = Array.isArray(seasonsData[seasonNum]) ? seasonsData[seasonNum] : [];

    list.forEach((ep: any) => {
      const id = ep.id ?? ep.episode_id ?? ep.stream_id;
      if (id == null) return;
      const ext = ep.container_extension || ep.containerExtension || "mp4";
      const epNum = ep.episode_num ?? ep.episodeNumber ?? "";
      const name = ep.title || ep.name || `Episode ${epNum}`;

      const item: NovaItem = {
        id: String(id),
        episodeId: String(id),
        seriesId: show.seriesId || show.id,
        name,
        group: `Season ${seasonNum}`,
        seasonNumber: seasonNum,
        episodeNumber: epNum,
        logo: ep.movie_image || ep.cover_big || show.logo || "",
        url: `${source.server}/series/${encodeURIComponent(source.username || "")}/${encodeURIComponent(source.password || "")}/${id}.${ext}`,
        mediaType: "episode",
      };

      episodes.push(item);
      seasons[seasonNum].push(item);
    });
  });

  return { episodes, seasons };
}

// -------------------------------------------------------------
// M3U PARSER & LOADER
// -------------------------------------------------------------
export function parseM3U(text: string): NovaItem[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const result: NovaItem[] = [];
  let pending: Partial<NovaItem> | null = null;

  for (const line of lines) {
    if (!line) continue;
    if (line.toUpperCase().startsWith("#EXTINF")) {
      const comma = line.indexOf(",");
      const attrs = comma !== -1 ? line.substring(0, comma) : line;
      const name = comma !== -1 ? line.substring(comma + 1).trim() : "Channel";

      const getAttr = (k: string) => {
        const match = attrs.match(new RegExp(`${k}="([^"]*)"`, "i"));
        return match ? match[1] : "";
      };

      pending = {
        name: name || "Channel",
        group: getAttr("group-title") || "Live TV",
        logo: getAttr("tvg-logo") || "",
        number: getAttr("tvg-chno") || getAttr("tvg-id") || "",
      };
      continue;
    }

    if (line.startsWith("#")) continue;

    if (/^https?:\/\//i.test(line)) {
      const item = pending || { name: "Channel", group: "Live TV", logo: "" };
      result.push({
        id: createId(),
        name: item.name || "Channel",
        group: item.group || "Live TV",
        logo: item.logo || "",
        number: item.number || "",
        url: line,
        mediaType: /\.(mp4|mkv|avi|mov)$/i.test(line) ? "movie" : "live",
      });
      pending = null;
    }
  }

  return result;
}

export async function fetchM3U(url: string): Promise<NovaItem[]> {
  const res = await fetch(`/api/m3u.php?url=${encodeURIComponent(url)}&device_id=${getDeviceId()}`);
  if (!res.ok) throw new Error(`Could not load M3U: HTTP ${res.status}`);
  const text = await res.text();
  return parseM3U(text);
}

// -------------------------------------------------------------
// PROXIED STREAM URL BUILDER (Fixed for Stalker episodes & movies!)
// -------------------------------------------------------------
export function buildProxiedStreamUrl(
  url: string,
  source: NovaSource | null,
  item: NovaItem | null,
  resumeSeconds: number = 0,
  remux: boolean = false
): string {
  if (!url) return "";

  const params = new URLSearchParams({ url });
  const endpoint = remux ? "/api/remux.mp4" : "/api/stream.php";

  // IMPORTANT: For Stalker sources, ALL streams (Live TV, Movies, AND Series Episodes)
  // must go through the Stalker stream proxy with the correct headers & session!
  if (source?.type === "stalker") {
    if (source.session_id || source.token) {
      params.set("sid", source.session_id || source.token || "");
    }
    if (source.portal) {
      params.set("portal", source.portal);
    }
    if (source.mac) {
      params.set("mac", source.mac);
    }
    if (source.model) {
      params.set("model", source.model);
    }
    if (item?.id) {
      params.set("channel_id", String(item.id));
    }
    if (item?.mediaType) {
      params.set("media_type", item.mediaType);
    }
    if (resumeSeconds >= 10) {
      params.set("resume", String(Math.floor(resumeSeconds)));
      params.set("ss", String(Math.floor(resumeSeconds)));
    }

    return `${endpoint}?${params.toString()}`;
  }

  // For Xtream and M3U VOD
  if (item && (item.mediaType === "movie" || item.mediaType === "episode")) {
    if (source?.type === "xtream" && source.server) {
      params.set("referer", source.server);
    }
    const extMatch = String(url).match(/\.([a-z0-9]+)(?:[?#]|$)/i);
    if (extMatch && extMatch[1]) {
      params.set("ext", extMatch[1].toLowerCase());
    }
    params.set("vod", "1");
    if (resumeSeconds >= 10) {
      params.set("resume", String(Math.floor(resumeSeconds)));
    }
    // Route through local stream proxy or fallback
    return `${endpoint}?${params.toString()}`;
  }

  // Default live stream proxy
  if (source?.portal) params.set("referer", source.portal);
  return `${endpoint}?${params.toString()}`;
}
