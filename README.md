# Netease Cloud Music Playlist Filter

[中文](./README-CN.md) | English

A local playlist management tool for Netease Cloud Music. It can read existing playlists, block songs by artist, let you manually select tracks, and generate a new playlist draft or submit the selected tracks to Netease Cloud Music.

> This project only starts a lightweight local Node.js bridge service on your own machine. It does not upload your Cookie to any third-party service.

## Features

- Read public Netease Cloud Music playlists, and read private playlists after configuring a Cookie
- Block songs by artist and automatically remove matched tracks from the selected list
- Search by song title, album, artist, or source playlist
- Switch between four views: available songs, selected songs, blocked songs, and all songs
- Import JSON for offline organization or integration with other data sources
- Download filtered results as JSON, or create a new playlist through the local bridge service

## Quick Start

Node.js 18 or later is required.

```bash
npm start
```

After the service starts, open:

```text
http://localhost:3017
```

To use a different port:

```bash
PORT=3020 npm start
```

Windows PowerShell:

```powershell
$env:PORT="3020"
npm start
```

## Configure Netease Cloud Music Cookie

Reading public playlists usually does not require a Cookie. Reading private playlists, creating playlists, and adding songs require a Netease Cloud Music web Cookie.

The recommended approach is to use an environment variable:

```powershell
$env:NETEASE_COOKIE="MUSIC_U=...; __csrf=..."
npm start
```

You can also copy the example configuration file:

```bash
cp bridge.config.example.json bridge.config.json
```

Then replace the `cookie` value in `bridge.config.json` with your own Netease Cloud Music web Cookie.

`bridge.config.json` has been added to `.gitignore`. Do not commit your real Cookie to a public repository.

## API

### Health Check

```http
GET /health
```

Example response:

```json
{
  "ok": true,
  "service": "netease-playlist-filter",
  "hasCookie": false
}
```

### Read Tracks from a Playlist

```http
GET /playlists/:id/tracks
```

Example response:

```json
{
  "playlistId": "123456789",
  "playlistName": "My Playlist",
  "count": 1,
  "tracks": [
    {
      "id": "1882040151",
      "title": "雾里",
      "artists": ["姚六一"],
      "album": "雾里",
      "durationMs": 222000,
      "coverUrl": "https://...",
      "playlist": "My Playlist"
    }
  ]
}
```

### Create a New Playlist

```http
POST /playlists
Content-Type: application/json
```

Example request body:

```json
{
  "playlistName": "Filtered Playlist",
  "trackIds": ["1882040151"],
  "blockedArtists": ["郭顶"]
}
```

## JSON Import Format

The frontend supports importing a direct array, `{ "tracks": [] }`, or `{ "songs": [] }`:

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

## Project Structure

```text
.
├── app.js                    # Frontend interaction logic
├── index.html                # Single-page application entry
├── server.js                 # Local static service and Netease bridge API
├── styles.css                # UI styles
├── bridge.config.example.json
└── package.json
```

## Limitations

Netease Cloud Music does not provide a stable official open API for this use case. This project uses Netease Cloud Music web endpoints, so it may fail due to endpoint changes, Cookie expiration, account risk control, or music copyright restrictions.

## License

[MIT](./LICENSE)
