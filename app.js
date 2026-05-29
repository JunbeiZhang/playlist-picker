const sampleSongs = [
  {
    id: "1882040151",
    title: "雾里",
    artists: ["姚六一"],
    album: "雾里",
    duration: "03:42",
    playlist: "示例歌单",
    color: "#3366a6",
  },
  {
    id: "1953314354",
    title: "夏日漱石",
    artists: ["橘子海"],
    album: "夏日漱石",
    duration: "04:14",
    playlist: "示例歌单",
    color: "#0f7b6c",
  },
  {
    id: "525278524",
    title: "凄美地",
    artists: ["郭顶"],
    album: "飞行器的执行周期",
    duration: "04:10",
    playlist: "示例歌单",
    color: "#a46810",
  },
  {
    id: "1381755293",
    title: "悬溺",
    artists: ["葛东琪"],
    album: "第二街区",
    duration: "03:17",
    playlist: "示例歌单",
    color: "#c8313f",
  },
  {
    id: "569214250",
    title: "水星记",
    artists: ["郭顶"],
    album: "飞行器的执行周期",
    duration: "05:25",
    playlist: "示例歌单",
    color: "#6a5878",
  },
  {
    id: "1446909125",
    title: "经济舱",
    artists: ["Kafe.Hu"],
    album: "经济舱",
    duration: "03:58",
    playlist: "示例歌单",
    color: "#287d8e",
  },
];

const state = {
  songs: sampleSongs,
  selected: new Set(),
  blockedArtists: new Set(JSON.parse(localStorage.getItem("blockedArtists") || "[]")),
  mode: "available",
  query: "",
  bridgeConnected: false,
  lastPayload: null,
};

const els = {
  bridgeDot: document.querySelector("#bridgeDot"),
  bridgeStatus: document.querySelector("#bridgeStatus"),
  bridgeUrl: document.querySelector("#bridgeUrl"),
  testBridge: document.querySelector("#testBridge"),
  sourcePlaylistId: document.querySelector("#sourcePlaylistId"),
  loadFromBridge: document.querySelector("#loadFromBridge"),
  jsonFile: document.querySelector("#jsonFile"),
  targetPlaylistName: document.querySelector("#targetPlaylistName"),
  searchInput: document.querySelector("#searchInput"),
  artistForm: document.querySelector("#artistForm"),
  artistInput: document.querySelector("#artistInput"),
  blockedArtists: document.querySelector("#blockedArtists"),
  selectVisible: document.querySelector("#selectVisible"),
  invertVisible: document.querySelector("#invertVisible"),
  clearSelected: document.querySelector("#clearSelected"),
  totalCount: document.querySelector("#totalCount"),
  visibleCount: document.querySelector("#visibleCount"),
  selectedCount: document.querySelector("#selectedCount"),
  blockedCount: document.querySelector("#blockedCount"),
  songGrid: document.querySelector("#songGrid"),
  emptyState: document.querySelector("#emptyState"),
  createPlaylist: document.querySelector("#createPlaylist"),
  resultDialog: document.querySelector("#resultDialog"),
  resultSummary: document.querySelector("#resultSummary"),
  resultPayload: document.querySelector("#resultPayload"),
  downloadJson: document.querySelector("#downloadJson"),
  submitBridge: document.querySelector("#submitBridge"),
};

if (location.protocol.startsWith("http")) {
  els.bridgeUrl.value = location.origin;
}

function normalizeSong(raw, index) {
  const artists = Array.isArray(raw.artists)
    ? raw.artists
    : Array.isArray(raw.ar)
      ? raw.ar.map((artist) => artist.name)
      : Array.isArray(raw.artistsName)
        ? raw.artistsName
        : typeof raw.artist === "string"
          ? raw.artist.split(/[、/]/).map((name) => name.trim()).filter(Boolean)
          : [];

  return {
    id: String(raw.id || raw.songId || raw.trackId || `local-${index}`),
    title: raw.title || raw.name || `未命名歌曲 ${index + 1}`,
    artists: artists.length ? artists : ["未知歌手"],
    album: raw.album || raw.al?.name || "未知专辑",
    duration: raw.duration || formatDuration(raw.dt || raw.durationMs),
    coverUrl: raw.coverUrl || raw.picUrl || raw.al?.picUrl || "",
    playlist: raw.playlist || raw.playlistName || "导入歌单",
    color: raw.color || pickColor(index),
  };
}

function formatDuration(ms) {
  if (!Number.isFinite(Number(ms))) return "--:--";
  const totalSeconds = Math.round(Number(ms) / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function pickColor(index) {
  const colors = ["#3366a6", "#0f7b6c", "#c8313f", "#a46810", "#6a5878", "#287d8e"];
  return colors[index % colors.length];
}

function isBlocked(song) {
  return song.artists.some((artist) => state.blockedArtists.has(artist));
}

function matchesSearch(song) {
  if (!state.query) return true;
  const query = state.query.toLowerCase();
  return [song.title, song.album, song.playlist, ...song.artists]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function getVisibleSongs() {
  return state.songs.filter((song) => {
    const blocked = isBlocked(song);
    const selected = state.selected.has(song.id);

    if (!matchesSearch(song)) return false;
    if (state.mode === "available") return !blocked;
    if (state.mode === "selected") return selected;
    if (state.mode === "blocked") return blocked;
    return true;
  });
}

function persistBlockedArtists() {
  localStorage.setItem("blockedArtists", JSON.stringify([...state.blockedArtists]));
}

function render() {
  const visibleSongs = getVisibleSongs();
  const blockedCount = state.songs.filter(isBlocked).length;

  els.totalCount.textContent = state.songs.length;
  els.visibleCount.textContent = visibleSongs.length;
  els.selectedCount.textContent = state.selected.size;
  els.blockedCount.textContent = blockedCount;
  els.createPlaylist.disabled = state.selected.size === 0;

  renderBlockedArtists();
  renderSongs(visibleSongs);
}

function renderBlockedArtists() {
  els.blockedArtists.innerHTML = "";
  if (!state.blockedArtists.size) {
    const empty = document.createElement("span");
    empty.className = "song-meta";
    empty.textContent = "还没有屏蔽歌手";
    els.blockedArtists.append(empty);
    return;
  }

  [...state.blockedArtists].forEach((artist) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = artist;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = `取消屏蔽 ${artist}`;
    remove.setAttribute("aria-label", `取消屏蔽 ${artist}`);
    remove.textContent = "×";
    remove.addEventListener("click", () => {
      state.blockedArtists.delete(artist);
      persistBlockedArtists();
      render();
    });

    chip.append(remove);
    els.blockedArtists.append(chip);
  });
}

function renderSongs(songs) {
  els.songGrid.innerHTML = "";
  els.emptyState.classList.toggle("hidden", songs.length > 0);

  const fragment = document.createDocumentFragment();
  songs.forEach((song) => {
    const blocked = isBlocked(song);
    const selected = state.selected.has(song.id);
    const card = document.createElement("article");
    card.className = ["song-card", blocked ? "blocked" : "", selected ? "selected" : ""].filter(Boolean).join(" ");

    const cover = document.createElement("div");
    cover.className = "cover";
    cover.style.background = `linear-gradient(135deg, ${song.color}, #172024)`;
    if (song.coverUrl) {
      const image = document.createElement("img");
      image.src = song.coverUrl;
      image.alt = `${song.title} 封面`;
      cover.append(image);
    } else {
      cover.textContent = song.title.slice(0, 1);
    }

    const body = document.createElement("div");
    body.className = "song-body";
    body.innerHTML = `
      <div class="song-main">
        <h3 class="song-title"></h3>
        <div class="song-meta"></div>
      </div>
      <div class="song-actions">
        <span class="reason"></span>
        <button class="select-toggle" type="button"></button>
      </div>
    `;

    body.querySelector(".song-title").textContent = song.title;
    body.querySelector(".song-meta").textContent = `${song.artists.join(" / ")} · ${song.album} · ${song.duration}`;

    const reason = body.querySelector(".reason");
    reason.textContent = blocked ? "命中屏蔽歌手" : song.playlist;

    const button = body.querySelector(".select-toggle");
    button.textContent = selected ? "已选择" : "选择";
    button.disabled = blocked;
    button.setAttribute("aria-pressed", String(selected));
    button.addEventListener("click", () => {
      if (state.selected.has(song.id)) {
        state.selected.delete(song.id);
      } else {
        state.selected.add(song.id);
      }
      render();
    });

    card.append(cover, body);
    fragment.append(card);
  });

  els.songGrid.append(fragment);
}

function addBlockedArtist(name) {
  const artist = name.trim();
  if (!artist) return;
  state.blockedArtists.add(artist);
  [...state.selected].forEach((songId) => {
    const song = state.songs.find((item) => item.id === songId);
    if (song && isBlocked(song)) state.selected.delete(songId);
  });
  persistBlockedArtists();
  render();
}

function createPayload() {
  const tracks = state.songs.filter((song) => state.selected.has(song.id) && !isBlocked(song));
  return {
    playlistName: els.targetPlaylistName.value.trim() || "筛选后的新歌单",
    createdAt: new Date().toISOString(),
    trackIds: tracks.map((song) => song.id),
    tracks: tracks.map((song) => ({
      id: song.id,
      title: song.title,
      artists: song.artists,
      album: song.album,
    })),
    blockedArtists: [...state.blockedArtists],
  };
}

function showResult() {
  state.lastPayload = createPayload();
  els.resultSummary.textContent = `准备加入 ${state.lastPayload.tracks.length} 首歌到《${state.lastPayload.playlistName}》。`;
  els.resultPayload.textContent = JSON.stringify(state.lastPayload, null, 2);
  els.submitBridge.disabled = !state.bridgeConnected;
  els.resultDialog.showModal();
}

async function testBridge() {
  const bridgeUrl = getBridgeUrl();
  setBridgeStatus(false, "正在测试连接...");
  try {
    const response = await fetch(`${bridgeUrl}/health`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const suffix = data.hasCookie ? "，已配置网易云 Cookie" : "，未配置 Cookie";
    setBridgeStatus(true, `已连接本地桥接${suffix}`);
  } catch (error) {
    setBridgeStatus(false, "未连接本地桥接");
  }
}

function getBridgeUrl() {
  return els.bridgeUrl.value.trim().replace(/\/$/, "");
}

function setBridgeStatus(connected, text) {
  state.bridgeConnected = connected;
  els.bridgeDot.classList.toggle("connected", connected);
  els.bridgeStatus.textContent = text;
  els.submitBridge.disabled = !connected;
}

async function loadFromBridge() {
  const playlistId = els.sourcePlaylistId.value.trim();
  if (!playlistId) {
    alert("请先填写源歌单 ID。");
    return;
  }

  const bridgeUrl = getBridgeUrl();
  try {
    const response = await fetch(`${bridgeUrl}/playlists/${encodeURIComponent(playlistId)}/tracks`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    const rawSongs = Array.isArray(data) ? data : data.songs || data.tracks || [];
    replaceSongs(rawSongs);
    setBridgeStatus(true, "已连接本地桥接");
  } catch (error) {
    alert(`读取失败：${error.message}`);
  }
}

function replaceSongs(rawSongs) {
  state.songs = rawSongs.map(normalizeSong);
  state.selected.clear();
  render();
}

function downloadPayload() {
  if (!state.lastPayload) return;
  const blob = new Blob([JSON.stringify(state.lastPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.lastPayload.playlistName}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function submitToBridge() {
  if (!state.lastPayload) return;
  const bridgeUrl = getBridgeUrl();
  try {
    const response = await fetch(`${bridgeUrl}/playlists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.lastPayload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    els.resultPayload.textContent = JSON.stringify(data, null, 2);
    alert(`已创建歌单《${data.playlistName}》，并提交 ${data.addedTrackIds.length} 首歌。`);
  } catch (error) {
    alert(`提交失败：${error.message}`);
  }
}

els.artistForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addBlockedArtist(els.artistInput.value);
  els.artistInput.value = "";
});

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.mode = button.dataset.mode;
    render();
  });
});

els.selectVisible.addEventListener("click", () => {
  getVisibleSongs().forEach((song) => {
    if (!isBlocked(song)) state.selected.add(song.id);
  });
  render();
});

els.invertVisible.addEventListener("click", () => {
  getVisibleSongs().forEach((song) => {
    if (isBlocked(song)) return;
    if (state.selected.has(song.id)) state.selected.delete(song.id);
    else state.selected.add(song.id);
  });
  render();
});

els.clearSelected.addEventListener("click", () => {
  state.selected.clear();
  render();
});

els.jsonFile.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const rawSongs = Array.isArray(data) ? data : data.songs || data.tracks || [];
    replaceSongs(rawSongs);
  } catch (error) {
    alert("JSON 解析失败。");
  } finally {
    event.target.value = "";
  }
});

els.createPlaylist.addEventListener("click", showResult);
els.downloadJson.addEventListener("click", downloadPayload);
els.submitBridge.addEventListener("click", submitToBridge);
els.testBridge.addEventListener("click", testBridge);
els.loadFromBridge.addEventListener("click", loadFromBridge);

render();
testBridge();
