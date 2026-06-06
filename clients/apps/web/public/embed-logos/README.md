# Embed / link platform logos

Drop **square** brand logos here as `.jpg` and they light up automatically in
two places:

1. The **Add to your Space → Embed** picker tiles, and
2. The rendered **link / embed cards** on a Space (used as the thumbnail when a
   link has no preview image).

No code change is needed — `platformLogoUrl()` in
`src/components/Profile/linkPlatforms.ts` maps each platform id to
`/embed-logos/<id>.jpg`, and both surfaces fall back gracefully (to the inline
SVG mark in the picker, or a generic link glyph on cards) until the file is
present.

## Expected filenames

| Platform     | File               |
| ------------ | ------------------ |
| YouTube      | `youtube.jpg`      |
| Spotify      | `spotify.jpg`      |
| SoundCloud   | `soundcloud.jpg`   |
| Vimeo        | `vimeo.jpg`        |
| Apple Music  | `apple_music.jpg`  |
| TikTok       | `tiktok.jpg`       |
| Instagram    | `instagram.jpg`    |
| Substack     | `substack.jpg`     |
| X / Twitter  | `x.jpg`            |

Tips:
- Use a **square** image (e.g. 256×256 or 512×512); both surfaces render the
  logo with `object-fit: cover`.
- The ids must match exactly (note the underscore in `apple_music.jpg`).
- `.jpg` only — that's what `platformLogoUrl()` requests.
