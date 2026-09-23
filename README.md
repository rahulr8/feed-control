# Feed Control

Hide AI slop, ads & any topic on Reddit and X. A Chrome extension that blurs promoted posts, AI slop, stealth ads, and any topics you choose from your Reddit and X (Twitter) feeds. Classification uses [TypeSafe's Jev](https://docs.typesafe.ai) model.

## Install
1. `chrome://extensions` → enable Developer mode → **Load unpacked** → this folder.
2. Click the extension icon → **API** → pick a provider (OpenRouter, TypeSafe, or a custom TypeSafe-compatible URL) → paste its key → **Save**.

## Architecture
| File | Role |
|---|---|
| `lib.js` | All business logic, pure: questions, scoring, verdict, `classify()` pipeline, `askJev()` HTTP. Shared by the extension, eval, and dev stub. |
| `settings.js` | Loads/validates settings for the background worker and popup. |
| `background.js` | Glue only: session cache + per-post queue around `classify()`. |
| `content.js` | Per-site DOM adapters (`SITES`) + the blur/reveal UI. Plain script: content scripts can't import modules. |
| `options.*` | Popup / settings page. |

## How it works
- Promoted posts / ads are detected from the site's markup (`shreddit-ad-post` on Reddit, `placementTracking` on X); no API call.
- Site-specific DOM reading lives in `SITES` in `content.js`; everything else is shared. X is a virtualized React list, so verdicts are remembered per tweet id and re-applied instantly when a tweet re-mounts.
- Every other post gets one Jev request, with all questions fanned out in it. Each filter is a set of yes/no questions whose answers are combined with weights in code (`lib.js`).
- Custom topics each add one question. Answers are cached per post for the browser session.
- A confident match is collapsed and blurred; a borderline one is dimmed. Click to reveal.

**Privacy:** the title, body (first 1500 chars), subreddit, flair, and link domain of each post you scroll past are sent to your chosen provider.

## Dev
- `npm test`: scoring self-check.
- `python3 -m http.server`, then open `/dev/feed.html` (Reddit), `/dev/x.html` (X) or `/dev/popup.html` to preview with a fake `chrome` API.
- `npm run zip`: store-ready package.

## Eval (measure accuracy on real posts)
1. `node eval/fetch.js`: pulls ~120 real posts into `eval/posts.json`.
2. `python3 -m http.server`, open `/eval/label.html`, label each post (keys: `s` slop, `p` promo, `1–4` topics, `Enter` next), then **Export** and save over `eval/posts.json`.
3. `OPENROUTER_API_KEY=... node eval/run.js`: per filter, shows wrongly hidden, missed, and suggested thresholds. Answers are cached in `eval/answers.json`; editing a question in `lib.js` re-asks only that question.

Topics measured: `eval/config.js`.
