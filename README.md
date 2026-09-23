# Feed Control

Hide AI slop, ads & any topic on Reddit, X and LinkedIn. A Chrome extension that blurs promoted posts, AI slop, stealth ads, and any topics you choose from your Reddit and X (Twitter) feeds. Classification uses [TypeSafe's Jev](https://docs.typesafe.ai) model.

## Install
**From the Chrome Web Store:** _(link once published)_

**Manually (works today, any Chromium browser: Chrome, Arc, Brave, Edge):**
1. Download `feed-control.zip` from the latest release (or clone this repo) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, pick the unzipped folder.
3. Browse Reddit, X or LinkedIn. It works out of the box on the Free tier (no key). Optional: add your own OpenRouter/TypeSafe key under **API**.

Privacy: see [PRIVACY.md](PRIVACY.md).

## Free tier (shared key)
`server/` is a one-function Vercel project (`feed-control-api.vercel.app`) that holds a shared OpenRouter key so users need none. Defenses, from outermost in:
1. **Vercel Firewall** rate limit: 120 requests/min per IP on `/api/` (blocked requests aren't billed).
2. **Request validation**: only the extension's exact shape (Noul questions, capped counts and sizes); the model is forced to Jev, so the key can't be used for anything else.
3. **Spend cap** on the OpenRouter key itself: the hard ceiling on cost, whatever happens.

Deploy: `cd server && vercel deploy --prod`. The key lives only in the `OPENROUTER_API_KEY` env var.

## Architecture
| File | Role |
|---|---|
| `lib.js` | All business logic, pure: questions, scoring, verdict, `classify()` pipeline, `askJev()` HTTP. Shared by the extension, eval, and dev stub. |
| `settings.js` | Loads/validates settings for the background worker and popup. |
| `background.js` | Glue only: session cache + per-post queue around `classify()`. |
| `content.js` | Per-site DOM adapters (`SITES`) + the blur/reveal UI. Plain script: content scripts can't import modules. |
| `options.*` | Popup / settings page. |

## How it works
- **Facts** are things the page's own markup proves, decided in code with no API call: ads (`shreddit-ad-post` on Reddit, `placementTracking` on X, "Sponsored" labels on LinkedIn) and, on LinkedIn, *Suggested* posts, posts surfaced because your network liked/commented, and *Jobs recommended for you* / *People you may know* modules. Each is a toggle in the popup.
- **Page-level** filters are pure CSS: LinkedIn's sidebar news, Premium upsells and sidebar ad.
- Site-specific DOM reading lives in `SITES` in `content.js`; everything else is shared. X is a virtualized React list, so verdicts are remembered per tweet id and re-applied instantly when a tweet re-mounts.
- Every other post gets one Jev request, with all questions fanned out in it. Each filter is a set of yes/no questions whose answers are combined with weights in code (`lib.js`).
- Custom topics each add one question. Answers are cached per post for the browser session.
- A confident match is collapsed and blurred (or removed, if you choose). Anything below the strictness threshold is left untouched. Click to reveal.

**Privacy:** for each post you scroll past, its text is sent to your chosen provider: on Reddit the title, body (first 1500 chars), subreddit, flair and link domain; on X the author handle, text, quoted tweet text and link-card text. API keys stay in local browser storage and are never synced. The popup shows the same disclosure.

## Dev
- `npm test`: scoring self-check.
- `python3 -m http.server`, then open `/dev/feed.html` (Reddit), `/dev/x.html` (X), `/dev/linkedin.html` (LinkedIn) or `/dev/popup.html` to preview with a fake `chrome` API.

## Site notes
- **LinkedIn** ships hashed class names and no `data-urn`; only `componentkey`, `data-view-name` and `data-testid` are stable. Selectors follow what LinkOff and Slop Mop verified live (Sept 2026). Module/header detection ("Suggested", "likes this", "Jobs recommended for you") matches English copy only.
- `npm run zip`: store-ready package.

## Eval (measure accuracy on real posts)
1. `node eval/fetch.js`: pulls ~120 real posts into `eval/posts.json`.
2. `python3 -m http.server`, open `/eval/label.html`, label each post (keys: `s` slop, `p` promo, `1–4` topics, `Enter` next), then **Export** and save over `eval/posts.json`.
3. `OPENROUTER_API_KEY=... node eval/run.js`: per filter, shows wrongly hidden, missed, and suggested thresholds. Answers are cached in `eval/answers.json`; editing a question in `lib.js` re-asks only that question.

Topics measured: `eval/config.js`.
