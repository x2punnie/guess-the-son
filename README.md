# Guess The Son

Ready for GitHub Pages.

## Files
- `index.html` — game
- `config.js` — YouTube Data API v3 key used for YouTube fallback

## GitHub Pages
1. Put all files in the repository root.
2. Commit and push to `main`.
3. GitHub → Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
4. Open the GitHub Pages URL.

## YouTube API key
The key is intentionally in `config.js` because this is a browser game. Restrict it in Google Cloud by HTTP referrer to your GitHub Pages domain. Do not use an unrestricted key.

## Music sources
- iTunes/Apple previews are used first.
- YouTube Data API v3 is used as fallback/supplement.
- Common Remix/Live/Acoustic/Remastered/Karaoke/Cover/Sped Up/Slowed/etc. results are filtered.
