# Chrome Web Store listing: copy-paste answers

Upload: `npm run zip` → `feed-control.zip`. Images: `store/screenshot-1.png` … `-4.png` (1280×800, 24-bit PNG), `store/promo-tile.png` (440×280), `icons/128.png`. Regenerate after UI changes: `npm run shots` (with `python3 -m http.server 5178` running).

## Store listing tab

**Name:** Feed Control

**Summary** (≤132 chars):
> Hide AI slop, ads & any topic you choose on Reddit, X and LinkedIn. Blurred behind a label, one click to show.

**Category:** Productivity · **Language:** English

**Description:**
> Take back your feed. Feed Control hides the posts you don't want to see on Reddit, X (Twitter) and LinkedIn: blurred behind a small label (one click to show) or removed entirely.
>
> WHAT IT HIDES
> • AI slop: formulaic, low-information, chatbot-written posts
> • Ads & self-promo: promoted posts, undisclosed advertising, "DM me for the link" pitches
> • Any topic you type: "politics", "crypto", "Trump", "sports", "AI-related"… in plain words
> • On LinkedIn: suggested posts, jobs & people recommendations, sidebar news and Premium upsells, and (optionally) posts shown because someone in your network liked them
>
> WHEN UNSURE, IT DOES NOTHING
> Posts are only hidden when the model is confident. Choose Relaxed, Balanced or Strict to decide how confident.
>
> HOW IT WORKS
>
> Posts are classified by Jev, TypeSafe's fast decision model. It works out of the box: no account, no API key, nothing to set up. Promoted posts and LinkedIn modules are detected from the page itself.
>
> PRIVATE BY DESIGN
> No account, no tracking. Post text is only used to classify it and is never stored. Open source: https://github.com/rahulr8/feed-control
>
> SETUP
> Install it, then browse Reddit, X or LinkedIn. That's it. Pin the icon to add topics or change what's hidden.

## Privacy practices tab

**Single purpose:**
> Hide unwanted posts (AI-generated filler, advertising, and user-chosen topics) from Reddit, X and LinkedIn feeds.

**Permission justifications:**
- **storage:** Saves the user's filter settings and topics, and caches classification results for the session.
- **scripting:** After the extension is installed or updated, re-attaches its content script to Reddit/X/LinkedIn tabs that were already open, so filtering works without reloading them.
- **Host permission: reddit.com, x.com, twitter.com, linkedin.com:** Reads post text in the feed and hides matching posts. These are the only sites the extension runs on.
- **Host permission: feed-control-api.vercel.app:** The extension's own server, which classifies post text.

**Remote code:** No, I am not using remote code.

**Data usage:** tick **Website content** (post text is sent to the classification service to classify it; not stored). Certify all three: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://github.com/rahulr8/feed-control/blob/main/PRIVACY.md

## Distribution tab

**Visibility:** Unlisted (share the store link with friends), or Public later.
