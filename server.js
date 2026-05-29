const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const rootDir = __dirname;
const port = Number(process.env.PORT || 3017);
const config = readConfig();
const neteaseCookie = process.env.NETEASE_COOKIE || config.cookie || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        service: "netease-playlist-filter",
        hasCookie: Boolean(neteaseCookie),
      });
      return;
    }

    const playlistTracksMatch = url.pathname.match(/^\/playlists\/([^/]+)\/tracks$/);
    if (req.method === "GET" && playlistTracksMatch) {
      const playlistId = decodeURIComponent(playlistTracksMatch[1]);
      const data = await getPlaylistTracks(playlistId);
      sendJson(res, 200, data);
      return;
    }

    if (req.method === "POST" && url.pathname === "/playlists") {
      const payload = await readJsonBody(req);
      const result = await createPlaylistWithTracks(payload);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" || req.method === "HEAD") {
      serveStatic(req, res, url.pathname);
      return;
    }

    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, error.statusCode || 500, {
      error: error.message || "Internal server error",
    });
  }
});

server.listen(port, () => {
  console.log(`Netease playlist filter is running at http://localhost:${port}`);
  if (!neteaseCookie) {
    console.log("No NETEASE_COOKIE or bridge.config.json cookie found. Public playlist reads may work; writes require a cookie.");
  }
});

function readConfig() {
  const configPath = path.join(rootDir, "bridge.config.json");
  if (!fs.existsSync(configPath)) return {};

  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`bridge.config.json is invalid JSON: ${error.message}`);
  }
}

async function getPlaylistTracks(playlistId) {
  const data = await neteaseGet("/api/v6/playlist/detail", {
    id: playlistId,
    n: "100000",
    s: "8",
  });

  const playlist = data.playlist || data.result;
  if (!playlist) {
    throw statusError(404, "未读取到歌单。请确认歌单 ID 是否正确，私密歌单需要配置网易云 Cookie。");
  }

  let tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  const trackIds = Array.isArray(playlist.trackIds) ? playlist.trackIds.map((item) => item.id).filter(Boolean) : [];

  if (tracks.length < trackIds.length) {
    const detailTracks = await getSongDetails(trackIds);
    if (detailTracks.length) tracks = detailTracks;
  }

  return {
    playlistId: String(playlist.id || playlistId),
    playlistName: playlist.name || "网易云歌单",
    count: tracks.length,
    tracks: tracks.map((track, index) => normalizeNeteaseTrack(track, playlist.name, index)),
  };
}

async function getSongDetails(ids) {
  const songs = [];
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const data = await neteaseGet("/api/v3/song/detail", {
      c: JSON.stringify(chunk.map((id) => ({ id }))),
    });
    if (Array.isArray(data.songs)) songs.push(...data.songs);
  }
  return songs;
}

async function createPlaylistWithTracks(payload) {
  if (!neteaseCookie) {
    throw statusError(401, "未配置网易云 Cookie。请在 NETEASE_COOKIE 环境变量或 bridge.config.json 中配置登录 Cookie 后再创建歌单。");
  }

  const playlistName = String(payload.playlistName || "筛选后的新歌单").trim();
  const trackIds = uniqueIds(payload.trackIds || payload.tracks?.map((track) => track.id) || []);

  if (!playlistName) throw statusError(400, "歌单名不能为空。");
  if (!trackIds.length) throw statusError(400, "没有可添加的歌曲。");

  const csrfToken = getCsrfToken(neteaseCookie);
  const createData = await neteasePost("/api/playlist/create", {
    name: playlistName,
    privacy: "0",
    type: "NORMAL",
    csrf_token: csrfToken,
  });

  const playlistId = createData.id || createData.playlist?.id;
  if (!playlistId) {
    throw statusError(502, `网易云没有返回新歌单 ID：${JSON.stringify(createData)}`);
  }

  const addedTrackIds = [];
  for (let index = 0; index < trackIds.length; index += 200) {
    const chunk = trackIds.slice(index, index + 200);
    await neteasePost("/api/playlist/manipulate/tracks", {
      op: "add",
      pid: String(playlistId),
      trackIds: JSON.stringify(chunk),
      tracks: JSON.stringify(chunk),
      csrf_token: csrfToken,
    });
    addedTrackIds.push(...chunk);
  }

  return {
    ok: true,
    playlistId: String(playlistId),
    playlistName,
    addedTrackIds,
  };
}

function normalizeNeteaseTrack(track, playlistName, index) {
  const artists = Array.isArray(track.ar)
    ? track.ar.map((artist) => artist.name).filter(Boolean)
    : Array.isArray(track.artists)
      ? track.artists.map((artist) => artist.name).filter(Boolean)
      : [];

  const album = track.al || track.album || {};

  return {
    id: String(track.id),
    title: track.name || `未命名歌曲 ${index + 1}`,
    artists: artists.length ? artists : ["未知歌手"],
    album: album.name || "未知专辑",
    durationMs: track.dt || track.duration || 0,
    coverUrl: album.picUrl || "",
    playlist: playlistName || "网易云歌单",
  };
}

async function neteaseGet(apiPath, params = {}) {
  const url = new URL(`https://music.163.com${apiPath}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return requestNetease(url, { method: "GET" });
}

async function neteasePost(apiPath, body) {
  const csrfToken = getCsrfToken(neteaseCookie);
  const url = new URL(`https://music.163.com${apiPath}`);
  if (csrfToken) url.searchParams.set("csrf_token", csrfToken);

  return requestNetease(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
}

async function requestNetease(url, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://music.163.com/",
      Origin: "https://music.163.com",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36",
      Cookie: neteaseCookie,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw statusError(502, `网易云返回了非 JSON 响应：${text.slice(0, 160)}`);
  }

  const apiCode = Number(data.code);
  if (!response.ok || apiCode === 301 || apiCode >= 400) {
    const statusCode = !response.ok ? response.status : apiCode === 301 ? 401 : 502;
    throw statusError(statusCode, data.message || data.msg || `网易云请求失败：${data.code || response.status}`);
  }

  return data;
}

function uniqueIds(ids) {
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function getCsrfToken(cookie) {
  const match = cookie.match(/(?:^|;\s*)__csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(rootDir, `.${safePath}`);
  const insideRoot = filePath === rootDir || filePath.startsWith(`${rootDir}${path.sep}`);

  if (!insideRoot) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    if (req.method === "HEAD") res.end();
    else res.end(data);
  });
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, statusCode, payload) {
  if (res.headersSent) return;
  setCors(res);
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(statusError(413, "Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(statusError(400, "Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function statusError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
