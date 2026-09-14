import express, { Request, Response } from "express";
import path from "path";
import { spawn } from "child_process";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Helper: Ensure valid portal base URL ending with /
function normalizePortalUrl(rawPortal: string): string {
  let portal = (rawPortal || "").trim();
  if (!portal) return "";
  if (!/^https?:\/\//i.test(portal)) {
    portal = "http://" + portal;
  }
  return portal.replace(/\/+$/, "") + "/";
}

// Helper: Clean MAC address
function cleanMac(mac: string): string {
  return (mac || "")
    .toUpperCase()
    .replace(/[^0-9A-F:]/g, "");
}

// Common headers for Stalker Portal requests
function getStalkerHeaders(params: {
  mac?: string;
  token?: string;
  portal?: string;
  model?: string;
}) {
  const mac = cleanMac(params.mac || "");
  const model = params.model || "MAG254";
  const portal = normalizePortalUrl(params.portal || "");

  const headers: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250",
    "X-User-Agent": `Model: ${model}; Link: WiFi`,
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const cookies: string[] = [];
  if (mac) cookies.push(`mac=${encodeURIComponent(mac)}`);
  cookies.push("stb_lang=en");
  cookies.push("timezone=Europe%2FAmsterdam");

  if (cookies.length) {
    headers["Cookie"] = cookies.join("; ");
  }

  if (params.token) {
    headers["Authorization"] = `Bearer ${params.token}`;
  }

  if (portal) {
    headers["Referer"] = portal;
  }

  return headers;
}

// Request dispatcher to Stalker Portal load.php
async function stalkerFetch(
  portalUrl: string,
  queryParams: Record<string, string>,
  options: {
    mac?: string;
    token?: string;
    model?: string;
  } = {}
) {
  const base = normalizePortalUrl(portalUrl);
  // Stalker portals typically have server/load.php
  const loadUrl = new URL("server/load.php", base);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      loadUrl.searchParams.set(key, value);
    }
  }

  const headers = getStalkerHeaders({
    mac: options.mac,
    token: options.token,
    portal: portalUrl,
    model: options.model,
  });

  const response = await fetch(loadUrl.toString(), {
    method: "GET",
    headers,
  });

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// -------------------------------------------------------------
// STALKER API ROUTE (/api/stalker and /api/stalker.php)
// -------------------------------------------------------------
async function handleStalkerRequest(req: Request, res: Response) {
  try {
    const body = req.body || {};
    const action = body.action || req.query.action;
    const portal = body.portal || req.query.portal;
    const mac = body.mac || req.query.mac;
    const model = body.model || "MAG254";
    const token = body.token || "";
    const sessionId = body.session_id || "";

    if (!portal) {
      return res.status(400).json({ ok: false, error: "Portal URL is required." });
    }

    const basePortal = normalizePortalUrl(portal);

    // 1. HANDSHAKE
    if (action === "handshake") {
      const data = await stalkerFetch(
        basePortal,
        {
          type: "stb",
          action: "handshake",
          token: token,
          JsHttpRequest: "1-xml",
        },
        { mac, token, model }
      );

      let handshakeToken = "";
      let random = "";

      if (data && typeof data === "object") {
        const js = (data as any).js || data;
        handshakeToken = js.token || "";
        random = js.random || "";
      }

      return res.json({
        ok: true,
        token: handshakeToken || token,
        random: random,
        session_id: handshakeToken || token,
      });
    }

    // 2. CHANNELS (Live TV)
    if (action === "channels") {
      const data = await stalkerFetch(
        basePortal,
        {
          type: "itv",
          action: "get_all_channels",
          JsHttpRequest: "1-xml",
        },
        { mac, token, model }
      );

      const raw = (data && (data as any).js) ? (data as any).js.data || (data as any).js : [];
      const channels = Array.isArray(raw) ? raw : [];

      return res.json({
        ok: true,
        channels,
      });
    }

    // 3. GENRES (Live TV Categories)
    if (action === "genres") {
      const data = await stalkerFetch(
        basePortal,
        {
          type: "itv",
          action: "get_genres",
          JsHttpRequest: "1-xml",
        },
        { mac, token, model }
      );

      const raw = (data && (data as any).js) ? (data as any).js : [];
      const genres = Array.isArray(raw) ? raw : [];

      return res.json({
        ok: true,
        genres,
      });
    }

    // 4. MEDIA (Movies & Series & Series Episodes)
    if (action === "media" || action === "series_info" || action === "episodes") {
      const mediaType =
        action === "series_info" || action === "episodes"
          ? "series_info"
          : body.media_type || req.query.media_type || "movie";
      const page = String(body.page || req.query.page || "1");
      const categoryId = body.category_id || req.query.category_id || "";

      // 4A. MOVIES (VOD)
      if (mediaType === "movie") {
        // Fetch categories and ordered list
        const [catData, listData] = await Promise.all([
          stalkerFetch(
            basePortal,
            { type: "vod", action: "get_categories", JsHttpRequest: "1-xml" },
            { mac, token, model }
          ),
          stalkerFetch(
            basePortal,
            {
              type: "vod",
              action: "get_ordered_list",
              category: categoryId && categoryId !== "all" ? String(categoryId) : "*",
              p: page,
              sortby: "added",
              JsHttpRequest: "1-xml",
            },
            { mac, token, model }
          ),
        ]);

        const rawCats = (catData && (catData as any).js) ? (catData as any).js : [];
        const cats = Array.isArray(rawCats) ? rawCats : [];

        const listJs = (listData && (listData as any).js) ? (listData as any).js : {};
        const items = Array.isArray(listJs.data)
          ? listJs.data
          : Array.isArray(listJs)
          ? listJs
          : [];

        return res.json({
          ok: true,
          categories: cats,
          items,
          page: Number(listJs.cur_page || page) || 1,
          total_items: Number(listJs.total_items || items.length) || items.length,
          total_pages: Number(listJs.max_page_items)
            ? Math.ceil((Number(listJs.total_items) || items.length) / Number(listJs.max_page_items))
            : Math.ceil(items.length / 14) || 1,
        });
      }

      // 4B. SERIES LIST
      if (mediaType === "series") {
        // Try type=series, if empty fallback to type=vod with category or is_series
        let catData = await stalkerFetch(
          basePortal,
          { type: "series", action: "get_categories", JsHttpRequest: "1-xml" },
          { mac, token, model }
        );

        let rawCats = (catData && (catData as any).js) ? (catData as any).js : [];
        if (!Array.isArray(rawCats) || !rawCats.length) {
          catData = await stalkerFetch(
            basePortal,
            { type: "vod", action: "get_categories", JsHttpRequest: "1-xml" },
            { mac, token, model }
          );
          rawCats = (catData && (catData as any).js) ? (catData as any).js : [];
        }

        let listData = await stalkerFetch(
          basePortal,
          {
            type: "series",
            action: "get_ordered_list",
            category: categoryId && categoryId !== "all" ? String(categoryId) : "*",
            p: page,
            sortby: "added",
            JsHttpRequest: "1-xml",
          },
          { mac, token, model }
        );

        let listJs = (listData && (listData as any).js) ? (listData as any).js : {};
        let items = Array.isArray(listJs.data)
          ? listJs.data
          : Array.isArray(listJs)
          ? listJs
          : [];

        // If type=series was rejected or returned nothing, fallback to type=vod
        if (!items.length) {
          listData = await stalkerFetch(
            basePortal,
            {
              type: "vod",
              action: "get_ordered_list",
              category: categoryId && categoryId !== "all" ? String(categoryId) : "*",
              p: page,
              sortby: "added",
              JsHttpRequest: "1-xml",
            },
            { mac, token, model }
          );
          listJs = (listData && (listData as any).js) ? (listData as any).js : {};
          const vodItems = Array.isArray(listJs.data)
            ? listJs.data
            : Array.isArray(listJs)
            ? listJs
            : [];
          // Filter to items that are marked as series or have series field
          items = vodItems.filter((x: any) => x && (x.is_series == "1" || x.series || x.series_number || x.seasons));
          if (!items.length && vodItems.length) {
            items = vodItems;
          }
        }

        return res.json({
          ok: true,
          categories: Array.isArray(rawCats) ? rawCats : [],
          items,
          page: Number(listJs.cur_page || page) || 1,
          total_items: Number(listJs.total_items || items.length) || items.length,
          total_pages: Number(listJs.max_page_items)
            ? Math.ceil((Number(listJs.total_items) || items.length) / Number(listJs.max_page_items))
            : Math.ceil(items.length / 14) || 1,
        });
      }

      // 4C. SERIES INFO & EPISODES
      // Enhanced Stalker / Ministra series & seasons & episodes parser
      if (mediaType === "series_info") {
        const seriesId = String(body.series_id || body.movieId || body.video_id || "");
        const parentSeriesId = String(body.parent_series_id || seriesId);
        const seasonId = String(body.season_id || "");

        let detectedSeasons: Record<string, any[]> = {};
        let allNormalizedEpisodes: any[] = [];

        // Strategy 1: Fetch series seasons/episodes with movie_id={seriesId}
        const try1 = await stalkerFetch(
          basePortal,
          {
            type: "series",
            action: "get_ordered_list",
            movie_id: seriesId,
            ...(seasonId ? { season_id: seasonId } : {}),
            JsHttpRequest: "1-xml",
          },
          { mac, token, model }
        );

        const js1 = (try1 && (try1 as any).js) ? (try1 as any).js : try1;
        let rawItems: any[] = [];
        if (js1) {
          if (Array.isArray(js1.data)) rawItems = js1.data;
          else if (Array.isArray(js1)) rawItems = js1;
          else if (Array.isArray(js1.items)) rawItems = js1.items;
          else if (typeof js1.episodes === "object") {
            if (Array.isArray(js1.episodes)) rawItems = js1.episodes;
            else detectedSeasons = js1.episodes;
          }
        }

        // Stalker Ministra hierarchical structure check:
        // rawItems may be season entries (e.g. [{ id: "64285:1", name: "Season 1", series: [1,2,3,4], cmd: "..." }])
        if (rawItems.length && !Object.keys(detectedSeasons).length) {
          for (const item of rawItems) {
            let seasonObj = item;
            let sId = String(item.id || "");

            // If the season entry doesn't have the series array populated, fetch its details
            if (!Array.isArray(seasonObj.series) || !seasonObj.series.length) {
              try {
                const subData = await stalkerFetch(
                  basePortal,
                  {
                    type: "series",
                    action: "get_ordered_list",
                    movie_id: sId,
                    JsHttpRequest: "1-xml",
                  },
                  { mac, token, model }
                );
                const subJs = (subData && (subData as any).js) ? (subData as any).js : subData;
                const subList = Array.isArray(subJs?.data) ? subJs.data : Array.isArray(subJs) ? subJs : [];
                if (subList.length && Array.isArray(subList[0]?.series)) {
                  seasonObj = subList[0];
                }
              } catch {}
            }

            // Extract season number from name ("Season 1") or id ("64285:1")
            let sNum = "1";
            const sMatch = (seasonObj.name || "").match(/Season\s*(\d+)/i) || sId.match(/:(\d+)$/);
            if (sMatch && sMatch[1]) {
              sNum = sMatch[1];
            } else if (seasonObj.season_number) {
              sNum = String(seasonObj.season_number);
            }

            if (!detectedSeasons[sNum]) {
              detectedSeasons[sNum] = [];
            }

            // If seasonObj has an array of episode numbers (e.g. series: [1, 2, 3, 4])
            if (Array.isArray(seasonObj.series) && seasonObj.series.length) {
              seasonObj.series.forEach((epNumVal: any, idx: number) => {
                const epNum = Number(epNumVal) || (idx + 1);
                const epId = `${sId}:${epNum}`;
                const epTitle = `Aflevering ${epNum}`;
                const epCmd = seasonObj.cmd || sId;

                const ep = {
                  id: epId,
                  episode_id: epId,
                  episodeId: epId,
                  series_id: seriesId,
                  parent_series_id: parentSeriesId,
                  parentSeriesId: parentSeriesId,
                  season_id: sId,
                  season_number: sNum,
                  seasonNumber: sNum,
                  series_number: String(epNum),
                  episode_num: String(epNum),
                  episodeNumber: String(epNum),
                  name: epTitle,
                  title: epTitle,
                  cmd: epCmd,
                  url: "",
                  movie_image: seasonObj.screenshot_uri || seasonObj.pic || "",
                  logo: seasonObj.screenshot_uri || seasonObj.pic || "",
                  group: `Season ${sNum}`,
                  mediaType: "episode",
                };

                detectedSeasons[sNum].push(ep);
                allNormalizedEpisodes.push(ep);
              });
            } else if (seasonObj.cmd || seasonObj.file || seasonObj.name) {
              // Flat episode item inside season
              const epId = String(seasonObj.id || `${seriesId}-${sNum}-${detectedSeasons[sNum].length + 1}`);
              const epNum = seasonObj.series_number ?? seasonObj.episode_num ?? (detectedSeasons[sNum].length + 1);
              const epTitle = seasonObj.name || seasonObj.title || `Aflevering ${epNum}`;
              const ep = {
                id: epId,
                episode_id: epId,
                episodeId: epId,
                series_id: seriesId,
                parent_series_id: parentSeriesId,
                parentSeriesId: parentSeriesId,
                season_id: sId,
                season_number: sNum,
                seasonNumber: sNum,
                series_number: String(epNum),
                episode_num: String(epNum),
                episodeNumber: String(epNum),
                name: epTitle,
                title: epTitle,
                cmd: seasonObj.cmd || `/media/${epId}.mpg`,
                url: seasonObj.url || "",
                movie_image: seasonObj.screenshot_uri || seasonObj.pic || "",
                logo: seasonObj.screenshot_uri || seasonObj.pic || "",
                group: `Season ${sNum}`,
                mediaType: "episode",
              };

              detectedSeasons[sNum].push(ep);
              allNormalizedEpisodes.push(ep);
            }
          }
        }

        // Strategy 2: type=vod&action=get_ordered_list&movie_id={seriesId}
        if (!allNormalizedEpisodes.length) {
          const try2 = await stalkerFetch(
            basePortal,
            {
              type: "vod",
              action: "get_ordered_list",
              movie_id: seriesId,
              ...(seasonId ? { season_id: seasonId } : {}),
              JsHttpRequest: "1-xml",
            },
            { mac, token, model }
          );
          const js2 = (try2 && (try2 as any).js) ? (try2 as any).js : try2;
          const vodList = Array.isArray(js2?.data) ? js2.data : Array.isArray(js2) ? js2 : [];
          if (vodList.length) {
            vodList.forEach((ep: any, idx: number) => {
              const epId = String(ep.id || `${seriesId}-${idx + 1}`);
              const sNum = String(ep.season_number ?? ep.season ?? "1");
              const epNum = ep.series_number ?? ep.episode_num ?? (idx + 1);
              const epTitle = ep.title || ep.name || `Aflevering ${epNum}`;

              if (!detectedSeasons[sNum]) detectedSeasons[sNum] = [];

              const item = {
                id: epId,
                episode_id: epId,
                episodeId: epId,
                series_id: seriesId,
                parent_series_id: parentSeriesId,
                parentSeriesId: parentSeriesId,
                season_id: String(ep.season_id ?? sNum),
                season_number: sNum,
                seasonNumber: sNum,
                series_number: String(epNum),
                episode_num: String(epNum),
                episodeNumber: String(epNum),
                name: epTitle,
                title: epTitle,
                cmd: ep.cmd || `/media/${epId}.mpg`,
                url: ep.url || "",
                movie_image: ep.movie_image || ep.screenshot_uri || ep.cover || "",
                logo: ep.movie_image || ep.screenshot_uri || ep.cover || "",
                group: `Season ${sNum}`,
                mediaType: "episode",
              };
              detectedSeasons[sNum].push(item);
              allNormalizedEpisodes.push(item);
            });
          }
        }

        // Return structured seasons and episode list
        return res.json({
          ok: true,
          series_id: seriesId,
          episodes: detectedSeasons,
          seasons: detectedSeasons,
          items: allNormalizedEpisodes,
          data: {
            series_id: seriesId,
            episodes: detectedSeasons,
            seasons: detectedSeasons,
          },
        });
      }
    }

    // 5. CREATE LINK (Playback URL generation)
    // Supports Live TV, VOD Movies, and Stalker Series Episodes!
    if (action === "create_link") {
      const channelId = String(body.channel_id || body.id || "");
      const episodeId = String(body.episode_id || body.episodeId || channelId);
      const seriesId = String(body.series_id || body.seriesId || "");
      const mediaType = body.media_type || (body.episode_id || seriesId ? "episode" : "live");
      let cmd = String(body.cmd || "");

      // For live channels: if body.cmd is ALREADY a valid streaming URL with stream ID, use it directly!
      if (mediaType === "live" && cmd) {
        let directUrl = cmd.replace(/^ffmpeg\s+/i, "").trim();
        if (directUrl.startsWith("/") || directUrl.startsWith("./")) {
          directUrl = new URL(directUrl, basePortal).href;
        }
        if (/^https?:\/\//i.test(directUrl) && !/([?&]stream=)(&|$)/.test(directUrl)) {
          return res.json({
            ok: true,
            url: directUrl,
            cmd: directUrl,
          });
        }
      }

      // If cmd is empty, configure sensible default for portal
      if (!cmd) {
        if (mediaType === "live") {
          cmd = channelId ? `/media/${channelId}.mpg` : "";
        } else if (mediaType === "episode" || mediaType === "movie") {
          cmd = `/media/${episodeId || channelId}.mpg`;
        }
      }

      // For episodes or movies, prioritize type=vod with cmd (e.g. base64 season cmd)
      // For live TV, prioritize type=itv
      const typesToTry = mediaType === "episode" || mediaType === "movie"
        ? ["vod", "series", "stb", "itv"]
        : ["itv", "stb", "vod"];

      let playableUrl = "";
      let lastError = "";

      for (const t of typesToTry) {
        try {
          const queryParams: Record<string, string> = {
            type: t,
            action: "create_link",
            cmd: cmd || (mediaType === "live" ? channelId : `/media/${episodeId || channelId}.mpg`),
            series: String(body.episode_num || body.series_number || "0"),
            forced_storage: "undefined",
            disable_ad: "0",
            JsHttpRequest: "1-xml",
          };

          const targetId = episodeId || channelId;
          if (targetId) {
            if (t === "vod") {
              queryParams.movie_id = String(targetId);
              queryParams.vod_id = String(targetId);
              queryParams.episode = String(targetId);
            } else if (t === "series") {
              queryParams.episode_id = String(targetId);
              queryParams.movie_id = String(seriesId || targetId);
            }
          }

          const linkData = await stalkerFetch(basePortal, queryParams, { mac, token, model });
          const js = (linkData && (linkData as any).js) ? (linkData as any).js : linkData;

          let returnedCmd = "";
          if (typeof js === "string") {
            returnedCmd = js;
          } else if (js && typeof js === "object") {
            returnedCmd = js.cmd || js.url || js.data || "";
          }

          if (returnedCmd) {
            returnedCmd = returnedCmd.replace(/^ffmpeg\s+/i, "").trim();

            if (returnedCmd.startsWith("/") || returnedCmd.startsWith("./")) {
              returnedCmd = new URL(returnedCmd, basePortal).href;
            }

            if (/^https?:\/\//i.test(returnedCmd)) {
              // Safety repair: If portal returned stream=& without the channel id, inject it
              if (channelId && /([?&]stream=)(&|$)/.test(returnedCmd)) {
                returnedCmd = returnedCmd.replace(/([?&]stream=)(&|$)/, `$1${channelId}$2`);
              }

              playableUrl = returnedCmd;
              break;
            }
          }
        } catch (err: any) {
          lastError = err.message;
        }
      }

      // If still not found for movies/series, try action=get_link or direct portal load endpoint
      if (!playableUrl && (mediaType === "movie" || mediaType === "episode")) {
        try {
          const targetId = episodeId || channelId;
          const directData = await stalkerFetch(
            basePortal,
            {
              type: "vod",
              action: "get_link",
              movie_id: targetId,
              cmd: cmd || `/media/${targetId}.mpg`,
              JsHttpRequest: "1-xml",
            },
            { mac, token, model }
          );
          const dJs = (directData && (directData as any).js) ? (directData as any).js : directData;
          let dUrl = typeof dJs === "string" ? dJs : (dJs?.cmd || dJs?.url || dJs?.data || "");
          dUrl = String(dUrl).replace(/^ffmpeg\s+/i, "").trim();
          if (dUrl.startsWith("/") && basePortal) {
            dUrl = new URL(dUrl, basePortal).href;
          }
          if (/^https?:\/\//i.test(dUrl)) {
            playableUrl = dUrl;
          }
        } catch {}
      }

      if (!playableUrl) {
        // Fallback: construct direct stream URL from portal base and item/episode/channel ID
        const targetId = episodeId || channelId;
        if (targetId) {
          if (mediaType === "movie" || mediaType === "episode") {
            playableUrl = new URL(`/media/${targetId}.mpg`, basePortal).href;
          } else {
            playableUrl = new URL(`/ch/${targetId}`, basePortal).href;
          }
        }
      }

      if (!playableUrl && cmd && /^https?:\/\//i.test(cmd.replace(/^ffmpeg\s+/i, ""))) {
        playableUrl = cmd.replace(/^ffmpeg\s+/i, "").trim();
        if (channelId && /([?&]stream=)(&|$)/.test(playableUrl)) {
          playableUrl = playableUrl.replace(/([?&]stream=)(&|$)/, `$1${channelId}$2`);
        }
      }

      if (!playableUrl) {
        return res.status(500).json({
          ok: false,
          error: lastError || "Geen afspeelbare stream URL ontvangen van het portaal.",
        });
      }

      return res.json({
        ok: true,
        url: playableUrl,
        cmd: playableUrl,
      });
    }

    return res.status(400).json({ ok: false, error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error("Stalker endpoint error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Internal server error" });
  }
}

app.post("/api/stalker.php", handleStalkerRequest);
app.post("/api/stalker", handleStalkerRequest);
app.get("/api/stalker.php", handleStalkerRequest);
app.get("/api/stalker", handleStalkerRequest);

// -------------------------------------------------------------
// XTREAM API ROUTE (/api/xtream and /api/xtream.php)
// -------------------------------------------------------------
async function handleXtreamRequest(req: Request, res: Response) {
  try {
    const server = String(req.query.server || req.body?.server || "");
    const username = String(req.query.username || req.body?.username || "");
    const password = String(req.query.password || req.body?.password || "");
    const action = String(req.query.action || req.body?.action || "");

    if (!server || !username || !password) {
      return res.status(400).json({ ok: false, error: "Server, username, and password are required." });
    }

    const base = server.replace(/\/+$/, "");
    const playerApiUrl = new URL("player_api.php", base + "/");
    playerApiUrl.searchParams.set("username", username);
    playerApiUrl.searchParams.set("password", password);

    // Forward all other query params (action, stream_id, series_id, category_id, etc.)
    const sourceParams = req.method === "GET" ? req.query : { ...req.query, ...req.body };
    for (const [k, v] of Object.entries(sourceParams)) {
      if (!["server", "device_id"].includes(k) && v !== undefined && v !== null) {
        playerApiUrl.searchParams.set(k, String(v));
      }
    }

    const response = await fetch(playerApiUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "IPTVSmartersPro/3.1.5",
        "Accept": "application/json, */*",
      },
    });

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return res.json({ ok: true, data: json, ...json });
    } catch {
      return res.send(text);
    }
  } catch (error: any) {
    console.error("Xtream proxy error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Xtream request failed" });
  }
}

app.get("/api/xtream.php", handleXtreamRequest);
app.post("/api/xtream.php", handleXtreamRequest);
app.get("/api/xtream", handleXtreamRequest);
app.post("/api/xtream", handleXtreamRequest);

// -------------------------------------------------------------
// M3U API ROUTE (/api/m3u and /api/m3u.php)
// -------------------------------------------------------------
async function handleM3uRequest(req: Request, res: Response) {
  try {
    const url = String(req.query.url || req.body?.url || "").trim();
    if (!url) {
      return res.status(400).json({ ok: false, error: "M3U URL is required" });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
        "Accept": "*/*",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ ok: false, error: `Failed to fetch M3U: HTTP ${response.status}` });
    }

    // Stream text response directly
    res.setHeader("Content-Type", response.headers.get("content-type") || "text/plain; charset=utf-8");
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message || "M3U fetch failed" });
  }
}

app.get("/api/m3u.php", handleM3uRequest);
app.get("/api/m3u", handleM3uRequest);

// -------------------------------------------------------------
// STREAM PROXY ROUTE (/api/stream and /api/stream.php)
// Handles Range headers, video streaming, Stalker cookies and auth
// -------------------------------------------------------------
async function handleStreamRequest(req: Request, res: Response) {
  try {
    let streamUrl = String(req.query.url || "").trim();
    if (!streamUrl) {
      return res.status(400).send("Stream URL missing");
    }

    // Parameter repair: if portal link ended in stream=&, inject channel_id or stream_id
    const channelId = String(req.query.channel_id || req.query.stream_id || "");
    if (channelId && /([?&]stream=)(&|$)/.test(streamUrl)) {
      streamUrl = streamUrl.replace(/([?&]stream=)(&|$)/, `$1${channelId}$2`);
    }

    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250",
    };

    // Stalker session params
    const portal = req.query.portal as string;
    const mac = req.query.mac as string;
    const model = (req.query.model as string) || "MAG254";

    if (portal) {
      headers["Referer"] = normalizePortalUrl(portal);
    }
    if (mac) {
      headers["Cookie"] = `mac=${encodeURIComponent(cleanMac(mac))}; stb_lang=en; timezone=Europe%2FAmsterdam`;
    }
    if (model) {
      headers["X-User-Agent"] = `Model: ${model}; Link: WiFi`;
    }

    // Forward Range header if present
    if (req.headers.range) {
      headers["Range"] = req.headers.range;
    }

    const upstream = await fetch(streamUrl, {
      method: req.method === "HEAD" ? "HEAD" : "GET",
      headers,
    });

    res.status(upstream.status);

    // Forward relevant headers (excluding hop-by-hop headers like connection and transfer-encoding)
    for (const [headerName, headerValue] of upstream.headers.entries()) {
      if (
        [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
          "cache-control",
        ].includes(headerName.toLowerCase())
      ) {
        res.setHeader(headerName, headerValue);
      }
    }

    // Ensure video or audio can be streamed by HTML5 player
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
    if (!res.getHeader("accept-ranges")) {
      res.setHeader("Accept-Ranges", "bytes");
    }

    if (req.method === "HEAD" || !upstream.body) {
      return res.end();
    }

    // Stream the body chunks to response
    const reader = upstream.body.getReader();
    req.on("close", () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).send("Stream proxy failed: " + error.message);
    }
  }
}

app.get("/api/stream.php", handleStreamRequest);
app.get("/api/stream", handleStreamRequest);
app.get("/api/stalker-hls.php", handleStreamRequest);

// -------------------------------------------------------------
// LIVE & VOD REMUX ROUTE (/api/remux.mp4 and /api/remux)
// Uses ffprobe to detect codec/color profile and ffmpeg to remux
// or transcode to universal fragmented MP4 (H.264/AAC, 8-bit YUV420P)
// Plays smoothly in standard HTML5 <video> across all modern browsers
// -------------------------------------------------------------
async function probeStreamVideo(streamUrl: string, headers: string): Promise<{ isH264: boolean; isYuv420p: boolean } | null> {
  return new Promise((resolve) => {
    const probe = spawn("ffprobe", [
      "-headers", headers,
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,pix_fmt",
      "-of", "json",
      streamUrl,
    ]);
    let out = "";
    probe.stdout.on("data", (d) => (out += d));
    const timer = setTimeout(() => {
      try {
        probe.kill("SIGKILL");
      } catch {}
      resolve(null);
    }, 1800);

    probe.on("close", () => {
      clearTimeout(timer);
      try {
        const data = JSON.parse(out);
        const st = data.streams && data.streams[0];
        if (st) {
          const isH264 = st.codec_name === "h264";
          const isYuv420p = st.pix_fmt === "yuv420p" || st.pix_fmt === "yuvj420p";
          resolve({ isH264, isYuv420p });
          return;
        }
      } catch {}
      resolve(null);
    });

    probe.on("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

async function handleRemuxRequest(req: Request, res: Response) {
  try {
    let streamUrl = String(req.query.url || "").trim();
    if (!streamUrl) {
      return res.status(400).send("Stream URL missing");
    }

    const channelId = String(req.query.channel_id || req.query.stream_id || "");
    if (channelId && /([?&]stream=)(&|$)/.test(streamUrl)) {
      streamUrl = streamUrl.replace(/([?&]stream=)(&|$)/, `$1${channelId}$2`);
    }

    const portal = req.query.portal as string;
    const mac = req.query.mac as string;
    const model = (req.query.model as string) || "MAG254";
    const resumeSeconds = Number(req.query.ss || req.query.resume || 0);

    let headerLines = "User-Agent: Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG250\r\n";
    if (portal) {
      headerLines += `Referer: ${normalizePortalUrl(portal)}\r\n`;
    }
    if (mac) {
      headerLines += `Cookie: mac=${encodeURIComponent(cleanMac(mac))}; stb_lang=en; timezone=Europe%2FAmsterdam\r\n`;
    }
    if (model) {
      headerLines += `X-User-Agent: Model: ${model}; Link: WiFi\r\n`;
    }

    const isMpegTs = req.path.endsWith(".ts") || req.query.format === "ts" || req.path === "/api/remux";
    if (isMpegTs) {
      res.setHeader("Content-Type", "video/mp2t");
    } else {
      res.setHeader("Content-Type", "video/mp4");
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

    if (req.method === "HEAD") {
      return res.end();
    }

    if (req.destroyed) return;

    // Quick probe to check if stream is already web-native H.264 8-bit YUV420P
    const probeRes = await probeStreamVideo(streamUrl, headerLines);
    if (req.destroyed) return;

    const canCopyVideo = Boolean(probeRes && probeRes.isH264 && probeRes.isYuv420p);

    const ffArgs: string[] = [
      "-headers", headerLines,
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_delay_max", "5",
    ];

    // Optional seek / resume offset
    if (resumeSeconds > 0) {
      ffArgs.push("-ss", String(Math.floor(resumeSeconds)));
    }

    ffArgs.push(
      "-i", streamUrl,
      "-map", "0:v:0",
      "-map", "0:a:0?",
    );

    if (canCopyVideo) {
      // 0% CPU direct copy when already standard H.264 YUV420P
      ffArgs.push("-c:v", "copy");
    } else {
      // Universal H.264 8-bit YUV420P - plays smoothly in 100% of browsers (fixes HEVC 10-bit, AV1, MPEG2)
      ffArgs.push(
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-g", "48",
        "-pix_fmt", "yuv420p"
      );
    }

    // Universal AAC audio & container output
    if (isMpegTs) {
      ffArgs.push(
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-muxdelay", "0",
        "-f", "mpegts",
        "pipe:1"
      );
    } else {
      ffArgs.push(
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-flush_packets", "1",
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "pipe:1"
      );
    }

    const ff = spawn("ffmpeg", ffArgs, { stdio: ["ignore", "pipe", "pipe"] });

    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
      try {
        ff.kill("SIGKILL");
      } catch {}
    });

    ff.stdout.pipe(res);

    ff.on("error", (err) => {
      if (!res.headersSent && !clientDisconnected) {
        res.status(500).send("Remux failed to start: " + err.message);
      }
    });
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).send("Remux proxy failed: " + error.message);
    }
  }
}

app.get("/api/remux.mp4", handleRemuxRequest);
app.get("/api/remux", handleRemuxRequest);

// -------------------------------------------------------------
// IMAGE PROXY ROUTE (/api/image.php)
// -------------------------------------------------------------
app.get("/api/image.php", async (req: Request, res: Response) => {
  try {
    const imgUrl = String(req.query.url || "").trim();
    if (!imgUrl) return res.status(400).send("Image URL missing");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(imgUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) return res.status(response.status).send("Failed to load image");

    res.setHeader("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(502).send(err.message);
    }
  }
});

// -------------------------------------------------------------
// STRIPE STATUS / MOCK ENDPOINTS
// -------------------------------------------------------------
app.post("/api/stripe-status.php", (req: Request, res: Response) => {
  return res.json({ ok: true, active: true, premium: true });
});

app.post("/api/stripe.php", (req: Request, res: Response) => {
  return res.json({
    ok: true,
    url: req.body?.return_url || "/?stripe=success",
  });
});

// -------------------------------------------------------------
// VITE / SPA MIDDLEWARE
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nova Player Server running on http://localhost:${PORT}`);
  });
}

startServer();
