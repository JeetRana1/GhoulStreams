# GhoulStreams 👻⚽

GhoulStreams is a live sports web app where users can browse events and watch games in a dedicated viewing experience.

## Highlights 🏟️

- 🔴 Live and upcoming sports event discovery
- 🗂️ Category-based browsing across major sports
- 📺 Dedicated watch page for each event
- 🎮 Custom video player controls (play/pause, skip, seek, volume, fullscreen, live edge)
- 📊 Live match context with event status and score-focused UI
- 🌐 Responsive design optimized for desktop and mobile

## App Structure 🧩

- `index.html` - Main sports hub with event browsing and live status presentation
- `watch.html` - Event watch page with custom player interface and playback controls
- `server.js` - Backend API routes, stream handling, and media proxy support
- `Stream.js` - Internal event/source parsing and stream data handling logic
- `Provider.js` - Shared provider base contract used by the app logic

## Scope 🔒

This repository is maintained for a specific personal workflow and project context.

It is not intended to be a reusable public template or starter package.

## Notes 📝

The UI, playback behavior, and event data flow are tightly integrated for this project’s current architecture.

Future updates may change internal behavior without aiming for external compatibility.
