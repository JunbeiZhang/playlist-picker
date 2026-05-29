# 网易云歌单筛选器

中文 | [English](./README.md)

一个本地运行的网易云音乐歌单整理工具。它可以读取已有歌单，按歌手屏蔽不想听的歌曲，手动挑选保留曲目，并生成一个新的歌单草稿或直接提交到网易云音乐。

> 这个项目只在本机启动一个轻量 Node.js 桥接服务，不会把你的 Cookie 上传到第三方服务。

## 功能

- 读取网易云音乐公开歌单，配置 Cookie 后也可读取私密歌单
- 按歌手屏蔽歌曲，并自动从已选歌曲中移除命中的曲目
- 支持关键词搜索歌曲、专辑、歌手和来源歌单
- 支持可选歌曲、已选歌曲、已屏蔽歌曲、全部歌曲四种视图
- 支持导入 JSON，方便离线整理或接入其他数据源
- 支持下载筛选结果 JSON，或通过本地桥接服务创建新歌单

## 快速开始

需要 Node.js 18 或更高版本。

```bash
npm start
```

启动后打开：

```text
http://localhost:3017
```

如果需要换端口：

```bash
PORT=3020 npm start
```

Windows PowerShell：

```powershell
$env:PORT="3020"
npm start
```

## 配置网易云 Cookie

读取公开歌单通常不需要 Cookie。读取私密歌单、创建歌单、添加歌曲需要使用网易云音乐网页版 Cookie。

推荐使用环境变量：

```powershell
$env:NETEASE_COOKIE="MUSIC_U=...; __csrf=..."
npm start
```

也可以复制示例配置：

```bash
cp bridge.config.example.json bridge.config.json
```

然后把 `bridge.config.json` 中的 `cookie` 替换成自己的网易云网页 Cookie。

`bridge.config.json` 已加入 `.gitignore`。不要把真实 Cookie 提交到公开仓库。

## 接口

### 健康检查

```http
GET /health
```

返回桥接服务状态：

```json
{
  "ok": true,
  "service": "netease-playlist-filter",
  "hasCookie": false
}
```

### 读取歌单歌曲

```http
GET /playlists/:id/tracks
```

响应示例：

```json
{
  "playlistId": "123456789",
  "playlistName": "我的歌单",
  "count": 1,
  "tracks": [
    {
      "id": "1882040151",
      "title": "雾里",
      "artists": ["姚六一"],
      "album": "雾里",
      "durationMs": 222000,
      "coverUrl": "https://...",
      "playlist": "我的歌单"
    }
  ]
}
```

### 创建新歌单

```http
POST /playlists
Content-Type: application/json
```

请求体示例：

```json
{
  "playlistName": "筛选后的新歌单",
  "trackIds": ["1882040151"],
  "blockedArtists": ["郭顶"]
}
```

## JSON 导入格式

前端支持直接导入数组，也支持 `{ "tracks": [] }` 或 `{ "songs": [] }`：

```json
[
  {
    "id": "1882040151",
    "title": "雾里",
    "artists": ["姚六一"],
    "album": "雾里",
    "durationMs": 222000,
    "coverUrl": "https://..."
  }
]
```

## 项目结构

```text
.
├── app.js                    # 前端交互逻辑
├── index.html                # 单页应用入口
├── server.js                 # 本地静态服务和网易云桥接接口
├── styles.css                # 界面样式
├── bridge.config.example.json
└── package.json
```

## 边界说明

网易云音乐没有为这个场景提供稳定的官方开放 API。本项目使用网易云音乐 Web 端接口，因此可能因为接口策略变化、Cookie 过期、账号风控或歌曲版权限制而失败。

## 开源协议

[MIT](./LICENSE)
